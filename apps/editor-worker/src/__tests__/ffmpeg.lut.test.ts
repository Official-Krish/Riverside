import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries, ensureDir } from "../helpers";
import { test, beforeAll, afterAll, expect } from "vitest";

const testIfReal = process.env.REAL_FFMPEG ? test : test.skip;

const tmpDir = path.resolve(process.cwd(), "../../recordings/tmp/ffmpeg-lut");
const source = path.join(tmpDir, "source.mp4");
const cube = path.join(tmpDir, "identity.cube");
const output = path.join(tmpDir, "output-lut.mp4");

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
  "LUT effect: apply color lookup table to video",
  async () => {
    // Create a colorful test video (gradient-like with multiple colors)
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

    // Create a simple 3x3x3 identity cube LUT (minimal color transform)
    const lutContent = `TITLE "Identity 3D LUT"
LUT_3D_SIZE 3
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
# 3x3x3 identity cube (raw data)
0.000000 0.000000 0.000000
0.500000 0.000000 0.000000
1.000000 0.000000 0.000000
0.000000 0.500000 0.000000
0.500000 0.500000 0.000000
1.000000 0.500000 0.000000
0.000000 1.000000 0.000000
0.500000 1.000000 0.000000
1.000000 1.000000 0.000000
0.000000 0.000000 0.500000
0.500000 0.000000 0.500000
1.000000 0.000000 0.500000
0.000000 0.500000 0.500000
0.500000 0.500000 0.500000
1.000000 0.500000 0.500000
0.000000 1.000000 0.500000
0.500000 1.000000 0.500000
1.000000 1.000000 0.500000
0.000000 0.000000 1.000000
0.500000 0.000000 1.000000
1.000000 0.000000 1.000000
0.000000 0.500000 1.000000
0.500000 0.500000 1.000000
1.000000 0.500000 1.000000
0.000000 1.000000 1.000000
0.500000 1.000000 1.000000
1.000000 1.000000 1.000000`;

    await fs.writeFile(cube, lutContent, "utf8");

    // Apply lut3d filter
    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-i",
        source,
        "-vf",
        `lut3d=file=${cube}`,
        "-c:v",
        "libx264",
        output,
      ],
      2,
      200,
    );

    const s = await fs.stat(output);
    expect(s.size).toBeGreaterThan(0);
  },
  30_000,
);
