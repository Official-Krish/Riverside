import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(process.cwd(), "../../recordings/tmp/ffmpeg-audio");
const videoWithAudio = path.join(tmpDir, "with-audio.mp4");
const normalized = path.join(tmpDir, "normalized.mp4");
const filtered = path.join(tmpDir, "filtered.mp4");
const compressed = path.join(tmpDir, "compressed.mp4");

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
  "audio effects: apply volume normalization, filtering, and compression",
  async () => {
    // Create a video with audio (sine wave at 440Hz)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360:d=3",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=3",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        videoWithAudio,
      ],
      2,
      200,
    );

    // Normalize audio level (loudnorm filter)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        videoWithAudio,
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        normalized,
      ],
      2,
      200,
    );

    // Apply audio filtering: low-pass filter (remove high frequencies)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        videoWithAudio,
        "-af",
        "lowpass=f=5000",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        filtered,
      ],
      2,
      200,
    );

    // Apply dynamic range compression (audio compressor)
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        videoWithAudio,
        "-af",
        "compand=attacks=0.005:decays=0.1:points=-90/-inf|-60/-50|-30/-30|0/0:soft-knee=6:gain=0:volume=0:delay=0.05",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        compressed,
      ],
      2,
      200,
    );

    const s1 = await fs.stat(normalized);
    expect(s1.size).toBeGreaterThan(0);

    const s2 = await fs.stat(filtered);
    expect(s2.size).toBeGreaterThan(0);

    const s3 = await fs.stat(compressed);
    expect(s3.size).toBeGreaterThan(0);
  },
  60_000,
);
