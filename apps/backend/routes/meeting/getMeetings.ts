import { Router } from "express";
import { authMiddleware } from "../../utils/authMiddleware";
import { prisma } from "@repo/db/client";
import {
  toSingleString,
  canViewFinalRecording,
  normalizeFinalRecordingLink,
} from "../../utils/helpers";

const getMeetingsRouter = Router();

getMeetingsRouter.get("/getAll", authMiddleware, async (req, res) => {
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId as string, isVerified: true },
            select: { email: true },
        });

        const userEmail = user?.email?.toLowerCase() || null;

        const meetings = await prisma.meeting.findMany({
        where: {
            OR: [
            { userId }, 
            {
                participants: {
                    some: { userId } 
                }
            }]
        },
            include: {
                finalRecording: true,
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            }
        });

        const schedules = await prisma.meetingSchedule.findMany({
            where: {
                participants: {
                    some: { userId }
                },
                status: {
                    notIn: ["ENDED", "CANCELLED"]
                }
            },
            include: {
                participants: true,
            },
            orderBy: {
                startTime: "asc",
            }
        });

        const formatted = meetings.map((meeting) => {
        const normalizedRecording = normalizeFinalRecordingLink(meeting.finalRecording);

        const isHost = meeting.userId === userId;

        const canView = normalizedRecording
            ? canViewFinalRecording({
                isHost,
                userEmail,
                visibleToEmails: normalizedRecording.visibleToEmails ?? [],
            })
            : false;

            return {
                id: meeting.id,
                roomId: meeting.roomId,
                roomName: meeting.roomName,
                isHost,
                isEnded: meeting.isEnded,
                recordingState: meeting.recordingState,
                createdAt: meeting.createdAt,
                startedAt: meeting.recordingStartedAt,
                endedAt: meeting.recordingStoppedAt,
                recordingStartedAt: meeting.recordingStartedAt,

                participants: meeting.participants.map(p => ({
                    id: p.user.id,
                    name: p.user.name,
                    email: p.user.email,
                    role: p.role,
                    joinedAt: p.joinedAt,
                    leftAt: p.leftAt
                })),

                finalRecording: normalizedRecording
                ? (canView
                    ? normalizedRecording
                    : {
                        ...normalizedRecording,
                        videoLink: null,
                        audioLink: null,
                        visibleToEmails: []
                        })
                : null,
            };
        });

        res.status(200).json({ meetings: formatted, schedules: schedules.map(s => ({
            id: s.id,
            title: s.title,
            isHost: s.hostId === userId,
            description: s.description,
            startTime: s.startTime,
            isRecurring: s.isRecurring,
            recurrenceRule: s.recurrenceRule,
            participantCount: s.participants.length,
        })) || []});
    } catch (error) {
        console.error("Error fetching meetings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

getMeetingsRouter.get("/get/:id", authMiddleware, async (req, res) => {
    const userId = req.userId;
    const roomId = toSingleString(req.params.id);

    if (!roomId) {
        return res.status(400).json({ message: "Room ID is required" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId as string, isVerified: true },
            select: { email: true },
        });

        const userEmail = user?.email?.toLowerCase() || null;

        const meeting = await prisma.meeting.findUnique({
        where: { roomId },
            include: {
                finalRecording: true,
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            }
                        }
                    }
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

        const normalizedRecording = normalizeFinalRecordingLink(meeting.finalRecording);

        const canView = normalizedRecording
        ? canViewFinalRecording({
            isHost,
            userEmail,
            visibleToEmails: normalizedRecording.visibleToEmails ?? [],
            })
        : false;

        return res.status(200).json({
            id: meeting.id,
            roomId: meeting.roomId,
            roomName: meeting.roomName,
            isHost,
            isEnded: meeting.isEnded,
            createdAt: meeting.createdAt,
            recordingState: meeting.recordingState,

            participants: meeting.participants.map((p) => ({
                id: p.user.id,
                name: p.user.name,
                email: p.user.email,
                role: p.role,
                joinedAt: p.joinedAt,
                leftAt: p.leftAt,
            })),

            finalRecording: normalizedRecording
                ? (canView
                    ? normalizedRecording
                    : {
                        ...normalizedRecording,
                        videoLink: null,
                        audioLink: null,
                        visibleToEmails: []
                    })
                : null,
            }
        );

    } catch (error) {
        console.error("Error fetching meeting:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default getMeetingsRouter;
