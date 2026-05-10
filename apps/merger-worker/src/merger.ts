import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
    putObjectToS3,
} from "@repo/amazons3";
import { resolveStorageContext } from "@repo/amazons3";
import { collectUserChunks } from "./chunks";
import { createUserVideo, createBlackPlaceholderVideo } from "./video-creator";
import { createGridVideo, normalizeVideoDurations } from "./grid-builder";
import { cleanupTempDir, cleanupSourceChunksFromS3, cleanupLegacyLocalChunks, cleanupLegacyRecordingsTmp } from "./cleanup";
import { getVideoDuration, hasAudioStream, ffprobeBin } from "./ffmpeg";
import { getPositiveIntegerEnv } from "./config";
import { type MergerConfig, type ProcessedUser, type FailedUser, type UserChunk } from "./types";

export class LocalVideoMerger {
    private readonly meetingId: string;
    private readonly recordingsRoot: string;
    private readonly tempDir: string;
    private readonly bucketName: string;
    private readonly s3Client: ReturnType<typeof resolveStorageContext>["s3Client"];

    private config: MergerConfig = {
        frameRate: 60,
        audioBitrate: "320k",
        maxConcurrentUserJobs: getPositiveIntegerEnv("MERGER_USER_CONCURRENCY", 2),
    };

    constructor(meetingId: string) {
        this.meetingId = meetingId;
        this.recordingsRoot = path.resolve(process.cwd(), "../../recordings");
        this.tempDir = path.join(this.recordingsRoot, "tmp", `media_merge_${Date.now()}`);
        const storage = resolveStorageContext();
        this.bucketName = storage.bucketName;
        this.s3Client = storage.s3Client;
    }

    private log(message: string): void {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    private async createDirectories(): Promise<void> {
        await fs.mkdir(this.tempDir, { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "chunks"), { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "videos"), { recursive: true });
        await fs.mkdir(path.join(this.tempDir, "output"), { recursive: true });
    }

    private async runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
        let nextIndex = 0;
        const workerCount = Math.min(concurrency, items.length);

        await Promise.all(Array.from({ length: workerCount }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++;
                await worker(items[currentIndex]!, currentIndex);
            }
        }));
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

    public async process(): Promise<string> {
        const totalStartTime = Date.now();

        try {
            await this.createDirectories();

            const userChunks = await collectUserChunks(
                this.meetingId,
                this.tempDir,
                this.s3Client,
                this.bucketName
            );

            let recordingStartTime = Number.MAX_VALUE;
            const userJoinTimes = new Map<string, number>();

            for (const [userId, chunks] of userChunks.entries()) {
                const joinTime = chunks[0]!.timestamp;
                userJoinTimes.set(userId, joinTime);
                recordingStartTime = Math.min(recordingStartTime, joinTime);
            }

            const processedUsers: ProcessedUser[] = [];
            const failedUsers: FailedUser[] = [];

            const userEntries = Array.from(userChunks.entries());
            await this.runWithConcurrency(userEntries, this.config.maxConcurrentUserJobs, async ([userId, chunks]) => {
                const userStart = Date.now();
                const userVideo = await createUserVideo(userId, chunks, this.tempDir, this.config, this.log.bind(this));
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

                const duration = await getVideoDuration(userVideo, ffprobeBin, this.log.bind(this));
                const hasAudio = await hasAudioStream(userVideo, ffprobeBin, this.log.bind(this));
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
                const baseDuration = processedUsers.length > 0
                    ? Math.max(...processedUsers.map(user => user.duration))
                    : Math.max(...failedUsers.map(user => user.estimatedDuration));

                for (const failedUser of failedUsers) {
                    const leadingPaddingSeconds = Math.max(0, (failedUser.joinTimestamp - recordingStartTime) / 1000);
                    const placeholderDuration = Math.max(1, baseDuration - leadingPaddingSeconds);

                    const placeholderPath = await createBlackPlaceholderVideo(
                        failedUser.userId,
                        placeholderDuration,
                        this.tempDir,
                        this.config,
                        this.log.bind(this)
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

            processedUsers.sort((a, b) => a.joinTimestamp - b.joinTimestamp);

            const normalized = normalizeVideoDurations(processedUsers, this.log.bind(this));

            const gridVideo = await createGridVideo(normalized, this.tempDir, this.config, this.log.bind(this));

            const finalPath = await this.persistFinal(gridVideo);

            await cleanupSourceChunksFromS3(this.meetingId, this.s3Client, this.bucketName);
            await cleanupLegacyLocalChunks(this.recordingsRoot, this.meetingId);
            await cleanupLegacyRecordingsTmp(this.recordingsRoot, this.log.bind(this));

            const totalDuration = Date.now() - totalStartTime;
            this.log(`✓ MERGE COMPLETE in ${(totalDuration / 1000).toFixed(1)}s - Final: ${finalPath}`);

            return finalPath;
        } catch (error) {
            const totalDuration = Date.now() - totalStartTime;
            this.log(`✗ MERGE FAILED after ${(totalDuration / 1000).toFixed(1)}s - Error: ${error}`);
            throw error;
        } finally {
            await cleanupTempDir(this.tempDir, this.log.bind(this));
        }
    }
}