import { test, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs/promises";

test("normalizeFfmpegColor accepts named and hex", async () => {
  const { normalizeFfmpegColor, formatFfmpegColorWithAlpha } = await import(
    "../ffmpegUtils"
  );
  expect(normalizeFfmpegColor("black")).toBe("black");
  expect(normalizeFfmpegColor("#112233")).toBe("0x112233");
  expect(formatFfmpegColorWithAlpha("black", 0.5)).toBe("black@0.500");
  expect(formatFfmpegColorWithAlpha("#ffffff", 1)).toBe("0xffffffff");
});

test("buildAudioMixArgs returns mix mapping and inputs", async () => {
  const { buildAudioMixArgs } = await import("../audio");
  const args = buildAudioMixArgs(
    "in.mp4",
    [
      {
        sourcePath: "a1.mp3",
        timelineStartMs: 0,
        sourceStartMs: 0,
        durationMs: 1000,
        volume: 1,
        audioMode: "layer",
      },
    ],
    "out.mp4",
  );

  const joined = args.join(" ");
  expect(joined).toContain("-filter_complex");
  expect(joined).toContain("amix=inputs=2");
  expect(joined).toContain("-map [mix]");
});

test("buildConcatArgs writes list file and returns args", async () => {
  const { buildConcatArgs } = await import("../audio");
  const tmp = path.join(process.cwd(), "tmp_more_tests");
  await fs.mkdir(tmp, { recursive: true });
  const out = path.join(tmp, "o.mp4");
  const parts = ["a.mp4", "b.mp4"];
  const res = await buildConcatArgs(parts, out);
  expect(res.args).toBeDefined();
  const content = await fs.readFile(res.listPath, "utf8");
  expect(content).toContain("file 'a.mp4'");
  await fs.rm(tmp, { recursive: true, force: true });
});

test("materializeClipEffectsAssets writes LUT when cubeData present", async () => {
  const { materializeClipEffectsAssets } = await import(
    "../effects/materialize"
  );
  const tmp = path.join(process.cwd(), "tmp_materialize");
  await fs.mkdir(tmp, { recursive: true });
  const clip = {
    id: "c1",
    effects: {
      color: { lut: { enabled: true, cubeData: "LUTDATA", name: "m.cube" } },
    },
  } as any;
  const res = await materializeClipEffectsAssets(clip, tmp);
  expect(res.cleanupPaths.length).toBeGreaterThan(0);
  await fs.rm(tmp, { recursive: true, force: true });
});
