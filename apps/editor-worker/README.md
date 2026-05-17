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

| Variable        | Default        | Description                      |
| --------------- | -------------- | -------------------------------- |
| `CONCURRENCY`   | 4              | Number of concurrent export jobs |
| `QUEUE_NAME`    | "EditorExport" | Redis queue name                 |
| `FFMPEG_BIN`    | "ffmpeg"       | FFmpeg binary path               |
| `OUTPUT_WIDTH`  | 1920           | Default export width             |
| `OUTPUT_HEIGHT` | 1080           | Default export height            |
| `OUTPUT_FPS`    | 30             | Default frame rate               |

## Performance

- Concurrent job processing (configurable)
- Canvas-based rendering for flexibility
- Efficient frame caching
- Progress reporting during export

## Tests

Comprehensive test suite covering FFmpeg operations, effects, and worker integration.

### Test Files

**Integration Tests (with REAL_FFMPEG):**

- `ffmpeg.real.test.ts` — Basic FFmpeg video generation and transcoding
- `ffmpeg.fullflow.test.ts` — Full video+audio composition with all effects
- `ffmpeg.worker.integration.test.ts` — End-to-end worker job processing
- `ffmpeg.overlays.test.ts` — Text and image overlay compositing
- `ffmpeg.transitions.test.ts` — XFade transition crossfades
- `ffmpeg.chromakey.test.ts` — Green screen chroma key removal
- `ffmpeg.lut.test.ts` — LUT 3D color grading
- `ffmpeg.speed.test.ts` — Speed ramps and variable playback
- `ffmpeg.blur.test.ts` — Blur and selective focus effects
- `ffmpeg.colorgrade.test.ts` — Color grading (EQ, hue, channel mixer)
- `ffmpeg.audio.test.ts` — Audio normalization, filtering, compression

**Unit Tests:**

- `processRender.flow.test.ts` — Render flow logic
- `unit.flow.test.ts` — Overlay generation, speed graph, concatenation
- `more.flow.test.ts` — Color normalization, audio mixing, LUT generation

### Running Tests

**Full effect test suite (with real FFmpeg):**

```bash
cd apps/editor-worker
REAL_FFMPEG=1 LOCAL_ONLY=1 NODE_ENV=test bunx vitest src/__tests__/ffmpeg.*.test.ts --run
```

**All tests (unit + integration):**

```bash
cd apps/editor-worker
NODE_ENV=test bunx vitest --run
```

**Specific test file:**

```bash
cd apps/editor-worker
REAL_FFMPEG=1 LOCAL_ONLY=1 NODE_ENV=test bunx vitest src/__tests__/ffmpeg.fullflow.test.ts --run
```

### Test Environment Variables

| Variable              | Impact                                                   |
| --------------------- | -------------------------------------------------------- |
| `REAL_FFMPEG=1`       | Use real FFmpeg binary instead of mocked short-circuit   |
| `LOCAL_ONLY=1`        | Use local disk (recordings/local_s3) instead of S3       |
| `NODE_ENV=test`       | Enable test mode with stub Prisma (no database required) |
| `FORCE_FFMPEG_FAIL=1` | Inject FFmpeg failures for retry testing                 |

### Test Coverage

Tests validate:

- ✅ FFmpeg filter syntax and stream handling
- ✅ Audio/video stream combinations and guards
- ✅ File path handling and special characters
- ✅ Timeline math and clip positioning
- ✅ Color encoding and normalization
- ✅ Effect application and parameter validation
- ✅ Transition rendering and blending
- ✅ Audio processing and mixing
- ✅ Full end-to-end job processing
- ✅ Local storage and file operations

Tests do NOT cover (by design—Prisma is stubbed):

- Database constraint validation
- Complex query logic (minimal in this codebase)
- Transaction isolation issues
