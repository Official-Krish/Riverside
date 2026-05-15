# Transcoder

A background worker service that transcodes finished videos into HLS (HTTP Live Streaming) format with multiple quality profiles.

## Overview

The transcoder converts merged meeting videos into adaptive bitrate HLS streams:
- Multiple resolution profiles (360p, 480p, 720p, 1080p)
- Master playlist for client-side quality switching
- Thumbnail sprites for video scrubbing
- Poster image for video preview

## Technology Stack

- **Runtime**: Bun / Node.js
- **Video Processing**: FFmpeg + FFprobe
- **Storage**: Google Cloud Storage (via @repo/amazons3)
- **Queue**: Redis for job processing

## Key Features

### HLS Conversion
Converts MP4 video to HLS format:
- Segments: 6-second video segments (.ts files)
- Playlists: Manifest files (.m3u8)
- Master playlist: Quality variant selection

### Quality Profiles

| Profile | Resolution | Bitrate | Use Case |
|---------|------------|---------|----------|
| 1080p  | 1920x1080 | 6000kbps | High quality |
| 720p   | 1280x720  | 2500kbps | Standard |
| 480p   | 854x480   | 1000kbps | Mobile |
| 360p   | 640x360   | 500kbps  | Low bandwidth |

### Thumbnail Generation
- **Poster**: Single frame at 50% timestamp
- **Sprites**: Grid of thumbnails for scrubbing
- **VTT**: WebVTT file mapping sprite coordinates

### Output Structure
```
weave-recordings/{meetingId}/hls_v{version}/
├── master.m3u8              # Master playlist
├── 1080p/
│   ├── playlist.m3u8
│   └── segment-{n}.ts
├── 720p/
│   ├── playlist.m3u8
│   └── segment-{n}.ts
├── 480p/
├── 360p/
├── poster.jpg              # Preview image
├── sprites.jpg            # Thumbnail grid
└── thumbnails.vtt         # Sprite manifest
```

## Processing Pipeline

```
1. Job queued to Redis (queue: "TranscodeVideo")
2. Worker picks up job:
   ├─ Download source video from S3
   ├─ Detect video duration (ffprobe)
   ├─ Generate each quality profile:
   │   ├─ 1080p encoding
   │   ├─ 720p encoding
   │   ├─ 480p encoding
   │   └─ 360p encoding
   ├─ Generate master playlist
   ├─ Generate poster frame
   ├─ Generate thumbnail sprites
   ├─ Create VTT manifest
   ├─ Upload all to S3
   ├─ Cleanup local files
   └─ Report status to backend
```

## Job Payload

```typescript
interface TranscodePayload {
  meetingId: string;
  finalPath?: string;  // S3 key, defaults to standard path
  version?: string | number;  // Version identifier
}
```

## Status Reporting

Reports to backend endpoint: `POST /api/v1/worker/recording-status/{meetingId}`

```typescript
// Progress stages
{ status: "PROCESSING" }
{ status: "READY", finalPath: "...", version: "..." }
{ status: "FAILED" }
```

Authenticated via JWT with scope: `worker-service`

## Running

```bash
# Start the transcoder
bun run index.ts
```

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
BACKEND_URL=http://localhost:3000
WORKER_SERVICE_JWT_SECRET=your-secret
```

## Input/Output

### Input
- Primary: `weave-recordings/{meetingId}/final/meeting_grid_recording.mp4`
- Override: Custom path via `finalPath` parameter

### Output
- HLS manifest: `weave-recordings/{meetingId}/hls_v{version}/master.m3u8`
- Public URL: `https://storage.googleapis.com/{bucket}/weave-recordings/{meetingId}/hls_v{version}/master.m3u8`

## Integration with Other Services

1. **Merger Worker**: Triggers transcoder after successful merge
2. **Frontend**: Plays HLS via HLS.js
3. **Database**: Updates FinalRecording with HLS path