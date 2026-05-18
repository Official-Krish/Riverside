# Weave - Advanced Video Conferencing Platform

**High-quality video conferencing with intelligent local recording and end-to-end encryption**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)

## 🚀 Overview

Weave is a next-generation video conferencing platform that revolutionizes meeting recording by implementing **local recording technology** with **end-to-end encryption**. Unlike traditional platforms like Zoom that depend on internet quality for recording, Weave captures high-quality video and audio directly on each participant's device in encrypted 60-second chunks, then intelligently merges and processes recordings in the cloud.

### 🎯 Key Innovation

**Local Recording with Encryption**: Recordings happen locally on each user's device in 60-second chunks with AES-256-GCM encryption, ensuring:
- **No quality loss** due to internet connectivity issues
- **Consistent recording quality** regardless of network conditions
- **End-to-end encryption** - chunks encrypted before upload, decrypted only during merge
- **Reduced bandwidth usage** during meetings
- **Automatic chunk upload** and cloud processing

## ✨ Features

### 🎥 Core Functionality
- **Real-time video conferencing** with Jitsi Meet integration
- **Local recording** with automatic chunk upload and encryption
- **Screen sharing** capabilities
- **Participant management** with host controls
- **Meeting scheduling** with calendar integration (Google Calendar, Slack, Discord)
- **Passcode protection** for meetings

### 🔐 Security Features
- **AES-256-GCM chunk encryption** - Each recording chunk is encrypted locally
- **Per-meeting CEK (Content Encryption Key)** - Unique key per meeting
- **RSA-OAEP-256 key wrapping** - CEK wrapped with server's RSA public key
- **Server keypair** - RSA-4096 keypair for secure key management
- **JWT authentication** with role-based access control
- **Rate limiting** on API endpoints

### 🔧 Technical Features
- **Chunk-based recording** (60-second intervals)
- **Automatic video merging** using FFmpeg
- **Grid layout generation** for multi-participant recordings
- **HLS transcoding** with multiple quality profiles (360p-1080p)
- **Cloud storage integration** (Google Cloud Storage)
- **Real-time WebSocket** for chat and events
- **Video editor** with timeline, transitions, and presets

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                        │
│   /dashboard  /meeting/live/:id  /edit/:id  /recordings/:id                 │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ HTTP / WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express + Bun)                           │
│   User Auth  │ Meeting Mgmt  │ Recording  │ Editor  │ Notifications        │
│              │               │            │         │                      │
│   ─────────────────────────────────────────────────────────────────────     │
│   Real-time: ws-relayer (WebSocket server for chat/events)                 │
└──────┬──────────────────┬───────────────────────────────┬──────────────────┘
       │                  │                               │
       ▼                  ▼                               ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────────────────────────┐
│ PostgreSQL   │  │    Redis Queue   │  │       Amazon Cloud Storage         │
│ (Prisma ORM) │  │  Job Processing  │  │   Chunk Storage / Final Videos     │
└──────────────┘  └────────┬─────────┘  └─────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  Merger Worker  │ │ Editor Worker│ │   Transcoder    │
│  (FFmpeg Merge) │ │ (Video Edit) │ │   (HLS Convert)│
└────────┬────────┘ └──────┬───────┘ └────────┬────────┘
         │                 │                  │
         └─────────────────┴──────────────────┘
                          │
                          ▼
               ┌─────────────────────────┐
               │   Final Grid Video +    │
               │   HLS Adaptive Stream   │
               └─────────────────────────┘
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| **frontend** | 5173 | React Vite dev server |
| **backend** | 3000 | REST API server |
| **ws-relayer** | 9093 | WebSocket relay for real-time |
| **merger-worker** | - | Merges chunks into grid video |
| **editor-worker** | - | Video editor processing |
| **transcoder** | - | HLS transcoding |

## 🛠️ Technology Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS 4** for styling
- **Framer Motion** for animations
- **TanStack Query** for server state
- **Jitsi Meet SDK** for video conferencing
- **Konva + React-Konva** for canvas-based editor

### Backend
- **Bun / Node.js** runtime
- **Express.js** for API
- **TypeScript** for type safety
- **PostgreSQL** with Prisma ORM
- **Redis** for queue management
- **JWT** for authentication

### Workers
- **FFmpeg** for video processing
- **Bun** runtime for worker services
- **Google Cloud Storage** for file storage

## 📦 Project Structure

```
video_voice_confrence/
├── apps/
│   ├── frontend/               # React frontend (Vite)
│   ├── backend/                # Express API server
│   ├── ws-relayer/             # WebSocket relay (Bun)
│   ├── merger-worker/          # Video merging service
│   ├── editor-worker/          # Video editor processing
│   └── transcoder/             # HLS transcoder
├── packages/
│   ├── db/                     # Prisma schema and client
│   ├── types/                  # Shared TypeScript types
│   ├── ui/                     # Shared UI components
│   ├── amazons3/               # S3 storage utilities
│   └── eslint-config/          # ESLint configurations
├── docker/                     # Docker configurations
├── ops/                        # Kubernetes deployments
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Bun 1.2+ or Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Google Cloud Storage account

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Official-Krish/weave
   cd weave
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Environment Configuration**
   ```bash
   # Copy environment templates
   cp apps/backend/.env.example apps/backend/.env
   cp apps/frontend/.env.example apps/frontend/.env
   
   # Configure your environment variables
   # See Environment Variables section below
   ```

4. **Database Setup**
   ```bash
   cd packages/db
   bunx prisma generate
   bunx prisma db push
   ```

5. **Start Development Servers**
   ```bash
   # Start all services
   npm run dev
   
   # Or start individually
   npm run backend      # Port 3000
   npm run dev          # Frontend on 5173
   npm run editor-worker
   npm run merger-worker
   npm run transcoder
   ```

## 🔧 Environment Variables

### Backend
```env
DATABASE_URL="postgresql://user:password@localhost:5432/weave"
JWT_SECRET="your-jwt-secret"
REDIS_HOST=localhost
REDIS_PORT=6379
CDN_BASE_URL="https://cdn.yourdomain.com"
```

### Frontend
```env
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:9093"
VITE_JITSI_DOMAIN="meet.jit.si"
```

### Worker Services
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 📱 Usage

### For Users

1. **Create Account**: Sign up at the landing page
2. **Start Meeting**: Create a new meeting or join with a meeting ID
3. **Recording**: Host can start/stop recording (chunks encrypted automatically)
4. **Access Recordings**: View processed recordings in dashboard
5. **Edit Video**: Use the video editor to trim, add overlays, transitions

### For Developers

1. **API Integration**: Use the REST API at `/api/v1/*`
2. **WebSocket**: Connect to ws-relayer for real-time events
3. **Recording Flow**: Implement chunk upload with encryption

## 🔄 Recording Process (with Encryption)

### 1. Meeting Start
- Generate a random 256-bit Content Encryption Key (CEK) for the meeting
- Retrieve server's RSA public key
- Wrap CEK with RSA-OAEP-256 and store in Redis

### 2. Local Recording (every 60 seconds)
- Capture video/audio chunk from local MediaStream
- Generate random 96-bit IV
- Encrypt chunk: AES-256-GCM(plaintext, CEK, IV)
- Extract authentication tag
- Upload: encrypted chunk + wrapped CEK + IV + algorithm metadata

### 3. Chunk Upload
- Backend stores chunk with encryption metadata in database
- S3 stores the encrypted binary data

### 4. Meeting End → Merge
- Merger-worker downloads all chunks
- Reads encryption metadata from database
- Unwraps CEK using server's RSA private key
- Decrypts each chunk with AES-GCM
- Concatenates decrypted chunks per user
- Creates grid layout video with FFmpeg

### 5. Transcoding
- Transcoder converts final MP4 to HLS
- Generates multiple quality profiles (360p, 480p, 720p, 1080p)
- Creates thumbnail sprites and poster

## 📊 Performance

- **Recording Quality**: 1920x1080 @ 60fps
- **Chunk Size**: 60 seconds per chunk
- **Encryption**: AES-256-GCM (authenticated encryption)
- **Key Wrapping**: RSA-OAEP-256 with 4096-bit keys
- **Processing Time**: ~2-3 minutes for 1-hour meeting
- **HLS Profiles**: 4 quality levels for adaptive streaming

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Jitsi Meet** for the video conferencing foundation
- **FFmpeg** for video processing capabilities
- **Amazon Cloud Platform** for scalable infrastructure
- **Bun** for high-performance JavaScript runtime
- **Open Source Community** for various dependencies

---