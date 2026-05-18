import type { Request, Response, NextFunction } from "express";
import { redisPublisher } from "./redis";

type RateLimiterOptions = {
  windowSeconds?: number;
  maxRequests?: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string | null | undefined;
};

// Simple in-memory fallback when Redis is not available
class InMemoryStore {
  private map = new Map<string, { count: number; expiresAt: number }>();

  incr(key: string, windowSeconds: number) {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.map.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  ttl(key: string) {
    const entry = this.map.get(key);
    if (!entry) return -2;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }
}

const fallbackStore = new InMemoryStore();

export function rateLimiter(options: RateLimiterOptions = {}) {
  const windowSeconds = options.windowSeconds ?? 60; // default 1 minute
  const maxRequests = options.maxRequests ?? 120; // default 120 req/min
  const prefix = options.prefix ?? "rl";

  return async function (req: Request, res: Response, next: NextFunction) {
    try {
      // Skip rate limiting for admin users
      if (req.userTier === "ADMIN") {
        return next();
      }

      // Allow a custom key (e.g. per-user) via keyGenerator, otherwise fall back to IP
      const generated = options.keyGenerator ? options.keyGenerator(req) : null;
      const ip = (req.ip ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "unknown") as string;
      const keyBase = generated ? generated : ip;
      const key = `${prefix}:${keyBase}`;

      // Prefer Redis
      if (redisPublisher && redisPublisher.status === "ready") {
        const total = await redisPublisher.incr(key);
        if (total === 1) {
          await redisPublisher.expire(key, windowSeconds);
        }

        const ttl = await redisPublisher.ttl(key);
        if (total > maxRequests) {
          res.setHeader("Retry-After", String(ttl > 0 ? ttl : windowSeconds));
          return res
            .status(429)
            .json({
              message: "Too many requests",
              code: "RATE_LIMIT_EXCEEDED",
              retryAfter: ttl,
            });
        }

        res.setHeader("X-RateLimit-Limit", String(maxRequests));
        res.setHeader(
          "X-RateLimit-Remaining",
          String(Math.max(0, maxRequests - total)),
        );
        res.setHeader(
          "X-RateLimit-Reset",
          String(Date.now() + (ttl > 0 ? ttl : windowSeconds) * 1000),
        );
        return next();
      }

      // Fallback
      const total = fallbackStore.incr(key, windowSeconds);
      const ttl = fallbackStore.ttl(key);
      if (total > maxRequests) {
        res.setHeader("Retry-After", String(ttl > 0 ? ttl : windowSeconds));
        return res
          .status(429)
          .json({
            message: "Too many requests",
            code: "RATE_LIMIT_EXCEEDED",
            retryAfter: ttl,
          });
      }

      res.setHeader("X-RateLimit-Limit", String(maxRequests));
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, maxRequests - total)),
      );
      res.setHeader(
        "X-RateLimit-Reset",
        String(Date.now() + (ttl > 0 ? ttl : windowSeconds) * 1000),
      );
      return next();
    } catch (err) {
      // If anything fails, don't block the request — fail open

      console.error("Rate limiter error:", err);
      return next();
    }
  };
}

export default rateLimiter;
