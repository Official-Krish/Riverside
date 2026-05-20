import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { executeFFmpeg, ffmpegBin } from "./ffmpeg";
import { ffprobeBin } from "./ffmpeg";
import { buildUserTimeline, type TimelineEvent } from "./timeline";
import { type MergerConfig, type UserChunk } from "./types";

export function escapeConcatFilePath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
}

const INPUT_FLAGS = [
  "-fflags",
  "+genpts+igndts",
  "-err_detect",
  "ignore_err",
  "-probesize",
  "32M",
  "-analyzeduration",
  "100M",
];

const CHUNK_VIDEO_FILTER =
  "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2";

const GAP_VIDEO_FILTER =
  "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2";

const ENCODE_OUTPUT_FLAGS = [
  "-fps_mode",
  "cfr",
  "-avoid_negative_ts",
  "make_zero",
];

const AUDIO_ENCODE = ["-c:a", "aac", "-ar", "48000", "-b:a", "128k"];

function buildChunkEncodeArgs(
  input: string,
  output: string,
  frameRate: number,
  durationSeconds: number,
): string[] {
  return [
    "-y",
    ...INPUT_FLAGS,
    "-i",
    input,
    "-t",
    durationSeconds.toFixed(3),
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    CHUNK_VIDEO_FILTER,
    "-r",
    frameRate.toString(),
    ...AUDIO_ENCODE,
    ...ENCODE_OUTPUT_FLAGS,
    output,
  ];
}

async function normalizeChunkToSegment(
  chunk: UserChunk,
  outputPath: string,
  frameRate: number,
  label: string,
  log: (message: string) => void,
): Promise<void> {
  try {
    await executeFFmpeg(
      ffmpegBin,
      buildChunkEncodeArgs(
        chunk.localPath,
        outputPath,
        frameRate,
        chunk.durationSeconds,
      ),
      300000,
      label,
      log,
    );
  } catch (firstError) {
    log(
      `[${label}] Retrying chunk encode with relaxed demuxer flags: ${firstError instanceof Error ? firstError.message : firstError}`,
    );
    await executeFFmpeg(
      ffmpegBin,
      [
        "-y",
        "-fflags",
        "+genpts+igndts+discardcorrupt",
        "-i",
        chunk.localPath,
        "-t",
        chunk.durationSeconds.toFixed(3),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-vf",
        CHUNK_VIDEO_FILTER,
        "-vsync",
        "cfr",
        "-r",
        frameRate.toString(),
        ...AUDIO_ENCODE,
        ...ENCODE_OUTPUT_FLAGS,
        outputPath,
      ],
      300000,
      `${label}:retry`,
      log,
    );
  }
}

async function probeSegmentDuration(
  segmentPath: string,
  label: string,
  log: (message: string) => void,
): Promise<void> {
  await new Promise<void>((resolve) => {
    execFile(
      ffprobeBin,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        segmentPath,
      ],
      (error, stdout) => {
        log(
          `[${label}] segment ${path.basename(segmentPath)} probed_duration=${stdout.trim()} err=${error?.message ?? "none"}`,
        );
        resolve();
      },
    );
  });
}

async function createGapSegment(
  gapSeconds: number,
  outputPath: string,
  frameRate: number,
  label: string,
  log: (message: string) => void,
): Promise<void> {
  await executeFFmpeg(
    ffmpegBin,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=black:s=640x480:r=${frameRate}`,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-t",
      gapSeconds.toFixed(3),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-pix_fmt",
      "yuv420p",
      "-vf",
      GAP_VIDEO_FILTER,
      "-r",
      frameRate.toString(),
      ...AUDIO_ENCODE,
      ...ENCODE_OUTPUT_FLAGS,
      outputPath,
    ],
    60000,
    label,
    log,
  );
}

async function materializeTimelineEvents(
  events: TimelineEvent[],
  workDir: string,
  frameRate: number,
  label: string,
  log: (message: string) => void,
): Promise<string[]> {
  const segmentPaths: string[] = [];
  let gapIndex = 0;
  let chunkIndex = 0;

  for (const event of events) {
    if (event.type === "gap") {
      const gapPath = path.join(
        workDir,
        `gap_${String(gapIndex++).padStart(6, "0")}.mp4`,
      );
      log(
        `[${label}] timeline gap ${event.durationSeconds.toFixed(2)}s (black + silent audio)`,
      );
      await createGapSegment(
        event.durationSeconds,
        gapPath,
        frameRate,
        `${label}:gap-${gapIndex}`,
        log,
      );
      segmentPaths.push(gapPath);
      continue;
    }

    const segmentPath = path.join(
      workDir,
      `chunk_${String(chunkIndex++).padStart(6, "0")}.mp4`,
    );
    const chunk = event.chunk;
    const chunkStartIso = new Date(chunk.timestamp).toISOString();
    log(
      `[${label}] timeline chunk seq=${chunk.sequenceNumber ?? "?"} start=${chunkStartIso} duration=${chunk.durationSeconds.toFixed(2)}s`,
    );

    await normalizeChunkToSegment(
      chunk,
      segmentPath,
      frameRate,
      `${label}:chunk-${chunkIndex}`,
      log,
    );
    await probeSegmentDuration(segmentPath, label, log);
    const segmentStats = await fs.stat(segmentPath);
    log(
      `[${label}] segment ${path.basename(segmentPath)} size=${segmentStats.size}`,
    );
    segmentPaths.push(segmentPath);
  }

  return segmentPaths;
}

async function concatTimelineSegments(
  segmentPaths: string[],
  outputVideo: string,
  frameRate: number,
  label: string,
  log: (message: string) => void,
): Promise<void> {
  const inputs: string[] = [];
  for (const segmentPath of segmentPaths) {
    inputs.push("-i", segmentPath);
  }

  const n = segmentPaths.length;
  const filterParts: string[] = [];
  for (let index = 0; index < n; index++) {
    filterParts.push(`[${index}:v]setpts=PTS-STARTPTS[v${index}]`);
    filterParts.push(`[${index}:a]asetpts=PTS-STARTPTS[a${index}]`);
  }

  const concatInputs = Array.from(
    { length: n },
    (_, index) => `[v${index}][a${index}]`,
  ).join("");
  filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=1[vout][aout]`);

  await executeFFmpeg(
    ffmpegBin,
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      outputVideo,
    ],
    600000,
    `${label}:concat-filter`,
    log,
  );
}

/**
 * Merge chunks on the absolute meeting timeline (timestamp-ordered, gap-filled).
 */
export async function createUserVideo(
  userId: string,
  chunks: UserChunk[],
  tempDir: string,
  config: MergerConfig,
  meetingEpochMs: number,
  meetingEndMs: number,
  log: (message: string) => void,
): Promise<string | null> {
  const outputVideo = path.join(tempDir, "videos", `${userId}.mp4`);
  const startTime = Date.now();
  const label = `createUserVideo[${userId}]`;

  try {
    const timeline = buildUserTimeline(chunks, meetingEpochMs, meetingEndMs);
    if (timeline.length === 0) {
      throw new Error("No timeline events to merge");
    }

    const chunkEvents = timeline.filter((e) => e.type === "chunk").length;
    if (chunkEvents === 0) {
      throw new Error("Timeline has no chunk events");
    }

    log(
      `[${label}] timeline epoch=${new Date(meetingEpochMs).toISOString()} end=${new Date(meetingEndMs).toISOString()} chunks=${chunkEvents} gaps=${timeline.length - chunkEvents}`,
    );

    const workDir = path.join(tempDir, "videos", `${userId}-timeline`);
    await fs.mkdir(workDir, { recursive: true });

    const segmentPaths = await materializeTimelineEvents(
      timeline,
      workDir,
      config.frameRate,
      label,
      log,
    );

    if (segmentPaths.length === 0) {
      throw new Error("Timeline produced no segments");
    }

    if (segmentPaths.length === 1) {
      await fs.copyFile(segmentPaths[0]!, outputVideo);
      return outputVideo;
    }

    await concatTimelineSegments(
      segmentPaths,
      outputVideo,
      config.frameRate,
      label,
      log,
    );

    return outputVideo;
  } catch (error) {
    const elapsed = Date.now() - startTime;
    log(`[${label}] Failed after ${elapsed}ms: ${error}`);
    return null;
  }
}

export async function createBlackPlaceholderVideo(
  userId: string,
  duration: number,
  tempDir: string,
  config: MergerConfig,
  log: (message: string) => void,
): Promise<string> {
  const label = `createBlackPlaceholderVideo[${userId}]`;
  const safeDuration = Math.max(1, Math.ceil(duration));
  const outputVideo = path.join(tempDir, "videos", `${userId}_placeholder.mp4`);
  await createGapSegment(
    safeDuration,
    outputVideo,
    config.frameRate,
    label,
    log,
  );
  return outputVideo;
}
