import { Router } from "express";
import { getChatHistory, clearChatHistory } from "../utils/redis";
import { authMiddleware } from "../utils/authMiddleware";
import { prisma } from "@repo/db/client";

const chatRouter = Router();

chatRouter.get("/:roomId/history", authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!roomId) {
    return res.status(400).json({ error: "roomId is required" });
  }

  try {
    const history = await getChatHistory(roomId as string, limit);
    return res.json({
      roomId,
      messages: history,
      count: history.length,
    });
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    return res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

chatRouter.delete("/:roomId/history", authMiddleware, async (req, res) => {
  const { roomId } = req.params;

  if (!roomId) {
    return res.status(400).json({ error: "roomId is required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId, isVerified: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const meeting = await prisma.meeting.findFirst({
        where: {
            id: roomId as string,
            userId: user.id,
        },
    });
    if (!meeting) {
        return res.status(404).json({ error: "Meeting not found or you do not have permission to clear its chat history" });
    }
    await clearChatHistory(roomId as string);
    return res.json({ success: true, message: "Chat history cleared" });
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    return res.status(500).json({ error: "Failed to clear chat history" });
  }
});

export default chatRouter;
