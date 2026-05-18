import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const maybeDescribe = process.env.REAL_FFMPEG ? describe : describe.skip;

maybeDescribe("ffmpeg fullflow", () => {
  const tmpDir = path.resolve(
    process.cwd(),
    "../../recordings/tmp/ffmpeg-fullflow",
  );
  const clip1 = path.join(tmpDir, "clip1.mp4");
  const clip2 = path.join(tmpDir, "clip2.mp4");
  const composed = path.join(tmpDir, "composed.mp4");

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

  test("compose clips with audio, crossfade, overlay box and scale", async () => {
    // Create clip1: blue with 440Hz tone
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        clip1,
      ],
      2,
      200,
    );

    // Create clip2: green with 660Hz tone
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=640x360:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=660:duration=2",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        clip2,
      ],
      2,
      200,
    );

    // Crossfade video with xfade and audio with acrossfade, add a box overlay and scale to 480x270
    const fc = [
      "-y",
      "-i",
      clip1,
      "-i",
      clip2,
      "-filter_complex",
      // v: xfade; a: acrossfade
      "[0:v]trim=duration=2,setsar=1[v0];[1:v]trim=duration=2,setsar=1[v1];[v0][v1]xfade=transition=fade:duration=1:offset=1,format=yuv420p[vout];[0:a]atrim=duration=2[a0];[1:a]atrim=duration=2[a1];[a0][a1]acrossfade=d=1[aout];[vout]drawbox=x=10:y=10:w=200:h=60:color=black@0.5:t=fill,scale=480:270[vfinal]",
      "-map",
      "[vfinal]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      composed,
    ];

    await runBinaryWithRetries(ffmpegPath as string, fc, 2, 200);

    const s = await fs.stat(composed);
    expect(s.size).toBeGreaterThan(0);
  }, 60_000);
});
