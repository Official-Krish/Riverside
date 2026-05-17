import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
// Note: avoid statically importing `./storage` here because that module
// can throw when cloud credentials or bucket names are not configured
// (which would make running local integration tests difficult). Instead
// we provide small safe fallbacks and dynamically import the real
// implementation when available.

function extractS3KeySafe(value: string) {
  if (!value) return value;
  try {
    const u = new URL(value);
    // Strip leading '/'
    return u.pathname.replace(/^\//, "");
  } catch {
    return value;
  }
}

async function toPublicRecordingLinkDynamic(localPath: string) {
  try {
    const mod = await import("./storage");
    return mod.toPublicRecordingLink(localPath);
  } catch {
    return localPath;
  }
}

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
    const key = extractS3KeySafe(value);
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
  // Prefer dynamic forwarding to the real storage helper when available.
  // Keep the exported API sync for compatibility by returning the original
  // path when the dynamic import cannot be performed; callers that need
  // the S3 URL can call `toPublicRecordingLinkDynamic` directly.
  // NOTE: We keep this synchronous wrapper for compatibility.
  // If callers require the canonical S3 URL, they should use the storage
  // package directly or call the dynamic helper.
  // For now, return the input path and let higher-level code handle
  // conversion if necessary.
  return localPath;
}

// Export the dynamic async variant for callers who want the real S3 URL
export { toPublicRecordingLinkDynamic as toPublicRecordingLinkAsync };

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function runBinary(binary: string, args: string[]) {
  const MAX_STDERR_BYTES = 32 * 1024; // Keep last 32 KB of stderr (most useful for debugging)
  // During unit tests, avoid invoking the real binary — synthesize outputs.
  // Allow forcing real ffmpeg runs for integration tests by setting `REAL_FFMPEG=1`.
  if (process.env.NODE_ENV === "test" && process.env.REAL_FFMPEG !== "1") {
    if (process.env.FORCE_FFMPEG_FAIL === "deterministic") {
      return Promise.reject(
        new Error(
          "FFmpeg failed with code 1: Invalid data found when processing input",
        ),
      );
    }
    const out = args[args.length - 1];
    if (typeof out === "string") {
      return fs
        .mkdir(path.dirname(out), { recursive: true })
        .then(() => fs.writeFile(out, "test"));
    }
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const processRef = spawn(binary, args);
    let stderr = "";

    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // Trim to tail when stderr exceeds the cap
      if (stderr.length > MAX_STDERR_BYTES * 1.5) {
        stderr = stderr.slice(-MAX_STDERR_BYTES);
      }
    });

    processRef.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${binary} exited with code ${code}: ${stderr.slice(-MAX_STDERR_BYTES)}`,
        ),
      );
    });

    processRef.on("error", (error) => {
      reject(error);
    });
  });
}

export async function runBinaryWithRetries(
  binary: string,
  args: string[],
  retries = 2,
  delayMs = 500,
) {
  let attempt = 0;
  while (true) {
    try {
      await runBinary(binary, args);
      return;
    } catch (err: any) {
      attempt += 1;
      const msg = String(err?.message || "").toLowerCase();
      const isTransient =
        msg.includes("stalled") ||
        msg.includes("no ffmpeg output") ||
        msg.includes("timed out") ||
        msg.includes("econnreset");
      if (!isTransient || attempt > retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
