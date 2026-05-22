import express from "express";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { baseSchema, notificationReadSchema, schemas } from "@repo/types";
import { z } from "zod";

const NotificationRouter = express.Router();

NotificationRouter.get("/", authMiddleware, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      message: "Notifications fetched successfully",
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

NotificationRouter.post("/mark-as-read", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const parsedData = notificationReadSchema.safeParse(req.body);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid notification IDs" });
  }
  const { notificationIds } = parsedData.data;

  try {
    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
      data: { isRead: true },
    });
    return res.json({ message: "Notifications marked as read successfully" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

NotificationRouter.delete("/clear", authMiddleware, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    await prisma.notification.deleteMany({
      where: { userId },
    });
    return res.json({ message: "Notifications cleared successfully" });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

NotificationRouter.delete("/delete", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const parsedData = notificationReadSchema.safeParse(req.body);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid notification IDs" });
  }
  const { notificationIds } = parsedData.data;

  try {
    await prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
        userId,
      },
    });
    return res.json({ message: "Notifications deleted successfully" });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

NotificationRouter.post("/create", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const baseParsed = baseSchema.safeParse(req.body);
    if (!baseParsed.success) {
      return res.status(400).json({ message: "Invalid type" });
    }

    const { type } = baseParsed.data;

    const schema = schemas[type];
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid payload",
        errors: parsed.error.flatten(),
      });
    }

    let notificationData: any = {};
    switch (type) {
      case "RECORDING_REQUEST": {
        const { roomId } = parsed.data as z.infer<
          typeof schemas.RECORDING_REQUEST
        >;

        const user = await prisma.user.findFirst({
          where: { id: userId, isVerified: true },
          select: { name: true, email: true },
        });

        if (!user || !user.email) {
          return res.status(404).json({ message: "User not found" });
        }

        const hostMeeting = await prisma.meeting.findFirst({
          where: { roomId, isHost: true },
          select: {
            userId: true,
            roomName: true,
            finalRecording: {
              select: { visibleToEmails: true },
            },
          },
        });

        if (!hostMeeting || !hostMeeting.finalRecording) {
          return res.status(404).json({
            message: "Recording not available",
          });
        }

        if (hostMeeting.userId === userId) {
          return res.status(400).json({
            message: "Host already has access",
          });
        }

        if (hostMeeting.finalRecording.visibleToEmails?.includes(user.email)) {
          return res.status(400).json({
            message: "Already has access",
          });
        }

        const existing = await prisma.notification.findFirst({
          where: {
            userId: hostMeeting.userId,
            type: "RECORDING_REQUEST",
            isRead: false,
            AND: [
              {
                metadata: {
                  path: ["roomId"],
                  equals: roomId,
                },
              },
              {
                metadata: {
                  path: ["requestedBy"],
                  equals: userId,
                },
              },
            ],
          },
        });

        if (existing) {
          return res.status(400).json({
            message: "Already requested",
          });
        }

        notificationData = {
          userId: hostMeeting.userId,
          message: `${user.name} (${user.email}) requested access to recording for room ${hostMeeting.roomName}: ${roomId} and is awaiting your approval.`,
          metadata: {
            roomId,
            requestedBy: userId,
          },
        };

        break;
      }

      case "RECORDING_REQUEST_APPROVED": {
        const { roomId, notificationId } = parsed.data as z.infer<
          typeof schemas.RECORDING_REQUEST_APPROVED
        >;
        const notification = await prisma.notification.findFirst({
          where: {
            id: notificationId,
            userId,
            type: "RECORDING_REQUEST",
          },
        });

        if (!notification || !notification.metadata) {
          return res
            .status(404)
            .json({ message: "Original request notification not found" });
        }

        const requestedBy = (notification.metadata as { requestedBy: string })
          .requestedBy;

        const requestedUser = await prisma.user.findFirst({
          where: { id: requestedBy },
          select: {
            email: true,
          },
        });

        if (!requestedUser || !requestedUser.email) {
          return res.status(404).json({ message: "Requested user not found" });
        }

        const hostMeeting = await prisma.meeting.findFirst({
          where: {
            roomId,
            userId,
          },
          include: {
            finalRecording: true,
          },
        });

        if (!hostMeeting || !hostMeeting.finalRecording) {
          return res.status(404).json({
            message: "Meeting or final recording not found",
          });
        }

        await prisma.finalRecording.update({
          where: {
            id: hostMeeting.finalRecording.id,
          },
          data: {
            visibleToEmails: Array.from(
              new Set([
                ...hostMeeting.finalRecording.visibleToEmails,
                requestedUser.email,
              ]),
            ),
          },
        });

        notificationData = {
          userId: requestedBy,
          message: `Your request for recording access to room ${roomId} has been approved`,
          metadata: {
            roomId,
            recordingId: hostMeeting.id,
          },
        };
        break;
      }

      case "RECORDING_REQUEST_DENIED": {
        const { roomId, notificationId } = parsed.data as z.infer<
          typeof schemas.RECORDING_REQUEST_DENIED
        >;
        const notification = await prisma.notification.findFirst({
          where: {
            id: notificationId,
            userId,
            type: "RECORDING_REQUEST",
          },
        });

        if (!notification || !notification.metadata) {
          return res
            .status(404)
            .json({ message: "Original request notification not found" });
        }

        const requestedBy = (notification.metadata as { requestedBy: string })
          .requestedBy;

        notificationData = {
          userId: requestedBy,
          message: `Your request for recording access to room ${roomId} has been denied`,
          metadata: { roomId },
        };
        break;
      }

      case "MEETING_INVITE": {
        const { roomId, invitedUserId } = parsed.data as z.infer<
          typeof schemas.MEETING_INVITE
        >;

        notificationData = {
          userId: invitedUserId,
          message: `You are invited to meeting ${roomId}`,
          metadata: { roomId, invitedBy: userId },
        };

        break;
      }

      case "MEETING_REMINDER": {
        const { roomId, scheduledAt } = parsed.data as z.infer<
          typeof schemas.MEETING_REMINDER
        >;

        const meeting = await prisma.meeting.findUnique({
          where: { roomId },
          include: {
            participants: true,
          },
        });

        if (!meeting) {
          return res.status(404).json({ message: "Meeting not found" });
        }

        const userIds = new Set<string>();

        userIds.add(meeting.userId);

        meeting.participants.forEach((p) => {
          userIds.add(p.userId);
        });

        const notifications = await prisma.notification.createMany({
          data: Array.from(userIds).map((uid) => ({
            userId: uid,
            type: "MEETING_REMINDER",
            message: `Reminder for meeting ${roomId}`,
            metadata: { roomId, scheduledAt },
          })),
        });

        return res.json({
          message: "Reminder sent to all participants",
          count: notifications.count,
        });
      }

      case "RECORDING_READY": {
        const { roomId } = parsed.data as z.infer<
          typeof schemas.RECORDING_READY
        >;

        notificationData = {
          userId,
          message: `Recording ready for room ${roomId}`,
          metadata: { roomId },
        };

        break;
      }

      case "RECORDING_FAILED": {
        const { roomId, reason } = parsed.data as z.infer<
          typeof schemas.RECORDING_FAILED
        >;

        notificationData = {
          userId,
          message: `Recording failed for room ${roomId}`,
          metadata: { roomId, reason },
        };

        break;
      }

      case "RENDER_FAILED": {
        const { jobId, projectId, error } = parsed.data as z.infer<
          typeof schemas.RENDER_FAILED
        >;
        notificationData = {
          userId,
          message: `Export failed for project ${projectId}`,
          metadata: { jobId, projectId, error },
        };
        break;
      }

      case "MERGE_COMPLETE": {
        const { meetingId, finalPath } = parsed.data as z.infer<
          typeof schemas.MERGE_COMPLETE
        >;
        notificationData = {
          userId,
          message: `Recording merge complete for meeting ${meetingId}`,
          metadata: { meetingId, finalPath },
        };
        break;
      }

      case "MERGE_FAILED": {
        const { meetingId, error, errorCode, recoverable } =
          parsed.data as z.infer<typeof schemas.MERGE_FAILED>;
        notificationData = {
          userId,
          message: `Recording merge failed for meeting ${meetingId}`,
          metadata: { meetingId, error, errorCode, recoverable },
        };
        break;
      }

      case "OTHER": {
        const { message } = parsed.data as z.infer<typeof schemas.OTHER>;

        notificationData = {
          userId,
          message,
        };

        break;
      }

      default:
        return res.status(400).json({ message: "Unsupported type" });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        ...notificationData,
      },
    });

    return res.json({
      message: "Notification created",
      notification,
    });
  } catch (error) {
    console.error("Notification error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

export default NotificationRouter;
