import { Router } from "express";
import multer from "multer";
import { authMiddleware, serviceAuthMiddleware } from "../utils/authMiddleware";
import rateLimiter from "../utils/rateLimiter";
import { workerRecordingStatusSchema } from "@repo/types";
import { handleFailedStatus, handleProcessingStatus, handleReadyStatus } from "../utils/Notification.helper";
import { uploadChunk } from "../utils/uploadChunk.service";

const workerRouter = Router();
const upload = multer({ storage: multer.memoryStorage() });

workerRouter.post("/upload-chunk", authMiddleware, rateLimiter({ windowSeconds: 60, maxRequests: 600, prefix: "upload", keyGenerator: (req) => (req.userId ? `user:${req.userId}` : undefined) }), upload.single("video"), async (req, res) => {
  if (!req.file || !req.body.meetingId) {
    res.status(400).json({ message: "Missing file or meetingId" });
    return;
  }
 
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
 
  const mimeType = String(req.body.mimeType || req.file.mimetype || "video/webm");
  const sequenceNumber = req.body.sequenceNumber ? Number(req.body.sequenceNumber) : null;
  const startedAt = req.body.startedAt ? new Date(req.body.startedAt) : null;
  const durationMs = req.body.durationMs ? Number(req.body.durationMs) : null;
  const isEncrypted = String(req.body.isEncrypted || "false").toLowerCase() === "true";
  const sourceMimeType = req.body.sourceMimeType ? String(req.body.sourceMimeType) : null;
  const encryptionAlgorithm = req.body.encryptionAlgorithm ? String(req.body.encryptionAlgorithm) : null;
  const encryptionIv = req.body.encryptionIv ? String(req.body.encryptionIv) : null;
  const encryptionTagBits = req.body.encryptionTagBits ? Number(req.body.encryptionTagBits) : null;
 
  try {
    await uploadChunk({
      fileBuffer: req.file.buffer,
      fileMimeType: req.file.mimetype,
      meetingId: String(req.body.meetingId),
      userId,
      rawParticipantId: req.body.participantId,
      sequenceNumber,
      startedAt,
      durationMs,
      mimeType,
      isEncrypted,
      sourceMimeType,
      encryptionAlgorithm,
      encryptionIv,
      encryptionTagBits,
    });
 
    res.status(200).json({ message: "Chunk uploaded successfully"});
  } catch (error: any) {
    if (error?.statusCode === 400) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error?.statusCode === 404) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error?.statusCode === 403) {
      res.status(403).json({ message: error.message });
      return;
    }
    console.error("Upload chunk error:", error);
    res.status(500).json({ message: "Upload failed" });
  }
});

workerRouter.post("/worker/recording-status/:meetingId", serviceAuthMiddleware, async (req, res) => {
  const parsedData = workerRecordingStatusSchema.safeParse({
    meetingId: req.params.meetingId,
    status: req.body?.status,
    finalPath: req.body?.finalPath,
    version: req.body?.version,
  });

  if (!parsedData.success) {
    res.status(400).json({ message: "Invalid request body", errors: parsedData.error.errors });
    return;
  }

  const meetingId = parsedData.data.meetingId;
  const status = parsedData.data.status;
  const finalPath = parsedData.data.finalPath;
  const version = parsedData.data.version;

  if (!meetingId) {
    res.status(400).json({ message: "Missing meetingId" });
    return;
  }

  if (!["PROCESSING", "READY", "FAILED"].includes(status)) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }

  try {
    switch (status) {
      case "PROCESSING":
        await handleProcessingStatus(meetingId);
        res.status(200).json({ message: "Processing status updated" });
        break;

      case "FAILED":
        await handleFailedStatus(meetingId);
        res.status(200).json({ message: "Failure status updated" });
        break;

      case "READY":
        await handleReadyStatus(meetingId, finalPath!, version);
        res.status(200).json({ message: "Ready status updated" });
        break;
    }
  } catch (error) {
    console.error("Worker status callback error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default workerRouter;
