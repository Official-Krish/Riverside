# Backend API Server

The main REST API server for the Weave video conferencing platform.

## Overview

This is the central API backend that handles:
- User authentication (JWT + Google OAuth + GitHub OAuth)
- Meeting creation and management
- Recording chunk uploads (encrypted)
- Editor project management
- Notifications and scheduling

## Technology Stack

- **Runtime**: Bun / Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis for job processing
- **Authentication**: JWT tokens, Google OAuth, GitHub OAuth
- **Storage**: Google Cloud Storage (via @repo/amazons3)

## Key Features

### Authentication System
- Email/password registration and login
- Google OAuth integration
- GitHub OAuth integration
- JWT token-based session management
- Role-based access control

### Meeting Management
- Create meetings with optional passcode protection
- Join meetings via room ID
- Meeting scheduling with calendar integration
- Host controls for participant management

### Recording System
- **Chunk Upload Endpoint**: Receives 60-second video chunks from clients
- **Encryption Support**: Chunks can be encrypted with AES-256-GCM
- Each chunk is stored with metadata (sequence number, user ID, timestamps)
- Real-time recording state tracking (IDLE → RECORDING → UPLOADING → PROCESSING → READY)

### Video Editor API
- Create editor projects from recordings
- Save track/clips/overlay configurations
- Export job management

### Notifications
- In-app notification system
- Email notifications via Resend
- Meeting invites and reminders
- Recording ready/failed notifications

### Integration Services
- **Gmail**: Calendar integration for scheduled meetings
- **Slack**: Meeting notifications via Slack bot
- **Discord**: Webhook notifications
- **GitHub**: Issue creation from meeting chats

## API Endpoints

| Route | Description |
|-------|-------------|
| `/api/v1/user` | User authentication and profile |
| `/api/v1/meeting` | Meeting CRUD operations |
| `/api/v1/recording` | Recording management |
| `/api/v1/editor` | Editor projects |
| `/api/v1/notifications` | Notification management |
| `/api/v1/google` | Google OAuth and calendar |
| `/api/v1/github` | GitHub integration |
| `/api/v1/chat` | Chat messages |
| `/api/v1/keys` | Server encryption keys |
| `/api/v1/worker` | Worker service callbacks |

## Chunk Encryption

The backend supports encrypted chunk uploads for enhanced security:

### Encryption Flow
1. Client generates a random Content Encryption Key (CEK) per meeting
2. Client encrypts each video chunk with AES-256-GCM using the CEK
3. Client wraps (encrypts) the CEK with the server's RSA public key
4. Client uploads: encrypted chunk + wrapped CEK + IV + algorithm metadata
5. Backend stores all encryption parameters in the database
6. Merger-worker decrypts chunks before processing

### Database Schema
```prisma
model MediaChunk {
  isEncrypted           Boolean
  encryptionAlgorithm   String?  // "AES-GCM"
  encryptionIv          String?  // Base64 encoded IV
  encryptionTagBits    Int?     // Authentication tag length
}
```

### Server Key Pair
The server maintains an RSA-4096 keypair for wrapping CEKs:
```prisma
model ServerKeyPair {
  publicKeyPem   String
  privateKeyPem String
  algorithm     String  // "RSA-OAEP-256"
}
```

## Environment Variables

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-jwt-secret"
REDIS_HOST="localhost"
REDIS_PORT=6379
```

## Running

```bash
# Development
bun run index.ts

# Or from root
npm run backend
```

## Port

Listens on `http://localhost:3000`