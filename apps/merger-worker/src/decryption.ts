import * as fs from "node:fs/promises";
import * as path from "node:path";
import { constants, createDecipheriv, createPrivateKey, privateDecrypt, type KeyObject } from "node:crypto";
import { prisma } from "@repo/db/client";
import { type UserChunk } from "./types";
import { getRedisClient } from "./redis";

const userCekCache = new Map<string, Buffer>();

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

export async function getWrappedMeetingCek(meetingId: string, participantId: string): Promise<Buffer> {
    const redisClient = getRedisClient();
    const record = await redisClient.hgetall(getWrappedCekKey(meetingId, participantId));

    if (!record?.wrappedCek) {
        throw new Error(`Wrapped CEK not found for participant ${participantId}`);
    }

    const parsed = JSON.parse(record.wrappedCek) as number[];
    return Buffer.from(parsed);
}

function getCekCacheKey(meetingId: string, participantId: string): string {
    return `${meetingId}:${participantId}`;
}

export async function unwrapMeetingCek(meetingId: string, participantId: string): Promise<Buffer> {
    const cacheKey = getCekCacheKey(meetingId, participantId);
    const cachedCek = userCekCache.get(cacheKey);
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
        wrappedCek
    );

    userCekCache.set(cacheKey, unwrappedCek);
    return unwrappedCek;
}

function decryptEncryptedChunk(ciphertext: Buffer, cek: Buffer, ivBase64: string, tagBits: number | null): Buffer {
    const iv = Buffer.from(ivBase64, "base64");
    const authTagBytes = Math.max(16, Math.floor((tagBits ?? 128) / 8));

    if (ciphertext.length <= authTagBytes) {
        throw new Error("Encrypted chunk is too small to contain an auth tag");
    }

    const encryptedBody = ciphertext.subarray(0, ciphertext.length - authTagBytes);
    const authTag = ciphertext.subarray(ciphertext.length - authTagBytes);
    const decipher = createDecipheriv("aes-256-gcm", cek, iv);

    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedBody), decipher.final()]);
}

export async function decryptChunkToTempFile(
    chunk: UserChunk,
    meetingId: string,
    tempDir: string
): Promise<string> {
    if (!chunk.metadata?.isEncrypted) {
        return chunk.localPath;
    }

    if (chunk.metadata.encryptionAlgorithm !== "AES-GCM") {
        throw new Error(`Unsupported chunk encryption algorithm: ${chunk.metadata.encryptionAlgorithm || "unknown"}`);
    }

    if (!chunk.metadata.encryptionIv) {
        throw new Error(`Missing encryption IV for chunk ${chunk.localPath}`);
    }

    const wrappedCek = await unwrapMeetingCek(meetingId, chunk.userId);
    const ciphertext = await fs.readFile(chunk.localPath);
    const plaintext = decryptEncryptedChunk(
        ciphertext,
        wrappedCek,
        chunk.metadata.encryptionIv,
        chunk.metadata.encryptionTagBits
    );

    const decryptedDir = path.join(tempDir, "decrypted", chunk.userId);
    await fs.mkdir(decryptedDir, { recursive: true });

    const sourceExtension = mimeTypeToExtension(chunk.metadata.sourceMimeType);
    const decryptedPath = path.join(
        decryptedDir,
        `${path.basename(chunk.localPath, path.extname(chunk.localPath))}.decrypted.${sourceExtension}`
    );

    await fs.writeFile(decryptedPath, plaintext);
    return decryptedPath;
}

export async function decryptUserChunks(
    chunks: UserChunk[],
    meetingId: string,
    tempDir: string
): Promise<UserChunk[]> {
    const encryptedChunks = chunks.filter((chunk) => chunk.metadata?.isEncrypted);
    
    if (encryptedChunks.length === 0) {
        return chunks;
    }

    const decryptedChunks: UserChunk[] = [];
    
    for (const chunk of chunks) {
        if (chunk.metadata?.isEncrypted) {
            const decryptedPath = await decryptChunkToTempFile(chunk, meetingId, tempDir);
            decryptedChunks.push({
                ...chunk,
                localPath: decryptedPath,
            });
        } else {
            decryptedChunks.push(chunk);
        }
    }

    return decryptedChunks;
}