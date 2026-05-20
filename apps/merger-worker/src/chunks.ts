import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { listObjectKeysByPrefix, resolveStorageContext } from "@repo/amazons3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { type UserChunk } from "./types";
import { decryptUserChunks } from "./decryption";
import { sortChunksByTimeline } from "./timeline";
import { prisma } from "@repo/db/client";

export type CollectedChunksResult = {
  userChunks: Map<string, UserChunk[]>;
  recordingStartedAtMs: number | null;
};

const DOWNLOAD_CONCURRENCY = 4;

/**
 * Stream an S3 object directly to a local file (constant memory).
 * Falls back to getObjectBytesFromS3 if the body is not a stream.
 */
async function streamS3ToLocal(
  s3Client: ReturnType<typeof resolveStorageContext>["s3Client"],
  bucketName: string,
  key: string,
  localPath: string,
): Promise<boolean> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key }),
  );

  const body = response.Body;
  if (!body) {
    return false;
  }

  if (typeof (body as any).pipe === "function") {
    await pipeline(body as Readable, createWriteStream(localPath));
  } else if (typeof (body as any).transformToByteArray === "function") {
    const bytes = await (body as any).transformToByteArray();
    if (!bytes || bytes.length === 0) return false;
    await fs.writeFile(localPath, Buffer.from(bytes));
  } else {
    return false;
  }
  return true;
}

export function parseChunkSequenceNumber(filename: string): number | null {
  const match = filename.match(/chunk-(\d+)-/);
  if (!match?.[1]) {
    return null;
  }
  const sequence = Number.parseInt(match[1], 10);
  return Number.isNaN(sequence) ? null : sequence;
}

export function parseChunkTimestamp(filename: string): number | null {
  const match = filename.match(
    /chunk-(?:\d+-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\./,
  );
  if (!match || !match[1]) {
    return null;
  }
  const raw = match[1];
  const [datePart, timePart] = raw.split("T");
  if (!datePart || !timePart) {
    return null;
  }
  const timeMs = timePart.replace(
    /^(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1:$2:$3.$4Z",
  );
  const isoString = `${datePart}T${timeMs}`;
  const timestamp = new Date(isoString).getTime();
  return isNaN(timestamp) ? null : timestamp;
}

export async function collectUserChunks(
  meetingId: string,
  tempDir: string,
  s3Client: ReturnType<typeof resolveStorageContext>["s3Client"],
  bucketName: string,
): Promise<CollectedChunksResult> {
  const prefix = `weave-recordings/${meetingId}/raw/users/`;
  const chunkCacheRoot = path.join(tempDir, "chunks");
  const userChunks = new Map<string, UserChunk[]>();

  const keys = await listObjectKeysByPrefix({
    s3Client,
    bucketName,
    prefix,
    keyFilter: (key) => /chunk-.*\.(webm|mp4|ogg)$/i.test(key),
  });

  const meetingRecord = await prisma.meeting.findUnique({
    where: { roomId: meetingId },
    select: { id: true },
  });

  let metadataByPath: Map<
    string,
    {
      isEncrypted: boolean;
      sourceMimeType: string | null;
      encryptionAlgorithm: string | null;
      encryptionIv: string | null;
      encryptionTagBits: number | null;
      durationMs: number | null;
      startedAt: Date | null;
    }
  > = new Map();

  if (meetingRecord) {
    const mediaChunks = await prisma.mediaChunk.findMany({
      where: { meetingId: meetingRecord.id },
      select: {
        bucketLink: true,
        isEncrypted: true,
        sourceMimeType: true,
        encryptionAlgorithm: true,
        encryptionIv: true,
        encryptionTagBits: true,
        durationMs: true,
        startedAt: true,
      },
    });

    metadataByPath = new Map(
      mediaChunks.map((record: (typeof mediaChunks)[number]) => [
        record.bucketLink,
        {
          isEncrypted: record.isEncrypted,
          sourceMimeType: record.sourceMimeType,
          encryptionAlgorithm: record.encryptionAlgorithm,
          encryptionIv: record.encryptionIv,
          encryptionTagBits: record.encryptionTagBits,
          durationMs: record.durationMs,
          startedAt: record.startedAt,
        },
      ]),
    );
  }

  let recordingStartedAtMs: number | null = null;
  if (meetingRecord) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingRecord.id },
      select: { recordingStartedAt: true },
    });
    if (meeting?.recordingStartedAt) {
      recordingStartedAtMs = meeting.recordingStartedAt.getTime();
    }
  }

  // Prepare download tasks
  const downloadTasks: Array<{
    key: string;
    userId: string;
    localPath: string;
    metadata: typeof metadataByPath extends Map<string, infer V> ? V : never;
  } | null> = [];

  for (const key of keys) {
    const relativeKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
    const pathParts = relativeKey.split("/").filter(Boolean);
    if (pathParts.length < 2) {
      continue;
    }

    const userId = pathParts[0]!;
    const fileName = pathParts[pathParts.length - 1]!;
    const userLocalDir = path.join(chunkCacheRoot, userId);
    await fs.mkdir(userLocalDir, { recursive: true });

    const localPath = path.join(userLocalDir, fileName);
    const metadata = metadataByPath.get(key);
    downloadTasks.push({
      key,
      userId,
      localPath,
      metadata: metadata ?? (null as any),
    });
  }

  // Download chunks with controlled concurrency — stream to disk, not RAM
  let taskIndex = 0;
  const concurrency = Math.min(DOWNLOAD_CONCURRENCY, downloadTasks.length);

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (taskIndex < downloadTasks.length) {
        const idx = taskIndex++;
        const task = downloadTasks[idx];
        if (!task) continue;

        const ok = await streamS3ToLocal(
          s3Client,
          bucketName,
          task.key,
          task.localPath,
        );
        if (!ok) continue;

        const fileName = path.basename(task.localPath);
        const parsedTimestamp = parseChunkTimestamp(fileName);
        const parsedSequence = parseChunkSequenceNumber(fileName);
        const dbStartedAtMs = task.metadata?.startedAt
          ? task.metadata.startedAt.getTime()
          : null;
        const resolvedTimestamp = dbStartedAtMs ?? parsedTimestamp;

        const item: UserChunk = {
          userId: task.userId,
          localPath: task.localPath,
          timestamp: resolvedTimestamp ?? 0,
          durationSeconds: Math.max(
            0.1,
            (task.metadata?.durationMs ?? 10000) / 1000,
          ),
          sequenceNumber: parsedSequence,
          hasValidTimestamp:
            dbStartedAtMs !== null ||
            (parsedTimestamp !== null && !Number.isNaN(parsedTimestamp)),
          metadata: task.metadata
            ? {
                isEncrypted: task.metadata.isEncrypted,
                sourceMimeType: task.metadata.sourceMimeType,
                encryptionAlgorithm: task.metadata.encryptionAlgorithm,
                encryptionIv: task.metadata.encryptionIv,
                encryptionTagBits: task.metadata.encryptionTagBits,
              }
            : null,
        };

        const existing = userChunks.get(task.userId) || [];
        existing.push(item);
        userChunks.set(task.userId, existing);
      }
    }),
  );

  if (userChunks.size === 0) {
    throw new Error(`No chunk objects found in s3://${bucketName}/${prefix}`);
  }

  for (const [userId, chunks] of userChunks.entries()) {
    const validChunks = chunks.filter((c) => c.hasValidTimestamp);
    const baseTimestamp =
      validChunks.length > 0
        ? Math.min(...validChunks.map((c) => c.timestamp))
        : Date.now();

    let fallbackIndex = 0;
    for (const chunk of chunks) {
      if (!chunk.hasValidTimestamp) {
        chunk.timestamp =
          baseTimestamp +
          fallbackIndex * Math.round(chunk.durationSeconds * 1000);
        chunk.hasValidTimestamp = true;
        fallbackIndex++;
      }
    }

    const decryptedChunks = await decryptUserChunks(
      sortChunksByTimeline(chunks),
      meetingId,
      tempDir,
    );
    const sorted = sortChunksByTimeline(decryptedChunks);
    const chunksWithRealDuration = sorted.map((chunk, i) => {
      const nextChunk = sorted[i + 1];
      if (nextChunk && nextChunk.hasValidTimestamp && chunk.hasValidTimestamp) {
        const deltaMs = nextChunk.timestamp - chunk.timestamp;
        if (deltaMs > 500 && deltaMs < 120_000) {
          return { ...chunk, durationSeconds: deltaMs / 1000 };
        }
      }

      const rawDurationMs = chunk.durationSeconds * 1000;
      return {
        ...chunk,
        durationSeconds: rawDurationMs > 500 ? rawDurationMs / 1000 : 10.0,
      };
    });
    userChunks.set(userId, sortChunksByTimeline(chunksWithRealDuration));
  }

  return { userChunks, recordingStartedAtMs };
}
