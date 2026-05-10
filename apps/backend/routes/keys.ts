import { Router } from "express";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import { getServerPublicKeyJwk } from "../utils/keys";
import { storeWrappedMeetingCek } from "../utils/keys";
import { toSingleString } from "../utils/helpers";

const keysRouter = Router();

keysRouter.get("/public", async (_req, res) => {
    const publicKey = await getServerPublicKeyJwk();
    return res.status(200).json({
        algorithm: "RSA-OAEP-256",
        publicKey,
    });
});

keysRouter.post("/meeting/:meetingId/wrapped-cek", authMiddleware, async (req, res) => {
    const meetingId = toSingleString(req.params.meetingId);
    const userId = req.userId;
    const { wrappedCek } = req.body as { wrappedCek?: number[] };

    if (!meetingId || !userId) {
        return res.status(400).json({ message: "Meeting ID and user ID are required" });
    }

    if (!Array.isArray(wrappedCek) || wrappedCek.some((value) => typeof value !== "number" || value < 0 || value > 255)) {
        return res.status(400).json({ message: "Invalid wrapped CEK" });
    }

    try {
        const meeting = await prisma.meeting.findUnique({
            where: { roomId: meetingId },
            include: { participants: true },
        });

        if (!meeting) {
            return res.status(404).json({ message: "Meeting not found" });
        }

        const isHost = meeting.userId === userId;
        const isParticipant = meeting.participants.some((participant) => participant.userId === userId);

        if (!isHost && !isParticipant) {
            return res.status(403).json({ message: "Not authorized for this meeting" });
        }

        await storeWrappedMeetingCek(meetingId, userId, wrappedCek);

        return res.status(200).json({
            message: "Wrapped CEK stored",
            meetingId,
            participantId: userId,
        });
    } catch (error) {
        console.error("Error storing wrapped CEK:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

export default keysRouter;
