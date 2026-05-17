import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import crypto from "node:crypto";
import {
  deletePrefixFromS3 as sharedDeletePrefixFromS3,
  deleteObjectFromS3 as sharedDeleteObjectFromS3,
  keyToCdnUrl as sharedKeyToCdnUrl,
  normalizeS3Key as sharedNormalizeS3Key,
  putObjectToS3,
  resolveStorageContext,
  tryExtractS3Key as sharedTryExtractS3Key,
} from "@repo/amazons3";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const storage = resolveStorageContext();

export function normalizeS3Key(value: string) {
  return sharedNormalizeS3Key(value);
}

export function getCdnBaseUrl() {
  return storage.cdnBaseUrl;
}

export function keyToCdnUrl(key: string) {
  return sharedKeyToCdnUrl(key, getCdnBaseUrl());
}

export function toPublicRecordingLink(value: string) {
  const key = extractS3Key(value);
  return key ? keyToCdnUrl(key) : value;
}

export function extractS3Key(value: string | null | undefined): string | null {
  return sharedTryExtractS3Key(value);
}

/**
 * Download an S3 object to a local file using streaming (constant memory).
 * Falls back to getObjectBytesFromS3 if the response body is not a stream.
 */
async function streamS3ToLocal(key: string, localPath: string): Promise<void> {
  const normalizedKey = normalizeS3Key(key);
  const response = await storage.s3Client.send(
    new GetObjectCommand({
      Bucket: storage.bucketName,
      Key: normalizedKey,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`S3 object ${normalizedKey} has empty body`);
  }

  // AWS SDK v3 Body is a Readable in Node.js
  if (typeof (body as any).pipe === "function") {
    await pipeline(body as Readable, createWriteStream(localPath));
  } else if (typeof (body as any).transformToByteArray === "function") {
    // Fallback for non-streaming environments
    const bytes = await (body as any).transformToByteArray();
    await fs.writeFile(localPath, Buffer.from(bytes));
  } else {
    throw new Error(
      `Unexpected S3 response body type for key ${normalizedKey}`,
    );
  }
}

export async function downloadSourceToLocal(source: string, targetDir: string) {
  if (path.isAbsolute(source)) {
    return source;
  }

  const key = extractS3Key(source);
  if (!key) {
    return source;
  }

  await fs.mkdir(targetDir, { recursive: true });
  const extension = path.extname(key) || ".bin";
  const safeName = `${crypto.createHash("sha1").update(key).digest("hex")}${extension}`;
  const localPath = path.join(targetDir, safeName);

  try {
    await fs.access(localPath);
    return localPath;
  } catch {
    // Not cached yet.
  }

  // Stream directly to disk — avoids holding entire file in RAM
  await streamS3ToLocal(key, localPath);
  return localPath;
}

export async function uploadLocalFileToS3(
  localPath: string,
  key: string,
  contentType?: string,
) {
  const body = await fs.readFile(localPath);
  await putObjectToS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key: normalizeS3Key(key),
    body,
    contentType,
  });
}

/**
 * Check the size of an S3 object without downloading it.
 * Returns the ContentLength in bytes, or null if the object doesn't exist.
 */
export async function getS3ObjectSize(key: string): Promise<number | null> {
  try {
    const response = await storage.s3Client.send(
      new HeadObjectCommand({
        Bucket: storage.bucketName,
        Key: normalizeS3Key(key),
      }),
    );
    return response.ContentLength ?? null;
  } catch {
    return null;
  }
}

export async function deleteObjectFromS3(key: string) {
  await sharedDeleteObjectFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key: normalizeS3Key(key),
  });
}

export async function deleteS3Prefix(prefix: string) {
  await sharedDeletePrefixFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    prefix: normalizeS3Key(prefix),
  });
}
