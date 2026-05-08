import express from "express";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { canViewFinalRecording, canEditFinalRecording, normalizeEmails, toSingleString, checkRecordingLimit, normalizeFinalRecordingLink } from "../utils/helpers";
import { putRecordingVisibilitySchema, removeRecordingVisibilitySchema } from "@repo/types";

const RecordingRouter = express.Router();

RecordingRouter.delete("/delete/:id", authMiddleware, async (req, res) => {
  const roomId = toSingleString(req.params.id);
  const userId = req.userId;

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID and User ID are required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      include: { finalRecording: true },
    });

    if (!meeting || meeting.userId !== userId) {
      return res.status(403).json({ message: "Only the host can delete the recording" });
    }

    if (!meeting.finalRecording) {
      return res.status(404).json({ message: "Recording not found" });
    }

    await prisma.finalRecording.delete({
      where: { meetingId: meeting.id },
    });

    return res.status(200).json({ message: "Recording deleted successfully" });
  } catch (error) {
    console.error("Error deleting recording:", error);
    return res.status(500).json({ message: "Failed to delete recording" });
  }
});

RecordingRouter.get("/visibility/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      include: {
        finalRecording: true,
        participants: {
          include: {
            user: {
              select: { email: true }
            }
          }
        }
      },
    });

    if (!meeting || meeting.userId !== userId) {
      return res.status(403).json({ message: "Only host can manage recording visibility" });
    }

    return res.status(200).json({
      meetingId: meeting.roomId,
      visibleToEmails: meeting.finalRecording?.visibleToEmails ?? [],
      participants: meeting.participants.map(p => ({
        email: p.user.email?.toLowerCase() || null
      })),
    });

  } catch (error) {
    console.error("Error fetching recording visibility:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.put("/visibility/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  const parsedData = putRecordingVisibilitySchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  const requestedEmails = normalizeEmails(parsedData.data.visibleToEmails);

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      include: { finalRecording: true },
    });

    if (!meeting || meeting.userId !== userId) {
      return res.status(403).json({ message: "Only host can manage recording visibility" });
    }

    if (!meeting.finalRecording) {
      return res.status(404).json({ message: "Recording not found" });
    }

    const updatedEmails = [
      ...new Set([
        ...requestedEmails,
        ...(meeting.finalRecording.visibleToEmails ?? []),
      ]),
    ];

    await prisma.finalRecording.update({
      where: { meetingId: meeting.id },
      data: {
        visibleToEmails: updatedEmails,
      },
    });

    return res.status(200).json({
      message: "Recording visibility updated",
      meetingId: meeting.roomId,
      visibleToEmails: updatedEmails,
    });

  } catch (error) {
    console.error("Error updating recording visibility:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.get("/page/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const meetingId = toSingleString(req.params.id);

  if (!meetingId || !userId) {
    return res.status(400).json({ message: "Meeting ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        participants: {
          include: {
            user: {
              select: { email: true }
            }
          }
        },
        finalRecording: true,
        user: {
          select: { email: true }
        }
      }
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isHost = meeting.userId === userId;

    const isParticipant = meeting.participants.some(
      (p) => p.userId === userId
    );

    if (!isHost && !isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { email: true },
    });

    const userEmail = user?.email?.toLowerCase() || null;
    const visibleToEmails = meeting.finalRecording?.visibleToEmails ?? [];

    const canViewRecording =
      meeting.recordingState === "READY" &&
      canViewFinalRecording({
        isHost,
        userEmail,
        visibleToEmails,
      });
    const canEditRecording =
      meeting.recordingState === "READY" &&
      canEditFinalRecording({
        isHost,
        userEmail,
        visibleToEmails,
      });

    const normalizedFinalRecording = normalizeFinalRecordingLink(meeting.finalRecording);
    const canExposeUrls = canViewRecording && meeting.recordingState === "READY";
    const finalVideoUrl = canExposeUrls ? normalizedFinalRecording?.videoLink ?? null : null;

    const hlsBasePath = canExposeUrls && meeting.roomId ? `${process.env.CDN_BASE_URL || "https://cdn.krishlabs.tech"}/${meeting.roomId}/hls` : null;

    let response: any = {
      id: meeting.id,
      meetingId: meeting.roomId,
      roomName: meeting.roomName,
      isHost,
      recordingState: meeting.recordingState,
      hostEmail: meeting.user?.email?.toLowerCase() || null,
      userEmail,
      canViewRecording,
      canEditRecording,
      visibleToEmails,
      startedAt: meeting.recordingStartedAt,
      endedAt: meeting.recordingStoppedAt,
      finalVideoUrl,
      hlsManifestUrl: hlsBasePath ? `${hlsBasePath}/master.m3u8` : null,
      hlsThumbnailVttUrl: hlsBasePath ? `${hlsBasePath}/thumbnails.vtt` : null,
      hlsPosterUrl: hlsBasePath ? `${hlsBasePath}/poster.jpg` : null,
      participants: meeting.participants.map((p) => ({
        email: p.user.email?.toLowerCase() || null,
        role: p.role,
      })),
    };

    // Include rate limit info for the host
    if (isHost) {
      const limitCheck = await checkRecordingLimit(userId);
      response = {
        ...response,
        recordingLimit: {
          recordingsUsed: limitCheck.recordingsUsed,
          recordingsLimit: limitCheck.recordingsLimit,
          remainingRecordings: limitCheck.remainingRecordings,
        },
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching recording page details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.get("/status/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Meeting ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findFirst({
      where: {
        roomId,
        OR: [
          { userId },
          {
            participants: {
              some: { userId },
            },
          },
        ],
      },
      select: {
        id: true,
        roomId: true,
        userId: true,
        isHost: true,
        recordingState: true,
        recordingStartedAt: true,
        recordingStoppedAt: true,
        processingStartedAt: true,
        processingEndedAt: true,
        isEnded: true,
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isHost = meeting.userId === userId;
    let response: any = {
      roomId: meeting.roomId,
      isHost,
      isRecording: meeting.recordingState === "RECORDING",
      recordingState: meeting.recordingState,
      recordingStartedAt: meeting.recordingStartedAt,
      recordingStoppedAt: meeting.recordingStoppedAt,
      processingStartedAt: meeting.processingStartedAt,
      processingEndedAt: meeting.processingEndedAt,
      isEnded: meeting.isEnded,
    };

    // Include rate limit info for the host
    if (isHost) {
      const limitCheck = await checkRecordingLimit(userId);
      response = {
        ...response,
        recordingLimit: {
          recordingsUsed: limitCheck.recordingsUsed,
          recordingsLimit: limitCheck.recordingsLimit,
          remainingRecordings: limitCheck.remainingRecordings,
        },
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching recording status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.post("/start/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Meeting ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.userId !== userId) {
      return res.status(403).json({ message: "Only the host can start recording" });
    }

    if (meeting.isEnded) {
      return res.status(400).json({ message: "Meeting already ended" });
    }

    // Check recording limit
    const limitCheck = await checkRecordingLimit(userId);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        message: "Recording limit exceeded",
        code: "RECORDING_LIMIT_EXCEEDED",
        recordingsUsed: limitCheck.recordingsUsed,
        recordingsLimit: limitCheck.recordingsLimit,
        remainingRecordings: limitCheck.remainingRecordings,
      });
    }

    const recordingStartedAt = new Date();

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        recordingState: "RECORDING",
        recordingStartedAt,
        recordingStoppedAt: null,
        processingStartedAt: null,
        processingEndedAt: null,
      },
    });

    return res.status(200).json({
      roomId: meeting.roomId,
      isRecording: true,
      recordingState: "RECORDING",
      recordingStartedAt,
      recordingsUsed: limitCheck.recordingsUsed,
      recordingsLimit: limitCheck.recordingsLimit,
      remainingRecordings: limitCheck.remainingRecordings,
    });
  } catch (error) {
    console.error("Error starting recording:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.post("/stop/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.userId !== userId) {
      return res.status(403).json({ message: "Only the host can stop recording" });
    }

    if (meeting.recordingState !== "RECORDING") {
      return res.status(400).json({ message: "Recording is not in progress" });
    }

    const recordingStoppedAt = new Date();

    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        recordingState: "UPLOADING",
        recordingStoppedAt,
      },
    });

    return res.status(200).json({
      roomId: meeting.roomId,
      isRecording: false,
      recordingState: "UPLOADING",
      recordingStoppedAt,
    });
  } catch (error) {
    console.error("Error stopping recording:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.post("/removeVisibleEmail/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  const parsedData = removeRecordingVisibilitySchema.safeParse(req.body);
  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  const emailToRemove = parsedData.data.email.toLowerCase();

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      include: { finalRecording: true },
    });

    if (!meeting || meeting.userId !== userId) {
      return res.status(403).json({ message: "Only host can manage recording visibility" });
    }

    if (!meeting.finalRecording) {
      return res.status(404).json({ message: "Recording not found" });
    }

    const updatedVisibleEmails =
      meeting.finalRecording.visibleToEmails.filter(
        (email) => email.toLowerCase() !== emailToRemove
      );

    await prisma.finalRecording.update({
      where: { meetingId: meeting.id },
      data: {
        visibleToEmails: updatedVisibleEmails,
      },
    });

    return res.status(200).json({
      meetingId: meeting.roomId,
      visibleToEmails: updatedVisibleEmails,
    });
  } catch (error) {
    console.error("Error updating recording visibility:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.get("/getRaw/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);

  if (!roomId || !userId) {
    return res.status(400).json({ message: "Room ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findFirst({
      where: {
        roomId,
        OR: [
          { userId },
          {
            participants: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        rawChunks: true,
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    return res.status(200).json({
      meetingId: meeting.roomId,
      rawChunks: meeting.rawChunks,
    });
  } catch (error) {
    console.error("Error fetching raw chunks:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

RecordingRouter.get("/limit/check", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const limitCheck = await checkRecordingLimit(userId);
    
    return res.status(200).json({
      recordingsUsed: limitCheck.recordingsUsed,
      recordingsLimit: limitCheck.recordingsLimit,
      remainingRecordings: limitCheck.remainingRecordings,
      allowed: limitCheck.allowed,
    });
  } catch (error) {
    console.error("Error checking recording limit:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default RecordingRouter;