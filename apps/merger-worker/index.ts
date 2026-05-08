import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { Redis } from "ioredis";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import jwt from "jsonwebtoken";
import axios from "axios";
import {
    deletePrefixFromS3,
    getObjectBytesFromS3,
    listObjectKeysByPrefix,
    putObjectToS3,
    resolveStorageContext,
} from "@repo/amazons3";

const redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
});

redisClient.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Redis error:`, error);
});

redisClient.on("ready", () => {
    console.log(`[${new Date().toISOString()}] Connected to Redis at ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`);
});

interface UserChunk {
    userId: string;
    localPath: string;
    timestamp: number; // milliseconds since epoch
}

interface ProcessedUser {
    userId: string;
    videoPath: string;
    duration: number;
    hasAudio: boolean;
    joinTimestamp: number; // when user joined (first chunk timestamp)
    leadingPaddingSeconds: number;
}

interface FailedUser {
    userId: string;
    estimatedDuration: number;
    joinTimestamp: number;
}

// Parse timestamp from chunk filename like "chunk-000001-2024-05-02T14-30-45-123Z.webm"
function parseChunkTimestamp(filename: string): number | null {
    const match = filename.match(/chunk-(?:\d+-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\./);
    if (!match || !match[1]) {
        return null;
    }
    
    const raw = match[1]; // "2024-05-02T14-30-45-123Z"
    const [datePart, timePart] = raw.split('T');
    if (!datePart || !timePart) {
        return null;
    }
    
    // Replace dashes in time part: 14-30-45-123Z → 14:30:45.123Z
    // timePart format: "14-30-45-123Z"
    const timeMs = timePart.replace(/^(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1:$2:$3.$4Z');
    
    const isoString = `${datePart}T${timeMs}`;
    const timestamp = new Date(isoString).getTime();
    return isNaN(timestamp) ? null : timestamp;
}

function getWorkerServiceJwtSecret(): string {
  const secret = process.env.WORKER_SERVICE_JWT_SECRET || process.env.WORKER_SERVICE_TOKEN;
  if (!secret || secret === "WORKER_SERVICE_TOKEN" || secret === "WORKER_SERVICE_JWT_SECRET") {
    throw new Error("Worker service JWT secret must be configured and must not use the default placeholder value.");
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

function getPositiveIntegerEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value) || value < 1) {
        return fallback;
    }
    return value;
}

function escapeConcatFilePath(filePath: string): string {
    return filePath.replace(/'/g, "'\\''");
}

class LocalVideoMerger {
    private readonly meetingId: string;
    private readonly recordingsRoot: string;
    private readonly tempDir: string;
    private readonly bucketName: string;
    private readonly s3Client: ReturnType<typeof resolveStorageContext>["s3Client"];

    private config = {
        frameRate: 60,
        audioBitrate: "320k",
        maxConcurrentUserJobs: getPositiveIntegerEnv("MERGER_USER_CONCURRENCY", 2),
    };

    private readonly ffmpegBin: string;
    private readonly ffprobeBin: string;

    constructor(meetingId: string) {
        this.meetingId = meetingId;
        this.recordingsRoot = path.resolve(process.cwd(), "../../recordings");
        this.tempDir = path.join(this.recordingsRoot, "tmp", `media_merge_${Date.now()}`);
        const storage = resolveStorageContext();
        this.bucketName = storage.bucketName;
        this.s3Client = storage.s3Client;
        this.ffmpegBin = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
        this.ffprobeBin = process.env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";
    }

    private log(message: string) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    private async createDirectories() {
        await fs.mkdir(this.tempDir, { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "chunks"), { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "videos"), { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "output"), { recursive: true });
    }

    private async executeFFmpeg(args: string[], timeoutMs: number = 600000, label: string = "FFmpeg"): Promise<void> {
        const startTime = Date.now();

        await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn(this.ffmpegBin, args);
            let stderr = "";
            let timeoutHandle: NodeJS.Timeout | null = null;
            let resolved = false;
            let progressLines = 0;
            let lastProgressAt = Date.now();

            // Wait for the process to actually exit via the 'close' event
            const waitForExit = (): Promise<void> =>
                new Promise((res) => {
                    if (ffmpeg.exitCode !== null) {
                        // Already exited
                        res();
                        return;
                    }
                    // 'close' fires after stdio streams are closed and process has exited
                    ffmpeg.once("close", () => res());
                    // Safety net: if close never fires, give up after 3s
                    setTimeout(res, 3000);
                });

            const cleanup = async () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);

                if (ffmpeg.exitCode === null) {
                    // Process is still alive — escalate: SIGTERM first, then SIGKILL
                    ffmpeg.kill("SIGTERM");

                    // Give it 1s to exit gracefully, then SIGKILL
                    await Promise.race([
                        waitForExit(),
                        new Promise<void>((res) => setTimeout(res, 1000)),
                    ]);

                    if (ffmpeg.exitCode === null) {
                        ffmpeg.kill("SIGKILL");
                        await waitForExit(); // SIGKILL cannot be ignored
                    }
                }

                ffmpeg.removeAllListeners();
            };

            const doResolve = async (error?: Error) => {
                if (resolved) return;
                resolved = true;
                await cleanup();

                const duration = Date.now() - startTime;
                if (error) {
                    this.log(`[${label}] Failed after ${duration}ms: ${error.message}`);
                    reject(error);
                } else {
                    this.log(`[${label}] Completed successfully in ${duration}ms (${progressLines} progress lines)`);
                    resolve();
                }
            };

            const resetTimeout = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                timeoutHandle = setTimeout(() => {
                    const idleFor = Date.now() - lastProgressAt;
                    this.log(`[${label}] No FFmpeg progress for ${idleFor}ms, killing process...`);
                    if (progressLines === 0) {
                        this.log(`[${label}] WARNING: No FFmpeg output received - process may be stuck`);
                    }
                    doResolve(new Error(`FFmpeg stalled after ${idleFor}ms without progress`));
                }, timeoutMs);
            };

            resetTimeout();

            ffmpeg.stderr.on("data", (data) => {
                const output = data.toString();
                stderr += output;

                if (output.includes("frame=") || output.includes("error") || output.includes("Error") || output.includes("FAILED")) {
                    progressLines++;
                    lastProgressAt = Date.now();
                    resetTimeout();
                    const snippet = output.substring(0, 150).replace(/\n/g, " ");
                }
            });

            ffmpeg.on("close", (code) => {
                if (resolved) return; // Timeout already fired, cleanup already handled
                if (code === 0) {
                    doResolve();
                    return;
                }
                doResolve(new Error(`FFmpeg failed with code ${code}: ${stderr.substring(0, 200)}`));
            });

            ffmpeg.on("error", (error) => {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    doResolve(new Error(`ffmpeg binary not found. Checked path: ${this.ffmpegBin}`));
                    return;
                }
                doResolve(error);
            });
        });
    }

    private async getVideoDuration(videoPath: string): Promise<number> {
        const startTime = Date.now();
        const label = `getVideoDuration[${path.basename(videoPath)}]`;
        
        return await new Promise<number>((resolve, reject) => {
            const ffprobe = spawn(this.ffprobeBin, [
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                videoPath,
            ]);

            let stdout = "";
            let timeoutHandle: NodeJS.Timeout | null = null;

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                ffprobe.removeAllListeners();
                ffprobe.kill('SIGTERM');
            };

            timeoutHandle = setTimeout(() => {
                cleanup();
                reject(new Error(`FFprobe timeout for ${videoPath}`));
            }, 30000);

            ffprobe.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            ffprobe.on("close", (code) => {
                cleanup();
                if (code === 0) {
                    const duration = parseFloat(stdout.trim());
                    resolve(duration);
                    return;
                }
                this.log(`[${label}] Failed with code ${code}`);
                reject(new Error(`FFprobe failed with code ${code}`));
            });

            ffprobe.on("error", (error) => {
                cleanup();
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    reject(new Error(`ffprobe binary not found. Checked path: ${this.ffprobeBin}`));
                    return;
                }
                reject(error);
            });
        });
    }

    private async hasAudioStream(videoPath: string): Promise<boolean> {
        const startTime = Date.now();
        const label = `hasAudioStream[${path.basename(videoPath)}]`;
        
        return await new Promise<boolean>((resolve, reject) => {
            const ffprobe = spawn(this.ffprobeBin, [
                "-v",
                "error",
                "-select_streams",
                "a",
                "-show_entries",
                "stream=codec_type",
                "-of",
                "csv=p=0",
                videoPath,
            ]);

            let stdout = "";
            let timeoutHandle: NodeJS.Timeout | null = null;

            const cleanup = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                ffprobe.removeAllListeners();
                ffprobe.kill('SIGTERM');
            };

            timeoutHandle = setTimeout(() => {
                cleanup();
                reject(new Error(`FFprobe timeout for ${videoPath}`));
            }, 30000);

            ffprobe.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            ffprobe.on("close", (code) => {
                cleanup();
                if (code === 0) {
                    const hasAudio = stdout.trim().length > 0;
                    resolve(hasAudio);
                    return;
                }
                this.log(`[${label}] Failed with code ${code}`);
                reject(new Error(`FFprobe failed with code ${code}`));
            });

            ffprobe.on("error", (error) => {
                cleanup();
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    reject(new Error(`ffprobe binary not found. Checked path: ${this.ffprobeBin}`));
                    return;
                }
                reject(error);
            });
        });
    }

    private async collectUserChunks(): Promise<Map<string, UserChunk[]>> {
        const prefix = `weave-recordings/${this.meetingId}/raw/users/`;
        const chunkCacheRoot = path.join(this.tempDir, "chunks");
        const userChunks = new Map<string, UserChunk[]>();

        const keys = await listObjectKeysByPrefix({
            s3Client: this.s3Client,
            bucketName: this.bucketName,
            prefix,
            keyFilter: (key) => /chunk-.*\.(webm|mp4|ogg)$/i.test(key),
        });

        for (const key of keys) {
            const relativeKey = key.startsWith(prefix) ? key.slice(prefix.length) : key;
            const pathParts = relativeKey.split("/").filter(Boolean);
            if (pathParts.length < 2) {
                continue;
            }

            const userId = pathParts[0]!;
            const fileName = pathParts[pathParts.length - 1]!;
            const userLocalDir = path.join(chunkCacheRoot, userId);
            await fs.mkdir(userLocalDir, { recursive: true });

            const localPath = path.join(userLocalDir, fileName);
            const bytes = await getObjectBytesFromS3({
                s3Client: this.s3Client,
                bucketName: this.bucketName,
                key,
            });
            if (!bytes) {
                continue;
            }

            await fs.writeFile(localPath, bytes);

            const item: UserChunk = {
                userId,
                localPath,
                timestamp: parseChunkTimestamp(fileName) ?? Date.now(),
            };

            const existing = userChunks.get(userId) || [];
            existing.push(item);
            userChunks.set(userId, existing);
        }

        if (userChunks.size === 0) {
            throw new Error(`No chunk objects found in s3://${this.bucketName}/${prefix}`);
        }

        for (const [userId, chunks] of userChunks.entries()) {
            chunks.sort((a, b) => a.timestamp - b.timestamp);
            userChunks.set(userId, chunks);
        }

        return userChunks;
    }

    private async hasWebmHeader(filePath: string): Promise<boolean> {
        const file = await fs.open(filePath, "r");
        try {
            const header = Buffer.alloc(4);
            const { bytesRead } = await file.read(header, 0, header.length, 0);
            return bytesRead === header.length && header.equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
        } finally {
            await file.close();
        }
    }

    private async shouldConcatenateWebmFragments(chunks: UserChunk[]): Promise<boolean> {
        if (chunks.length < 2 || !chunks.every((chunk) => chunk.localPath.toLowerCase().endsWith(".webm"))) {
            return false;
        }

        const [firstChunk, secondChunk] = chunks;
        if (!firstChunk || !secondChunk) {
            return false;
        }

        return (await this.hasWebmHeader(firstChunk.localPath)) && !(await this.hasWebmHeader(secondChunk.localPath));
    }

    private async concatenateChunksBytewise(chunks: UserChunk[], outputPath: string): Promise<void> {
        const output = await fs.open(outputPath, "w");
        try {
            for (const chunk of chunks) {
                await output.writeFile(await fs.readFile(chunk.localPath));
            }
        } finally {
            await output.close();
        }
    }

    private async createUserVideo(userId: string, chunks: UserChunk[]): Promise<string | null> {
        const outputVideo = path.join(this.tempDir, "videos", `${userId}.mp4`);
        const startTime = Date.now();
        const label = `createUserVideo[${userId}]`;

        try {
            
            if (chunks.length === 1) {
                await this.executeFFmpeg([
                "-y",
                "-i",
                chunks[0]!.localPath,
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-pix_fmt",
                "yuv420p",
                "-vf",
                "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2",
                "-r",
                this.config.frameRate.toString(),
                outputVideo,
                ], 300000, `${label}:encode-single`);
            } else {
                const userTmp = path.join(this.tempDir, "videos", `${userId}-tmp`);
                await fs.mkdir(userTmp, { recursive: true });

                if (await this.shouldConcatenateWebmFragments(chunks)) {
                    const combinedWebmPath = path.join(userTmp, "combined.webm");
                    await this.concatenateChunksBytewise(chunks, combinedWebmPath);

                    await this.executeFFmpeg([
                    "-y",
                    "-i",
                    combinedWebmPath,
                    "-c:v",
                    "libx264",
                    "-preset",
                    "fast",
                    "-pix_fmt",
                    "yuv420p",
                    "-vf",
                    "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2",
                    "-r",
                    this.config.frameRate.toString(),
                    outputVideo,
                    ], 600000, `${label}:encode-webm-fragments`);
                    const elapsed = Date.now() - startTime;
                    return outputVideo;
                }

                // Use FFmpeg concat demuxer instead of binary concatenation
                const fileListPath = path.join(userTmp, "filelist.txt");
                const fileListContent = chunks.map(c => `file '${escapeConcatFilePath(c.localPath)}'`).join('\n');
                await fs.writeFile(fileListPath, fileListContent);

                await this.executeFFmpeg([
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                fileListPath,
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-pix_fmt",
                "yuv420p",
                "-vf",
                "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2",
                "-r",
                this.config.frameRate.toString(),
                outputVideo,
                ], 600000, `${label}:concat`);
            }
            return outputVideo;
        } catch (error) {
            const elapsed = Date.now() - startTime;
            this.log(`[${label}] Failed after ${elapsed}ms: ${error}`);
            return null;
        }
    }

    private async createBlackPlaceholderVideo(userId: string, duration: number): Promise<string> {
        const label = `createBlackPlaceholderVideo[${userId}]`;
        const safeDuration = Math.max(1, Math.ceil(duration));
        const outputVideo = path.join(this.tempDir, "videos", `${userId}_placeholder.mp4`);
        await this.executeFFmpeg([
            "-y",
            "-f",
            "lavfi",
            "-i",
            `color=c=black:s=640x480:r=${this.config.frameRate}`,
            "-t",
            safeDuration.toString(),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-pix_fmt",
            "yuv420p",
            outputVideo,
        ], 300000, label);
        return outputVideo;
    }

    private async normalizeVideoDurations(processedUsers: ProcessedUser[]): Promise<ProcessedUser[]> { 
        const maxDuration = Math.max(...processedUsers.map((u) => u.duration));

        for (const user of processedUsers) {
            const trailingPaddingSeconds = Math.max(0, maxDuration - user.duration);
            this.log(
                `[normalizeVideoDurations] User ${user.userId}: leading=${user.leadingPaddingSeconds.toFixed(2)}s trailing=${trailingPaddingSeconds.toFixed(2)}s deferred to final grid encode`
            );
        }
        return processedUsers;
    }

    private calculateGridDimensions(count: number) {
        if (count === 1) return { rows: 1, cols: 1 };
        if (count === 2) return { rows: 1, cols: 2 };
        if (count <= 4) return { rows: 2, cols: 2 };
        if (count <= 6) return { rows: 2, cols: 3 };
        if (count <= 9) return { rows: 3, cols: 3 };

        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        return { rows, cols };
    }

    private async createGridVideo(normalizedUsers: ProcessedUser[]): Promise<string> {
        const outputPath = path.join(this.tempDir, "output", "meeting_grid_recording.mp4");
        const startTime = Date.now();
        const label = `createGridVideo[${normalizedUsers.length}-users]`;

        // Handle single-user case by bypassing xstack
        if (normalizedUsers.length === 1) {
            const user = normalizedUsers[0]!;
            const targetDuration = Math.max(1, user.duration);
            const tpadFilter = user.leadingPaddingSeconds > 0.1
                ? `,tpad=start_mode=add:start_duration=${user.leadingPaddingSeconds}:color=black`
                : "";
            const audioDelayMs = Math.max(0, Math.round(user.leadingPaddingSeconds * 1000));
            const filter = `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2${tpadFilter}[video_out]${user.hasAudio && audioDelayMs > 0 ? `;[0:a]adelay=${audioDelayMs}:all=1[audio_out]` : ""}`;
            
            const args = [
                "-y",
                "-i",
                user.videoPath,
                "-filter_complex",
                filter,
                "-map",
                "[video_out]",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
            ];
            
            if (user.hasAudio) {
                args.push(
                    "-map",
                    audioDelayMs > 0 ? "[audio_out]" : "0:a",
                    "-c:a",
                    "aac",
                    "-b:a",
                    this.config.audioBitrate,
                    "-ar",
                    "48000",
                );
            } else {
                args.push("-an");
            }
            
            args.push(
                "-t",
                targetDuration.toString(),
                "-r",
                this.config.frameRate.toString(),
                outputPath,
            );
            
            await this.executeFFmpeg(args, 600000, `${label}:single-user`);
            return outputPath;
        }

        const { rows, cols } = this.calculateGridDimensions(normalizedUsers.length);
        const targetDuration = Math.max(...normalizedUsers.map((u) => u.duration));
        
        const outputWidth = 1920;
        const outputHeight = 1080;

        const tileWidth = Math.floor(outputWidth / cols);
        const tileHeight = Math.floor(outputHeight / rows);

        const inputs: string[] = [];
        let filter = "";

        for (let i = 0; i < normalizedUsers.length; i++) {
            const user = normalizedUsers[i]!;
            const trailingPaddingSeconds = Math.max(0, targetDuration - user.duration);
            const tpadOptions = [
                user.leadingPaddingSeconds > 0.1
                    ? `start_mode=add:start_duration=${user.leadingPaddingSeconds}:color=black`
                    : "",
                trailingPaddingSeconds > 0.1
                    ? `stop_mode=clone:stop_duration=${trailingPaddingSeconds}`
                    : "",
            ].filter(Boolean);

            inputs.push("-i", user.videoPath);
            filter += `[${i}:v]scale=${tileWidth}:${tileHeight}:force_original_aspect_ratio=decrease,pad=${tileWidth}:${tileHeight}:(ow-iw)/2:(oh-ih)/2${tpadOptions.length > 0 ? `,tpad=${tpadOptions.join(":")}` : ""},drawbox=x=0:y=0:w=iw:h=ih:color=#1f2937@0.6:t=2[v${i}];`;
        }

        const layout: string[] = [];
        for (let i = 0; i < normalizedUsers.length; i++) {
            const x = (i % cols) * tileWidth;
            const y = Math.floor(i / cols) * tileHeight;
            layout.push(`${x}_${y}`);
        }

        filter += `${Array.from({ length: normalizedUsers.length }, (_, i) => `[v${i}]`).join("")}xstack=inputs=${normalizedUsers.length}:layout=${layout.join("|")}:fill=black[video];`;
        filter += `[video]scale=${outputWidth}:${outputHeight}:flags=lanczos[video_out];`;

        const audioInputs = normalizedUsers
            .map((user, idx) => (user.hasAudio ? idx : -1))
            .filter((idx) => idx >= 0);

        let audioMap: string[] = [];
        if (audioInputs.length > 0) {
            const audioLabels: string[] = [];
            for (const inputIndex of audioInputs) {
                const user = normalizedUsers[inputIndex]!;
                const delayMs = Math.max(0, Math.round(user.leadingPaddingSeconds * 1000));
                const trailingPaddingSeconds = Math.max(0, targetDuration - user.duration);
                const audioFilters = [
                    delayMs > 0 ? `adelay=${delayMs}:all=1` : "",
                    trailingPaddingSeconds > 0.1 ? `apad=pad_dur=${trailingPaddingSeconds}` : "",
                ].filter(Boolean);

                if (audioFilters.length > 0) {
                    filter += `[${inputIndex}:a]${audioFilters.join(",")}[a${inputIndex}];`;
                    audioLabels.push(`[a${inputIndex}]`);
                } else {
                    audioLabels.push(`[${inputIndex}:a]`);
                }
            }
            filter += `${audioLabels.join("")}amix=inputs=${audioInputs.length}:duration=longest:normalize=0[audio]`;
            audioMap = ["-map", "[audio]"];
        } else {
            inputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
            audioMap = ["-map", `${normalizedUsers.length}:a`];
        }

        await this.executeFFmpeg([
        "-y",
        ...inputs,
        "-filter_complex",
        filter,
        "-map",
        "[video_out]",
        ...audioMap,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        this.config.audioBitrate,
        "-ar",
        "48000",
        "-t",
        targetDuration.toString(),
        "-r",
        this.config.frameRate.toString(),
        outputPath,
        ], 900000, `${label}:xstack`);
        return outputPath;
    }

    private async persistFinal(gridVideoPath: string): Promise<string> {
        const finalKey = `weave-recordings/${this.meetingId}/final/meeting_grid_recording.mp4`;
        const body = await fs.readFile(gridVideoPath);

        await putObjectToS3({
            s3Client: this.s3Client,
            bucketName: this.bucketName,
            key: finalKey,
            body,
            contentType: "video/mp4",
        });

        return finalKey;
    }

    private async cleanupSourceChunksFromS3(): Promise<void> {
        const prefix = `weave-recordings/${this.meetingId}/raw/users/`;
        await deletePrefixFromS3({
            s3Client: this.s3Client,
            bucketName: this.bucketName,
            prefix,
        });
    }

    private async cleanupLegacyLocalChunks(): Promise<void> {
        const rawDir = path.join(this.recordingsRoot, this.meetingId, "raw");
        await fs.rm(rawDir, { recursive: true, force: true }).catch(() => undefined);
    }

    private async cleanup(): Promise<void> {
        const startTime = Date.now();
        const label = `cleanup[${this.tempDir}]`;
        
        try {
            await fs.rm(this.tempDir, { recursive: true, force: true });
        } catch (error) {
            const elapsed = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`[${label}] Cleanup error after ${elapsed}ms: ${errorMsg}`);
        }
    }

    private async cleanupLegacyRecordingsTmp(): Promise<void> {
        // Only cleanup temp directories from media_merge_* pattern
        // Don't delete shared tmp/ dir as other jobs may be using it
        const startTime = Date.now();
        
        const tmpBaseDir = path.join(this.recordingsRoot, "tmp");
        
        try {
            const entries = await fs.readdir(tmpBaseDir, { withFileTypes: true });
            let deletedCount = 0;
            
            for (const entry of entries) {
                // Only delete media_merge_* directories
                if (entry.isDirectory() && entry.name.startsWith("media_merge_")) {
                    await fs.rm(path.join(tmpBaseDir, entry.name), { recursive: true, force: true }).catch(() => undefined);
                    deletedCount++;
                }
            }
        } catch (error) {
            // Ignore errors if tmp dir doesn't exist
            this.log(`[cleanupLegacyRecordingsTmp] Note: Could not access tmp directory (may be normal)`);
        }
    }

    private async runWithConcurrency<T>(
        items: T[],
        concurrency: number,
        worker: (item: T, index: number) => Promise<void>
    ): Promise<void> {
        let nextIndex = 0;
        const workerCount = Math.min(concurrency, items.length);

        await Promise.all(Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++;
                await worker(items[currentIndex]!, currentIndex);
            }
        }));
    }

    public async process(): Promise<string> {
        const totalStartTime = Date.now();

        try {
            let phaseStart = Date.now();
            await this.createDirectories();
            let phaseDuration = Date.now() - phaseStart;

            phaseStart = Date.now();
            const userChunks = await this.collectUserChunks();
            phaseDuration = Date.now() - phaseStart;
            
            // Calculate recording start time and user join times
            let recordingStartTime = Number.MAX_VALUE;
            const userJoinTimes = new Map<string, number>();
            
            for (const [userId, chunks] of userChunks.entries()) {
                const joinTime = chunks[0]!.timestamp; // First chunk timestamp is when user joined
                userJoinTimes.set(userId, joinTime);
                recordingStartTime = Math.min(recordingStartTime, joinTime);
            }

            const processedUsers: ProcessedUser[] = [];
            const failedUsers: FailedUser[] = [];

            phaseStart = Date.now();
            const userEntries = Array.from(userChunks.entries());
            await this.runWithConcurrency(userEntries, this.config.maxConcurrentUserJobs, async ([userId, chunks]) => {
                const userStart = Date.now();
                const userVideo = await this.createUserVideo(userId, chunks);
                const userDuration = Date.now() - userStart;
                const joinTime = userJoinTimes.get(userId) || Date.now();
                const leadingPaddingSeconds = Math.max(0, (joinTime - recordingStartTime) / 1000);
                
                if (!userVideo) {
                    this.log(`[phase:createUserVideos] User ${userId} FAILED (${userDuration}ms)`);
                    failedUsers.push({
                        userId,
                        estimatedDuration: leadingPaddingSeconds + Math.max(1, chunks.length * 5),
                        joinTimestamp: joinTime,
                    });
                    return;
                }

                const duration = await this.getVideoDuration(userVideo);
                const hasAudio = await this.hasAudioStream(userVideo);
                const finalDuration = duration + leadingPaddingSeconds;

                processedUsers.push({ 
                    userId, 
                    videoPath: userVideo, 
                    duration: finalDuration, 
                    hasAudio,
                    joinTimestamp: joinTime,
                    leadingPaddingSeconds,
                });
            });
            phaseDuration = Date.now() - phaseStart;

            if (failedUsers.length > 0) {
                phaseStart = Date.now();
                const baseDuration =
                processedUsers.length > 0
                    ? Math.max(...processedUsers.map((user) => user.duration))
                    : Math.max(...failedUsers.map((user) => user.estimatedDuration));

                let failedCount = 0;
                for (const failedUser of failedUsers) {
                    failedCount++;
                    const leadingPaddingSeconds = Math.max(0, (failedUser.joinTimestamp - recordingStartTime) / 1000);
                    const placeholderDuration = Math.max(1, baseDuration - leadingPaddingSeconds);
                    
                    const placeholderPath = await this.createBlackPlaceholderVideo(
                        failedUser.userId,
                        placeholderDuration
                    );

                    const finalDuration = placeholderDuration + leadingPaddingSeconds;
                    processedUsers.push({
                        userId: failedUser.userId,
                        videoPath: placeholderPath,
                        duration: finalDuration,
                        hasAudio: false,
                        joinTimestamp: failedUser.joinTimestamp,
                        leadingPaddingSeconds,
                    });
                }
                phaseDuration = Date.now() - phaseStart;
            }

            if (processedUsers.length === 0) {
                throw new Error("No videos were created for merging");
            }

            // Sort by join time for consistent grid layout (users appear in order they joined)
            processedUsers.sort((a, b) => a.joinTimestamp - b.joinTimestamp);

            phaseStart = Date.now();
            const normalized = await this.normalizeVideoDurations(processedUsers);
            phaseDuration = Date.now() - phaseStart;

            phaseStart = Date.now();
            const gridVideo = await this.createGridVideo(normalized);
            phaseDuration = Date.now() - phaseStart;

            phaseStart = Date.now();
            const finalPath = await this.persistFinal(gridVideo);
            phaseDuration = Date.now() - phaseStart;

            await this.cleanupSourceChunksFromS3();
            await this.cleanupLegacyLocalChunks();

            await this.cleanupLegacyRecordingsTmp();

            const totalDuration = Date.now() - totalStartTime;
            this.log(`✓ MERGE COMPLETE in ${(totalDuration / 1000).toFixed(1)}s - Final: ${finalPath}`);

            return finalPath;
        } catch (error) {
            const totalDuration = Date.now() - totalStartTime;
            this.log(`✗ MERGE FAILED after ${(totalDuration / 1000).toFixed(1)}s - Error: ${error}`);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

async function reportWorkerStatus(meetingId: string, status: "PROCESSING" | "READY" | "FAILED", finalPath?: string) {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000/api/v1";
    try {
        await axios.request({
            url: `${backendUrl}/worker/recording-status/${meetingId}`,
            method: "POST",
            headers: {
                "x-worker-token": getBackendServiceToken(),
                "Content-Type": "application/json",
            },
            data: {
                status,
                finalPath,
            },
            timeout: 10000,
        });
    } catch (error) {
        console.error(`Failed to report status ${status} for meeting ${meetingId}:`, error);
        throw error; // Re-throw to allow caller to handle
    }
}

async function processQueue() {
    console.log("Starting merger-worker queue processor...");

    while (true) {
        let meetingId: string | null = null;
        try {
            const result = await redisClient.blpop("ProcessVideo", 35);
            
            if (!result) {
                console.log(`[${new Date().toISOString()}] No result from queue`);
                continue;
            }

            const data = JSON.parse(result[1]);
            meetingId = data.roomId || data.meetingId;

            if (!meetingId) {
                console.error(`[${new Date().toISOString()}] Invalid queue payload: missing meetingId - ${JSON.stringify(data)}`);
                continue;
            }

            try {
                console.log(`[${new Date().toISOString()}] Starting merge for meeting ${meetingId}...`);
                await reportWorkerStatus(meetingId, "PROCESSING");
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Failed to report PROCESSING status:`, error);
                // Don't bail out, attempt merge anyway
            }

            try {
                const merger = new LocalVideoMerger(meetingId);
                const finalPath = await merger.process();
                
                // Queue for transcoding
                await redisClient.rpush("TranscodeVideo", JSON.stringify({ meetingId, finalPath }));
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Merge failed for ${meetingId}:`, error);
                try {
                    await reportWorkerStatus(meetingId, "FAILED");
                } catch (statusError) {
                    console.error(`[${new Date().toISOString()}] Failed to report FAILED status:`, statusError);
                }
            }
        } catch (error) {
            if (error instanceof Error && error.message === "Redis timeout") {
                // Intentional timeout, continue loop
                console.log(`[${new Date().toISOString()}] Queue timeout (normal), waiting for next job...`);
                continue;
            }
            console.error(`[${new Date().toISOString()}] Queue loop error:`, error);
            // Wait before retrying to avoid tight loop
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

processQueue();