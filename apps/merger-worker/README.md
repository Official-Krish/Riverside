# Merger Worker

A background worker service that merges individual participant video chunks into a single grid video.

## Overview

The merger-worker is responsible for:
- Collecting encrypted video chunks from all participants
- Decrypting chunks (if encrypted with AES-GCM)
- Processing and merging into a unified grid layout
- Generating final video with all participants visible

## Technology Stack

- **Runtime**: Bun / Node.js
- **Video Processing**: FFmpeg
- **Storage**: Google Cloud Storage (via @repo/amazons3)
- **Queue**: Redis for job processing

## Key Features

### Chunk Collection
- Downloads all chunks for a meeting from S3
- Organizes chunks by participant (userId)
- Handles gaps in recording (participants who joined late/left early)
- Supports both encrypted and unencrypted chunks

### Chunk Decryption
The worker handles AES-256-GCM encrypted chunks:
1. Reads encryption metadata (algorithm, IV, auth tag)
2. Locates the wrapped CEK (Content Encryption Key) in Redis
3. Decrypts CEK using server's private RSA key
4. Decrypts chunk using AES-GCM with decrypted CEK
5. Proceeds with normal processing

### Video Processing
- **Individual Processing**: Each participant's chunks are concatenated
- **Padding**: Black video fills gaps for participants who joined late
- **Grid Layout**: Creates side-by-side grid of all participants
- **Audio**: Mixed audio from all participants (or silence if no audio)

### Output
- Final video: `weave-recordings/{meetingId}/final/meeting_grid_recording.mp4`
- Resolution: 1920x1080 @ 60fps
- Format: H.264 video + AAC audio

## Processing Pipeline

```
1. Job queued to Redis (queue: "MergeVideo")
2. Worker picks up job:
   ├─ Download all chunks from S3
   ├─ Check encryption status per chunk
   ├─ Decrypt encrypted chunks (if any)
   ├─ Sort chunks by timestamp
   ├─ Create individual videos per user
   ├─ Add black padding for gaps
   ├─ Merge into grid layout
   ├─ Upload final video to S3
   ├─ Report status to backend
   └─ Cleanup temporary files
3. Trigger transcoder for HLS conversion
```

## Chunk Metadata Schema

```prisma
model MediaChunk {
  meetingId          String
  uploaderUserId     String
  sequenceNumber     Int
  bucketLink         String      // S3 key
  isEncrypted        Boolean     // Encryption flag
  encryptionAlgorithm String?    // "AES-GCM"
  encryptionIv       String?     // Base64 IV
  encryptionTagBits  Int?        // Auth tag length
  durationMs         Int?
  startedAt          DateTime?
  status             ChunkUploadStatus
}
```

## Decryption Process

```typescript
// 1. Get wrapped CEK from Redis key: "meeting:{id}:cek"
// 2. Unwrap CEK with RSA private key (RSA-OAEP-256)
// 3. For each encrypted chunk:
//    a. Read ciphertext from file
//    b. Extract IV from metadata
//    c. Decrypt: AES-GCM-decrypt(ciphertext, CEK, IV, authTag)
//    d. Write decrypted chunk to temp file
// 4. Proceed with normal video processing
```

## Running

```bash
# Start the worker
bun run index.ts

# Or from root
npm run merger-worker
```

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
BUCKET_NAME=your-storage-bucket
GOOGLE_CLOUD_PROJECT=your-project
MERGER_USER_CONCURRENCY=2
```

## Concurrency

- Processes multiple users in parallel (configurable via `MERGER_USER_CONCURRENCY`)
- Default: 2 concurrent user videos at a time

## Cleanup

- Removes source chunks from S3 after successful merge
- Cleans up local temporary files
- Handles failed merges gracefully (leaves partial files for debugging)