import * as fs from "node:fs/promises";
import type { AudioClipPlan } from "./types";

export function buildAudioMixArgs(
  baseVideoPath: string,
  audioClips: AudioClipPlan[],
  outputPath: string,
  baseVideoHasAudio = true,
) {
  const args = ["-y", "-i", baseVideoPath];
  const filterParts: string[] = [];
  const inputLabels: string[] = [];

  if (baseVideoHasAudio) {
    const duckIntervals = audioClips.map((clip) => ({
      start: (clip.timelineStartMs / 1000).toFixed(2),
      end: ((clip.timelineStartMs + clip.durationMs) / 1000).toFixed(2),
      level: clip.audioMode === "replace" ? "0" : "0.1",
    }));

    const volumeExpr =
      duckIntervals.length === 0
        ? "1"
        : duckIntervals
            .map((i) => `if(between(t,${i.start},${i.end}),${i.level},1)`)
            .reduce((acc, expr) => `min(${acc},${expr})`);

    filterParts.push(
      `[0:a]volume='${volumeExpr}',aresample=osr=48000:async=1[a0]`,
    );
    inputLabels.push("[a0]");
  }

  audioClips.forEach((clip, index) => {
    const inputIndex = baseVideoHasAudio ? index + 1 : index;
    args.push(
      "-ss",
      (clip.sourceStartMs / 1000).toFixed(3),
      "-t",
      (clip.durationMs / 1000).toFixed(3),
      "-i",
      clip.sourcePath,
    );

    const label = `a${inputLabels.length}`;
    const delay = Math.round(Math.max(0, clip.timelineStartMs));
    const volume = clip.volume.toFixed(3);

    filterParts.push(
      `[${inputIndex}:a]aresample=osr=48000:async=1,adelay=${delay}|${delay},volume=${volume}[${label}]`,
    );
    inputLabels.push(`[${label}]`);
  });

  if (inputLabels.length === 0) {
    args.push("-map", "0:v", "-c:v", "copy", outputPath);
    return args;
  }

  const mixOrPassthrough =
    inputLabels.length === 1
      ? `${inputLabels[0]}anull[mix]`
      : `${inputLabels.join("")}amix=inputs=${inputLabels.length}:duration=first:dropout_transition=2:normalize=0[mix]`;

  filterParts.push(mixOrPassthrough);

  args.push(
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    "0:v",
    "-map",
    "[mix]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "320k",
    "-ar",
    "48000",
    outputPath,
  );

  return args;
}

export async function buildConcatArgs(parts: string[], output: string) {
  const listPath = output.replace(/\.mp4$/, "_concat.txt");
  const content = parts
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fs.writeFile(listPath, content, "utf8");

  return {
    args: [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "22",
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
      output,
    ],
    listPath,
  };
}
