# WebSocket Relayer (ws-relayer)

A real-time WebSocket server for relaying meeting events and chat messages.

## Overview

The ws-relayer is a lightweight WebSocket server built with **Bun** that handles:
- Real-time meeting state synchronization
- Chat message broadcasting
- Participant presence tracking
- Recording status updates

## Technology Stack

- **Runtime**: Bun (high-performance JavaScript runtime)
- **Server**: Bun.serve with WebSocket support
- **Storage**: Redis for chat history and state

## Key Features

### Real-Time Communication
- **Bidirectional WebSocket** connections
- JSON-based message protocol
- Room-based message routing (per meeting)
- Connection state management

### Chat System
- Persistent chat history stored in Redis
- Message history retrieval on reconnect
- Typing indicators
- Message reactions (future)

### Meeting Events
- Participant join/leave events
- Recording start/stop notifications
- Mute/video toggle broadcasts
- Screen share notifications

## Message Protocol

### Client → Server
```typescript
// Join a meeting room
{ type: "join", meetingId: string, userId: string }

// Send a chat message
{ type: "chat", meetingId: string, message: string }

// Typing indicator
{ type: "typing", meetingId: string }
```

### Server → Client
```typescript
// Chat message received
{ type: "chat", meetingId: string, userId: string, message: string, timestamp: string }

// Participant joined
{ type: "participant_joined", meetingId: string, userId: string }

// Recording status
{ type: "recording_status", meetingId: string, status: "started" | "stopped" }
```

## Architecture

```
┌─────────────┐      WebSocket       ┌─────────────┐
│   Frontend  │◄────────────────────►│ ws-relayer  │
│   (React)   │                      │   (Bun)     │
└─────────────┘                      └──────┬──────┘
                                            │
                                           Redis
                                         (Chat History)
```

## Connection Flow

1. Client connects to WebSocket endpoint
2. Client sends `join` message with meeting ID
3. Server subscribes client to meeting room
4. Messages are broadcast to all participants in the room
5. Chat history is stored/retrieved from Redis

## Running

```bash
# Start the server
bun run index.ts
```

## Environment Variables

```env
WS_PORT=9093
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Port

Listens on `ws://localhost:9093`

## Use Cases

1. **Live Meeting Updates**: Real-time participant changes
2. **Chat**: Instant messaging during meetings
3. **Recording Status**: Notify when recording starts/stops
4. **Issue Tracking**: Create GitHub issues from meeting chat