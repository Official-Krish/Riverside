import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(
  process.cwd(),
  "../../recordings/tmp/ffmpeg-chromakey",
);
const greenscreen = path.join(tmpDir, "greenscreen.mp4");
const background = path.join(tmpDir, "background.mp4");
const keyed = path.join(tmpDir, "keyed.mp4");
const final = path.join(tmpDir, "final-chromakey.mp4");

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
  "chroma key effect: remove greenscreen and composite over background",
  async () => {
    // Create a 2-second green screen video
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=lime:s=640x360:d=2",
        "-c:v",
        "libx264",
        greenscreen,
      ],
      2,
      200,
    );

    // Create a 2-second background video (blue)
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
        background,
      ],
      2,
      200,
    );

    // Apply colorkey filter to remove lime green and add alpha channel
    // Then composite over background
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        greenscreen,
        "-i",
        background,
        "-filter_complex",
        "[0:v]format=rgba,colorkey=color=lime:similarity=0.2:blend=0.1[keyed];[1:v]setsar=1[bg];[bg][keyed]overlay",
        "-c:v",
        "libx264",
        final,
      ],
      2,
      200,
    );

    const s = await fs.stat(final);
    expect(s.size).toBeGreaterThan(0);
  },
  30_000,
);
