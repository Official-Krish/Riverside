import { getRedisClient } from "./src/redis";
import { processQueue } from "./src/queue";

const redisClient = getRedisClient();

redisClient.on("error", (error) => {
    console.error(`[${new Date().toISOString()}] Redis error:`, error);
});

redisClient.on("ready", () => {
    console.log(`[${new Date().toISOString()}] Connected to Redis`);
});

processQueue();