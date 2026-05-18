import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(
  process.cwd(),
  "../../recordings/tmp/ffmpeg-overlays",
);
const base = path.join(tmpDir, "base.mp4");
const overlayClip = path.join(tmpDir, "ov.mp4");
const out = path.join(tmpDir, "out-overlay.mp4");

beforeAll(async () => {
  await ensureDir(tmpDir);
});

afterAll(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

testIfReal(
  "overlay a small color clip on top of a base clip",
  async () => {
    // Base: blue 2s
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360:d=2",
        "-c:v",
        "libx264",
        base,
      ],
      2,
      200,
    );

    // Overlay clip: red small box 2s
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=red:s=160x90:d=2",
        "-c:v",
        "libx264",
        overlayClip,
      ],
      2,
      200,
    );

    // Compose overlay using filter_complex
    const compose = [
      "-y",
      "-i",
      base,
      "-i",
      overlayClip,
      "-filter_complex",
      "[0:v][1:v]overlay=10:10",
      "-c:v",
      "libx264",
      out,
    ];

    await runBinaryWithRetries(ffmpegPath as string, compose, 2, 200);

    const s = await fs.stat(out);
    expect(s.size).toBeGreaterThan(0);
  },
  20_000,
);
