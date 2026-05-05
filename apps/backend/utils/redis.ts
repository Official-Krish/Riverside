import { prisma } from "@repo/db/client";
import { Redis } from "ioredis";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent } from "../services/googleCalendar";
import { sendGmailMessage } from "../services/gmail";
import { sendSlackDirectMessage } from "../services/slack";
import { sendDiscordNotification } from "../services/discord";

export const redisSubscriber = new Redis({ host: process.env.REDIS_HOST, port: 6379 });
export const redisPublisher  = new Redis({ host: process.env.REDIS_HOST, port: 6379 });

const QUEUES = ["MeetingInvitations", "MeetingReminders", "SetupGoogleCalendarReminders", "Notifications"] as const;

function resolveParticipantUserId(participant: string | { userId?: string }) {
  return typeof participant === "string" ? participant : participant.userId;
}

export async function notificationWorker() {
  while (true) {
    try {
      const result = await redisSubscriber.brpop(...QUEUES, 5);
      if (!result) continue;

      const [queueName, data] = result;
      const parsed = JSON.parse(data);

      switch (queueName) {
        case "MeetingInvitations": {
          const { roomId, message, participants } = parsed;
          if (!participants) break;

          await Promise.all(
            participants.map((participant: string | { userId?: string }) => {
              const userId = resolveParticipantUserId(participant);
              if (!userId) return;
              return prisma.notification.create({
                data: { userId, type: "MEETING_INVITE", message, metadata: { roomId } },
              });
            })
          );
          break;
        }

        case "MeetingReminders": {
          const { scheduleId, message, participants, scheduledAt } = parsed;
          if (!participants) break;

          await Promise.all(
            participants.map((participant: string | { userId?: string }) => {
              const userId = resolveParticipantUserId(participant);
              if (!userId) return;
              return prisma.notification.create({
                data: { userId, type: "MEETING_REMINDER", message, metadata: { scheduleId, scheduledAt } },
              });
            })
          );
          break;
        }

        case "SetupGoogleCalendarReminders": {
          const { googleRefreshTokens, eventDetails, type } = parsed;
          if (!googleRefreshTokens) break;

          switch (type) {
            case "Create":
              await Promise.all(
                googleRefreshTokens.map(async (g: { googleRefreshToken?: string, userId: string }) => {
                  if (!g.googleRefreshToken) return;
                  if(!g.userId) {
                    console.warn("Missing userId for Google Calendar event creation, skipping...");
                    return;
                  }
                  const id = await createCalendarEvent(g.googleRefreshToken, eventDetails);
                  if(id){
                    await prisma.scheduleParticipant.update({
                      where: {
                        scheduleId_userId: {
                          scheduleId: eventDetails.scheduleId,
                          userId: g.userId
                        }
                      },
                      data: {
                        googleEventId: id
                      }
                    })
                  }
                })
              );
              break;
          
            case "Cancel":
              await Promise.all(
                googleRefreshTokens.map(async (g: { googleRefreshToken?: string, eventId?: string }) => {
                  if (!g.googleRefreshToken || !g.eventId) return;
                  try {
                    await deleteCalendarEvent(g.googleRefreshToken, g.eventId);
                  } catch (err) {
                    console.error(`Failed to delete calendar event for eventId: ${g.eventId}`, err);
                  }
                })
              );
              break;

            case "Update":
              await Promise.all(
                googleRefreshTokens.map(async (g: { googleRefreshToken?: string, eventId?: string }) => {
                  if (!g.googleRefreshToken || !g.eventId) return;
                  try {
                    await updateCalendarEvent(g.googleRefreshToken, g.eventId, eventDetails);
                  } catch (err) {
                    console.error(`Failed to update calendar event for eventId: ${g.eventId}`, err);
                  }
                })
              );
              break;

            }
          }
          break;
        
        case "Notifications":
          const { type } = parsed;
          switch (type) {
            case "Gmail":
              const { recipientEmails, eventDetails } = parsed;
              if (!recipientEmails || !eventDetails) break;
              try {
                await Promise.all(recipientEmails.map((email: string) => sendGmailMessage(email, eventDetails)));
              } catch (err) {
                console.error(`Failed to send Gmail notification to ${recipientEmails}`, err);
              }
              break;
            
            case "Slack":
              const { slackBotToken, slackUserId, eventDetails: slackEventDetails } = parsed;
              if (!slackBotToken || !slackUserId || !slackEventDetails) break;
              try {
                await sendSlackDirectMessage(slackBotToken, slackUserId, slackEventDetails);
              } catch (err) {
                console.error(`Failed to send Slack notification to user ${slackUserId}`, err);
              }
              break;
            
            case "Discord":
              const { discordWebhookUrl, eventDetails: discordEventDetails } = parsed;
              if (!discordWebhookUrl || !discordEventDetails) break;
              try{
                await sendDiscordNotification(discordWebhookUrl, discordEventDetails);
              } catch (err) {
                console.error(`Failed to send Discord notification to user ${discordWebhookUrl}`, err);
              }
              break;

            default:
              console.warn("Unknown notification type:", type);
          }
          break;

        default:
          console.warn("Unknown queue:", queueName);
      }

    } catch (error) {
      console.error("Worker error, retrying...", error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const CHAT_HISTORY_EXPIRY = 30 * 60; // 30 minutes in seconds
const MAX_MESSAGES_PER_ROOM = 100;

/**
 * Retrieve recent chat messages for a room (last N messages).
 */
export async function getChatHistory(roomId: string, limit: number = 50): Promise<any[]> {
  if (!roomId) return [];

  try {
    const key = `chat:${roomId}`;
    // Get the most recent messages (highest scores = newest timestamps)
    const messages = await redisPublisher.zrevrange(key, 0, limit - 1);
    return messages.map((msg) => {
      try {
        return JSON.parse(msg);
      } catch {
        return null;
      }
    }).filter(Boolean);
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