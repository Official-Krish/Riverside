import {
  keyToCdnUrl as sharedKeyToCdnUrl,
  putObjectToS3 as sharedPutObjectToS3,
  resolveStorageContext,
  tryExtractS3Key as sharedTryExtractS3Key,
  normalizeS3Key,
} from "@repo/amazons3";

const storage = resolveStorageContext();

export function getBucketName() {
  return storage.bucketName;
}

export function getCdnBaseUrl() {
  return storage.cdnBaseUrl;
}

export function keyToCdnUrl(key: string) {
  return sharedKeyToCdnUrl(key, getCdnBaseUrl());
}

export function tryExtractS3Key(value: string | null | undefined): string | null {
  return sharedTryExtractS3Key(value);
}

export function toPublicRecordingLink(value: string) {
  const key = tryExtractS3Key(value);
  return key ? keyToCdnUrl(key) : value;
}

export async function putObjectToS3(params: {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
}) {
  await sharedPutObjectToS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key: normalizeS3Key(params.key),
    body: params.body,
    contentType: params.contentType,
  });
}