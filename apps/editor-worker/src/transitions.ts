import type { RenderClip } from "./types";
import { buildPresetFilter } from "./presets";

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

function buildXFadeArgs(transition: { type: string; durationMs: number; borderWidth?: number; borderColor?: string; reverse?: boolean }, offsetSec: string): string {
  let args = `transition=${transition.type}:duration=${(transition.durationMs / 1000).toFixed(3)}:offset=${offsetSec}`;
  if (transition.borderWidth) args += `:borderw=${transition.borderWidth}`;
  if (transition.borderColor) args += `:bordercolor=0x${transition.borderColor.replace("#", "")}`;
  if (transition.reverse) args += ":reverse=1";
  return args;
}

export function getTransitionPlan(clip: RenderClip, position: "start" | "end") {
  const transition = position === "start"
    ? (clip.transitionStart ?? (clip.transitionIn ? { type: clip.transitionIn, durationMs: 500 } : null))
    : (clip.transitionEnd ?? (clip.transitionOut ? { type: clip.transitionOut, durationMs: 500 } : null));

  if (!transition || typeof transition !== "object") return null;

  const transitionRecord = transition as Record<string, unknown>;
  const transitionType = typeof transitionRecord.type === "string" ? transitionRecord.type : null;
  const transitionDuration = Number.isFinite(transitionRecord.durationMs) ? Number(transitionRecord.durationMs) : 500;

  if (!transitionType || transitionType === "cut") return null;

  return {
    type: getXFadeTransition(transitionType),
    durationMs: Math.max(100, transitionDuration),
    borderWidth: Number.isFinite(transitionRecord.borderWidth) ? Number(transitionRecord.borderWidth) : undefined,
    borderColor: typeof transitionRecord.borderColor === "string" ? transitionRecord.borderColor : undefined,
    reverse: typeof transitionRecord.reverse === "boolean" ? transitionRecord.reverse : undefined,
  };
}

export function buildClipRenderArgs(clip: RenderClip, outputPath: string, width: number, height: number, fps: number): string[] {
  const startTransition = getTransitionPlan(clip, "start");
  const endTransition = getTransitionPlan(clip, "end");
  const presetFilter = buildPresetFilter(clip.preset, clip.presetConfig, width, height, fps);

  const args = [
    "-y",
    "-ss", (clip.sourceStartMs / 1000).toFixed(3),
    "-i", clip.sourcePath,
  ];

  const hasTransition = Boolean(startTransition || endTransition);

  if (!hasTransition) {
    let filterChain = `scale=${width}:${height}`;
    if (presetFilter) {
      filterChain += `,${presetFilter}`;
    }

    const finalArgs = [
      "-t", (clip.durationMs / 1000).toFixed(3),
      "-vf", filterChain,
      "-r", String(fps),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "320k",
      "-ar", "48000",
      outputPath,
    ];
    
    return [...args, ...finalArgs];
  }

  
  const filterParts: string[] = [];
  filterParts.push(`[0:v]trim=duration=${(clip.durationMs / 1000).toFixed(3)},setpts=PTS-STARTPTS,scale=${width}:${height},fps=${fps}[clipv]`);

  let inputIndex = 1;
  let outputLabel = "clipv";

  if (startTransition) {
    args.push(
      "-f", "lavfi",
      "-t", (startTransition.durationMs / 1000).toFixed(3),
      "-i", `color=c=black:s=${width}x${height}:r=${fps}`,
    );
    filterParts.push(`[${inputIndex}:v]format=rgba[blackstart]`);
    filterParts.push(`[blackstart][clipv]xfade=${buildXFadeArgs(startTransition, "0")}[afterstart]`);
    outputLabel = "afterstart";
    inputIndex += 1;
  }

  if (endTransition) {
    args.push(
      "-f", "lavfi",
      "-t", (endTransition.durationMs / 1000).toFixed(3),
      "-i", `color=c=black:s=${width}x${height}:r=${fps}`,
    );
    filterParts.push(`[${inputIndex}:v]format=rgba[blackend]`);
    const endOffset = Math.max(0, (clip.durationMs - endTransition.durationMs) / 1000).toFixed(3);
    filterParts.push(`[${outputLabel}][blackend]xfade=${buildXFadeArgs(endTransition, endOffset)}[outv]`);
    outputLabel = "outv";
  }

  if (presetFilter) {
    if (outputLabel === "outv") {
      filterParts.push(`[outv]${presetFilter}[finalv]`);
    } else if (outputLabel === "afterstart") {
      filterParts.push(`[afterstart]${presetFilter}[finalv]`);
    } else {
      filterParts.push(`[clipv]${presetFilter}[finalv]`);
    }
    outputLabel = "finalv";
  }

  const finalArgs = [
    "-filter_complex", filterParts.join(";"),
    "-map", `[${outputLabel}]`,
    "-map", "0:a?",
    "-r", String(fps),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "aac",
    "-b:a", "320k",
    "-ar", "48000",
    outputPath,
  ];
  
  return [...args, ...finalArgs];
}

export function buildCrossfadeConcatArgs(parts: Array<{ path: string; transition?: { type: string; durationMs: number } | null }>, outputPath: string, fps: number): { args: string[]; listPath: string } | null {
  if (parts.length < 2) return null;

  const args = ["-y"];
  const filterParts: string[] = [];
  const inputLabels: string[] = [];
  let inputIndex = 0;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    args.push("-i", part.path);
    filterParts.push(`[${inputIndex}:v]setpts=PTS-STARTPTS[v${inputIndex}]`);
    inputLabels.push(`[v${inputIndex}]`);
    inputIndex += 1;
  }

  if (parts.length === 2) {
    const transition = parts[0]!.transition;
    if (transition) {
      const fadeType = getXFadeTransition(transition.type);
      const durationSec = (transition.durationMs / 1000).toFixed(3);
      const offset = Math.max(0, (0 - transition.durationMs) / 1000).toFixed(3);
      args.push(
        "-filter_complex",
        `${inputLabels.join("")}xfade=transition=${fadeType}:duration=${durationSec}:offset=${offset}[vout]`,
        "-map", "[vout]",
      );
    } else {
      args.push(
        "-filter_complex", `${inputLabels.join("")}concat=n=2:v=1:a=0[vout]`,
        "-map", "[vout]",
      );
    }
  } else {
    for (let i = 0; i < parts.length - 1; i++) {
      const currentTransition = parts[i]!.transition;
      if (currentTransition) {
        const fadeType = getXFadeTransition(currentTransition.type);
        const durationSec = (currentTransition.durationMs / 1000).toFixed(3);
        filterParts.push(`[v${i}][v${i + 1}]xfade=transition=${fadeType}:duration=${durationSec}:offset=0[v${i}_faded]`);
      } else {
        filterParts.push(`[v${i}][v${i + 1}]concat=v=1:a=0[n${i}]`);
      }
    }

    const lastLabel = parts.length === 2 ? "[vout]" : `[v${parts.length - 2}_faded]`;
    args.push(
      "-filter_complex", filterParts.join(";"),
      "-map", lastLabel,
    );
  }

  args.push(
    "-r", String(fps),
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    outputPath,
  );

  return { args, listPath: "" };
}