import { prisma } from "@repo/db/client";
import express from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL;

function createOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

function createOAuthState() {
  return jwt.sign(
    {
      purpose: "google-oauth",
    },
    JWT_SECRET,
    {
      expiresIn: "10m",
    },
  );
}

function assertValidOAuthState(state: string) {
  const payload = jwt.verify(state, JWT_SECRET) as { purpose?: string };
  if (payload.purpose !== "google-oauth") {
    throw new Error("Invalid OAuth state");
  }
}

const GoogleRouter = express.Router();

GoogleRouter.get("/auth/url", (_req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res
      .status(500)
      .json({ message: "Google OAuth is not configured correctly" });
  }

  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    state: createOAuthState(),
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });

  res.json({ url });
});

GoogleRouter.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ message: "Missing code" });
  }

  if (!state || typeof state !== "string") {
    return res.redirect(`${FRONTEND_URL}/signin?error=google_auth_failed`);
  }

  try {
    assertValidOAuthState(state);

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const { id: googleId, email, name, picture } = data;

    if (!email) {
      return res.status(401).json({ message: "No email from Google" });
    }

    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        googleId: googleId ?? undefined,
        name: name ?? undefined,
        isVerified: true,
        ...(tokens.refresh_token && {
          googleRefreshToken: tokens.refresh_token,
        }),
      },
      create: {
        email: normalizedEmail,
        name,
        googleId,
        googleRefreshToken: tokens.refresh_token,
        isVerified: true,
        avatarUrl: picture ?? "",
      },
    });

    const token = jwt.sign(
      { userId: user.id, name: user.name, userTier: user.tier },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.redirect(
      `${FRONTEND_URL}/auth/callback?token=${token}&name=${encodeURIComponent(user.name ?? "")}`,
    );
  } catch (err) {
    console.error("Google auth failed:", err);
    return res.redirect(`${FRONTEND_URL}/signin?error=google_auth_failed`);
  }
});

export default GoogleRouter;
