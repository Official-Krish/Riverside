import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import {
  toPublicRecordingLink as toPublicS3Url,
  extractS3Key,
} from "./storage";

const environment = process.env.NODE_ENV || "development";

export const recordingsRoot =
  environment === "production"
    ? "/app/recordings"
    : path.resolve(process.cwd(), "../../recordings");

export function toLocalRecordingPath(value: string) {
  if (!value) {
    return value;
  }

  if (value.startsWith("/api/v1/recordings/")) {
    return value.replace("/api/v1/recordings/", "");
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const key = extractS3Key(value);
    return key ?? value;
  }

  if (path.isAbsolute(value)) {
    return value;
  }

  if (value.includes("/")) {
    return value.replace(/\\/g, "/");
  }

  return path.join(recordingsRoot, value);
}

export function toPublicRecordingLink(localPath: string) {
  return toPublicS3Url(localPath);
}

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function runBinary(binary: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const processRef = spawn(binary, args);
    let stderr = "";

    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${binary} exited with code ${code}: ${stderr}`));
    });

    processRef.on("error", (error) => {
      reject(error);
    });
  });
}
