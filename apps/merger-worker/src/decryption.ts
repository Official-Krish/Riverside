import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  constants,
  createDecipheriv,
  createPrivateKey,
  privateDecrypt,
  type KeyObject,
} from "node:crypto";
import { prisma } from "@repo/db/client";
import { type UserChunk } from "./types";
import { getRedisClient } from "./redis";

const WEBM_EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const WEBM_CLUSTER_MAGIC = Buffer.from([0x1f, 0x43, 0xb6, 0x75]);
const MIN_WEBM_INIT_SEGMENT_BYTES = 300;
const MIN_ENCRYPTED_BYTES = 32;
const MIN_DECRYPTED_BYTES = 256;

const userCekCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CEK_CACHE_TTL_MS = 30 * 60 * 1000;
const webmInitSegmentCache = new Map<string, Buffer>();

function evictExpiredCekEntries(): void {
  const now = Date.now();
  for (const [key, entry] of userCekCache.entries()) {
    if (now - entry.timestamp > CEK_CACHE_TTL_MS) {
      userCekCache.delete(key);
    }
  }
}

function getCekFromCache(cacheKey: string): Buffer | null {
  evictExpiredCekEntries();
  const entry = userCekCache.get(cacheKey);
  return entry ? entry.buffer : null;
}

function setCekToCache(cacheKey: string, buffer: Buffer): void {
  evictExpiredCekEntries();
  userCekCache.set(cacheKey, { buffer, timestamp: Date.now() });
}

function getWrappedCekKey(meetingId: string, participantId: string): string {
  return `meeting:wrapped-cek:${meetingId}:${participantId}`;
}

function mimeTypeToExtension(mimeType?: string | null): string {
  if (!mimeType) {
    return "webm";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("webm")) {
    return "webm";
  }

  return "webm";
}

function hasWebmHeader(buffer: Buffer): boolean {
  return (
    buffer.length >= WEBM_EBML_MAGIC.length &&
    buffer.subarray(0, WEBM_EBML_MAGIC.length).equals(WEBM_EBML_MAGIC)
  );
}

function findWebmClusterOffset(buffer: Buffer): number {
  let searchFrom = MIN_WEBM_INIT_SEGMENT_BYTES;

  while (searchFrom < buffer.length - 8) {
    const clusterIndex = buffer.indexOf(WEBM_CLUSTER_MAGIC, searchFrom);
    if (clusterIndex < 0) {
      return -1;
    }

    const sizeFirstByte = buffer[clusterIndex + 4];
    if (sizeFirstByte === undefined) {
      searchFrom = clusterIndex + 1;
      continue;
    }

    if (sizeFirstByte >= 0x80) {
      searchFrom = clusterIndex + 1;
      continue;
    }

    return clusterIndex;
  }

  return -1;
}

function extractWebmInitSegment(buffer: Buffer): Buffer | null {
  const clusterIndex = findWebmClusterOffset(buffer);

  if (clusterIndex <= 0) {
    return null;
  }

  return buffer.subarray(0, clusterIndex);
}

function getWebmInitSegmentKey(meetingId: string, userId: string): string {
  return `${meetingId}:${userId}`;
}

function getCachedWebmInitSegment(
  meetingId: string,
  userId: string,
): Buffer | null {
  return (
    webmInitSegmentCache.get(getWebmInitSegmentKey(meetingId, userId)) ?? null
  );
}

function cacheWebmInitSegment(
  meetingId: string,
  userId: string,
  initSegment: Buffer,
): void {
  webmInitSegmentCache.set(
    getWebmInitSegmentKey(meetingId, userId),
    initSegment,
  );
}

function shouldDecryptChunk(chunk: UserChunk): boolean {
  const metadata = chunk.metadata;

  if (metadata?.isEncrypted) {
    return true;
  }

  return (
    metadata?.encryptionAlgorithm?.toUpperCase() === "AES-GCM" ||
    Boolean(metadata?.encryptionIv) ||
    Boolean(metadata?.encryptionTagBits)
  );
}

let serverPrivateKeyCache: KeyObject | null = null;

export async function getServerPrivateKey(): Promise<KeyObject> {
  if (serverPrivateKeyCache) {
    return serverPrivateKeyCache;
  }

  const keyPair = await prisma.serverKeyPair.findUnique({
    where: { id: "singleton" },
    select: { privateKeyPem: true },
  });

  if (!keyPair) {
    throw new Error("Server keypair not found in database");
  }

  serverPrivateKeyCache = createPrivateKey(keyPair.privateKeyPem);
  return serverPrivateKeyCache;
}

export async function getWrappedMeetingCek(
  meetingId: string,
  participantId: string,
): Promise<Buffer> {
  const redisClient = getRedisClient();
  const cekKey = getWrappedCekKey(meetingId, participantId);

  const record = await redisClient.hgetall(cekKey);

  if (!record?.wrappedCek) {
    throw new Error(`Wrapped CEK not found for participant ${participantId}`);
  }

  const parsed = JSON.parse(record.wrappedCek) as number[];
  return Buffer.from(parsed);
}

function getCekCacheKey(meetingId: string, participantId: string): string {
  return `${meetingId}:${participantId}`;
}

export async function unwrapMeetingCek(
  meetingId: string,
  participantId: string,
): Promise<Buffer> {
  const cacheKey = getCekCacheKey(meetingId, participantId);
  const cachedCek = getCekFromCache(cacheKey);
  if (cachedCek) {
    return cachedCek;
  }

  const wrappedCek = await getWrappedMeetingCek(meetingId, participantId);
  const privateKey = await getServerPrivateKey();

  const unwrappedCek = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    wrappedCek,
  );

  if (unwrappedCek.length !== 32) {
    throw new Error(
      `Unwrapped CEK has invalid length ${unwrappedCek.length} for participant ${participantId}`,
    );
  }

  setCekToCache(cacheKey, unwrappedCek);
  return unwrappedCek;
}

/**
 * Web Crypto AES-GCM appends the 16-byte auth tag to ciphertext.
 * Node expects ciphertext and tag separately via setAuthTag().
 */
function decryptEncryptedChunk(
  ciphertext: Buffer,
  cek: Buffer,
  ivBase64: string,
  tagBits: number | null,
): Buffer {
  const iv = Buffer.from(ivBase64, "base64");
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length ${iv.length} (expected 12 bytes)`);
  }

  const authTagBytes = Math.max(16, Math.floor((tagBits ?? 128) / 8));

  if (ciphertext.length <= authTagBytes) {
    throw new Error(
      `Encrypted chunk too small (${ciphertext.length} bytes) to contain ciphertext + auth tag`,
    );
  }

  const encryptedBody = ciphertext.subarray(
    0,
    ciphertext.length - authTagBytes,
  );
  const authTag = ciphertext.subarray(ciphertext.length - authTagBytes);

  const decipher = createDecipheriv("aes-256-gcm", cek, iv, {
    authTagLength: authTagBytes,
  });
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final(),
  ]);

  if (plaintext.length < MIN_DECRYPTED_BYTES) {
    throw new Error(
      `Decrypted chunk too small (${plaintext.length} bytes) — likely wrong CEK or corrupt upload`,
    );
  }

  return plaintext;
}

export async function decryptChunkToTempFile(
  chunk: UserChunk,
  meetingId: string,
  tempDir: string,
): Promise<string> {
  const metadata = chunk.metadata;

  if (!shouldDecryptChunk(chunk)) {
    const raw = await fs.readFile(chunk.localPath);
    if (!hasWebmHeader(raw)) {
      throw new Error(
        `Unencrypted chunk is not valid WebM: ${chunk.localPath}`,
      );
    }
    return chunk.localPath;
  }

  if (!metadata) {
    throw new Error(`Missing encryption metadata for chunk ${chunk.localPath}`);
  }

  if (metadata.encryptionAlgorithm !== "AES-GCM") {
    throw new Error(
      `Unsupported chunk encryption algorithm: ${metadata.encryptionAlgorithm || "unknown"}`,
    );
  }

  if (!metadata.encryptionIv) {
    throw new Error(`Missing encryption IV for chunk ${chunk.localPath}`);
  }

  if (!metadata.encryptionTagBits) {
    throw new Error(`Missing encryption tag bits for chunk ${chunk.localPath}`);
  }

  const ciphertext = await fs.readFile(chunk.localPath);

  if (hasWebmHeader(ciphertext)) {
    return chunk.localPath;
  }

  if (ciphertext.length < MIN_ENCRYPTED_BYTES) {
    throw new Error(
      `Encrypted chunk file too small (${ciphertext.length} bytes): ${chunk.localPath}`,
    );
  }

  const cek = await unwrapMeetingCek(meetingId, chunk.userId);

  let plaintext: Buffer;
  try {
    plaintext = decryptEncryptedChunk(
      ciphertext,
      cek,
      metadata.encryptionIv,
      metadata.encryptionTagBits,
    );
  } catch (error) {
    throw new Error(
      `Decrypt failed for ${path.basename(chunk.localPath)} (user=${chunk.userId}, seq=${chunk.sequenceNumber ?? "?"}, cipherBytes=${ciphertext.length}): ${error instanceof Error ? error.message : error}`,
    );
  }

  const cachedInitSegment = getCachedWebmInitSegment(meetingId, chunk.userId);
  const hasHeader = hasWebmHeader(plaintext);

  if (hasHeader) {
    const initSegment = extractWebmInitSegment(plaintext);
    if (initSegment && initSegment.length > 0) {
      cacheWebmInitSegment(meetingId, chunk.userId, initSegment);
    }
  } else if (cachedInitSegment) {
    plaintext = Buffer.concat([cachedInitSegment, plaintext]);
  } else {
    console.error(
      `[decrypt] No cached WebM init segment available for ${path.basename(chunk.localPath)}; continuing with decrypted payload as-is`,
    );
  }

  const decryptedDir = path.join(tempDir, "decrypted", chunk.userId);
  await fs.mkdir(decryptedDir, { recursive: true });

  const sourceExtension = mimeTypeToExtension(metadata.sourceMimeType);
  const decryptedPath = path.join(
    decryptedDir,
    `${path.basename(chunk.localPath, path.extname(chunk.localPath))}.decrypted.${sourceExtension}`,
  );

  await fs.writeFile(decryptedPath, plaintext);
  return decryptedPath;
}

export async function decryptUserChunks(
  chunks: UserChunk[],
  meetingId: string,
  tempDir: string,
): Promise<UserChunk[]> {
  const encryptedChunks = chunks.filter((chunk) => shouldDecryptChunk(chunk));

  if (encryptedChunks.length === 0) {
    return chunks;
  }

  const decryptedChunks: UserChunk[] = [];
  const failedEncryptedChunks: Array<{
    userId: string;
    localPath: string;
    reason: string;
  }> = [];

  for (const chunk of chunks) {
    if (!shouldDecryptChunk(chunk)) {
      decryptedChunks.push(chunk);
      continue;
    }

    try {
      const decryptedPath = await decryptChunkToTempFile(
        chunk,
        meetingId,
        tempDir,
      );
      decryptedChunks.push({
        ...chunk,
        localPath: decryptedPath,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failedEncryptedChunks.push({
        userId: chunk.userId,
        localPath: chunk.localPath,
        reason,
      });
    }
  }

  if (failedEncryptedChunks.length > 0) {
    const failedSummary = failedEncryptedChunks
      .map(
        (chunk) =>
          `${chunk.userId}/${path.basename(chunk.localPath)}: ${chunk.reason}`,
      )
      .join("; ");

    throw new Error(
      `One or more encrypted chunks failed to decrypt for meeting ${meetingId}: ${failedSummary}`,
    );
  }

  return decryptedChunks;
}
