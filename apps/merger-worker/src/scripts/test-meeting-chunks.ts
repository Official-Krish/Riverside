import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createGridVideo } from "../grid-builder";
import {
  executeFFmpeg,
  ffmpegBin,
  getVideoDuration,
  hasAudioStream,
  ffprobeBin,
} from "../ffmpeg";
import {
  computeMeetingEndMs,
  computeMeetingEpochMs,
  sortChunksByTimeline,
} from "../timeline";
import {
  type MergerConfig,
  type ProcessedUser,
  type UserChunk,
} from "../types";

const DEFAULT_MEETING_ID = "rq3mcbzbwi8lckzertzf";
const DEFAULT_FRAME_RATE = 30;
const DEFAULT_AUDIO_BITRATE = "320k";
const DEFAULT_MAX_CONCURRENT_USER_JOBS = 2;
const MIN_GAP_SECONDS = 0.5;
const MAX_GAP_SECONDS = 120;
const DEFAULT_DURATION_SECONDS = 10;
const WEBM_EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const WEBM_CLUSTER_MAGIC = Buffer.from([0x1f, 0x43, 0xb6, 0x75]);
const MIN_WEBM_INIT_SEGMENT_BYTES = 300;

const CHUNK_VIDEO_FILTER =
  "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2";

const AUDIO_ENCODE = ["-c:a", "aac", "-ar", "48000", "-b:a", "128k"];

function parseChunkSequenceNumber(filename: string): number | null {
  const match = filename.match(/chunk-(\d+)-/);
  if (!match?.[1]) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isNaN(sequence) ? null : sequence;
}

function parseChunkTimestamp(filename: string): number | null {
  const match = filename.match(
    /chunk-(?:\d+-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\./,
  );
  if (!match?.[1]) {
    return null;
  }

  const raw = match[1];
  const [datePart, timePart] = raw.split("T");
  if (!datePart || !timePart) {
    return null;
  }

  const timeMs = timePart.replace(
    /^(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    "$1:$2:$3.$4Z",
  );
  const isoString = `${datePart}T${timeMs}`;
  const timestamp = new Date(isoString).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function buildChunkDurationSeconds(
  current: UserChunk,
  nextChunk: UserChunk | null,
): number {
  if (nextChunk && current.hasValidTimestamp && nextChunk.hasValidTimestamp) {
    const deltaMs = nextChunk.timestamp - current.timestamp;
    if (deltaMs > MIN_GAP_SECONDS * 1000 && deltaMs < MAX_GAP_SECONDS * 1000) {
      return deltaMs / 1000;
    }
  }

  const rawDurationMs = current.durationSeconds * 1000;
  return rawDurationMs > MIN_GAP_SECONDS * 1000
    ? rawDurationMs / 1000
    : DEFAULT_DURATION_SECONDS;
}

function hasWebmHeader(buffer: Buffer): boolean {
  return (
    buffer.length >= WEBM_EBML_MAGIC.length &&
    buffer.subarray(0, WEBM_EBML_MAGIC.length).equals(WEBM_EBML_MAGIC)
  );
}

function findWebmClusterOffset(buffer: Buffer): number {
  let searchFrom = MIN_WEBM_INIT_SEGMENT_BYTES;

  while (searchFrom < buffer.length - 8) {
    const clusterIndex = buffer.indexOf(WEBM_CLUSTER_MAGIC, searchFrom);
    if (clusterIndex < 0) {
      return -1;
    }

    const sizeFirstByte = buffer[clusterIndex + 4];
    if (sizeFirstByte === undefined || sizeFirstByte >= 0x80) {
      searchFrom = clusterIndex + 1;
      continue;
    }

    return clusterIndex;
  }

  return -1;
}

async function concatenateRawWebmChunks(
  chunks: UserChunk[],
  outputPath: string,
): Promise<void> {
  const buffers: Buffer[] = [];

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index]!;
    const data = await fs.readFile(chunk.localPath);

    if (index === 0) {
      buffers.push(data);
      continue;
    }

    const clusterOffset = findWebmClusterOffset(data);
    if (clusterOffset > 0) {
      buffers.push(data.subarray(clusterOffset));
      continue;
    }

    buffers.push(data);
  }

  await fs.writeFile(outputPath, Buffer.concat(buffers));
}

async function encodeRawWebmToMp4(
  rawWebmPath: string,
  outputPath: string,
  frameRate: number,
  durationSeconds: number,
  label: string,
): Promise<void> {
  await executeFFmpeg(
    ffmpegBin,
    [
      "-y",
      "-i",
      rawWebmPath,
      "-t",
      durationSeconds.toFixed(3),
      "-vf",
      CHUNK_VIDEO_FILTER,
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
      "-r",
      frameRate.toString(),
      ...AUDIO_ENCODE,
      "-movflags",
      "+faststart",
      outputPath,
    ],
    600000,
    label,
    () => undefined,
  );
}

async function probeLocalVideo(filePath: string): Promise<{
  hasAudio: boolean;
  duration: number;
}> {
  const [hasAudio, duration] = await Promise.all([
    hasAudioStream(filePath, ffprobeBin, () => {}),
    getVideoDuration(filePath, ffprobeBin, () => {}).catch(() => 0),
  ]);

  return { hasAudio, duration };
}

async function buildServerSideUserVideo(
  userId: string,
  chunks: UserChunk[],
  tempDir: string,
  config: MergerConfig,
): Promise<string> {
  const userWorkDir = path.join(tempDir, "server-side", userId);
  const rawWebmPath = path.join(userWorkDir, `${userId}.raw.webm`);
  const outputPath = path.join(tempDir, "videos", `${userId}.mp4`);

  await fs.mkdir(userWorkDir, { recursive: true });

  const sorted = sortChunksByTimeline(chunks);
  await concatenateRawWebmChunks(sorted, rawWebmPath);

  const durationSeconds = sorted.reduce(
    (sum, chunk) => sum + chunk.durationSeconds,
    0,
  );
  await encodeRawWebmToMp4(
    rawWebmPath,
    outputPath,
    config.frameRate,
    Math.max(1, durationSeconds),
    `server-side-user-video[${userId}]`,
  );

  return outputPath;
}

async function scanLocalChunks(
  meetingId: string,
): Promise<Map<string, UserChunk[]>> {
  const localRoot = path.resolve(
    process.cwd(),
    "../../recordings/tmp",
    `test-meeting-chunks-${meetingId}`,
  );
  const decryptedRoot = path.join(localRoot, "decrypted");
  const chunksRoot = path.join(localRoot, "chunks");

  const sourceRoot = await fs
    .stat(decryptedRoot)
    .then(() => decryptedRoot)
    .catch(() => chunksRoot);

  const userChunks = new Map<string, UserChunk[]>();
  const userDirs = await fs.readdir(sourceRoot, { withFileTypes: true });

  for (const userDir of userDirs) {
    if (!userDir.isDirectory()) {
      continue;
    }

    const userId = userDir.name;
    const userDirPath = path.join(sourceRoot, userId);
    const files = await fs.readdir(userDirPath, { withFileTypes: true });
    const chunkFiles = files.filter((entry) => entry.isFile());

    const chunks: UserChunk[] = [];
    for (const file of chunkFiles) {
      const timestamp = parseChunkTimestamp(file.name);
      const sequenceNumber = parseChunkSequenceNumber(file.name);
      if (timestamp === null) {
        continue;
      }

      const localPath = path.join(userDirPath, file.name);
      chunks.push({
        userId,
        localPath,
        timestamp,
        durationSeconds: DEFAULT_DURATION_SECONDS,
        sequenceNumber,
        hasValidTimestamp: true,
        metadata: null,
      });
    }

    if (chunks.length > 0) {
      const sorted = sortChunksByTimeline(chunks);
      const withDurations = sorted.map((chunk, index) => {
        const nextChunk = sorted[index + 1] ?? null;
        return {
          ...chunk,
          durationSeconds: buildChunkDurationSeconds(chunk, nextChunk),
        };
      });

      userChunks.set(userId, sortChunksByTimeline(withDurations));
    }
  }

  if (userChunks.size === 0) {
    throw new Error(`No local chunks found under ${sourceRoot}`);
  }

  return userChunks;
}

async function main() {
  const meetingId = process.argv[2]?.trim() || DEFAULT_MEETING_ID;
  const tempDir = path.resolve(
    process.cwd(),
    "../../recordings/tmp",
    `test-meeting-chunks-${meetingId}`,
  );
  const finalLocalPath = path.resolve(
    process.cwd(),
    "../../recordings",
    meetingId,
    "final",
    "meeting_grid_recording.mp4",
  );

  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(path.join(tempDir, "chunks"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "videos"), { recursive: true });
  await fs.mkdir(path.join(tempDir, "output"), { recursive: true });
  await fs.mkdir(path.dirname(finalLocalPath), { recursive: true });

  const userChunks = await scanLocalChunks(meetingId);
  const meetingEpochMs = computeMeetingEpochMs(userChunks);
  const meetingEndMs = computeMeetingEndMs(userChunks);

  console.log(`[test] meetingId=${meetingId}`);
  console.log(`[test] tempDir=${tempDir}`);
  console.log(
    `[test] meetingEpochMs=${new Date(meetingEpochMs).toISOString()}`,
  );
  console.log(`[test] meetingEndMs=${new Date(meetingEndMs).toISOString()}`);
  console.log(`[test] users=${userChunks.size}`);

  const config: MergerConfig = {
    frameRate: DEFAULT_FRAME_RATE,
    audioBitrate: DEFAULT_AUDIO_BITRATE,
    maxConcurrentUserJobs: DEFAULT_MAX_CONCURRENT_USER_JOBS,
  };

  const processedUsers: ProcessedUser[] = [];
  const userEntries = Array.from(userChunks.entries());

  for (const [userId, chunks] of userEntries) {
    const userStart = Date.now();
    const userVideo = await buildServerSideUserVideo(
      userId,
      chunks,
      tempDir,
      config,
    );

    const elapsed = Date.now() - userStart;

    const { hasAudio, duration } = await probeLocalVideo(userVideo);
    const joinTimestamp = chunks[0]?.timestamp ?? meetingEpochMs;
    const leadingPaddingSeconds = Math.max(
      0,
      (joinTimestamp - meetingEpochMs) / 1000,
    );

    processedUsers.push({
      userId,
      videoPath: userVideo,
      duration: Math.max(duration, (meetingEndMs - meetingEpochMs) / 1000),
      hasAudio,
      joinTimestamp,
      leadingPaddingSeconds,
    });

    console.log(
      `[test] user=${userId} video=${userVideo} duration=${duration.toFixed(3)}s audio=${hasAudio}`,
    );
  }

  processedUsers.sort((a, b) => a.joinTimestamp - b.joinTimestamp);

  const gridVideo = await createGridVideo(
    processedUsers,
    tempDir,
    config,
    (message) => console.log(message),
  );

  await fs.copyFile(gridVideo, finalLocalPath);

  const finalStats = await fs.stat(finalLocalPath);
  console.log(`[test] finalVideo=${finalLocalPath}`);
  console.log(`[test] finalBytes=${finalStats.size}`);
  console.log(`[test] done`);
}

main().catch((error) => {
  console.error("[test] failed:", error);
  process.exitCode = 1;
});
