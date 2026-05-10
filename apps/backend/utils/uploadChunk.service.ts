import path from "path";
import { prisma } from "@repo/db/client";
import { sanitizePathSegment, getFileExtension } from "./helpers";
import { keyToCdnUrl, putObjectToS3 } from "./storage";

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
  fileMimeType,
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

  await writetoS3(outputPath, fileBuffer, fileMimeType || mimeType);

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

  return keyToCdnUrl(outputPath);
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
    "weave-recordings",
    roomId,
    "raw",
    "users",
    participantId,
    `chunk-${chunkSuffix}.${extension}`
  );

  return relativeChunkPath.split(path.sep).join("/");
}


async function writetoS3(outputPath: string, buffer: Buffer, contentType: string) {
  await putObjectToS3({
    key: outputPath,
    body: buffer,
    contentType: contentType || "video/webm",
  });
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
