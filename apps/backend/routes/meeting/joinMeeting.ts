import { Router } from "express";
import { authMiddleware } from "../../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { redisPublisher } from "../../utils/redis";
import { toSingleString, generateString } from "../../utils/helpers";

const joinMeetingRouter = Router();

joinMeetingRouter.post("/join/:id", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const id = toSingleString(req.params.id);
  const { passcode } = req.body;

  if (!userId || !id) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    let meeting = await prisma.meeting.findUnique({
      where: { roomId: id },
      include: { participants: true },
    });

    if (!meeting) {
      const schedule = await prisma.meetingSchedule.findFirst({
        where: { id },
        include: { participants: true },
      });

      if (!schedule) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      if (schedule.hostId === userId) {
        meeting = await prisma.meeting.create({
          data: {
            roomId: generateString().toLowerCase(),
            roomName: schedule.title,
            userId: schedule.hostId,
            isHost: true,
            isEnded: false,
            scheduleId: schedule.id,
            participants: {
              create: [
                {
                  userId: schedule.hostId,
                  role: "HOST",
                },
                ...schedule.participants
                  .filter((p) => p.userId !== schedule.hostId)
                  .map((p) => ({
                    userId: p.userId,
                  })),
              ],
            },
          },
          include: { participants: true },
        });

        await redisPublisher.lpush("MeetingInvitations", JSON.stringify({
          roomId: meeting.roomId,
          message: `Your scheduled meeting "${schedule.title}" is starting now.`,
          participants: schedule.participants
            .filter((p) => p.userId !== schedule.hostId)
            .map((p) => ({
              userId: p.userId,
            })),
        }));
        return res.status(200).json({
          roomId: meeting.roomId,
          meetingId: meeting.id,
          isHost: true,
          recordingState: meeting.recordingState,
        });
      } else if (schedule && schedule.hostId !== userId) {
        return res.status(201).json({ message: "Waiting for host to start the meeting" });
      }
    }

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    if (meeting.isEnded) {
      return res.status(400).json({ message: "Meeting ended" });
    }

    const existing = meeting.participants.find(p => p.userId === userId);
    const isHost = meeting.userId === userId;

    let hasAccess = false;
    let accessReason = "";

    // Check 1: Is user already a participant?
    if (existing) {
      hasAccess = true;
      accessReason = "existing_participant";
    }

    // Check 2: For scheduled meetings, verify user is in schedule participants
    if (!hasAccess && meeting.scheduleId) {
      const schedule = await prisma.meetingSchedule.findUnique({
        where: { id: meeting.scheduleId },
        select: { hostId: true, participants: { select: { userId: true } } },
      });

      if (schedule) {
        const isScheduleHost = schedule.hostId === userId;
        const isScheduleParticipant = schedule.participants.some(p => p.userId === userId);

        if (isScheduleHost || isScheduleParticipant) {
          hasAccess = true;
          accessReason = "scheduled_meeting_invited";
        }
      }
    }

    // Check 3: For instant meetings, verify correct passcode if not already invited
    if (!hasAccess && meeting.passcode) {
      if (passcode !== meeting.passcode) {
        return res.status(403).json({ 
          message: "Access denied. Invalid or missing passcode.",
          code: "INVALID_PASSCODE" 
        });
      }
      hasAccess = true;
      accessReason = "passcode_verified";
    }

    // Final access check: If user is not host, not participant, not scheduled, and no valid passcode
    if (!hasAccess && !isHost) {
      return res.status(403).json({ 
        message: "Access denied. You are not invited to this meeting.",
        code: "NOT_INVITED" 
      });
    }

    // Add or update participant
    if (!existing) {
      await prisma.meetingParticipant.create({
        data: {
          meetingId: meeting.id,
          userId,
          role: "PARTICIPANT",
        },
      });
    } else {
      await prisma.meetingParticipant.update({
        where: { id: existing.id },
        data: { leftAt: null },
      });
    }

    return res.status(200).json({
      roomId: meeting.roomId,
      meetingId: meeting.id,
      isHost,
      recordingState: meeting.recordingState,
    });

  } catch (error) {
    console.error("Join error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default joinMeetingRouter;
