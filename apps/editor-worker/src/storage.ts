import * as fs from "node:fs/promises";
import * as path from "node:path";
import crypto from "node:crypto";
import {
  deletePrefixFromS3 as sharedDeletePrefixFromS3,
  getObjectBytesFromS3,
  keyToCdnUrl as sharedKeyToCdnUrl,
  normalizeS3Key as sharedNormalizeS3Key,
  putObjectToS3,
  resolveStorageContext,
  tryExtractS3Key as sharedTryExtractS3Key,
} from "@repo/amazons3";

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

  const bytes = await getObjectBytesFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key,
  });
  if (!bytes) {
    throw new Error(`S3 object ${key} is empty or unavailable`);
  }

  await fs.writeFile(localPath, bytes);
  return localPath;
}

export async function uploadLocalFileToS3(localPath: string, key: string, contentType?: string) {
  const body = await fs.readFile(localPath);
  await putObjectToS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key: normalizeS3Key(key),
    body,
    contentType,
  });
}

export async function deleteS3Prefix(prefix: string) {
  await sharedDeletePrefixFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    prefix: normalizeS3Key(prefix),
  });
}
