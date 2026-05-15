# Editor Worker

A background worker service for processing video editor projects, handling exports, transitions, and rendering.

## Overview

The editor-worker handles:
- Export job processing (video rendering)
- Transition effects rendering
- Overlay rendering (text, images, shapes)
- Audio processing
- Preset application (effects, animations)

## Technology Stack

- **Runtime**: Bun / Node.js
- **Video Processing**: FFmpeg
- **Canvas**: Konva for layer composition
- **Queue**: Redis for job processing

## Key Features

### Export Jobs
Processes video export requests:
1. Load project tracks, clips, and overlays
2. Generate frames using Konva canvas
3. Apply transitions between clips
4. Render audio tracks
5. Encode final video with FFmpeg
6. Upload to S3 and report status

### Timeline System
- **Track Types**: Video, Audio, Text
- **Clips**: Segments from source assets with timeline positioning
- **Overlays**: Non-destructive visual elements

### Transitions
Supported transitions between clips:
- **Fade**: Cross-fade between clips
- **Cut**: Immediate cut (no transition)
- Custom transitions via TransitionRenderer

### Presets
Built-in visual effects:
- `zoom-pop` - Zoom animation with pop
- `shake` - Screen shake effect
- `glitch` - Digital glitch effect
- `cinematic-bars` - Letterbox bars
- `vhs` - Retro VHS effect
- `chromakey` - Green screen removal
- `intro-template` - Title card
- `meme-format` - Meme-style captions
- `podcast-layout` - Audio-focused layout
- `lower-third` - Lower third graphics
- `cta-button` - Call-to-action overlay
- `chapter-title` - Chapter marker

### Asset Management
- Source assets from meeting recordings
- Waveform generation for audio
- Thumbnail generation for preview

## Project Schema

```prisma
model EditorProject {
  id          String
  ownerId     String
  meetingId   String
  sourceMode  SourceMode  // FINAL or MULTITRACK
  status      ProjectStatus
  durationMs  Int?
  tracks      EditorTrack[]
  overlays    EditorOverlay[]
  assets      EditorAsset[]
}

model EditorTrack {
  type      TrackType  // VIDEO, AUDIO, TEXT
  order     Int
  visible   Boolean
  muted     Boolean
  volume    Float
  clips     EditorClip[]
}

model EditorClip {
  sourceAssetId   String    // Source media
  sourceStartMs   Int       // Start position in source
  timelineStartMs Int       // Position on timeline
  durationMs      Int
  preset          String?   // Visual effect preset
  transitionStart Json?     // Transition at clip start
  transitionEnd   Json?     // Transition at clip end
}
```

## Export Process

```
1. Backend queues export job (queue: "EditorExport")
2. Worker picks up job:
   ├─ Load project from database
   ├─ Initialize canvas (width, height, fps)
   ├─ For each frame:
   │   ├─ Determine active clips per track
   │   ├─ Apply clip transformations
   │   ├─ Render overlays
   │   ├─ Apply transitions
   │   └─ Draw to canvas
   ├─ Encode frames to video (FFmpeg)
   ├─ Mix audio tracks
   ├─ Combine video + audio
   ├─ Upload to S3
   └─ Report status to backend
```

## Running

```bash
# Start the worker
bun run index.ts

# Or from root
npm run editor-worker
```

## Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
BUCKET_NAME=your-storage-bucket
FFMPEG_PATH=/usr/bin/ffmpeg
CONCURRENCY=4
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CONCURRENCY` | 4 | Number of concurrent export jobs |
| `QUEUE_NAME` | "EditorExport" | Redis queue name |
| `FFMPEG_BIN` | "ffmpeg" | FFmpeg binary path |
| `OUTPUT_WIDTH` | 1920 | Default export width |
| `OUTPUT_HEIGHT` | 1080 | Default export height |
| `OUTPUT_FPS` | 30 | Default frame rate |

## Performance

- Concurrent job processing (configurable)
- Canvas-based rendering for flexibility
- Efficient frame caching
- Progress reporting during export