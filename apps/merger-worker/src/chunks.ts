import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
    getObjectBytesFromS3,
    listObjectKeysByPrefix,
} from "@repo/amazons3";
import { type UserChunk } from "./types";
import { resolveStorageContext } from "@repo/amazons3";
import { decryptUserChunks } from "./decryption";
import { prisma } from "@repo/db/client";

export function parseChunkTimestamp(filename: string): number | null {
    const match = filename.match(/chunk-(?:\d+-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\./);
    if (!match || !match[1]) {
        return null;
    }
    const raw = match[1];
    const [datePart, timePart] = raw.split("T");
    if (!datePart || !timePart) {
        return null;
    }
    const timeMs = timePart.replace(/^(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "$1:$2:$3.$4Z");
    const isoString = `${datePart}T${timeMs}`;
    const timestamp = new Date(isoString).getTime();
    return isNaN(timestamp) ? null : timestamp;
}

export async function collectUserChunks(
    meetingId: string,
    tempDir: string,
    s3Client: ReturnType<typeof resolveStorageContext>["s3Client"],
    bucketName: string
): Promise<Map<string, UserChunk[]>> {
    const prefix = `weave-recordings/${meetingId}/raw/users/`;
    const chunkCacheRoot = path.join(tempDir, "chunks");
    const userChunks = new Map<string, UserChunk[]>();
    const storage = resolveStorageContext();

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

    let metadataByPath: Map<string, { isEncrypted: boolean; sourceMimeType: string | null; encryptionAlgorithm: string | null; encryptionIv: string | null; encryptionTagBits: number | null }> = new Map();

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
            },
        });

        metadataByPath = new Map(
            mediaChunks.map((record) => [
                record.bucketLink,
                {
                    isEncrypted: record.isEncrypted,
                    sourceMimeType: record.sourceMimeType,
                    encryptionAlgorithm: record.encryptionAlgorithm,
                    encryptionIv: record.encryptionIv,
                    encryptionTagBits: record.encryptionTagBits,
                },
            ])
        );
    }

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
        const bytes = await getObjectBytesFromS3({
            s3Client,
            bucketName,
            key,
        });
        if (!bytes) {
            continue;
        }

        await fs.writeFile(localPath, bytes);

        const metadata = metadataByPath.get(key);
        const parsedTimestamp = parseChunkTimestamp(fileName) ?? 0;

        const item: UserChunk = {
            userId,
            localPath,
            timestamp: parsedTimestamp,
            hasValidTimestamp: parsedTimestamp !== null,
            metadata: metadata
                ? {
                    isEncrypted: metadata.isEncrypted,
                    sourceMimeType: metadata.sourceMimeType,
                    encryptionAlgorithm: metadata.encryptionAlgorithm,
                    encryptionIv: metadata.encryptionIv,
                    encryptionTagBits: metadata.encryptionTagBits,
                }
                : null,
        };

        const existing = userChunks.get(userId) || [];
        existing.push(item);
        userChunks.set(userId, existing);
    }

    if (userChunks.size === 0) {
        throw new Error(`No chunk objects found in s3://${bucketName}/${prefix}`);
    }

    for (const [userId, chunks] of userChunks.entries()) {
        const validChunks = chunks.filter(c => c.hasValidTimestamp);
        const baseTimestamp = validChunks.length > 0
            ? Math.min(...validChunks.map(c => c.timestamp))
            : Date.now();

        let fallbackIndex = 0;
        for (const chunk of chunks) {
            if (!chunk.hasValidTimestamp) {
                chunk.timestamp = baseTimestamp + (fallbackIndex * 5000);
                chunk.hasValidTimestamp = true;
                fallbackIndex++;
            }
        }

        chunks.sort((a, b) => a.timestamp - b.timestamp);
        
        const decryptedChunks = await decryptUserChunks(chunks, meetingId, tempDir);
        userChunks.set(userId, decryptedChunks);
    }

    return userChunks;
}