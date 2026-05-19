import path from "node:path";

export type HlsProfile = {
  name: "360p" | "720p" | "1080p";
  width: number;
  height: number;
  bandwidth: number;
  crf: number;
};

export const HLS_PROFILES: HlsProfile[] = [
  { name: "360p", width: 640, height: 360, bandwidth: 800000, crf: 28 },
  { name: "720p", width: 1280, height: 720, bandwidth: 2800000, crf: 23 },
  { name: "1080p", width: 1920, height: 1080, bandwidth: 5000000, crf: 20 },
];

export const THUMB_INTERVAL_SECONDS = 5;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const TILE_PADDING = 2;
const TILE_MARGIN = 2;
const TILE_COLS = 10;
const TILE_CELL_W = THUMB_WIDTH + TILE_PADDING;
const TILE_CELL_H = THUMB_HEIGHT + TILE_PADDING;

export function getTranscodeOutputDir(
  recordingsRoot: string,
  meetingId: string,
) {
  return path.join(recordingsRoot, meetingId, "hls");
}

export function buildPosterArgs(inputPath: string, outDir: string): string[] {
  return [
    "-y",
    "-ss",
    "00:00:01",
    "-i",
    inputPath,
    "-frames:v",
    "1",
    path.join(outDir, "poster.jpg"),
  ];
}

export function buildSpriteArgs(
  inputPath: string,
  outDir: string,
  durationSeconds: number,
): string[] {
  const thumbCount = Math.max(
    1,
    Math.ceil(durationSeconds / THUMB_INTERVAL_SECONDS),
  );
  const rows = Math.max(1, Math.ceil(thumbCount / TILE_COLS));

  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `fps=1/${THUMB_INTERVAL_SECONDS},scale=${THUMB_WIDTH}:${THUMB_HEIGHT},tile=${TILE_COLS}x${rows}:padding=${TILE_PADDING}:margin=${TILE_MARGIN}`,
    "-frames:v",
    "1",
    "-q:v",
    "4",
    path.join(outDir, "thumbnails.jpg"),
  ];
}

export function buildMasterPlaylistContent() {
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    ...HLS_PROFILES.flatMap((profile) => [
      `#EXT-X-STREAM-INF:BANDWIDTH=${profile.bandwidth},RESOLUTION=${profile.width}x${profile.height}`,
      `${profile.name}.m3u8`,
    ]),
    "",
  ].join("\n");
}

export function buildThumbnailVtt(durationSeconds: number) {
  const thumbCount = Math.max(
    1,
    Math.ceil(durationSeconds / THUMB_INTERVAL_SECONDS),
  );
  let vtt = "WEBVTT\n\n";

  for (let i = 0; i < thumbCount; i++) {
    const startTime = i * THUMB_INTERVAL_SECONDS;
    const endTime = Math.min(
      startTime + THUMB_INTERVAL_SECONDS,
      durationSeconds,
    );
    const col = i % TILE_COLS;
    const row = Math.floor(i / TILE_COLS);

    const x = TILE_MARGIN + col * TILE_CELL_W;
    const y = TILE_MARGIN + row * TILE_CELL_H;

    vtt += `${formatVttTime(startTime)} --> ${formatVttTime(endTime)}\n`;
    vtt += `thumbnails.jpg#xywh=${x},${y},${THUMB_WIDTH},${THUMB_HEIGHT}\n\n`;
  }

  return vtt;
}

function formatVttTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}
