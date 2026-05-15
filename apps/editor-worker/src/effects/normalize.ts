import { DEFAULT_CLIP_EFFECTS, type ClipEffects } from "./types";

function cloneDefaults(): ClipEffects {
  return JSON.parse(JSON.stringify(DEFAULT_CLIP_EFFECTS)) as ClipEffects;
}

export function normalizeClipEffects(
  input?: Partial<ClipEffects> | null,
): ClipEffects {
  const base = cloneDefaults();
  if (!input) return base;

  return {
    blur: {
      ...base.blur,
      ...(input.blur ?? {}),
      focusRegion: {
        ...base.blur.focusRegion,
        ...(input.blur?.focusRegion ?? {}),
      },
    },
    color: {
      ...base.color,
      ...(input.color ?? {}),
      lut: {
        ...base.color.lut,
        ...(input.color?.lut ?? {}),
      },
    },
    chromaKey: {
      ...base.chromaKey,
      ...(input.chromaKey ?? {}),
    },
    speed: {
      ...base.speed,
      ...(input.speed ?? {}),
      points: input.speed?.points?.length
        ? input.speed.points
        : base.speed.points,
      freezeFrames: input.speed?.freezeFrames ?? base.speed.freezeFrames,
    },
  };
}

export function hasEnabledClipEffects(
  input?: Partial<ClipEffects> | null,
): boolean {
  const normalized = normalizeClipEffects(input);
  return Boolean(
    normalized.blur.enabled ||
      normalized.color.enabled ||
      normalized.chromaKey.enabled ||
      normalized.speed.enabled,
  );
}
