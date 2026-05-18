import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(
  process.cwd(),
  "../../recordings/tmp/ffmpeg-colorgrade",
);
const source = path.join(tmpDir, "source.mp4");
const graded = path.join(tmpDir, "graded.mp4");
const warmTone = path.join(tmpDir, "warm-tone.mp4");
const saturated = path.join(tmpDir, "saturated.mp4");

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
  "color grading effects: apply color adjustments and grading",
  async () => {
    // Create a color test pattern (smptebars has consistent colors for grading)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "smptebars=s=640x360:d=2",
        "-c:v",
        "libx264",
        source,
      ],
      2,
      200,
    );

    // Apply basic color grading: increase saturation and reduce brightness
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-vf",
        "eq=saturation=1.5:brightness=-0.1",
        "-c:v",
        "libx264",
        graded,
      ],
      2,
      200,
    );

    // Apply warm tone (shift hue slightly yellow/orange)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-vf",
        "colorchannelmixer=rr=1.1:gg=0.9:bb=0.7",
        "-c:v",
        "libx264",
        warmTone,
      ],
      2,
      200,
    );

    // Increase saturation significantly (cinematic look)
    await runBinaryWithRetries(
      ffmpegPath as string,
      ["-y", "-i", source, "-vf", "hue=s=2.0", "-c:v", "libx264", saturated],
      2,
      200,
    );

    const s1 = await fs.stat(graded);
    expect(s1.size).toBeGreaterThan(0);

    const s2 = await fs.stat(warmTone);
    expect(s2.size).toBeGreaterThan(0);

    const s3 = await fs.stat(saturated);
    expect(s3.size).toBeGreaterThan(0);
  },
  60_000,
);
