import {
  addSocketToRoom,
  getParticipantList,
  hostDisconnectTimers,
  removeSocketFromMaps,
  roomParticipants,
  roomRecordingStates,
  socketMetadata,
  updateParticipantMediaState,
  upsertParticipant,
} from "./state";
import { broadcastToRoom, normalizeText, sendJson } from "./socket-utils";
import { storeChatMessage } from "./chatHistory";
import type { RelayerSocket, SocketMetadata, WsPayload } from "./types";

const HOST_DISCONNECT_GRACE_MS = 12000;

async function finalizeMeetingAfterHostDisconnect(roomId: string) {
  const backendBaseUrl =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    "http://localhost:3000/api/v1";
  const serviceToken =
    process.env.WORKER_SERVICE_JWT_SECRET ||
    process.env.WORKER_SERVICE_TOKEN;

  if (!serviceToken) {
    console.error("Host disconnect finalization skipped: missing worker service token");
    return;
  }

  try {
    const response = await fetch(
      `${backendBaseUrl.replace(/\/$/, "")}/meeting/system/end-on-host-disconnect/${roomId}`,
      {
        method: "POST",
        headers: {
          "x-worker-token": serviceToken,
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("Host disconnect finalization failed:", response.status, body);
    }
  } catch (error) {
    console.error("Host disconnect finalization request failed:", error);
  }
}

function broadcastParticipantList(roomId: string) {
  broadcastToRoom(roomId, {
    type: "participant-list",
    roomId,
    participants: getParticipantList(roomId),
  });
}

function clearPendingHostDisconnect(roomId: string) {
  const existingTimer = hostDisconnectTimers.get(roomId);
  if (!existingTimer) {
    return;
  }

  clearTimeout(existingTimer);
  hostDisconnectTimers.delete(roomId);
}

function scheduleHostDisconnectFinalization(metadata: SocketMetadata) {
  clearPendingHostDisconnect(metadata.roomId);

  const timer = setTimeout(() => {
    hostDisconnectTimers.delete(metadata.roomId);
    roomRecordingStates.set(metadata.roomId, false);

    broadcastToRoom(metadata.roomId, {
      type: "recording-state",
      roomId: metadata.roomId,
      isRecording: false,
      participantId: metadata.participantId,
    });
    broadcastToRoom(metadata.roomId, {
      type: "meeting-ended",
      roomId: metadata.roomId,
      endedBy: {
        participantId: metadata.participantId,
        displayName: metadata.displayName,
      },
      timestamp: Date.now(),
    });
    void finalizeMeetingAfterHostDisconnect(metadata.roomId);
  }, HOST_DISCONNECT_GRACE_MS);

  hostDisconnectTimers.set(metadata.roomId, timer);
}

function handleSocketLeave(ws: RelayerSocket) {
  const metadata = removeSocketFromMaps(ws);
  if (!metadata) {
    return;
  }

  broadcastToRoom(metadata.roomId, {
    type: "participant-left",
    roomId: metadata.roomId,
    participantId: metadata.participantId,
    displayName: metadata.displayName,
  });

  if (metadata.isHost) {
    scheduleHostDisconnectFinalization(metadata);
  }

  broadcastParticipantList(metadata.roomId);
}

function handleJoinRoom(ws: RelayerSocket, data: WsPayload, roomId: string) {
  handleSocketLeave(ws);

  const displayName = normalizeText(data.displayName, 80) || "Guest";
  const participantId =
    (typeof data.participantId === "string" && data.participantId.trim()) || crypto.randomUUID();
  const isHost = Boolean(data.isHost);
  const isMuted = typeof data.isMuted === "boolean" ? data.isMuted : false;
  const isVideoOff = typeof data.isVideoOff === "boolean" ? data.isVideoOff : false;

  if (isHost) {
    clearPendingHostDisconnect(roomId);
  }

  addSocketToRoom(roomId, ws);
  upsertParticipant(roomId, {
    participantId,
    displayName,
    isTyping: false,
    isHost,
    isMuted,
    isVideoOff,
  });

  const metadata: SocketMetadata = {
    roomId,
    participantId,
    displayName,
    isHost,
  };
  socketMetadata.set(ws, metadata);

  sendJson(ws, {
    type: "joined-room",
    roomId,
    participantId,
    displayName,
    isHost,
    isRecording: roomRecordingStates.get(roomId) ?? false,
  });

  broadcastToRoom(
    roomId,
    {
      type: "participant-joined",
      roomId,
      participant: {
        participantId,
        displayName,
        isTyping: false,
        isHost,
        isMuted,
        isVideoOff,
      },
    },
    ws
  );

  broadcastParticipantList(roomId);
}

export function handleSocketClose(ws: RelayerSocket) {
  handleSocketLeave(ws);
}

export async function handleSocketMessage(ws: RelayerSocket, data: WsPayload) {
  const type = typeof data.type === "string" ? data.type : "";
  const roomId = typeof data.roomId === "string" ? data.roomId.trim() : "";

  if (!type) {
    sendJson(ws, { type: "error", message: "Message type is required" });
    return;
  }

  if (type === "join-room") {
    if (!roomId) {
      sendJson(ws, { type: "error", message: "roomId is required for join-room" });
      return;
    }

    handleJoinRoom(ws, data, roomId);
    return;
  }

  const metadata = socketMetadata.get(ws);
  if (!metadata || metadata.roomId !== roomId) {
    sendJson(ws, { type: "error", message: "Join the room before sending events" });
    return;
  }

  if (type === "recording-state") {
    const isRecording = Boolean(data.isRecording);
    roomRecordingStates.set(roomId, isRecording);
    broadcastToRoom(roomId, {
      type: "recording-state",
      roomId,
      isRecording,
      participantId: metadata.participantId,
    });
    return;
  }

  if (type === "get-recording-state") {
    sendJson(ws, {
      type: "recording-state",
      roomId,
      isRecording: roomRecordingStates.get(roomId) ?? false,
    });
    return;
  }

  if (type === "chat-message") {
    const text = normalizeText(data.text, 1000);
    if (!text) {
      return;
    }

    const messagePayload = {
      type: "chat-message",
      id: crypto.randomUUID(),
      roomId,
      text,
      timestamp: Date.now(),
      sender: {
        participantId: metadata.participantId,
        displayName: metadata.displayName,
      },
    };

    // Store in Redis for history
    await storeChatMessage(roomId, messagePayload);

    broadcastToRoom(roomId, messagePayload);
    return;
  }

  if (type === "typing-state") {
    const isTyping = Boolean(data.isTyping);
    const participant = roomParticipants.get(roomId)?.get(metadata.participantId);
    if (participant) {
      participant.isTyping = isTyping;
    }

    broadcastToRoom(
      roomId,
      {
        type: "typing-state",
        roomId,
        participantId: metadata.participantId,
        displayName: metadata.displayName,
        isTyping,
      },
      ws
    );
    return;
  }

  if (type === "media-state") {
    if (typeof data.isMuted !== "boolean" || typeof data.isVideoOff !== "boolean") {
      sendJson(ws, {
        type: "error",
        message: "isMuted and isVideoOff are required for media-state",
      });
      return;
    }

    const participant = updateParticipantMediaState(roomId, metadata.participantId, {
      isMuted: data.isMuted,
      isVideoOff: data.isVideoOff,
    });

    if (!participant) {
      sendJson(ws, { type: "error", message: "Participant not found in room" });
      return;
    }

    broadcastToRoom(roomId, {
      type: "participant-media-state",
      roomId,
      participantId: metadata.participantId,
      displayName: metadata.displayName,
      isMuted: participant.isMuted,
      isVideoOff: participant.isVideoOff,
    });
    return;
  }

  if (type === "reaction") {
    const messageId = typeof data.messageId === "string" ? data.messageId.trim() : "";
    const emoji = typeof data.emoji === "string" ? data.emoji.trim() : "";
    const action = data.action === "remove" ? "remove" : "add";

    if (!messageId || !emoji) {
      sendJson(ws, { type: "error", message: "messageId and emoji are required for reaction" });
      return;
    }

    // Validate emoji is a single emoji (basic check)
    if (emoji.length > 20) {
      sendJson(ws, { type: "error", message: "Invalid emoji" });
      return;
    }

    broadcastToRoom(roomId, {
      type: "reaction",
      roomId,
      messageId,
      emoji,
      participantId: metadata.participantId,
      displayName: metadata.displayName,
      action,
      timestamp: Date.now(),
    });
    return;
  }

  if (type === "meeting-ended") {
    if (!metadata.isHost) {
      sendJson(ws, { type: "error", message: "Only host can end the meeting for all" });
      return;
    }

    broadcastToRoom(roomId, {
      type: "meeting-ended",
      roomId,
      endedBy: {
        participantId: metadata.participantId,
        displayName: metadata.displayName,
      },
      timestamp: Date.now(),
    });
    return;
  }

  if (type === "leave-room") {
    handleSocketLeave(ws);
    sendJson(ws, { type: "left-room", roomId });
    return;
  }

  if (type === "ping") {
    sendJson(ws, { type: "pong", timestamp: Date.now() });
    return;
  }

  sendJson(ws, { type: "error", message: `Unsupported message type: ${type}` });
}
