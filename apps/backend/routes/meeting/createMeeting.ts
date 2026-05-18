import { Router } from "express";
import { authMiddleware } from "../../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { redisPublisher } from "../../utils/redis";
import { normalizeEmails, generateString } from "../../utils/helpers";
import { CreateMeetingSchema } from "@repo/types";

const createMeetingRouter = Router();

createMeetingRouter.post("/create", authMiddleware, async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const parsedData = CreateMeetingSchema.safeParse(req.body);

  if (!parsedData.success) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
      select: { id: true, name: true, email: true, googleRefreshToken: true },
    });

    if (!user || !user.email) {
      return res.status(404).json({ message: "User not found" });
    }

    const { roomName, passcode, invitedParticipants } = parsedData.data;

    const randomPasscode = Math.random().toString(36).slice(2, 10);

    // normalize emails
    const normalizedEmails = normalizeEmails(invitedParticipants || []);

    // find users by email
    const invitedUsers = await prisma.user.findMany({
      where: {
        email: { in: normalizedEmails },
        isVerified: true,
      },
      select: { id: true, email: true, googleRefreshToken: true },
    });

    const meeting = await prisma.meeting.create({
      data: {
        roomId: generateString().toLowerCase(),
        roomName,
        userId,
        isHost: true,
        passcode: passcode ?? randomPasscode,
        startedAt: new Date(),
        participants: {
          create: [
            // host
            {
              userId,
              role: "HOST",
            },
            // invited users
            ...invitedUsers.map((u) => ({
              userId: u.id,
            })),
          ],
        },
      },
      include: {
        participants: true,
      },
    });

    // send notifications to invited users
    if (invitedUsers.length > 0) {
      await redisPublisher.lpush(
        "MeetingInvitations",
        JSON.stringify({
          roomId: meeting.roomId,
          message: `You have been invited to join the meeting "${roomName}" by ${user.name}.`,
          participants: invitedUsers.map((u) => ({
            userId: u.id,
          })),
        }),
      );
    }

    return res.status(200).json({
      id: meeting.id,
      roomId: meeting.roomId,
      passcode: meeting.passcode,
      name: user.name,
    });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default createMeetingRouter;
