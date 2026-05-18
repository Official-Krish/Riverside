// Ensure storage codepath doesn't throw on import in test environment
process.env.AWS_BUCKET_NAME =
  process.env.AWS_BUCKET_NAME || "local-test-bucket";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

// This integration test runs only when REAL_FFMPEG=1 is set in the environment.
// It generates a short color video and re-encodes it, asserting outputs exist.

const maybeDescribe = process.env.REAL_FFMPEG ? describe : describe.skip;

maybeDescribe("real ffmpeg integration tests", () => {
  const tmpDir = path.resolve(
    process.cwd(),
    "../../recordings/tmp/ffmpeg-real-test",
  );
  const input = path.join(tmpDir, "input.mp4");
  const output = path.join(tmpDir, "out-scaled.mp4");

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

  test("ffmpeg can generate and transcode a short color video", async () => {
    // Generate a 1-second red color clip
    const genArgs = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=red:s=320x240:d=1",
      "-vf",
      "format=yuv420p",
      "-c:v",
      "libx264",
      input,
    ];

    await runBinaryWithRetries(ffmpegPath as string, genArgs, 2, 200);

    const stat1 = await fs.stat(input);
    expect(stat1.size).toBeGreaterThan(0);

    // Transcode / scale the generated input
    const transArgs = [
      "-y",
      "-i",
      input,
      "-vf",
      "scale=160:120",
      "-c:v",
      "libx264",
      output,
    ];

    await runBinaryWithRetries(ffmpegPath as string, transArgs, 2, 200);

    const stat2 = await fs.stat(output);
    expect(stat2.size).toBeGreaterThan(0);
  }, 30_000);
});
