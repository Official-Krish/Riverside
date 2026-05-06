import path from "path";
import fs from "fs/promises";
import { prisma } from "@repo/db/client";
import { sanitizePathSegment, getFileExtension } from "./helpers";
import { recordingsRoot } from "./helpers";

interface UploadChunkParams {
  fileBuffer: Buffer;
  fileMimeType: string;
  meetingId: string;
  userId: string;
  rawParticipantId?: string;
  sequenceNumber: number | null;
  startedAt: Date | null;
  durationMs: number | null;
  mimeType: string;
  isEncrypted?: boolean;
  sourceMimeType?: string | null;
  encryptionAlgorithm?: string | null;
  encryptionIv?: string | null;
  encryptionTagBits?: number | null;
}

export async function uploadChunk({
  fileBuffer,
  meetingId: roomId,
  userId,
  rawParticipantId,
  sequenceNumber,
  startedAt,
  durationMs,
  mimeType,
  isEncrypted = false,
  sourceMimeType,
  encryptionAlgorithm,
  encryptionIv,
  encryptionTagBits = null,
}: UploadChunkParams) {
  const participantId =
    sanitizePathSegment(userId) || sanitizePathSegment(rawParticipantId);

  if (!participantId) {
    const error = new Error("Invalid participant identity");
    (error as any).statusCode = 400;
    throw error;
  }

  const meeting = await resolveMeetingForUploader(roomId, userId);

  const outputPath = buildChunkOutputPath({
    roomId,
    participantId,
    mimeType,
    sequenceNumber,
    startedAt,
  });

  await writeChunkToDisk(outputPath, fileBuffer);

  await prisma.mediaChunk.upsert({
    where: {
      meetingId_uploaderUserId_sequenceNumber: {
        meetingId: meeting.id,
        uploaderUserId: userId,
        sequenceNumber: toValidNumber(sequenceNumber) ?? 0,
      },
    },
    create: {
      meetingId: meeting.id,
      bucketLink: outputPath,
      mimeType,
      sourceMimeType,
      isEncrypted,
      encryptionAlgorithm,
      encryptionIv,
      encryptionTagBits: toValidNumber(encryptionTagBits),
      uploaderUserId: userId,
      sequenceNumber: toValidNumber(sequenceNumber),
      durationMs: toValidNumber(durationMs),
      startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : null,
      status: "UPLOADED",
    },
    update: {
      bucketLink: outputPath,
      mimeType,
      sourceMimeType,
      isEncrypted,
      encryptionAlgorithm,
      encryptionIv,
      encryptionTagBits: toValidNumber(encryptionTagBits),
      durationMs: toValidNumber(durationMs),
      startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : null,
      status: "UPLOADED",
    },
  });

  return outputPath;
}

function buildChunkOutputPath({
  roomId,
  participantId,
  mimeType,
  sequenceNumber,
  startedAt,
}: {
  roomId: string;
  participantId: string;
  mimeType: string;
  sequenceNumber: number | null;
  startedAt: Date | null;
}) {
  const extension = getFileExtension(mimeType);
  const timestamp = (startedAt ?? new Date())
    .toISOString()
    .replace(/[:.]/g, "-");

  const chunkSuffix =
    sequenceNumber !== null && !Number.isNaN(sequenceNumber)
      ? `${String(sequenceNumber).padStart(6, "0")}-${timestamp}`
      : timestamp;

  const relativeChunkPath = path.join(
    roomId,
    "raw",
    "users",
    participantId,
    `chunk-${chunkSuffix}.${extension}`
  );

  return path.join(recordingsRoot, relativeChunkPath);
}

async function writeChunkToDisk(outputPath: string, buffer: Buffer) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);
}

async function resolveMeetingForUploader(roomId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    include: {
      participants: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!meeting) {
    console.warn(`Meeting not found for uploaded chunk: roomId=${roomId}, userId=${userId}`);
    const error = new Error("Meeting session not found for uploader");
    (error as any).statusCode = 404;
    throw error;
  }

  const isAuthorizedUploader = meeting.userId === userId || meeting.participants.length > 0;

  if (!isAuthorizedUploader) {
    console.warn(`Unauthorized chunk upload attempt: roomId=${roomId}, userId=${userId}`);
    const error = new Error("Uploader is not part of this meeting");
    (error as any).statusCode = 403;
    throw error;
  }

  return meeting;
}

function toValidNumber(value: number | null): number | null {
  return value !== null && !Number.isNaN(value) ? value : null;
}
