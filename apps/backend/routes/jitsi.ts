import express from "express";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";

const appId = process.env.JITSI_APP_ID;
const appSecret = process.env.JITSI_APP_SECRET;

const JitsiRouter = express.Router();

JitsiRouter.post("/token", authMiddleware, async (req, res) => {
  const userId = req.userId;
  const { meetingId } = req.body;

  if (!meetingId) {
    return res.status(400).json({ message: "Meeting ID is required" });
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomId: meetingId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        participants: {
          where: { userId },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ message: "Meeting not found" });
    }

    const isHost = meeting.userId === userId;
    const isParticipant = meeting.participants.length > 0;

    if (!isHost && !isParticipant) {
      return res
        .status(403)
        .json({ message: "You are not authorized to join this meeting" });
    }

    if (!appId || !appSecret) {
      return res.status(500).json({ message: "Jitsi configuration missing" });
    }

    const user = isHost ? meeting.user : meeting.participants[0]?.user;

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600;

    const token = jwt.sign(
      {
        iss: appId,
        aud: "jitsi",
        sub: meetingId,
        room: meetingId,
        name: user?.name || "Weave User",
        email: user?.email || "",
        avatar: "",
        moderator: isHost ? "true" : "false",
        exp,
      },
      appSecret,
      { algorithm: "HS256" },
    );

    return res.status(200).json({
      token,
      meetingId,
      domain: "jitsi.krishlabs.tech",
    });
  } catch (error) {
    console.error("Error generating Jitsi token:", error);
    return res.status(500).json({ message: "Failed to generate token" });
  }
});

export default JitsiRouter;
