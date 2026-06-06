import * as fs from "node:fs/promises";
import * as path from "node:path";
import { putObjectToS3, buildS3Key } from "@repo/amazons3";
import { resolveStorageContext } from "@repo/amazons3";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db/client";
import { collectUserChunks } from "./chunks";
import { createUserVideo, createBlackPlaceholderVideo } from "./video-creator";
import { createGridVideo } from "./grid-builder";
import {
  cleanupTempDir,
  cleanupSourceChunksFromS3,
  cleanupLegacyLocalChunks,
  cleanupLegacyRecordingsTmp,
} from "./cleanup";
import { getVideoDuration, hasAudioStream, ffprobeBin } from "./ffmpeg";
import { getPositiveIntegerEnv } from "./config";
import {
  computeMeetingEndMs,
  computeMeetingEpochMs,
  timelineDurationSeconds,
} from "./timeline";
import {
  type MergerConfig,
  type ProcessedUser,
  type FailedUser,
} from "./types";

const environment = process.env.NODE_ENV || "development";

export class LocalVideoMerger {
  private readonly meetingId: string;
  private readonly recordingsRoot: string;
  private readonly tempDir: string;
  private readonly bucketName: string;
  private readonly s3Client: ReturnType<
    typeof resolveStorageContext
  >["s3Client"];

  private config: MergerConfig = {
    frameRate: getPositiveIntegerEnv("MERGER_FRAME_RATE", 30),
    audioBitrate: "320k",
    maxConcurrentUserJobs: getPositiveIntegerEnv("MERGER_USER_CONCURRENCY", 2),
  };

  constructor(meetingId: string) {
    this.meetingId = meetingId;

    this.recordingsRoot =
      environment === "production"
        ? "/app/recordings"
        : path.resolve(process.cwd(), "../../recordings");
    this.tempDir = path.join(
      this.recordingsRoot,
      "tmp",
      `media_merge_${Date.now()}`,
    );
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

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
          const currentIndex = nextIndex++;
          await worker(items[currentIndex]!, currentIndex);
        }
      }),
    );
  }

  private async resolveCanonicalMeetingId(): Promise<string> {
    const requestedId = this.meetingId.trim().replace(/\/+$/u, "");

    const meetingByRoomId = await prisma.meeting.findUnique({
      where: { roomId: requestedId },
      select: { roomId: true },
    });

    if (meetingByRoomId?.roomId) {
      return meetingByRoomId.roomId;
    }

    const meetingByInternalId = await prisma.meeting.findUnique({
      where: { id: requestedId },
      select: { roomId: true },
    });

    return meetingByInternalId?.roomId || requestedId;
  }

  private async persistFinal(
    gridVideoPath: string,
    meetingId: string,
  ): Promise<string> {
    const finalKey = `weave-recordings/${meetingId}/final/meeting_grid_recording.mp4`;
    const fileStats = await fs.stat(gridVideoPath);
    const uploadStart = Date.now();

    this.log(
      `[phase:persistFinal] Uploading final video (${fileStats.size} bytes) to s3://${this.bucketName}/${finalKey}`,
    );

    try {
      const body = await fs.readFile(gridVideoPath);
      await putObjectToS3({
        s3Client: this.s3Client,
        bucketName: this.bucketName,
        key: finalKey,
        body,
        contentType: "video/mp4",
      });
    } catch (error) {
      throw new Error(
        `Final buffered upload failed for ${finalKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const head = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
      }),
    );
    const uploadedSize = head.ContentLength ?? 0;
    const verified = uploadedSize > fileStats.size * 0.5;

    if (!verified) {
      throw new Error(
        `Final upload verification failed for ${finalKey} (uploaded: ${uploadedSize}, expected: >${fileStats.size * 0.5})`,
      );
    }

    this.log(
      `[phase:persistFinal] Final upload complete in ${Date.now() - uploadStart}ms (verified ${uploadedSize} bytes)`,
    );

    return finalKey;
  }

  private async persistParticipantVideos(
    processedUsers: ProcessedUser[],
    meetingId: string,
  ): Promise<void> {
    this.log(
      `[phase:persistParticipants] Uploading ${processedUsers.length} participant videos`,
    );

    const results = await Promise.allSettled(
      processedUsers.map(async (user) => {
        const videoKey = buildS3Key(
          "weave-recordings",
          meetingId,
          "participants",
          user.userId,
          "merged.mp4",
        );
        const fileStats = await fs.stat(user.videoPath);

        const body = await fs.readFile(user.videoPath);
        await putObjectToS3({
          s3Client: this.s3Client,
          bucketName: this.bucketName,
          key: videoKey,
          body,
          contentType: "video/mp4",
        });

        await prisma.participantSource.upsert({
          where: {
            meetingId_participantId: {
              meetingId,
              participantId: user.userId,
            },
          },
          update: {
            videoUrl: videoKey,
            durationMs: Math.round(user.duration * 1000),
            fileSizeBytes: fileStats.size,
          },
          create: {
            meetingId,
            participantId: user.userId,
            videoUrl: videoKey,
            durationMs: Math.round(user.duration * 1000),
            fileSizeBytes: fileStats.size,
          },
        });

        this.log(
          `[phase:persistParticipants] Uploaded ${user.userId} (${(fileStats.size / 1024 / 1024).toFixed(1)} MB)`,
        );
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      this.log(
        `[phase:persistParticipants] ${failed.length}/${processedUsers.length} participant uploads failed`,
      );
    }
  }

  public async process(): Promise<string> {
    const totalStartTime = Date.now();

    try {
      await this.createDirectories();

      const canonicalMeetingId = await this.resolveCanonicalMeetingId();

      const { userChunks, recordingStartedAtMs } = await collectUserChunks(
        canonicalMeetingId,
        this.tempDir,
        this.s3Client,
        this.bucketName,
      );

      if (recordingStartedAtMs) {
        this.log(
          `[phase:timeline] recordingStartedAt=${new Date(recordingStartedAtMs).toISOString()} (reference only)`,
        );
      }

      const meetingEpochMs = computeMeetingEpochMs(userChunks);
      const meetingEndMs = computeMeetingEndMs(userChunks);
      const meetingDurationSeconds = timelineDurationSeconds(
        meetingEpochMs,
        meetingEndMs,
      );

      this.log(
        `[phase:timeline] epoch=${new Date(meetingEpochMs).toISOString()} end=${new Date(meetingEndMs).toISOString()} duration=${meetingDurationSeconds.toFixed(2)}s`,
      );

      for (const [userId, chunks] of userChunks.entries()) {
        const sorted = chunks;
        this.log(
          `[phase:collectUserChunks] user=${userId} chunks=${chunks.length} timeline=${sorted.map((c) => `${new Date(c.timestamp).toISOString()}(+${c.durationSeconds.toFixed(1)}s)`).join(" | ")}`,
        );
      }

      const processedUsers: ProcessedUser[] = [];
      const failedUsers: FailedUser[] = [];

      const userEntries = Array.from(userChunks.entries());
      await this.runWithConcurrency(
        userEntries,
        this.config.maxConcurrentUserJobs,
        async ([userId, chunks]) => {
          const userStart = Date.now();
          const userVideo = await createUserVideo(
            userId,
            chunks,
            this.tempDir,
            this.config,
            meetingEpochMs,
            meetingEndMs,
            this.log.bind(this),
          );
          const userDuration = Date.now() - userStart;

          if (!userVideo) {
            this.log(
              `[phase:createUserVideos] User ${userId} FAILED (${userDuration}ms)`,
            );
            failedUsers.push({
              userId,
              estimatedDuration: meetingDurationSeconds,
              joinTimestamp: chunks[0]?.timestamp ?? meetingEpochMs,
            });
            return;
          }

          const hasAudio = await hasAudioStream(
            userVideo,
            ffprobeBin,
            this.log.bind(this),
          );

          let encodedDuration = meetingDurationSeconds;
          try {
            encodedDuration = await getVideoDuration(
              userVideo,
              ffprobeBin,
              this.log.bind(this),
            );
          } catch {
            // use meeting timeline duration
          }

          const joinTime = chunks[0]?.timestamp ?? meetingEpochMs;
          const leadingPaddingSeconds = Math.max(
            0,
            (joinTime - meetingEpochMs) / 1000,
          );

          processedUsers.push({
            userId,
            videoPath: userVideo,
            duration: Math.max(encodedDuration, meetingDurationSeconds),
            hasAudio,
            joinTimestamp: joinTime,
            leadingPaddingSeconds,
          });
        },
      );

      if (failedUsers.length > 0) {
        for (const failedUser of failedUsers) {
          this.log(
            `[phase:createUserVideos] User ${failedUser.userId} had no decodable video — using black placeholder`,
          );

          const placeholderPath = await createBlackPlaceholderVideo(
            failedUser.userId,
            meetingDurationSeconds,
            this.tempDir,
            this.config,
            this.log.bind(this),
          );

          const leadingPaddingSeconds = Math.max(
            0,
            (failedUser.joinTimestamp - meetingEpochMs) / 1000,
          );

          processedUsers.push({
            userId: failedUser.userId,
            videoPath: placeholderPath,
            duration: meetingDurationSeconds,
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

      await this.persistParticipantVideos(processedUsers, canonicalMeetingId);

      const gridVideo = await createGridVideo(
        processedUsers,
        this.tempDir,
        this.config,
        this.log.bind(this),
      );

      const finalPath = await this.persistFinal(gridVideo, canonicalMeetingId);

      this.log(
        "[phase:cleanup] Starting post-merge cleanup (keeping raw chunks for multicam)",
      );
      await Promise.allSettled([
        // Raw S3 chunks preserved for multicam timeline reconstruction
        // cleanupSourceChunksFromS3(canonicalMeetingId, this.s3Client, this.bucketName),
        cleanupLegacyLocalChunks(this.recordingsRoot, canonicalMeetingId),
        cleanupLegacyRecordingsTmp(
          this.recordingsRoot,
          this.tempDir,
          this.log.bind(this),
        ),
      ]);
      this.log("[phase:cleanup] Post-merge cleanup finished");

      const totalDuration = Date.now() - totalStartTime;
      this.log(
        `✓ MERGE COMPLETE in ${(totalDuration / 1000).toFixed(1)}s - Final: ${finalPath}`,
      );

      return finalPath;
    } catch (error) {
      const totalDuration = Date.now() - totalStartTime;
      this.log(
        `✗ MERGE FAILED after ${(totalDuration / 1000).toFixed(1)}s - Error: ${error}`,
      );
      throw error;
    } finally {
      await cleanupTempDir(this.tempDir, this.log.bind(this));
    }
  }
}
