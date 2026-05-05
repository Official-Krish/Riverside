import { Redis } from "ioredis";

const CHAT_HISTORY_EXPIRY = 30 * 60; // 30 minutes in seconds
const MAX_MESSAGES_PER_ROOM = 100;

let redisClient: Redis | null = null;

export function initializeChatHistory() {
  if (redisClient) return;

  const host = process.env.REDIS_HOST || "localhost";
  const port = Number(process.env.REDIS_PORT || "6379");

  redisClient = new Redis({ host, port });

  redisClient.on("error", (err) => {
    console.error("Redis connection error in chat history:", err);
  });

  redisClient.on("connect", () => {
    console.log("Redis connected for chat history storage");
  });
}

/**
 * Store a chat message in Redis for the room.
 * Messages are stored in a sorted set by timestamp and expire after CHAT_HISTORY_EXPIRY.
 */
export async function storeChatMessage(roomId: string, message: any) {
  if (!roomId || !message || !redisClient) return;

  try {
    const key = `chat:messages:${roomId}`;
    const score = message.timestamp || Date.now();
    const value = JSON.stringify(message);

    // Add message to sorted set (scored by timestamp)
    await redisClient.zadd(key, score, value);

    // Keep only the last MAX_MESSAGES_PER_ROOM messages
    const count = await redisClient.zcard(key);
    if (count > MAX_MESSAGES_PER_ROOM) {
      await redisClient.zremrangebyrank(key, 0, count - MAX_MESSAGES_PER_ROOM - 1);
    }

    // Set expiry on the key
    await redisClient.expire(key, CHAT_HISTORY_EXPIRY);
  } catch (error) {
    console.error(`Failed to store chat message for room ${roomId}:`, error);
  }
}

/**
 * Retrieve recent chat messages for a room.
 */
export async function getChatHistory(roomId: string, limit: number = 50): Promise<any[]> {
  if (!roomId || !redisClient) return [];

  try {
    const key = `chat:messages:${roomId}`;
    // Get the most recent messages (highest scores = newest timestamps)
    const messages = await redisClient.zrevrange(key, 0, limit - 1);
    const parsed = messages.map((msg) => {
      try {
        return JSON.parse(msg);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Return in chronological order (oldest first)
    return parsed.reverse();
  } catch (error) {
    console.error(`Failed to retrieve chat history for room ${roomId}:`, error);
    return [];
  }
}

/**
 * Clear all chat messages for a room.
 */
export async function clearChatHistory(roomId: string): Promise<void> {
  if (!roomId || !redisClient) return;

  try {
    const key = `chat:messages:${roomId}`;
    await redisClient.del(key);
  } catch (error) {
    console.error(`Failed to clear chat history for room ${roomId}:`, error);
  }
}
