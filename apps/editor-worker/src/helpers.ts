import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { toPublicRecordingLink as toPublicS3Url } from "./storage";

export const recordingsRoot = path.resolve(process.cwd(), "../../recordings");

export function toLocalRecordingPath(value: string) {
  if (!value) {
    return value;
  }

  if (value.startsWith("/api/v1/recordings/")) {
    return value.replace("/api/v1/recordings/", "");
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
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

export function buildOverlayFilter(overlays: any[]) {
  if (!overlays?.length) return null;

  const filters = overlays.map((o) => {
    const text = (o.content?.text || "")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'")
      .replace(/,/g, "\\,");

    const start = (o.timelineStartMs / 1000).toFixed(2);
    const end = ((o.timelineStartMs + o.durationMs) / 1000).toFixed(2);

    return `drawtext=text='${text}':x=${o.transform?.x || 100}:y=${o.transform?.y || 100}:fontsize=24:fontcolor=white:enable='between(t,${start},${end})'`;
  });

  return filters.join(",");
}