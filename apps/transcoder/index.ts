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
  buildRenditionArgs,
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

type TranscodePayload = {
  meetingId: string;
  finalPath?: string;
  version?: string | number;
};

const QUEUE_NAME = "TranscodeVideo";
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
  port: Number(process.env.REDIS_PORT || 6379),
});

function runBinary(binary: string, args: string[]): Promise<void> {
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

      reject(new Error(`${binary} exited with code ${code}: ${stderr}`));
    });

    processRef.on("error", (error) => {
      reject(error);
    });
  });
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

    processRef.on("error", (error) => {
      reject(error);
    });
  });
}

function toInputS3Key(payload: TranscodePayload) {
  if (payload.finalPath && payload.finalPath.trim()) {
    return payload.finalPath;
  }
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
  if (!bytes) {
    throw new Error(`Empty S3 object body for key: ${key}`);
  }

  await fs.writeFile(targetPath, bytes);
}

async function clearS3Prefix(prefix: string) {
  await deletePrefixFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    prefix,
  });
}

function guessContentType(fileName: string) {
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

async function processMeeting(payload: TranscodePayload) {
  const inputKey = toInputS3Key(payload);

  const localWorkDir = path.join(
    recordingsRoot,
    "tmp",
    `transcode_${payload.meetingId}_${Date.now()}`,
  );
  const inputPath = path.join(localWorkDir, "input.mp4");
  const outputDir = getTranscodeOutputDir(recordingsRoot, payload.meetingId);

  await fs.mkdir(localWorkDir, { recursive: true });

  await downloadS3ObjectToFile(inputKey, inputPath);

  await fs.mkdir(outputDir, { recursive: true });

  const duration = await readDurationSeconds(inputPath);

  for (const profile of HLS_PROFILES) {
    await runBinary(
      ffmpegBin,
      buildRenditionArgs(inputPath, outputDir, profile),
    );
  }

  await fs.writeFile(
    path.join(outputDir, "master.m3u8"),
    buildMasterPlaylistContent(),
    "utf8",
  );

  await runBinary(ffmpegBin, buildPosterArgs(inputPath, outputDir));
  await runBinary(ffmpegBin, buildSpriteArgs(inputPath, outputDir, duration));

  const vtt = buildThumbnailVtt(duration);
  await fs.writeFile(path.join(outputDir, "thumbnails.vtt"), vtt, "utf8");

  const hlsPrefix = `weave-recordings/${payload.meetingId}/hls_v${payload.version ?? "stable"}/`;
  await clearS3Prefix(hlsPrefix);
  await uploadDirectoryToS3(outputDir, hlsPrefix);

  await Promise.allSettled([
    fs.rm(outputDir, { recursive: true, force: true }),
    fs.rm(localWorkDir, { recursive: true, force: true }),
  ]);
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

    if (!identifier || typeof identifier !== "string") {
      return null;
    }

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
  return jwt.sign(
    {
      scope: "worker-service",
    },
    getWorkerServiceJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: "60s",
      audience: "weave-backend",
      issuer: "weave-worker",
    },
  );
}

async function reportWorkerStatus(
  meetingId: string,
  status: "PROCESSING" | "READY" | "FAILED",
  finalPath?: string,
  version?: string | number,
) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000/api/v1";

  const response = await axios.request({
    url: `${backendUrl}/worker/recording-status/${meetingId}`,
    method: "POST",
    headers: {
      "x-worker-token": getBackendServiceToken(),
      "Content-Type": "application/json",
    },
    data: {
      status,
      finalPath,
      version,
    },
  });

  if (!response) {
    throw new Error(`Worker status callback failed`);
  }
}

async function workQueue() {
  while (true) {
    try {
      const result = await redisClient.blpop(QUEUE_NAME, 0);
      if (!result) {
        continue;
      }

      const payload = parsePayload(result[1]);
      if (!payload || !payload.meetingId) {
        continue;
      }

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
      } catch (_error) {
        try {
          await reportWorkerStatus(payload.meetingId, "FAILED");
        } catch (statusError) {
          console.error(
            "Error reporting worker status after processing failure:",
            statusError,
          );
        }
      }
    } catch (error) {
      console.error("Error processing queue item:", error);
    }
  }
}

workQueue();
