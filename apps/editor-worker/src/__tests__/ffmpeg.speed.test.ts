import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(process.cwd(), "../../recordings/tmp/ffmpeg-speed");
const source = path.join(tmpDir, "source.mp4");
const speedUp = path.join(tmpDir, "output-speedup.mp4");
const slowDown = path.join(tmpDir, "output-slowdown.mp4");

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
  "speed effects: apply variable speed/time remapping",
  async () => {
    // Create a 4-second video with a gradient pattern (easier than timecode)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=s=640x360:d=4",
        "-c:v",
        "libx264",
        source,
      ],
      2,
      200,
    );

    // Speed up: double the speed (half the duration)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-filter:v",
        "setpts=0.5*PTS",
        "-filter:a",
        "atempo=2.0",
        "-c:v",
        "libx264",
        speedUp,
      ],
      2,
      200,
    );

    // Slow down: half the speed (double the duration)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-filter:v",
        "setpts=2*PTS",
        "-filter:a",
        "atempo=0.5",
        "-c:v",
        "libx264",
        slowDown,
      ],
      2,
      200,
    );

    const s1 = await fs.stat(speedUp);
    expect(s1.size).toBeGreaterThan(0);

    const s2 = await fs.stat(slowDown);
    expect(s2.size).toBeGreaterThan(0);
  },
  60_000,
);
