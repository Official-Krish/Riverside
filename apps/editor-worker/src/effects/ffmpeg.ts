import type { RenderClip } from "../types";
import type { ClipEffects, SpeedPoint } from "./types";
import { hasEnabledClipEffects, normalizeClipEffects } from "./normalize";

type VisualGraphBuildResult = {
  filterParts: string[];
  outputLabel: string;
};

type SpeedGraphBuildResult = {
  filterParts: string[];
  videoLabel: string;
  audioLabel?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nextLabel(prefix: string, indexRef: { value: number }) {
  const label = `${prefix}${indexRef.value}`;
  indexRef.value += 1;
  return label;
}

function toFfmpegColor(color: string) {
  return `0x${color.replace("#", "")}`;
}

function escapePath(filePath: string) {
  return filePath
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function buildCurvePoint(base: number, amount: number, lift: boolean) {
  const delta = clamp(amount, -1, 1) * 0.18;
  return clamp(base + (lift ? delta : -delta), 0, 1);
}

function interpolateSpeed(points: SpeedPoint[], at: number) {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  if (at <= sorted[0]!.at) return sorted[0]!.speed;
  if (at >= sorted[sorted.length - 1]!.at)
    return sorted[sorted.length - 1]!.speed;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (at >= start.at && at <= end.at) {
      const span = Math.max(0.0001, end.at - start.at);
      const progress = (at - start.at) / span;
      return start.speed + (end.speed - start.speed) * progress;
    }
  }

  return 1;
}

function buildAtempoChain(speed: number) {
  const filters: string[] = [];
  let remaining = speed;

  while (remaining > 2) {
    filters.push("atempo=2");
    remaining /= 2;
  }

  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }

  filters.push(`atempo=${remaining.toFixed(4)}`);
  return filters.join(",");
}

export function buildSimpleVisualFilterChain(
  effectsInput?: Partial<ClipEffects> | null,
): string[] {
  if (!effectsInput || !hasEnabledClipEffects(effectsInput)) return [];

  const effects = normalizeClipEffects(effectsInput);
  const filters: string[] = [];

  if (effects.blur.enabled) {
    switch (effects.blur.type) {
      case "gaussian":
        filters.push(
          `gblur=sigma=${clamp(effects.blur.amount / 4, 0.1, 64).toFixed(2)}`,
        );
        break;
      case "motion":
        filters.push(
          `avgblur=sizeX=${clamp(Math.round(effects.blur.amount), 1, 64)}:sizeY=1`,
        );
        break;
      default:
        break;
    }
  }

  if (effects.color.enabled) {
    filters.push(
      `eq=brightness=${clamp(effects.color.brightness, -1, 1).toFixed(3)}:` +
        `contrast=${clamp(effects.color.contrast, 0, 3).toFixed(3)}:` +
        `saturation=${clamp(effects.color.saturation, 0, 3).toFixed(3)}`,
    );

    if (effects.color.vibrance !== 0) {
      filters.push(
        `vibrance=intensity=${clamp(effects.color.vibrance, -2, 2).toFixed(3)}`,
      );
    }

    if (effects.color.temperature !== 0) {
      const warmth = clamp(effects.color.temperature, -1, 1) * 0.5;
      filters.push(
        `colorbalance=rs=${warmth.toFixed(3)}:bs=${(-warmth).toFixed(3)}`,
      );
    }

    if (effects.color.hue !== 0) {
      filters.push(`hue=h=${effects.color.hue.toFixed(3)}`);
    }

    if (effects.color.shadows !== 0 || effects.color.highlights !== 0) {
      const shadowPoint = buildCurvePoint(0.25, effects.color.shadows, true);
      const highlightPoint = buildCurvePoint(
        0.75,
        effects.color.highlights,
        false,
      );
      filters.push(
        `curves=master='0/0 0.25/${shadowPoint.toFixed(3)} 0.75/${highlightPoint.toFixed(3)} 1/1'`,
      );
    }

    if (
      effects.color.lut.enabled &&
      effects.color.lut.cubePath &&
      effects.color.lut.intensity >= 0.999
    ) {
      filters.push(`lut3d=file='${escapePath(effects.color.lut.cubePath)}'`);
    }
  }

  return filters;
}

export function needsComplexVisualGraph(
  effectsInput?: Partial<ClipEffects> | null,
): boolean {
  if (!effectsInput || !hasEnabledClipEffects(effectsInput)) return false;
  const effects = normalizeClipEffects(effectsInput);

  return Boolean(
    (effects.blur.enabled &&
      ["background", "face", "radial"].includes(effects.blur.type)) ||
      effects.chromaKey.enabled ||
      (effects.color.enabled &&
        effects.color.lut.enabled &&
        effects.color.lut.cubePath &&
        effects.color.lut.intensity < 0.999),
  );
}

export function buildVisualEffectsGraph(
  inputLabel: string,
  effectsInput: Partial<ClipEffects> | null | undefined,
  width: number,
  height: number,
  fps: number,
  labelPrefix: string,
): VisualGraphBuildResult {
  const effects = normalizeClipEffects(effectsInput);
  const filterParts: string[] = [];
  const labelIndex = { value: 0 };
  let current = inputLabel;

  const chain = (filter: string) => {
    const out = nextLabel(labelPrefix, labelIndex);
    filterParts.push(`[${current}]${filter}[${out}]`);
    current = out;
  };

  const focus = effects.blur.focusRegion;
  const cropW = clamp(Math.round(focus.width), 8, width);
  const cropH = clamp(Math.round(focus.height), 8, height);
  const cropX = clamp(Math.round(focus.x), 0, Math.max(0, width - cropW));
  const cropY = clamp(Math.round(focus.y), 0, Math.max(0, height - cropH));

  if (effects.blur.enabled) {
    if (effects.blur.type === "background") {
      const sharp = nextLabel(labelPrefix, labelIndex);
      const blurred = nextLabel(labelPrefix, labelIndex);
      const focusLabel = nextLabel(labelPrefix, labelIndex);
      const out = nextLabel(labelPrefix, labelIndex);
      filterParts.push(`[${current}]split[${sharp}][${blurred}]`);
      filterParts.push(
        `[${blurred}]boxblur=luma_radius=${clamp(effects.blur.amount / 2, 1, 32).toFixed(2)}:luma_power=1[${blurred}b]`,
      );
      filterParts.push(
        `[${sharp}]crop=${cropW}:${cropH}:${cropX}:${cropY}[${focusLabel}]`,
      );
      filterParts.push(
        `[${blurred}b][${focusLabel}]overlay=${cropX}:${cropY}[${out}]`,
      );
      current = out;
    } else if (effects.blur.type === "face") {
      const sharp = nextLabel(labelPrefix, labelIndex);
      const face = nextLabel(labelPrefix, labelIndex);
      const faceBlur = nextLabel(labelPrefix, labelIndex);
      const out = nextLabel(labelPrefix, labelIndex);
      filterParts.push(`[${current}]split[${sharp}][${face}]`);
      filterParts.push(
        `[${face}]crop=${cropW}:${cropH}:${cropX}:${cropY},smartblur=lr=${clamp(effects.blur.amount / 8, 0.1, 8).toFixed(2)}:ls=1[${faceBlur}]`,
      );
      filterParts.push(
        `[${sharp}][${faceBlur}]overlay=${cropX}:${cropY}[${out}]`,
      );
      current = out;
    } else if (effects.blur.type === "radial") {
      const base = nextLabel(labelPrefix, labelIndex);
      const blur = nextLabel(labelPrefix, labelIndex);
      const blurZoom = nextLabel(labelPrefix, labelIndex);
      const out = nextLabel(labelPrefix, labelIndex);
      filterParts.push(`[${current}]split[${base}][${blur}]`);
      filterParts.push(
        `[${blur}]gblur=sigma=${clamp(effects.blur.amount / 3, 0.1, 32).toFixed(2)}[${blur}b]`,
      );
      filterParts.push(
        `[${blur}b]scale=${Math.round(width * 1.08)}:${Math.round(height * 1.08)},crop=${width}:${height}[${blurZoom}]`,
      );
      filterParts.push(
        `[${base}][${blurZoom}]blend=all_mode='screen':all_opacity=${clamp(effects.blur.mix, 0, 1).toFixed(3)}[${out}]`,
      );
      current = out;
    } else {
      const simpleFilters = buildSimpleVisualFilterChain({
        blur: effects.blur,
      });
      for (const filter of simpleFilters) chain(filter);
    }
  }

  if (effects.color.enabled) {
    const simpleFilters = buildSimpleVisualFilterChain({
      color: {
        ...effects.color,
        lut: {
          ...effects.color.lut,
          intensity:
            effects.color.lut.intensity >= 0.999
              ? effects.color.lut.intensity
              : 0,
        },
      },
    });

    for (const filter of simpleFilters) {
      if (filter.includes("lut3d") && effects.color.lut.intensity < 0.999)
        continue;
      chain(filter);
    }

    if (
      effects.color.lut.enabled &&
      effects.color.lut.cubePath &&
      effects.color.lut.intensity < 0.999
    ) {
      const base = nextLabel(labelPrefix, labelIndex);
      const graded = nextLabel(labelPrefix, labelIndex);
      const out = nextLabel(labelPrefix, labelIndex);
      filterParts.push(`[${current}]split[${base}][${graded}]`);
      filterParts.push(
        `[${graded}]lut3d=file='${escapePath(effects.color.lut.cubePath)}'[${graded}lut]`,
      );
      filterParts.push(
        `[${base}][${graded}lut]blend=all_mode='normal':all_opacity=${clamp(effects.color.lut.intensity, 0, 1).toFixed(3)}[${out}]`,
      );
      current = out;
    }
  }

  if (effects.chromaKey.enabled) {
    const out = nextLabel(labelPrefix, labelIndex);
    filterParts.push(
      `[${current}]format=rgba,colorkey=${toFfmpegColor(effects.chromaKey.color)}:${clamp(effects.chromaKey.similarity, 0, 1).toFixed(3)}:${clamp(effects.chromaKey.blend, 0, 1).toFixed(3)}[${current}fg]`,
    );
    const backgroundColor =
      effects.chromaKey.backgroundMode === "solid"
        ? toFfmpegColor(effects.chromaKey.backgroundColor)
        : "black";
    filterParts.push(
      `color=c=${backgroundColor}:s=${width}x${height}:r=${fps}[${current}bg]`,
    );
    filterParts.push(`[${current}bg][${current}fg]overlay=shortest=1[${out}]`);
    current = out;
  }

  return {
    filterParts,
    outputLabel: current,
  };
}

export function needsSpeedGraph(clip: RenderClip): boolean {
  return Boolean(
    clip.effects && normalizeClipEffects(clip.effects).speed.enabled,
  );
}

export function buildSpeedGraph(
  clip: RenderClip,
  labelPrefix: string,
): SpeedGraphBuildResult {
  const effects = normalizeClipEffects(clip.effects);
  const filterParts: string[] = [];
  const videoLabels: string[] = [];
  const audioLabels: string[] = [];
  const motionDurationMs = clip.durationMs;
  const freezeFrames = [...effects.speed.freezeFrames]
    .map((frame) => ({
      ...frame,
      at: clamp(frame.at, 0, 1),
      durationMs: clamp(frame.durationMs, 40, clip.durationMs),
    }))
    .sort((a, b) => a.at - b.at);

  let cursorOutMs = 0;
  let cursorSourceMs = clip.sourceStartMs;
  let segmentIndex = 0;

  const addMotionSegment = (endOutMs: number) => {
    const outputDurationMs = Math.max(0, endOutMs - cursorOutMs);
    if (outputDurationMs <= 0) return;

    const startNorm = clip.durationMs <= 0 ? 0 : cursorOutMs / clip.durationMs;
    const endNorm = clip.durationMs <= 0 ? 1 : endOutMs / clip.durationMs;
    const steps = Math.max(
      1,
      Math.min(10, Math.ceil((endNorm - startNorm) * 8)),
    );
    const segmentSliceMs = outputDurationMs / steps;

    for (let step = 0; step < steps; step += 1) {
      const stepStartOutMs = cursorOutMs + step * segmentSliceMs;
      const stepEndOutMs = cursorOutMs + (step + 1) * segmentSliceMs;
      const midpoint =
        (stepStartOutMs + stepEndOutMs) / 2 / Math.max(1, clip.durationMs);
      const speed = clamp(
        interpolateSpeed(effects.speed.points, midpoint),
        0.1,
        4,
      );
      const sourceDurationMs = (stepEndOutMs - stepStartOutMs) * speed;
      const sourceEndMs =
        clip.sourceDurationMs != null
          ? Math.min(cursorSourceMs + sourceDurationMs, clip.sourceDurationMs)
          : cursorSourceMs + sourceDurationMs;
      const actualSourceDurationMs = Math.max(1, sourceEndMs - cursorSourceMs);
      const label = `${labelPrefix}mv${segmentIndex}`;
      filterParts.push(
        `[0:v]trim=start=${(cursorSourceMs / 1000).toFixed(3)}:duration=${(actualSourceDurationMs / 1000).toFixed(3)},` +
          `setpts=(PTS-STARTPTS)/${speed.toFixed(5)}[${label}]`,
      );
      videoLabels.push(`[${label}]`);

      if (effects.speed.preservePitch) {
        const aLabel = `${labelPrefix}ma${segmentIndex}`;
        filterParts.push(
          `[0:a]atrim=start=${(cursorSourceMs / 1000).toFixed(3)}:duration=${(actualSourceDurationMs / 1000).toFixed(3)},` +
            `${buildAtempoChain(speed)},asetpts=PTS-STARTPTS[${aLabel}]`,
        );
        audioLabels.push(`[${aLabel}]`);
      } else {
        const aLabel = `${labelPrefix}ma${segmentIndex}`;
        filterParts.push(
          `[0:a]atrim=start=${(cursorSourceMs / 1000).toFixed(3)}:duration=${(actualSourceDurationMs / 1000).toFixed(3)},` +
            `asetrate=48000*${speed.toFixed(5)},aresample=48000,asetpts=PTS-STARTPTS[${aLabel}]`,
        );
        audioLabels.push(`[${aLabel}]`);
      }

      cursorSourceMs = sourceEndMs;
      segmentIndex += 1;
    }

    cursorOutMs = endOutMs;
  };

  for (const freeze of freezeFrames) {
    const freezeStartMs = clamp(
      freeze.at * motionDurationMs,
      cursorOutMs,
      motionDurationMs,
    );
    addMotionSegment(freezeStartMs);

    const frameTimeMs = clamp(
      cursorSourceMs,
      clip.sourceStartMs,
      clip.sourceDurationMs ?? cursorSourceMs,
    );
    const freezeLabel = `${labelPrefix}fz${segmentIndex}`;
    filterParts.push(
      `[0:v]trim=start=${(frameTimeMs / 1000).toFixed(3)}:duration=0.040,setpts=PTS-STARTPTS,` +
        `tpad=stop_mode=clone:stop_duration=${(freeze.durationMs / 1000).toFixed(3)}[${freezeLabel}]`,
    );
    videoLabels.push(`[${freezeLabel}]`);

    const silenceLabel = `${labelPrefix}fa${segmentIndex}`;
    filterParts.push(
      `anullsrc=r=48000:cl=stereo,atrim=duration=${(freeze.durationMs / 1000).toFixed(3)}[${silenceLabel}]`,
    );
    audioLabels.push(`[${silenceLabel}]`);

    cursorOutMs = Math.min(motionDurationMs, freezeStartMs + freeze.durationMs);
    segmentIndex += 1;
  }

  addMotionSegment(motionDurationMs);

  const videoLabel = `${labelPrefix}vout`;
  filterParts.push(
    `${videoLabels.join("")}concat=n=${videoLabels.length}:v=1:a=0[${videoLabel}]`,
  );

  let audioLabel: string | undefined;
  if (audioLabels.length > 0) {
    audioLabel = `${labelPrefix}aout`;
    filterParts.push(
      `${audioLabels.join("")}concat=n=${audioLabels.length}:v=0:a=1[${audioLabel}]`,
    );
  }

  return {
    filterParts,
    videoLabel,
    audioLabel,
  };
}
