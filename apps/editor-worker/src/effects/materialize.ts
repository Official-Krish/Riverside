import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RenderClip } from "../types";
import { normalizeClipEffects } from "./normalize";

function sanitizeName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function materializeClipEffectsAssets(
  clip: RenderClip,
  workingDir: string,
): Promise<{ clip: RenderClip; cleanupPaths: string[] }> {
  if (!clip.effects) {
    return { clip, cleanupPaths: [] };
  }

  const effects = normalizeClipEffects(clip.effects);
  const cleanupPaths: string[] = [];

  if (
    effects.color.lut.enabled &&
    effects.color.lut.cubeData &&
    !effects.color.lut.cubePath
  ) {
    const lutDir = path.join(workingDir, "clip-effects");
    await fs.mkdir(lutDir, { recursive: true });

    const fileName = sanitizeName(effects.color.lut.name || `${clip.id}.cube`);
    const lutPath = path.join(lutDir, `${clip.id}_${fileName}`);
    await fs.writeFile(lutPath, effects.color.lut.cubeData, "utf8");
    cleanupPaths.push(lutPath);

    effects.color.lut.cubePath = lutPath;
  }

  return {
    clip: {
      ...clip,
      effects,
    },
    cleanupPaths,
  };
}
