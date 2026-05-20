import { Redis } from "ioredis";
import { log } from "./logger";
import { prisma } from "@repo/db/client";

export const connection = createRedis("main");
export const publishConnection = createRedis("publish");

export function createRedis(name: string) {
  const client = new Redis({
    host: process.env.REDIS_HOST,
    port: 6379,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    retryStrategy: (times) => Math.min(times * 100, 3_000),
    maxRetriesPerRequest: null, // required for BullMQ / blocking commands
    enableReadyCheck: true,
    lazyConnect: false,
  });

  client.on("error", (err) =>
    log("error", `Redis[${name}] error`, { err: err.message }),
  );
  client.on("reconnecting", () => log("warn", `Redis[${name}] reconnecting`));
  client.on("ready", () => log("info", `Redis[${name}] ready`));
  return client;
}

let shuttingDown = false;

export function isShuttingDown() {
  return shuttingDown;
}

export const metrics = {
  processed: 0,
  failed: 0,
  retried: 0,
  activeSlots: 0,
};

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", `Received ${signal} — draining active jobs then exiting`);

  // Wait until all slots are free (max 60 s)
  const deadline = Date.now() + 60_000;
  while (metrics.activeSlots > 0 && Date.now() < deadline) {
    await sleep(500);
  }

  log("info", "metrics", { ...metrics });
  await Promise.all([
    connection.quit().catch(() => {}),
    publishConnection.quit().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, 500)), // buffer for pending async work
  ]);
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}
