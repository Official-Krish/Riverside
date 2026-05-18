# Weave Frontend

The main React frontend application for the Weave video conferencing platform.

## Overview

A modern, feature-rich video conferencing client built with React 19, providing:
- Real-time video meetings via Jitsi Meet integration
- Local recording with automatic chunk upload
- Video editor for post-production
- User dashboard and profile management
- Meeting scheduling with calendar integration

## Technology Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4 + custom components
- **State Management**: TanStack Query (server state) + React hooks
- **Routing**: React Router v7
- **Video**: Jitsi Meet SDK for conferencing
- **Animations**: Framer Motion

## Key Features

### Meeting System
- Create/join meetings with room IDs
- Passcode-protected meetings
- Real-time participant grid
- Audio/video controls
- Screen sharing
- Device selection (camera, microphone)

### Local Recording with Encryption
- Records video/audio in 60-second chunks locally
- **AES-256-GCM encryption** for each chunk before upload
- Per-meeting Content Encryption Key (CEK)
- CEK wrapped with server's RSA public key
- Upload continues even with intermittent connectivity

### Recording Flow (Encryption)
```
1. Meeting starts → Generate random CEK (256-bit)
2. Every 60 seconds:
   a. Capture media chunk from local stream
   b. Generate random IV (96-bit)
   c. Encrypt chunk: AES-GCM(plaintext, CEK, IV)
   d. Extract auth tag from encryption
   e. Upload: encrypted chunk + wrapped CEK + IV + metadata
3. Meeting ends → CEK is discarded (one-time use)
```

### Video Editor
- Timeline-based editing interface
- Multiple tracks (video, audio, text)
- Drag-and-drop clips
- Overlay system (text, images, shapes)
- Transition effects
- Export to various formats
- Preset templates (zoom, glitch, cinematic, etc.)

### Dashboard
- Meeting history
- Recording library
- User profile management
- Notification center
- Subscription/billing (placeholder)

## Routes

| Route | Page |
|-------|------|
| `/` | Landing Page |
| `/signin` | Sign In |
| `/signup` | Sign Up |
| `/dashboard` | User Dashboard |
| `/meetingSetup` | Create Meeting |
| `/meeting/live/:meetingId` | Live Meeting |
| `/recordings/:recordingId` | Recording Viewer |
| `/edit/:meetingId` | Video Editor |
| `/meeting/schedule` | Schedule Meeting |
| `/profile` | User Profile |
| `/notifications` | Notifications |
| `/pricing` | Pricing Page |
| `/features` | Features Page |
| `/auth/callback` | OAuth Callback |

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Run linter
bun run lint
```

## Environment Variables

```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:9093"
VITE_JITSI_DOMAIN="meet.jit.si"
```

## Architecture

### Hooks
- `useMeetingRoom` - Jitsi connection and participant management
- `useMeetingRecording` - Local recording with encryption
- `useMeetingRealtime` - Real-time state via WebSocket
- `useAuth` - Authentication state
- `useEditorShortcuts` - Editor keyboard shortcuts

### Key Libraries
- `@jitsi/react-sdk` - Video conferencing
- `konva` + `react-konva` - Canvas-based editor
- `@tanstack/react-query` - Server state caching
- `axios` - HTTP client
- `sonner` - Toast notifications

## Security Features

1. **Chunk Encryption**: All recording chunks encrypted with AES-256-GCM
2. **CEK Management**: Per-meeting keys wrapped with RSA-OAEP-256
3. **JWT Authentication**: Secure token-based sessions
4. **Rate Limiting**: API protection against abuse
5. **CORS**: Proper cross-origin configuration