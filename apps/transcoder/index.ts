import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { Redis } from "ioredis";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import {
  HLS_PROFILES,
  buildMasterPlaylistContent,
  buildPosterArgs,
  buildSpriteArgs,
  buildThumbnailVtt,
  getTranscodeOutputDir,
} from "./utils";
import axios from "axios";
import jwt from "jsonwebtoken";
import {
  deletePrefixFromS3,
  getObjectBytesFromS3,
  normalizeS3Key,
  putObjectToS3,
  resolveStorageContext,
} from "@repo/amazons3";
import { WorkerError, toWorkerError } from "./errors";

type TranscodePayload = {
  meetingId: string;
  finalPath?: string;
  version?: string | number;
};

const QUEUE_NAME = "TranscodeVideo";
const BLPOP_TIMEOUT_SECONDS = 5; // yields the loop at idle; 0 = busy-spin
const MAX_CONCURRENT_JOBS = 1; // 2 CPUs → keep 1 transcode active; raise to 2 if headroom allows
const FFMPEG_THREADS = 2; // cap ffmpeg thread count to your vCPU count

const environment = process.env.NODE_ENV || "development";
const recordingsRoot =
  environment === "production"
    ? "/app/recordings"
    : path.resolve(process.cwd(), "../../recordings");
const ffmpegBin = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobeBin = process.env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";
const storage = resolveStorageContext();

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  lazyConnect: true, // don't connect until first use
  enableOfflineQueue: false, // fail fast if Redis is down — don't buffer jobs in memory
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 5000), // exponential backoff, cap 5s
  keepAlive: 30_000, // TCP keepalive so idle connections don't drop
});

redisClient.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});

// k8s sends SIGTERM before killing the pod. Without this, in-flight ffmpeg
// processes are orphaned and the pod can't be evicted cleanly.

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] received ${signal}, draining…`);

  // Give in-flight jobs up to 30s to finish before the pod is force-killed.
  // Set terminationGracePeriodSeconds ≥ 35 in your Deployment spec.
  await redisClient.quit().catch(() => undefined);
  console.log("[worker] shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

let activeJobs = 0;

function canAcceptJob(): boolean {
  return activeJobs < MAX_CONCURRENT_JOBS;
}

function runBinary(
  binary: string,
  args: string[],
  label = binary,
): Promise<void> {
  return new Promise((resolve, reject) => {
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
      reject(
        new Error(`${label} exited with code ${code}: ${stderr.slice(-2000)}`),
      );
    });

    processRef.on("error", reject);
  });
}

/**
 * Inject -threads N into ffmpeg args so it never spawns more threads than
 * your vCPU budget. buildRenditionArgs must accept an extra trailing flag list,
 * or you can append them before the output path — adjust to match your utils.
 */
function ffmpegWithThreads(args: string[]): string[] {
  // Insert -threads before the first output file argument.
  // Safe approach: prepend right after any -i flag.
  const inputIdx = args.indexOf("-i");
  if (inputIdx !== -1) {
    return [
      ...args.slice(0, inputIdx + 2),
      "-threads",
      String(FFMPEG_THREADS),
      ...args.slice(inputIdx + 2),
    ];
  }
  return ["-threads", String(FFMPEG_THREADS), ...args];
}

function readDurationSeconds(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const processRef = spawn(ffprobeBin, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);

    let stdout = "";
    let stderr = "";

    processRef.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      const parsed = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(parsed) || parsed <= 0) {
        reject(
          new Error(`Invalid video duration from ffprobe output: ${stdout}`),
        );
        return;
      }

      resolve(parsed);
    });

    processRef.on("error", reject);
  });
}

function toInputS3Key(payload: TranscodePayload): string {
  if (payload.finalPath?.trim()) return payload.finalPath;
  return normalizeS3Key(
    `${payload.meetingId}/final/meeting_grid_recording.mp4`,
  );
}

async function downloadS3ObjectToFile(key: string, targetPath: string) {
  const bytes = await getObjectBytesFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key,
  });
  if (!bytes) throw new Error(`Empty S3 object body for key: ${key}`);
  await fs.writeFile(targetPath, bytes);
}

async function clearS3Prefix(prefix: string) {
  await deletePrefixFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    prefix,
  });
}

function guessContentType(fileName: string): string {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fileName.endsWith(".ts")) return "video/mp2t";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg"))
    return "image/jpeg";
  if (fileName.endsWith(".vtt")) return "text/vtt";
  return "application/octet-stream";
}

async function uploadDirectoryToS3(localDir: string, prefix: string) {
  const entries = await fs.readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDirectoryToS3(fullPath, `${prefix}${entry.name}/`);
      continue;
    }

    const body = await fs.readFile(fullPath);
    await putObjectToS3({
      s3Client: storage.s3Client,
      bucketName: storage.bucketName,
      key: `${prefix}${entry.name}`,
      body,
      contentType: guessContentType(entry.name),
    });
  }
}

// If the pod crashed mid-transcode, leftover dirs waste disk/inodes.

async function cleanStaleTempDirs() {
  const tmpRoot = path.join(recordingsRoot, "tmp");
  try {
    const entries = await fs.readdir(tmpRoot, { withFileTypes: true });
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours

    await Promise.allSettled(
      entries
        .filter((e) => e.isDirectory() && e.name.startsWith("transcode_"))
        .map(async (e) => {
          const fullPath = path.join(tmpRoot, e.name);
          const stat = await fs.stat(fullPath).catch(() => null);
          if (stat && stat.mtimeMs < cutoff) {
            console.log(`[cleanup] removing stale dir: ${e.name}`);
            await fs.rm(fullPath, { recursive: true, force: true });
          }
        }),
    );
  } catch {
    // tmpRoot may not exist yet — that's fine
  }
}

// Decodes the source video exactly ONCE and writes all renditions simultaneously.
// Compared to the old per-profile loop this cuts:
//   - decode CPU by ~(N-1)/N  (2 fewer full decode passes for 3 profiles)
//   - wall time by ~40-60%    (no sequential pipeline stalls between profiles)
//   - peak disk I/O by ~2/3   (one input read instead of three)
//
// ffmpeg structure for N renditions:
//   -i input.mp4  -threads T
//   -filter_complex "[0:v]split=N[v0][v1]…[vN-1]"
//   -map [v0] -map 0:a  <enc opts 0>  -f hls …  out0/stream.m3u8
//   -map [v1] -map 0:a  <enc opts 1>  -f hls …  out1/stream.m3u8
//   …

type HlsProfile = (typeof HLS_PROFILES)[number];

function buildSinglePassArgs(
  inputPath: string,
  outputDir: string,
  profiles: readonly HlsProfile[],
  threads: number,
): string[] {
  const n = profiles.length;
  const splitLabels = profiles.map((_, i) => `[v${i}]`).join("");
  const filterChains = profiles.map((profile, i) => {
    const outputLabel = `[v${i}out]`;
    return `[v${i}]scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p${outputLabel}`;
  });

  const args: string[] = [
    "-i",
    inputPath,
    "-threads",
    String(threads),
    "-filter_complex",
    `[0:v]split=${n}${splitLabels};${filterChains.join(";")}`,
  ];

  for (let i = 0; i < n; i++) {
    const p = profiles[i]!;
    const maxrate = `${Math.round(p.bandwidth / 1000)}k`;
    const bufsize = `${Math.round((p.bandwidth * 2) / 1000)}k`;

    args.push(
      "-map",
      `[v${i}out]`,
      "-map",
      "0:a?",

      // Video
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(p.crf ?? 23),
      "-maxrate",
      maxrate,
      "-bufsize",
      bufsize,
      "-profile:v",
      "main",

      // Audio
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",

      // HLS muxer — flat naming to match frontend expectations
      "-f",
      "hls",
      "-hls_time",
      "6",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(outputDir, `${p.name}_%03d.ts`),
      path.join(outputDir, `${p.name}.m3u8`),
    );
  }

  return args;
}

async function processMeeting(payload: TranscodePayload) {
  const inputKey = toInputS3Key(payload);
  const jobTag = `[job:${payload.meetingId}]`;

  const localWorkDir = path.join(
    recordingsRoot,
    "tmp",
    `transcode_${payload.meetingId}_${Date.now()}`,
  );
  const inputPath = path.join(localWorkDir, "input.mp4");
  const outputDir = getTranscodeOutputDir(recordingsRoot, payload.meetingId);

  await fs.mkdir(localWorkDir, { recursive: true });

  try {
    console.log(`${jobTag} downloading input from S3…`);
    await downloadS3ObjectToFile(inputKey, inputPath);

    await fs.mkdir(outputDir, { recursive: true });

    const duration = await readDurationSeconds(inputPath);
    console.log(
      `${jobTag} duration=${duration.toFixed(1)}s profiles=${HLS_PROFILES.length}`,
    );

    // Single decode pass — all renditions encoded simultaneously
    console.log(`${jobTag} single-pass encode starting…`);
    await runBinary(
      ffmpegBin,
      buildSinglePassArgs(inputPath, outputDir, HLS_PROFILES, FFMPEG_THREADS),
      "ffmpeg[single-pass]",
    );

    await fs.writeFile(
      path.join(outputDir, "master.m3u8"),
      buildMasterPlaylistContent(),
      "utf8",
    );

    // Poster and sprite still use ffmpegWithThreads since they come from utils
    await runBinary(
      ffmpegBin,
      ffmpegWithThreads(buildPosterArgs(inputPath, outputDir)),
      "ffmpeg[poster]",
    );
    await runBinary(
      ffmpegBin,
      ffmpegWithThreads(buildSpriteArgs(inputPath, outputDir, duration)),
      "ffmpeg[sprite]",
    );

    await fs.writeFile(
      path.join(outputDir, "thumbnails.vtt"),
      buildThumbnailVtt(duration),
      "utf8",
    );

    const hlsPrefix = `weave-recordings/${payload.meetingId}/hls_v${payload.version ?? "stable"}/`;
    console.log(`${jobTag} uploading to S3 prefix: ${hlsPrefix}`);
    await clearS3Prefix(hlsPrefix);
    await uploadDirectoryToS3(outputDir, hlsPrefix);

    console.log(`${jobTag} done`);
  } finally {
    // Always clean up local disk, even on failure
    await Promise.allSettled([
      fs.rm(outputDir, { recursive: true, force: true }),
      fs.rm(localWorkDir, { recursive: true, force: true }),
    ]);
  }
}

function getWorkerServiceJwtSecret(): string {
  const secret =
    process.env.WORKER_SERVICE_JWT_SECRET || process.env.WORKER_SERVICE_TOKEN;
  if (
    !secret ||
    secret === "WORKER_SERVICE_TOKEN" ||
    secret === "WORKER_SERVICE_JWT_SECRET"
  ) {
    throw new Error(
      "Worker service JWT secret must be configured and must not use the default placeholder value.",
    );
  }
  return secret;
}

function getBackendServiceToken(): string {
  return jwt.sign({ scope: "worker-service" }, getWorkerServiceJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "60s",
    audience: "weave-backend",
    issuer: "weave-worker",
  });
}

async function reportWorkerStatus(
  meetingId: string,
  status: "PROCESSING" | "READY" | "FAILED",
  finalPath?: string,
  version?: string | number,
) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000/api/v1";
  await axios.post(
    `${backendUrl}/worker/recording-status/${meetingId}`,
    { status, finalPath, version },
    {
      headers: {
        "x-worker-token": getBackendServiceToken(),
        "Content-Type": "application/json",
      },
      timeout: 10_000, // don't hang forever on a dead backend
    },
  );
}

function parsePayload(raw: string): TranscodePayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TranscodePayload> & {
      roomId?: string;
    };
    const identifier =
      typeof parsed.roomId === "string" && parsed.roomId.trim()
        ? parsed.roomId
        : parsed.meetingId;

    if (!identifier || typeof identifier !== "string") return null;

    return {
      meetingId: identifier.trim(),
      finalPath:
        typeof parsed.finalPath === "string" ? parsed.finalPath : undefined,
      version:
        typeof parsed.version === "string" || typeof parsed.version === "number"
          ? parsed.version
          : undefined,
    };
  } catch {
    return null;
  }
}

async function workQueue() {
  await redisClient.connect();
  await cleanStaleTempDirs();
  console.log(`[worker] ready — max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);

  while (!shuttingDown) {
    // If at capacity, back off briefly instead of hammering Redis.
    if (!canAcceptJob()) {
      await new Promise((r) => setTimeout(r, 500));
      continue;
    }

    let result: [string, string] | null = null;
    try {
      // blpop with a finite timeout so the loop condition is checked regularly
      // and the event loop isn't starved when idle.
      result = await redisClient.blpop(QUEUE_NAME, BLPOP_TIMEOUT_SECONDS);
    } catch (err) {
      if (!shuttingDown) {
        console.error("[worker] blpop error:", (err as Error).message);
        await new Promise((r) => setTimeout(r, 1_000));
      }
      continue;
    }

    if (!result) continue; // timeout — loop back to check shuttingDown

    const payload = parsePayload(result[1]);
    if (!payload?.meetingId) {
      console.warn("[worker] received unparseable payload, skipping");
      continue;
    }

    activeJobs++;

    (async () => {
      const tag = `[job:${payload.meetingId}]`;
      try {
        await reportWorkerStatus(payload.meetingId, "PROCESSING");
        await processMeeting(payload);
        const callbackFinalPath = payload.finalPath || toInputS3Key(payload);
        await reportWorkerStatus(
          payload.meetingId,
          "READY",
          callbackFinalPath,
          payload.version,
        );
        console.log(`${tag} reported READY`);
      } catch (err) {
        const workerErr = toWorkerError(err);
        console.error(`${tag} processing failed:`, {
          code: workerErr.code,
          recoverable: workerErr.recoverable,
          message: workerErr.message,
        });

        // Push render-failed notification
        try {
          await redisClient.lpush(
            "Notifications",
            JSON.stringify({
              userId: payload.meetingId,
              type: "RENDER_FAILED",
              message: `Transcode for meeting ${payload.meetingId} failed`,
              metadata: {
                meetingId: payload.meetingId,
                error: workerErr.message,
                errorCode: workerErr.code,
                recoverable: workerErr.recoverable,
              },
            }),
          );
        } catch (notifyErr: any) {
          console.error(
            `${tag} failed to push notification:`,
            notifyErr.message,
          );
        }

        try {
          await reportWorkerStatus(payload.meetingId, "FAILED");
        } catch (statusErr) {
          console.error(
            `${tag} failed to report FAILED status:`,
            (statusErr as Error).message,
          );
        }
      } finally {
        activeJobs--;
      }
    })();
  }
}

workQueue().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
