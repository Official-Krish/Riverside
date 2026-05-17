import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(
  process.cwd(),
  "../../recordings/tmp/ffmpeg-transitions",
);
const a = path.join(tmpDir, "a.mp4");
const b = path.join(tmpDir, "b.mp4");
const out = path.join(tmpDir, "out-xfade.mp4");

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
  "xfade transition between two clips",
  async () => {
    // Create two colored clips
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=yellow:s=480x270:d=3",
        "-c:v",
        "libx264",
        a,
      ],
      2,
      200,
    );

    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=purple:s=480x270:d=3",
        "-c:v",
        "libx264",
        b,
      ],
      2,
      200,
    );

    // Use xfade to crossfade with duration 1 at offset 2
    const fc = [
      "-y",
      "-i",
      a,
      "-i",
      b,
      "-filter_complex",
      "[0:v]trim=duration=3[v0];[1:v]trim=duration=3[v1];[v0][v1]xfade=transition=fade:duration=1:offset=2,format=yuv420p[v]",
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      out,
    ];

    await runBinaryWithRetries(ffmpegPath as string, fc, 2, 200);

    const s = await fs.stat(out);
    expect(s.size).toBeGreaterThan(0);
  },
  30_000,
);
