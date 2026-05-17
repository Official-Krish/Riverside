import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(process.cwd(), "../../recordings/tmp/ffmpeg-blur");
const source = path.join(tmpDir, "source.mp4");
const blurred = path.join(tmpDir, "blurred.mp4");
const focusBlur = path.join(tmpDir, "focus-blur.mp4");

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
  "blur effect: apply blur filter to entire video",
  async () => {
    // Create a test pattern video
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc=s=640x360:d=2",
        "-c:v",
        "libx264",
        source,
      ],
      2,
      200,
    );

    // Apply blur filter to entire video
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-vf",
        "boxblur=luma_radius=10:chroma_radius=10",
        "-c:v",
        "libx264",
        blurred,
      ],
      2,
      200,
    );

    // Apply selective blur with focus region (blur everything except center)
    // Using boxblur with an unsharp mask inverse; alternative: use zscale + boxblur
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-vf",
        "split[a][b];[b]boxblur=luma_radius=15[blur];[a][blur]blend=all_mode=screen",
        "-c:v",
        "libx264",
        focusBlur,
      ],
      2,
      200,
    );

    const s1 = await fs.stat(blurred);
    expect(s1.size).toBeGreaterThan(0);

    const s2 = await fs.stat(focusBlur);
    expect(s2.size).toBeGreaterThan(0);
  },
  30_000,
);
