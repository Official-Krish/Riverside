import { Router } from "express";
import { authMiddleware } from "../../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { redisPublisher } from "../../utils/redis";
import { toSingleString, normalizeEmails, formatTime } from "../../utils/helpers";
import { ScheduleMeetingSchema } from "@repo/types";

const scheduleRouter = Router();

scheduleRouter.post("/create/schedule", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const parsedData = ScheduleMeetingSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  try {
    const {
      title,
      description,
      startTime,
      isRecurring,
      recurrenceRule,
      invitedParticipants,
      notificationType
    } = parsedData.data;

    const normalizedEmails = normalizeEmails(invitedParticipants || []);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, googleRefreshToken: true },
    });

    if (!user || !user.email) {
      return res.status(404).json({ message: "User not found" });
    }

    const users = await prisma.user.findMany({
      where: {
        email: { in: normalizedEmails },
        isVerified: true,
      },
      select: { id: true, email: true, googleRefreshToken: true },
    });

    const schedule = await prisma.meetingSchedule.create({
      data: {
        hostId: userId,
        title,
        description,
        startTime: new Date(startTime),
        isRecurring: isRecurring ?? false,
        recurrenceRule: recurrenceRule ?? null,
        participants: {
          create: [
            // host
            {
              userId,
              role: "HOST",
              googleRefreshToken: user.googleRefreshToken || "",
            },
            // invited users
            ...users.map((u) => ({
              userId: u.id,
              googleRefreshToken: u.googleRefreshToken || "",
            })),
          ],
        },
      },
      include: {
        participants: true,
      },
    });

    // send notifications
    const allUsers = [user, ...users];
    await redisPublisher.lpush("MeetingReminders", JSON.stringify({
      scheduleId: schedule.id,
      scheduledAt: schedule.startTime,
      message: `You have been invited to join the scheduled meeting "${title}" by ${user.name}. at ${formatTime(schedule.startTime)}. You will be notified again when the meeting is about to start with the join link.`,
      participants: users.map((u) => ({
        userId: u.id,
      })),
    }));

    await redisPublisher.lpush("SetupGoogleCalendarReminders", JSON.stringify({
      googleRefreshTokens: allUsers
        .filter(u => u.googleRefreshToken)
        .map(u => ({ googleRefreshToken: u.googleRefreshToken, userId: u.id })),
      eventDetails: {
        scheduleId: schedule.id,
        summary: title,
        description: description ?? "",
        startDateTime: new Date(startTime).toISOString(),
        attendees: users.map(u => u.email),
      },
      type: "Create",
    }));

    if(notificationType != null) {
      await redisPublisher.lpush("Notifications", JSON.stringify({
        type: notificationType,
        recipientEmails: users.map(u => u.email),
        slackBotToken: parsedData.data.slackBotToken || "",
        slackUserId: parsedData.data.slackUserId || "",
        discordWebhookUrl: parsedData.data.discordWebhookUrl || "",
        eventDetails: {
          hostedby: user.name,
          summary: title,
          description: description ?? "",
          startDateTime: new Date(startTime).toISOString(),
          attendees: users.map(u => u.email),
        }
      }));
    }

    return res.status(200).json({
      id: schedule.id,
      title: schedule.title,
      startTime: schedule.startTime,
    });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

scheduleRouter.post("/cancel/schedule/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const scheduleId = toSingleString(req.params.id);

  if (!userId || !scheduleId) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    const schedule = await prisma.meetingSchedule.findUnique({
      where: { id: scheduleId },
      include: { participants: true },
    });

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (schedule.hostId !== userId) {
      return res.status(403).json({ message: "Only the host can cancel the schedule" });
    }

    await redisPublisher.lpush("SetupGoogleCalendarReminders", JSON.stringify({
      googleRefreshTokens: schedule.participants
        .filter(p => p.googleRefreshToken)
        .map(p => ({ googleRefreshToken: p.googleRefreshToken, eventId: p.googleEventId })),
      type: "Cancel"
    }));

    await prisma.meetingSchedule.delete({
      where: { id: scheduleId }
    });

    await redisPublisher.lpush("MeetingReminders", JSON.stringify({
      scheduleId,
      message: `The scheduled meeting "${schedule.title}" has been canceled by the host.`,
      participants: schedule.participants
        .filter((p) => p.userId !== schedule.hostId)
        .map((p) => ({
          userId: p.userId,
        })),
    }));

    return res.status(200).json({ message: "Schedule canceled successfully" });
  } catch (error) {
    console.error("Error canceling schedule:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

scheduleRouter.post("/reschedule/schedule/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const scheduleId = toSingleString(req.params.id);
  const { startTime } = req.body;

  if (!userId || !scheduleId || !startTime) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    const schedule = await prisma.meetingSchedule.findUnique({
      where: { id: scheduleId },
      include: { participants: true },
    });

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (schedule.hostId !== userId) {
      return res.status(403).json({ message: "Only the host can reschedule" });
    }

    const updatedSchedule = await prisma.meetingSchedule.update({
      where: { id: scheduleId },
      data: { startTime: new Date(startTime) },
      include: { participants: true },
    });

    await redisPublisher.lpush("MeetingReminders", JSON.stringify({
      scheduleId,
      scheduledAt: updatedSchedule.startTime,
      message: `The scheduled meeting "${schedule.title}" has been rescheduled by the host to ${formatTime(updatedSchedule.startTime)}. You will be notified again when the meeting is about to start with the join link.`,
      participants: updatedSchedule.participants
        .filter((p) => p.userId !== updatedSchedule.hostId)
        .map((p) => ({
          userId: p.userId,
        })),
    }));

    const updatedUsers = await prisma.user.findMany({
      where: {
        id: { in: updatedSchedule.participants.map(p => p.userId) }
      },
      select: { id: true, email: true, googleRefreshToken: true },
    });

    await redisPublisher.lpush("SetupGoogleCalendarReminders", JSON.stringify({
      googleRefreshTokens: updatedSchedule.participants
        .filter(p => p.googleRefreshToken)
        .map(p => ({ googleRefreshToken: p.googleRefreshToken, eventId: p.googleEventId })),
      eventDetails: {
        summary: updatedSchedule.title,
        description: updatedSchedule.description ?? "",
        startDateTime: new Date(updatedSchedule.startTime).toISOString(),
        attendees: updatedUsers.map(u => u.email),
      },
      type: "Update"
    }));

    return res.status(200).json({ message: "Schedule rescheduled successfully" });
  } catch (error) {
    console.error("Error rescheduling:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default scheduleRouter;
