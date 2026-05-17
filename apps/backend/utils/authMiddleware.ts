import { prisma } from "@repo/db/client";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userTier?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers["authorization"];
    const token =
      typeof authorization === "string" && authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : null;

    if (!token) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    if (!process.env.JWT_SECRET) {
      res.status(500).json({ message: "JWT_SECRET is not configured" });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    // Extract user ID from the decoded token
    const userId = (decoded as any).userId;

    if (!userId) {
      console.error("No user ID in token payload");
      res.status(403).json({ message: "Invalid token payload" });
      return;
    }

    req.userId = userId;
    const user = await prisma.user.findUnique({
      where: { id: userId, isVerified: true },
    });
    if (!user) {
      res.status(403).json({ message: "User not found or email not verified" });
      return;
    }

    req.userTier = user.tier;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({
        message: "Invalid token",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
      return;
    }
    res.status(500).json({
      message: "Error processing authentication",
      details:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
    return;
  }
}

function getWorkerServiceJwtSecret(): string {
  const secret =
    process.env.WORKER_SERVICE_JWT_SECRET || process.env.WORKER_SERVICE_TOKEN;
  if (
    !secret ||
    secret === "WORKER_SERVICE_TOKEN" ||
    secret === "WORKER_SERVICE_JWT_SECRET"
  ) {
    throw new Error(
      "Worker service JWT secret must be configured and must not use the default placeholder value.",
    );
  }
  return secret;
}

interface WorkerServiceJwtPayload extends jwt.JwtPayload {
  scope?: string;
}

export async function serviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const jwtSecret = getWorkerServiceJwtSecret();
    const headerToken =
      req.headers["x-worker-token"] ||
      req.headers.authorization?.replace(/^Bearer\s+/i, "");

    const providedToken = Array.isArray(headerToken)
      ? headerToken[0]
      : headerToken;

    if (!providedToken) {
      res.status(401).json({
        success: false,
        code: "SERVICE_TOKEN_MISSING",
        message: "Missing worker service token.",
      });
      return;
    }

    if (providedToken === jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(providedToken, jwtSecret, {
      algorithms: ["HS256"],
      audience: "weave-backend",
      issuer: "weave-worker",
    }) as WorkerServiceJwtPayload;

    if (decoded.scope !== "worker-service") {
      res.status(403).json({
        success: false,
        code: "SERVICE_TOKEN_INVALID",
        message: "Invalid worker service token.",
      });
      return;
    }

    next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      res.status(403).json({
        success: false,
        code: "SERVICE_TOKEN_INVALID",
        message:
          error instanceof jwt.TokenExpiredError
            ? "Worker service token expired."
            : "Invalid Worker service token.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      code: "SERVICE_AUTH_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Worker service authentication failed.",
    });
  }
}
