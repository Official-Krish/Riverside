import type { RenderClip } from "./types";
import { buildPresetFilter } from "./presets";
import {
  buildSimpleVisualFilterChain,
  buildSpeedGraph,
  buildVisualEffectsGraph,
  needsComplexVisualGraph,
  needsSpeedGraph,
} from "./effects/ffmpeg";

export function getXFadeTransition(type: string | null | undefined): string {
  switch (type) {
    case "cut":
    case "fade":
    case "cross-dissolve":
      return "fade";
    case "dip-to-black":
      return "fadeblack";
    case "slide-left":
      return "slideleft";
    case "slide-right":
      return "slideright";
    case "slide-up":
      return "slideup";
    case "slide-down":
      return "slidedown";
    case "push-left":
      return "smoothleft";
    case "push-right":
      return "smoothright";
    case "push-up":
      return "smoothup";
    case "push-down":
      return "smoothdown";
    case "wipe-left":
      return "wipeleft";
    case "wipe-right":
      return "wiperight";
    case "wipe-top":
      return "wipeup";
    case "wipe-bottom":
      return "wipedown";
    case "wipe-clock":
      return "wipeclock";
    case "wipe-radial":
      return "radial";
    case "circle-open":
      return "circleopen";
    case "circle-close":
      return "circleclose";
    case "diamond-open":
    case "diamond-close":
    case "square-open":
    case "square-close":
      return "rectcrop";
    case "blur":
    case "zoom-in":
    case "zoom-out":
    case "swap":
    case "cube-left":
    case "cube-right":
    case "page-turn":
    case "morph":
      return "fade";
    case "gradient-left":
      return "wipeleft";
    case "gradient-right":
      return "wiperight";
    case "gradient-top":
      return "wipeup";
    case "gradient-bottom":
      return "wipedown";
    default:
      return "fade";
  }
}

function buildXFadeArgs(
  transition: {
    type: string;
    durationMs: number;
    borderWidth?: number;
    borderColor?: string;
    reverse?: boolean;
  },
  offsetSec: string,
): string {
  let args = `transition=${transition.type}:duration=${(transition.durationMs / 1000).toFixed(3)}:offset=${offsetSec}`;
  if (transition.borderWidth) args += `:borderw=${transition.borderWidth}`;
  if (transition.borderColor)
    args += `:bordercolor=0x${transition.borderColor.replace("#", "")}`;
  if (transition.reverse) args += ":reverse=1";
  return args;
}

export function getTransitionPlan(clip: RenderClip, position: "start" | "end") {
  const transition =
    position === "start"
      ? (clip.transitionStart ??
        (clip.transitionIn
          ? { type: clip.transitionIn, durationMs: 500 }
          : null))
      : (clip.transitionEnd ??
        (clip.transitionOut
          ? { type: clip.transitionOut, durationMs: 500 }
          : null));

  if (!transition || typeof transition !== "object") return null;

  const transitionRecord = transition as Record<string, unknown>;
  const transitionType =
    typeof transitionRecord.type === "string" ? transitionRecord.type : null;
  const transitionDuration = Number.isFinite(transitionRecord.durationMs)
    ? Number(transitionRecord.durationMs)
    : 500;

  if (!transitionType || transitionType === "cut") return null;

  return {
    type: getXFadeTransition(transitionType),
    durationMs: Math.max(100, transitionDuration),
    borderWidth: Number.isFinite(transitionRecord.borderWidth)
      ? Number(transitionRecord.borderWidth)
      : undefined,
    borderColor:
      typeof transitionRecord.borderColor === "string"
        ? transitionRecord.borderColor
        : undefined,
    reverse:
      typeof transitionRecord.reverse === "boolean"
        ? transitionRecord.reverse
        : undefined,
  };
}

export function buildClipRenderArgs(
  clip: RenderClip,
  outputPath: string,
  width: number,
  height: number,
  fps: number,
): string[] {
  const startTransition = getTransitionPlan(clip, "start");
  const endTransition = getTransitionPlan(clip, "end");
  const presetFilter = buildPresetFilter(
    clip.preset,
    clip.presetConfig,
    width,
    height,
    fps,
  );
  const visualFilters = buildSimpleVisualFilterChain(clip.effects);
  const useSpeedGraph = needsSpeedGraph(clip);
  const useComplexVisuals = needsComplexVisualGraph(clip.effects);
  const needsFilterComplex = Boolean(
    startTransition || endTransition || useSpeedGraph || useComplexVisuals,
  );

  const args = [
    "-y",
    "-ss",
    (clip.sourceStartMs / 1000).toFixed(3),
    "-i",
    clip.sourcePath,
  ];

  if (!needsFilterComplex) {
    let filterChain = `scale=${width}:${height}`;
    if (visualFilters.length > 0) {
      filterChain += `,${visualFilters.join(",")}`;
    }
    if (presetFilter) {
      filterChain += `,${presetFilter}`;
    }

    const audioArgs = clip.hasAudio
      ? ["-c:a", "aac", "-b:a", "320k", "-ar", "48000"]
      : ["-an"];

    const finalArgs = [
      "-t",
      (clip.durationMs / 1000).toFixed(3),
      "-vf",
      filterChain,
      "-r",
      String(fps),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "22",
      "-movflags",
      "+faststart",
      ...audioArgs,
      outputPath,
    ];

    return [...args, ...finalArgs];
  }

  const filterParts: string[] = [];
  let videoLabel = "clipv";
  let audioLabel: string | null = null;

  if (useSpeedGraph) {
    const speedGraph = buildSpeedGraph(clip, "spd");
    filterParts.push(...speedGraph.filterParts);
    filterParts.push(
      `[${speedGraph.videoLabel}]scale=${width}:${height},fps=${fps}[clipscaled]`,
    );
    videoLabel = "clipscaled";
    audioLabel = speedGraph.audioLabel ?? null;
  } else {
    let filterChain = `trim=duration=${(clip.durationMs / 1000).toFixed(3)},setpts=PTS-STARTPTS,scale=${width}:${height},fps=${fps}`;
    if (visualFilters.length > 0) {
      filterChain += `,${visualFilters.join(",")}`;
    }
    filterParts.push(`[0:v]${filterChain}[clipbase]`);
    videoLabel = "clipbase";
  }

  if (useComplexVisuals) {
    const visualGraph = buildVisualEffectsGraph(
      videoLabel,
      clip.effects,
      width,
      height,
      fps,
      "fx",
    );
    filterParts.push(...visualGraph.filterParts);
    videoLabel = visualGraph.outputLabel;
  }

  let inputIndex = 1;
  let outputLabel = videoLabel;

  if (startTransition) {
    args.push(
      "-f",
      "lavfi",
      "-t",
      (startTransition.durationMs / 1000).toFixed(3),
      "-i",
      `color=c=black:s=${width}x${height}:r=${fps}`,
    );
    filterParts.push(`[${inputIndex}:v]format=rgba[blackstart]`);
    filterParts.push(
      `[blackstart][${videoLabel}]xfade=${buildXFadeArgs(startTransition, "0")}[afterstart]`,
    );
    outputLabel = "afterstart";
    inputIndex += 1;
  }

  if (endTransition) {
    args.push(
      "-f",
      "lavfi",
      "-t",
      (endTransition.durationMs / 1000).toFixed(3),
      "-i",
      `color=c=black:s=${width}x${height}:r=${fps}`,
    );
    filterParts.push(`[${inputIndex}:v]format=rgba[blackend]`);
    const endOffset = Math.max(
      0,
      (clip.durationMs - endTransition.durationMs) / 1000,
    ).toFixed(3);
    filterParts.push(
      `[${outputLabel}][blackend]xfade=${buildXFadeArgs(endTransition, endOffset)}[outv]`,
    );
    outputLabel = "outv";
  }

  if (presetFilter) {
    if (outputLabel === "outv") {
      filterParts.push(`[outv]${presetFilter}[finalv]`);
    } else if (outputLabel === "afterstart") {
      filterParts.push(`[afterstart]${presetFilter}[finalv]`);
    } else {
      filterParts.push(`[${videoLabel}]${presetFilter}[finalv]`);
    }
    outputLabel = "finalv";
  }

  const finalArgs = [
    "-filter_complex",
    filterParts.join(";"),
    "-map",
    `[${outputLabel}]`,
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  if (audioLabel) {
    finalArgs.splice(2, 0, "-map", `[${audioLabel}]`);
    finalArgs.splice(
      finalArgs.length - 1,
      0,
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
    );
  } else if (clip.hasAudio) {
    finalArgs.splice(2, 0, "-map", "0:a?");
    finalArgs.splice(
      finalArgs.length - 1,
      0,
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-ar",
      "48000",
    );
  } else {
    finalArgs.splice(2, 0, "-an");
  }

  return [...args, ...finalArgs];
}

export function buildCrossfadeConcatArgs(
  parts: Array<{
    path: string;
    durationMs: number;
    transition?: { type: string; durationMs: number } | null;
  }>,
  outputPath: string,
  fps: number,
): { args: string[]; listPath: string } | null {
  if (parts.length < 2) return null;

  const args = ["-y"];
  const filterParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    args.push("-i", part.path);
    filterParts.push(`[${i}:v:0]setpts=PTS-STARTPTS[v${i}]`);
  }

  // Chain pairwise transitions left-to-right.
  // Example for 3 clips: [v0]+[v1] -> [x0], then [x0]+[v2] -> [vout]
  let currentLabel = "v0";
  let currentDurationMs = Math.max(1, parts[0]!.durationMs);
  for (let i = 0; i < parts.length - 1; i++) {
    const currentTransition = parts[i]!.transition;
    const nextDurationMs = Math.max(1, parts[i + 1]!.durationMs);
    const nextLabel = `v${i + 1}`;
    const outLabel = i === parts.length - 2 ? "vout" : `x${i}`;

    if (currentTransition) {
      const fadeType = getXFadeTransition(currentTransition.type);
      const maxTransitionMs = Math.max(
        100,
        Math.min(currentDurationMs - 1, nextDurationMs - 1),
      );
      const transitionMs = Math.min(
        currentTransition.durationMs,
        maxTransitionMs,
      );
      const durationSec = (transitionMs / 1000).toFixed(3);
      const offsetSec = Math.max(
        0,
        (currentDurationMs - transitionMs) / 1000,
      ).toFixed(3);
      filterParts.push(
        `[${currentLabel}][${nextLabel}]xfade=transition=${fadeType}:duration=${durationSec}:offset=${offsetSec}[${outLabel}]`,
      );
      currentDurationMs = currentDurationMs + nextDurationMs - transitionMs;
    } else {
      filterParts.push(
        `[${currentLabel}][${nextLabel}]concat=n=2:v=1:a=0[${outLabel}]`,
      );
      currentDurationMs += nextDurationMs;
    }

    currentLabel = outLabel;
  }

  args.push("-filter_complex", filterParts.join(";"), "-map", "[vout]");

  args.push(
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    outputPath,
  );

  return { args, listPath: "" };
}
