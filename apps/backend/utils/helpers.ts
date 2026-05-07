import { prisma } from "@repo/db/client";
import path from "node:path";
import { redisPublisher } from "./redis";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const recordingsRoot = path.resolve(process.cwd(), "../../recordings");

export function toSingleString(value: string | string[] | undefined): string | null {
    if (typeof value === "string") {
        return value;
    }

    if (Array.isArray(value) && value.length > 0) {
        return value[0] ?? null;
    }

    return null;
}

export const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateString() {
    let result = '';
    const charactersLength = characters.length;
    for ( let i = 0; i < 20; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

export function generateRandomToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function SendVerificationEmail(email: string, token: string) {
  await resend.emails.send({
    from: "Weave <support@weave.krishdev.xyz>",
    to: email,
    subject: `Verify Your Weave Account`,
    html: ` <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Verify Your Weave Account</title>
    </head>
    <body style="margin:0;padding:0;background:#0c0b0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0b0a;padding:40px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#1a1408 0%,#241c0a 100%);border-radius:16px;padding:32px 36px;border-bottom:1px solid #f5a623;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#f5a623;opacity:0.7;">Weave · Account Verification</p>
                        <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#fff5de;line-height:1.25;">Verify Your Account</h1>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background:#14100c;padding:28px 36px;border-radius:0 0 16px 16px;">
                  <p style="margin:0 0 16px;font-size:14px;color:#c5ac72;line-height:1.6;">Use the verification code below to verify your Weave account.</p>
                  <div style="display:inline-block;padding:12px 20px;background:#1a1408;border:1px solid rgba(245,166,35,0.18);border-radius:8px;">
                    <span style="font-size:18px;font-weight:700;letter-spacing:0.1em;color:#f5a623;">${token}</span>
                  </div>
                </td>
              </tr>

            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#b49650;opacity:0.7;">If you did not sign up for a Weave account, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
     `
  });
}

export async function getMeetingSessions(roomId: string) {
    return prisma.meeting.findMany({
        where: {
            roomId: roomId,
        },
        include: {
            finalRecording: true,
            participants: true,
        }
    });
}

export async function getUserMeetingSession(roomId: string, userId: string) {
  return prisma.meeting.findFirst({
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
      finalRecording: true,
      participants: {
        where: { userId },
      },
    },
  });
}

export function canViewFinalRecording(args: {
    isHost: boolean;
    userEmail: string | null;
    visibleToEmails: string[];
}) {
    if (args.isHost) {
        return true;
    }

    if (!args.userEmail) {
        return false;
    }

    return args.visibleToEmails.includes(args.userEmail);
}

export function canEditFinalRecording(args: {
  isHost: boolean;
  userEmail: string | null;
  visibleToEmails: string[];
}) {
  return canViewFinalRecording(args);
}

export function normalizeEmails(values: unknown): string[] {
    if (!Array.isArray(values)) {
        return [];
    }

    const normalized = values
        .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
        .filter((email) => Boolean(email) && email.includes("@"));

    return [...new Set(normalized)];
}

export function normalizeFinalRecordingLinks<T extends { videoLink: string }>(recordings: T[]): T[] {
    return recordings.map((recording) => {
        const videoLink = recording.videoLink || "";

        if (videoLink.startsWith("/api/v1/recordings/")) {
            return recording;
        }

        const normalizedRelative = path.relative(recordingsRoot, videoLink).split(path.sep).join("/");
        if (!normalizedRelative || normalizedRelative.startsWith("..")) {
            return recording;
        }

        return {
            ...recording,
            videoLink: `/api/v1/recordings/${normalizedRelative}`,
        };
    });
}

export function normalizeFinalRecordingLink<T extends { videoLink: string }>(recording: T | null | undefined): T | null {
    if (!recording) {
        return null;
    }

    const videoLink = recording.videoLink || "";

    if (videoLink.startsWith("/api/v1/recordings/")) {
        return recording;
    }

    const normalizedRelative = path.relative(recordingsRoot, videoLink).split(path.sep).join("/");
    if (!normalizedRelative || normalizedRelative.startsWith("..")) {
        return recording;
    }

    return {
        ...recording,
        videoLink: `/api/v1/recordings/${normalizedRelative}`,
    };
}

export function toPublicRecordingLink(localPath: string) {
  const normalizedRelative = path.relative(recordingsRoot, localPath).split(path.sep).join("/");
  if (!normalizedRelative || normalizedRelative.startsWith("..")) {
    return localPath;
  }

  return `/api/v1/recordings/${normalizedRelative}`;
}

// Rate limiting configuration
export const RECORDING_LIMITS = {
  FREE: 3,
  PRO: 50,
  ENTERPRISE: -1, // unlimited
} as const;

export async function getRecordingCount(userId: string): Promise<number> {
  const recordingCount = await prisma.meeting.count({
    where: {
      userId,
      finalRecording: {
        isNot: null,
      },
    },
  });

  return recordingCount;
}

export interface RecordingLimitCheckResult {
  allowed: boolean;
  recordingsUsed: number;
  recordingsLimit: number;
  remainingRecordings: number;
}

export async function checkRecordingLimit(userId: string): Promise<RecordingLimitCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  });

  if (!user) {
    return {
      allowed: false,
      recordingsUsed: 0,
      recordingsLimit: 0,
      remainingRecordings: 0,
    };
  }

  const tier = user.tier || 'FREE';
  const limit = RECORDING_LIMITS[tier];
  const recordingsUsed = await getRecordingCount(userId);

  // -1 means unlimited (ENTERPRISE)
  const remainingRecordings = limit === -1 ? -1 : limit - recordingsUsed;
  const allowed = limit === -1 || recordingsUsed < limit;

  return {
    allowed,
    recordingsUsed,
    recordingsLimit: limit === -1 ? -1 : limit,
    remainingRecordings,
  };
}

export function sanitizePathSegment(value: unknown) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  return /^[a-zA-Z0-9._-]+$/.test(text) ? text : null;
}

export function getFileExtension(mimeType?: string) {
  if (!mimeType) {
    return "webm";
  }

  if (mimeType.includes("webm")) {
    return "webm";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

export async function finalizeMeetingRoom(roomId: string, hostUserId?: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { roomId },
    include: {
      participants: true,
    },
  });

  if (!meeting) {
    const error = new Error("Meeting not found");
    (error as Error & { statusCode?: number }).statusCode = 404;
    throw error;
  }

  if (hostUserId && meeting.userId !== hostUserId) {
    const error = new Error("Only host can end this meeting");
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }

  const alreadyEnded = meeting.isEnded;
  const endTime = new Date();

  const shouldProcessRecording =
    meeting.recordingState === "RECORDING" ||
    meeting.recordingState === "UPLOADING" ||
    meeting.recordingState === "PROCESSING";

  if (!alreadyEnded) {
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        isEnded: true,
        endedAt: endTime,
        recordingState: shouldProcessRecording ? "PROCESSING" : "IDLE",
        recordingStoppedAt: shouldProcessRecording ? endTime : null,
        processingStartedAt: shouldProcessRecording ? endTime : null,
      },
    });

    if (shouldProcessRecording) {
      await redisPublisher.rpush(
        "ProcessVideo",
        JSON.stringify({
          meetingId: meeting.roomId,
          roomId: meeting.roomId,
          internalMeetingId: meeting.id,
        })
      );
    }
  }

  return {
    meeting,
    participants: meeting.participants.length,
    duration: meeting.createdAt
      ? Math.max(
          0,
          Math.floor((endTime.getTime() - meeting.createdAt.getTime()) / 60000)
        )
      : 0,
    alreadyEnded,
    shouldProcessRecording,
  };
}

export function formatTime(time: string | Date) {
  const date = typeof time === "string" ? new Date(time) : time;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
