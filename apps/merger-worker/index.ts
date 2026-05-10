import * as fs from "node:fs/promises";
import * as path from "node:path";
import { spawn } from "node:child_process";
import { constants, createDecipheriv, createPrivateKey, privateDecrypt, type KeyObject } from "node:crypto";
import { Redis } from "ioredis";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import jwt from "jsonwebtoken";
import axios from "axios";
import { prisma } from "@repo/db/client";

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
    metadata?: {
        isEncrypted: boolean;
        sourceMimeType: string | null;
        encryptionAlgorithm: string | null;
        encryptionIv: string | null;
        encryptionTagBits: number | null;
    } | null;
}

let cachedServerPrivateKey: KeyObject | null = null;

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

function mimeTypeToExtension(mimeType?: string | null): string {
    if (!mimeType) {
        return "webm";
    }

    if (mimeType.includes("mp4")) {
        return "mp4";
    }

    if (mimeType.includes("ogg")) {
        return "ogg";
    }

    if (mimeType.includes("webm")) {
        return "webm";
    }

    return "webm";
}

function getWrappedCekKey(meetingId: string, participantId: string) {
    return `meeting:wrapped-cek:${meetingId}:${participantId}`;
}

class LocalVideoMerger {
    private readonly meetingId: string;
    private readonly recordingsRoot: string;
    private readonly tempDir: string;
    private readonly outputDir: string;

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
        this.outputDir = path.join(this.recordingsRoot, this.meetingId, "final");
        this.ffmpegBin = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
        this.ffprobeBin = process.env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";
    }

    private log(message: string) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    private async getServerPrivateKey(): Promise<KeyObject> {
        if (cachedServerPrivateKey) {
            return cachedServerPrivateKey;
        }

        const keyPair = await prisma.serverKeyPair.findUnique({
            where: { id: "singleton" },
            select: { privateKeyPem: true },
        });

        if (!keyPair) {
            throw new Error("Server keypair not found in database");
        }

        cachedServerPrivateKey = createPrivateKey(keyPair.privateKeyPem);
        return cachedServerPrivateKey;
    }

    private async getWrappedMeetingCek(participantId: string): Promise<Buffer> {
        const record = await redisClient.hgetall(getWrappedCekKey(this.meetingId, participantId));

        if (!record?.wrappedCek) {
            throw new Error(`Wrapped CEK not found for participant ${participantId}`);
        }

        const parsed = JSON.parse(record.wrappedCek) as number[];
        return Buffer.from(parsed);
    }

    private async unwrapMeetingCek(participantId: string): Promise<Buffer> {
        const wrappedCek = await this.getWrappedMeetingCek(participantId);
        const privateKey = await this.getServerPrivateKey();

        return privateDecrypt(
            {
                key: privateKey,
                oaepHash: "sha256",
                padding: constants.RSA_PKCS1_OAEP_PADDING,
            },
            wrappedCek
        );
    }

    private decryptEncryptedChunk(ciphertext: Buffer, cek: Buffer, ivBase64: string, tagBits: number | null): Buffer {
        const iv = Buffer.from(ivBase64, "base64");
        const authTagBytes = Math.max(16, Math.floor((tagBits ?? 128) / 8));

        if (ciphertext.length <= authTagBytes) {
            throw new Error("Encrypted chunk is too small to contain an auth tag");
        }

        const encryptedBody = ciphertext.subarray(0, ciphertext.length - authTagBytes);
        const authTag = ciphertext.subarray(ciphertext.length - authTagBytes);
        const decipher = createDecipheriv("aes-256-gcm", cek, iv);

        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encryptedBody), decipher.final()]);
    }

    private async decryptChunkToTempFile(chunk: UserChunk): Promise<string> {
        if (!chunk.metadata?.isEncrypted) {
            return chunk.localPath;
        }

        if (chunk.metadata.encryptionAlgorithm !== "AES-GCM") {
            throw new Error(`Unsupported chunk encryption algorithm: ${chunk.metadata.encryptionAlgorithm || "unknown"}`);
        }

        if (!chunk.metadata.encryptionIv) {
            throw new Error(`Missing encryption IV for chunk ${chunk.localPath}`);
        }

        const wrappedCek = await this.unwrapMeetingCek(chunk.userId);
        const ciphertext = await fs.readFile(chunk.localPath);
        const plaintext = this.decryptEncryptedChunk(
            ciphertext,
            wrappedCek,
            chunk.metadata.encryptionIv,
            chunk.metadata.encryptionTagBits
        );

        const decryptedDir = path.join(this.tempDir, "decrypted", chunk.userId);
        await fs.mkdir(decryptedDir, { recursive: true });

        const sourceExtension = mimeTypeToExtension(chunk.metadata.sourceMimeType);
        const decryptedPath = path.join(
            decryptedDir,
            `${path.basename(chunk.localPath, path.extname(chunk.localPath))}.decrypted.${sourceExtension}`
        );

        await fs.writeFile(decryptedPath, plaintext);
        return decryptedPath;
    }

    private async createDirectories() {
        await fs.mkdir(this.tempDir, { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "videos"), { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "output"), { recursive: true });
        await fs.mkdir(this.outputDir, { recursive: true });
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
        const usersRoot = path.join(this.recordingsRoot, this.meetingId, "raw", "users");
        const meetingRecord = await prisma.meeting.findUnique({
            where: { roomId: this.meetingId },
            select: { id: true },
        });

        if (!meetingRecord) {
            throw new Error(`Meeting not found for roomId ${this.meetingId}`);
        }

        const mediaChunks = await prisma.mediaChunk.findMany({
            where: { meetingId: meetingRecord.id },
            select: {
                bucketLink: true,
                isEncrypted: true,
                sourceMimeType: true,
                encryptionAlgorithm: true,
                encryptionIv: true,
                encryptionTagBits: true,
            },
        });

        const metadataByPath = new Map(
            mediaChunks.map((record) => [path.resolve(record.bucketLink), record])
        );

        const userDirs = await fs.readdir(usersRoot, { withFileTypes: true }).catch(() => []);
        if (userDirs.length === 0) {
            throw new Error(`No local chunks found in ${usersRoot}`);
        }

        const userChunks = new Map<string, UserChunk[]>();

        for (const dirent of userDirs) {
            if (!dirent.isDirectory()) {
                continue;
            }

            const userId = dirent.name;
            const userDirPath = path.join(usersRoot, userId);
            const files = await fs.readdir(userDirPath).catch(() => []);

            const chunks = files
                .filter((file) => /chunk-.*\.(webm|mp4|ogg)$/i.test(file))
                .map((file) => {
                    const localPath = path.join(userDirPath, file);
                    const metadata = metadataByPath.get(path.resolve(localPath));

                    return {
                        userId,
                        localPath,
                        timestamp: parseChunkTimestamp(file) ?? Date.now(),
                        metadata: metadata
                            ? {
                                isEncrypted: metadata.isEncrypted,
                                sourceMimeType: metadata.sourceMimeType,
                                encryptionAlgorithm: metadata.encryptionAlgorithm,
                                encryptionIv: metadata.encryptionIv,
                                encryptionTagBits: metadata.encryptionTagBits,
                            }
                            : null,
                    };
                })
                .sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp

            const encryptedChunks = chunks.filter((chunk) => chunk.metadata?.isEncrypted);
            if (encryptedChunks.length > 0) {
                for (const chunk of encryptedChunks) {
                    chunk.localPath = await this.decryptChunkToTempFile(chunk);
                }
            }

            if (chunks.length > 0) {
                userChunks.set(userId, chunks);
            }
        }

        if (userChunks.size === 0) {
            throw new Error("No valid chunk files found for any user");
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
        const startTime = Date.now();
        const label = `persistFinal[${path.basename(gridVideoPath)}]`;
        
        const finalPath = path.join(this.outputDir, "meeting_grid_recording.mp4");
        
        await fs.copyFile(gridVideoPath, finalPath);
        
        // GCP upload flow retained for future use (intentionally commented, not removed).
        // import { Storage } from "@google-cloud/storage";
        // const storage = new Storage({ keyFilename: "./gcp-key.json" });
        // const bucket = storage.bucket(process.env.BUCKET_NAME!);
        // await bucket.upload(gridVideoPath, {
        //   destination: `weave/${this.meetingId}/processed/video/meeting_grid_recording.mp4`,
        //   metadata: { contentType: "video/mp4" },
        // });

        return finalPath;
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

            phaseStart = Date.now();
            const userChunks = await this.collectUserChunks();
            
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

            if (failedUsers.length > 0) {
                const baseDuration =
                processedUsers.length > 0
                    ? Math.max(...processedUsers.map((user) => user.duration))
                    : Math.max(...failedUsers.map((user) => user.estimatedDuration));

                for (const failedUser of failedUsers) {
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
            }

            if (processedUsers.length === 0) {
                throw new Error("No videos were created for merging");
            }

            // Sort by join time for consistent grid layout (users appear in order they joined)
            processedUsers.sort((a, b) => a.joinTimestamp - b.joinTimestamp);

            const normalized = await this.normalizeVideoDurations(processedUsers);

            const gridVideo = await this.createGridVideo(normalized);

            const finalPath = await this.persistFinal(gridVideo);

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

async function reportWorkerStatus(meetingId: string, status: "PROCESSING" | "FAILED", finalPath?: string) {
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
            const result = (await redisClient.blpop("ProcessVideo", 35)) as [string, string] | null;

            if (!result) {
                // No job within timeout, continue loop and wait again.
                console.log(`[${new Date().toISOString()}] Queue timeout (no job), waiting for next job...`);
                continue;
            }

            const data = JSON.parse(result[1]);
            meetingId = data.roomId || data.meetingId;

            if (!meetingId) {
                console.error(`[${new Date().toISOString()}] Invalid queue payload: missing meetingId - ${JSON.stringify(data)}`);
                continue;
            }

            try {
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