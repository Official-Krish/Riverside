import { Redis } from "ioredis";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || "localhost",
            port: Number(process.env.REDIS_PORT || 6379),
        });

        redisClient.on("error", (error) => {
            console.error(`[${new Date().toISOString()}] Redis error:`, error);
        });

        redisClient.on("ready", () => {
        });
    }
    return redisClient;
}

export async function blpopQueue(queue: string, timeout: number): Promise<string | null> {
    const client = getRedisClient();
    const result = await client.blpop(queue, timeout);
    return result ? result[1] : null;
}

export async function rpushQueue(queue: string, data: object): Promise<void> {
    const client = getRedisClient();
    await client.rpush(queue, JSON.stringify(data));
}