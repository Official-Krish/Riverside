import { prisma } from "@repo/db/client";
import { toPublicRecordingLink } from "./helpers";

export async function handleProcessingStatus(meetingIdentifier: string) {
  const meeting = await getMeetingByIdentifier(meetingIdentifier);

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: {
      recordingState: "PROCESSING",
      processingStartedAt: new Date(),
      processingEndedAt: null,
    },
  });
}

export async function handleFailedStatus(meetingIdentifier: string) {
  const meeting = await getMeetingByIdentifier(meetingIdentifier);

  await prisma.$transaction([
    prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        recordingState: "FAILED",
        processingEndedAt: new Date(),
      },
    }),
    prisma.notification.create({
      data: {
        userId: meeting.userId,
        type: "RECORDING_FAILED",
        message: `Recording for meeting "${meeting.roomName}" has failed to process.`,
        metadata: { roomId: meeting.roomId },
        createdAt: new Date(),
      },
    }),
  ]);
}

export async function handleReadyStatus(meetingIdentifier: string, finalPath: string) {
  const meeting = await getMeetingByIdentifier(meetingIdentifier);
  const publicFinalPath = toPublicRecordingLink(finalPath);

  await prisma.$transaction(async (tx) => {
    await tx.finalRecording.upsert({
      where: { meetingId: meeting.id },
      create: {
        meetingId: meeting.id,
        videoLink: publicFinalPath,
        visibleToEmails: [],
      },
      update: {
        videoLink: publicFinalPath,
      },
    });

    await tx.meeting.update({
      where: { id: meeting.id },
      data: {
        recordingState: "READY",
        processingEndedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        userId: meeting.userId,
        type: "RECORDING_READY",
        message: `Recording for meeting "${meeting.roomName}" is ready.`,
        metadata: {
          roomId: meeting.roomId,
          recordingId: meeting.id,
        },
        createdAt: new Date(),
      },
    });
  });
}

async function getMeetingByIdentifier(meetingIdentifier: string) {
  const meeting = await prisma.meeting.findFirst({
    where: {
      OR: [
        { roomId: meetingIdentifier },
        { id: meetingIdentifier },
      ],
    },
  });

  if (!meeting) {
    const error = new Error("Meeting not found");
    (error as any).statusCode = 404;
    throw error;
  }

  return meeting;
}
