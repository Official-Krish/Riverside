import { prisma } from "@repo/db/client";
import { Redis } from "ioredis";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../services/googleCalendar";
import { sendGmailMessage } from "../services/gmail";
import { sendSlackDirectMessage } from "../services/slack";
import { sendDiscordNotification } from "../services/discord";

export const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});
export const redisPublisher = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});

const QUEUES = [
  "MeetingInvitations",
  "MeetingReminders",
  "SetupGoogleCalendarReminders",
  "Notifications",
] as const;

const DEAD_LETTER_QUEUE = "NotificationWorkerDLQ";
const MAX_IN_FLIGHT_JOBS = Number(
  process.env.NOTIFICATION_WORKER_MAX_IN_FLIGHT ?? 20,
);
const DB_WRITE_CONCURRENCY = Number(
  process.env.NOTIFICATION_DB_WRITE_CONCURRENCY ?? 25,
);
const PROVIDER_CONCURRENCY = Number(
  process.env.NOTIFICATION_PROVIDER_CONCURRENCY ?? 5,
);
const RETRY_ATTEMPTS = Number(process.env.NOTIFICATION_RETRY_ATTEMPTS ?? 3);
const RETRY_BASE_DELAY_MS = Number(
  process.env.NOTIFICATION_RETRY_BASE_DELAY_MS ?? 500,
);

type QueueName = (typeof QUEUES)[number];

function resolveParticipantUserId(participant: string | { userId?: string }) {
  return typeof participant === "string" ? participant : participant.userId;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(err: unknown) {
  return err instanceof Error ? err : new Error(String(err));
}

async function pushToDeadLetterQueue(
  queueName: string,
  payload: unknown,
  error: unknown,
  stage: string,
) {
  try {
    await redisPublisher.lpush(
      DEAD_LETTER_QUEUE,
      JSON.stringify({
        queueName,
        stage,
        payload,
        error: normalizeError(error).message,
        failedAt: new Date().toISOString(),
      }),
    );
  } catch (dlqError) {
    console.error("Failed to write message to dead-letter queue", dlqError);
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  queueName: string,
  payloadForDlq: unknown,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_ATTEMPTS) {
        await pushToDeadLetterQueue(queueName, payloadForDlq, error, context);
        throw error;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[${context}] attempt ${attempt}/${RETRY_ATTEMPTS} failed, retrying in ${delayMs}ms`,
        error,
      );
      await sleep(delayMs);
    }
  }

  throw normalizeError(lastError);
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
  context: string,
) {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let index = 0;
  let failed = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (true) {
        const current = index;
        index += 1;

        if (current >= items.length) break;

        try {
          await handler(items[current]);
        } catch (error) {
          failed += 1;
          console.error(`[${context}] item processing failed`, error);
        }
      }
    }),
  );

  if (failed > 0) {
    console.warn(`[${context}] completed with ${failed} failed item(s)`);
  }
}

async function processQueueMessage(queueName: QueueName, parsed: any) {
  switch (queueName) {
    case "MeetingInvitations": {
      const { roomId, message, participants } = parsed;
      if (!Array.isArray(participants) || participants.length === 0) return;

      await processWithConcurrency(
        participants,
        DB_WRITE_CONCURRENCY,
        async (participant: string | { userId?: string }) => {
          const userId = resolveParticipantUserId(participant);
          if (!userId) return;

          await withRetry(
            () =>
              prisma.notification.create({
                data: {
                  userId,
                  type: "MEETING_INVITE",
                  message,
                  metadata: { roomId },
                },
              }),
            "MeetingInvitations.createNotification",
            queueName,
            { participant, roomId, message },
          );
        },
        queueName,
      );
      break;
    }

    case "MeetingReminders": {
      const { scheduleId, message, participants, scheduledAt } = parsed;
      if (!Array.isArray(participants) || participants.length === 0) return;

      await processWithConcurrency(
        participants,
        DB_WRITE_CONCURRENCY,
        async (participant: string | { userId?: string }) => {
          const userId = resolveParticipantUserId(participant);
          if (!userId) return;

          await withRetry(
            () =>
              prisma.notification.create({
                data: {
                  userId,
                  type: "MEETING_REMINDER",
                  message,
                  metadata: { scheduleId, scheduledAt },
                },
              }),
            "MeetingReminders.createNotification",
            queueName,
            { participant, scheduleId, message, scheduledAt },
          );
        },
        queueName,
      );
      break;
    }

    case "SetupGoogleCalendarReminders": {
      const { googleRefreshTokens, eventDetails, type } = parsed;
      if (
        !Array.isArray(googleRefreshTokens) ||
        googleRefreshTokens.length === 0
      ) {
        return;
      }

      switch (type) {
        case "Create":
          await processWithConcurrency(
            googleRefreshTokens,
            PROVIDER_CONCURRENCY,
            async (g: { googleRefreshToken?: string; userId: string }) => {
              if (!g.googleRefreshToken) return;
              if (!g.userId) {
                console.warn(
                  "Missing userId for Google Calendar event creation, skipping...",
                );
                return;
              }

              const id = await withRetry(
                () => createCalendarEvent(g.googleRefreshToken!, eventDetails),
                "GoogleCalendar.CreateEvent",
                queueName,
                { userId: g.userId, eventDetails },
              );

              if (!id) return;

              await withRetry(
                () =>
                  prisma.scheduleParticipant.update({
                    where: {
                      scheduleId_userId: {
                        scheduleId: eventDetails.scheduleId,
                        userId: g.userId,
                      },
                    },
                    data: {
                      googleEventId: id,
                    },
                  }),
                "GoogleCalendar.PersistEventId",
                queueName,
                { userId: g.userId, scheduleId: eventDetails.scheduleId, id },
              );
            },
            `${queueName}.Create`,
          );
          break;

        case "Cancel":
          await processWithConcurrency(
            googleRefreshTokens,
            PROVIDER_CONCURRENCY,
            async (g: { googleRefreshToken?: string; eventId?: string }) => {
              if (!g.googleRefreshToken || !g.eventId) return;
              await withRetry(
                () => deleteCalendarEvent(g.googleRefreshToken!, g.eventId!),
                "GoogleCalendar.CancelEvent",
                queueName,
                { eventId: g.eventId },
              );
            },
            `${queueName}.Cancel`,
          );
          break;

        case "Update":
          await processWithConcurrency(
            googleRefreshTokens,
            PROVIDER_CONCURRENCY,
            async (g: { googleRefreshToken?: string; eventId?: string }) => {
              if (!g.googleRefreshToken || !g.eventId) return;
              await withRetry(
                () =>
                  updateCalendarEvent(
                    g.googleRefreshToken!,
                    g.eventId!,
                    eventDetails,
                  ),
                "GoogleCalendar.UpdateEvent",
                queueName,
                { eventId: g.eventId, eventDetails },
              );
            },
            `${queueName}.Update`,
          );
          break;

        default:
          console.warn("Unknown Google Calendar reminder action:", type);
      }
      break;
    }

    case "Notifications": {
      const { type } = parsed;
      switch (type) {
        case "GMAIL": {
          const { recipientEmails, eventDetails } = parsed;
          if (!Array.isArray(recipientEmails) || !eventDetails) return;

          await processWithConcurrency(
            recipientEmails,
            PROVIDER_CONCURRENCY,
            async (email: string) => {
              await withRetry(
                () => sendGmailMessage(email, eventDetails),
                "Notifications.GMAIL",
                queueName,
                { email, eventDetails },
              );
            },
            "Notifications.GMAIL",
          );
          break;
        }

        case "SLACK": {
          const {
            slackBotToken,
            slackUserId,
            eventDetails: slackEventDetails,
          } = parsed;
          if (!slackBotToken || !slackUserId || !slackEventDetails) return;

          await withRetry(
            () =>
              sendSlackDirectMessage(
                slackBotToken,
                slackUserId,
                slackEventDetails,
              ),
            "Notifications.SLACK",
            queueName,
            { slackUserId, eventDetails: slackEventDetails },
          );
          break;
        }

        case "DISCORD": {
          const { discordWebhookUrl, eventDetails: discordEventDetails } =
            parsed;
          if (!discordWebhookUrl || !discordEventDetails) return;

          await withRetry(
            () =>
              sendDiscordNotification(discordWebhookUrl, discordEventDetails),
            "Notifications.DISCORD",
            queueName,
            { discordWebhookUrl, eventDetails: discordEventDetails },
          );
          break;
        }

        case "RENDER_COMPLETE":
        case "MERGE_COMPLETE": {
          const { userId, message, metadata } = parsed;
          if (!userId || !message) return;
          await prisma.notification.create({
            data: {
              userId,
              type,
              message:
                "Your render is complete! It will be soon be available in your dashboard.",
              metadata: metadata ?? {},
            },
          });
          break;
        }
        case "RENDER_FAILED":
        case "MERGE_FAILED": {
          const { userId, message, metadata } = parsed;
          if (!userId || !message) return;
          await prisma.notification.create({
            data: {
              userId,
              type,
              message,
              metadata: metadata ?? {},
            },
          });
          break;
        }

        default:
          console.warn("Unknown notification type:", type);
      }
      break;
    }

    default:
      console.warn("Unknown queue:", queueName);
  }
}

async function processRawQueueMessage(queueName: string, data: string) {
  if (!QUEUES.includes(queueName as QueueName)) {
    console.warn("Unknown queue:", queueName);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch (error) {
    console.error("Failed to parse queue payload", error);
    await pushToDeadLetterQueue(queueName, data, error, "JSON.parse");
    return;
  }

  await processQueueMessage(queueName as QueueName, parsed);
}

export async function notificationWorker() {
  const inFlight = new Set<Promise<void>>();

  while (true) {
    try {
      if (inFlight.size >= MAX_IN_FLIGHT_JOBS) {
        await Promise.race(inFlight);
      }

      // Use an infinite blocking pop so Redis wakes the worker only when work exists.
      const result = await redisSubscriber.brpop(...QUEUES, 0);
      if (!result) continue;

      const [queueName, data] = result;

      const job = processRawQueueMessage(queueName, data)
        .catch(async (error) => {
          console.error("Failed to process queue job", error);
          await pushToDeadLetterQueue(
            queueName,
            data,
            error,
            "processRawQueueMessage",
          );
        })
        .finally(() => {
          inFlight.delete(job);
        });

      inFlight.add(job);
    } catch (error) {
      console.error("Worker error, retrying...", error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/**
 * Retrieve recent chat messages for a room (last N messages).
 */
export async function getChatHistory(
  roomId: string,
  limit: number = 50,
): Promise<any[]> {
  if (!roomId) return [];

  try {
    const key = `chat:${roomId}`;
    // Get the most recent messages (highest scores = newest timestamps)
    const messages = await redisPublisher.zrevrange(key, 0, limit - 1);
    return messages
      .map((msg) => {
        try {
          return JSON.parse(msg);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    console.error(`Failed to retrieve chat history for room ${roomId}:`, error);
    return [];
  }
}

/**
 * Clear all chat messages for a room.
 */
export async function clearChatHistory(roomId: string): Promise<void> {
  if (!roomId) return;

  try {
    const key = `chat:${roomId}`;
    await redisPublisher.del(key);
  } catch (error) {
    console.error(`Failed to clear chat history for room ${roomId}:`, error);
  }
}
