import "dotenv/config";
import express from 'express';
import cors from 'cors';
import path from "node:path";
import userRouter from './routes/user';
import meetingRouter from './routes/meeting';
import workerRouter from './routes/worker';
import GoogleRouter from "./routes/google";
import NotificationRouter from "./routes/notifications";
import { notificationWorker } from "./utils/redis";
import RecordingRouter from "./routes/recording";
import editorRouter from "./routes/editor";
import GithubRouter from "./routes/github";
import chatRouter from "./routes/chat";
import rateLimiter from "./utils/rateLimiter";
import keysRouter from "./routes/keys";
import { ensureServerKeyPair } from "./utils/keys";

const app = express();
const recordingsRoot = path.resolve(process.cwd(), "../../recordings");

app.use(express.json());
app.use(cors());
app.use("/api/v1/recordings", express.static(recordingsRoot));

// Trust proxy if behind a load balancer / nginx so req.ip is correct
app.set("trust proxy", true);

// Global rate limiter (per-IP)
app.use(rateLimiter({ windowSeconds: 60, maxRequests: 200 }));

app.use("/api/v1/user", userRouter);
app.use("/api/v1/meeting", meetingRouter);
app.use("/api/v1", workerRouter);
app.use("/api/v1/google", GoogleRouter);
app.use("/api/v1/notifications", NotificationRouter);
app.use("/api/v1/recording", RecordingRouter);
app.use("/api/v1/editor", editorRouter);
app.use("/api/v1/github", GithubRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/keys", keysRouter);

notificationWorker().catch((error) => {
    console.error("Error in sendInvitationEmail:", error);
});

ensureServerKeyPair().catch((error) => {
    console.error("Failed to bootstrap server keypair:", error);
    process.exit(1);
});

app.listen(3000, () => {
    console.log('Backend server is running on port 3000');
});
