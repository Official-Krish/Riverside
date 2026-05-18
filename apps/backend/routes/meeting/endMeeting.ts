import { Router } from "express";
import {
  authMiddleware,
  serviceAuthMiddleware,
} from "../../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import {
  toSingleString,
  finalizeMeetingRoom,
  MAX_MEETING_DURATION_MS,
} from "../../utils/helpers";

const endMeetingRouter = Router();

endMeetingRouter.post(
  "/system/end-on-host-disconnect/:id",
  serviceAuthMiddleware,
  async (req, res) => {
    const roomId = toSingleString(req.params.id);

    if (!roomId) {
      res.status(400).json({ message: "Room ID is required" });
      return;
    }

    try {
      const result = await finalizeMeetingRoom(roomId);

      res.status(200).json({
        message: result.alreadyEnded
          ? "Meeting was already ended"
          : "Meeting finalized after host disconnect",
        participants: result.participants,
        duration: result.duration,
        recordingProcessing: result.shouldProcessRecording,
      });
    } catch (error) {
      console.error("Error finalizing meeting after host disconnect:", error);
      const statusCode =
        (error as Error & { statusCode?: number }).statusCode ?? 500;
      res
        .status(statusCode)
        .json({
          message:
            statusCode === 500
              ? "Internal server error"
              : (error as Error).message,
        });
    }
  },
);

endMeetingRouter.get(
  "/getParticipantDetails",
  authMiddleware,
  async (req, res) => {
    const userId = req.userId;
    const roomId = toSingleString(
      req.query.meetingId as string | string[] | undefined,
    );

    if (!userId || !roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    try {
      const meeting = await prisma.meeting.findUnique({
        where: { roomId },
        include: {
          participants: {
            where: { userId },
          },
        },
      });

      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      const participant = meeting.participants[0];

      if (!participant && meeting.userId !== userId) {
        return res.status(403).json({ message: "Not part of this meeting" });
      }

      return res.status(200).json({
        isHost: meeting.userId === userId,
        role: participant?.role ?? (meeting.userId === userId ? "HOST" : null),
        recordingState: meeting.recordingState,
        isRecording: meeting.recordingState === "RECORDING",
        joinedAt: participant?.joinedAt ?? null,
        leftAt: participant?.leftAt ?? null,
      });
    } catch (error) {
      console.error("Error fetching participant details:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
);

endMeetingRouter.post("/end/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const roomId = toSingleString(req.params.id);
  if (!roomId) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }
  try {
    const result = await finalizeMeetingRoom(roomId, userId as string);

    res.status(200).json({
      message: "Meeting ended successfully",
      participants: result.participants,
      duration: result.duration,
      recordingProcessing: result.shouldProcessRecording,
    });
  } catch (error) {
    console.error("Error fetching meeting:", error);
    const statusCode =
      (error as Error & { statusCode?: number }).statusCode ?? 500;
    res
      .status(statusCode)
      .json({
        message:
          statusCode === 500
            ? "Internal server error"
            : (error as Error).message,
      });
  }
});

endMeetingRouter.get("/status/:id", authMiddleware, async (req, res) => {
  const roomId = toSingleString(req.params.id);
  if (!roomId) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      select: {
        id: true,
        isEnded: true,
        startedAt: true,
        endedAt: true,
        userId: true,
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.isEnded) {
      return res.status(200).json({
        isEnded: true,
        elapsedMs:
          meeting.endedAt && meeting.startedAt
            ? meeting.endedAt.getTime() - meeting.startedAt.getTime()
            : 0,
        maxDurationMs: MAX_MEETING_DURATION_MS,
        autoEnded: false,
      });
    }

    const now = Date.now();
    const startedAt = meeting.startedAt?.getTime() || now;
    const elapsedMs = now - startedAt;
    const remainingMs = Math.max(0, MAX_MEETING_DURATION_MS - elapsedMs);
    const shouldAutoEnd = elapsedMs >= MAX_MEETING_DURATION_MS;

    return res.status(200).json({
      isEnded: false,
      elapsedMs,
      remainingMs,
      maxDurationMs: MAX_MEETING_DURATION_MS,
      shouldAutoEnd,
      percentage: Math.min(100, (elapsedMs / MAX_MEETING_DURATION_MS) * 100),
    });
  } catch (error) {
    console.error("Error fetching meeting status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

endMeetingRouter.post("/auto-end/:id", authMiddleware, async (req, res) => {
  const roomId = toSingleString(req.params.id);
  if (!roomId) {
    res.status(400).json({ message: "Room ID is required" });
    return;
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      select: { id: true, isEnded: true, startedAt: true, userId: true },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.isEnded) {
      return res
        .status(200)
        .json({ message: "Meeting already ended", alreadyEnded: true });
    }

    const now = Date.now();
    const startedAt = meeting.startedAt?.getTime() || now;
    const elapsedMs = now - startedAt;

    if (elapsedMs >= MAX_MEETING_DURATION_MS) {
      await finalizeMeetingRoom(roomId, meeting.userId);
      return res.status(200).json({
        message: "Meeting auto-ended due to duration limit",
        autoEnded: true,
        elapsedMs,
        maxDurationMs: MAX_MEETING_DURATION_MS,
      });
    }

    return res.status(200).json({
      message: "Meeting still within duration limit",
      autoEnded: false,
      remainingMs: MAX_MEETING_DURATION_MS - elapsedMs,
    });
  } catch (error) {
    console.error("Error auto-ending meeting:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default endMeetingRouter;
