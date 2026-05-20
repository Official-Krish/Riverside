import * as fs from "node:fs/promises";
import * as path from "node:path";
import { deletePrefixFromS3 } from "@repo/amazons3";
import { resolveStorageContext } from "@repo/amazons3";

export async function cleanupTempDir(
  tempDir: string,
  log: (message: string) => void,
): Promise<void> {
  const startTime = Date.now();
  const label = `cleanup[${tempDir}]`;

  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`[${label}] Cleanup error after ${elapsed}ms: ${errorMsg}`);
  }
}

export async function cleanupSourceChunksFromS3(
  meetingId: string,
  s3Client: ReturnType<typeof resolveStorageContext>["s3Client"],
  bucketName: string,
): Promise<void> {
  const prefix = `weave-recordings/${meetingId}/raw/users/`;
  await deletePrefixFromS3({
    s3Client,
    bucketName,
    prefix,
  });
}

export async function cleanupLegacyLocalChunks(
  recordingsRoot: string,
  meetingId: string,
): Promise<void> {
  const rawDir = path.join(recordingsRoot, meetingId, "raw");
  await fs.rm(rawDir, { recursive: true, force: true }).catch(() => undefined);
}

export async function cleanupLegacyRecordingsTmp(
  recordingsRoot: string,
  currentTempDir: string,
  log: (message: string) => void,
): Promise<void> {
  const tmpBaseDir = path.join(recordingsRoot, "tmp");

  try {
    const entries = await fs.readdir(tmpBaseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("media_merge_")) {
        const fullPath = path.join(tmpBaseDir, entry.name);
        if (fullPath === currentTempDir) continue;
        await fs
          .rm(fullPath, { recursive: true, force: true })
          .catch(() => undefined);
      }
    }
  } catch (error) {
    console.error(
      `[cleanupLegacyRecordingsTmp] Error cleaning up legacy tmp directories: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
