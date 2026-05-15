import type { ClipEffects } from "./types";
import { normalizeClipEffects } from "./utils";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function buildPreviewFilter(
  effects?: Partial<ClipEffects> | null,
): string {
  const normalized = normalizeClipEffects(effects);
  const filters: string[] = [];

  if (normalized.blur.enabled) {
    const blurPx = clamp(normalized.blur.amount / 3, 0, 32);
    filters.push(`blur(${blurPx.toFixed(1)}px)`);
  }

  if (normalized.color.enabled) {
    filters.push(`brightness(${(1 + normalized.color.brightness).toFixed(3)})`);
    filters.push(`contrast(${normalized.color.contrast.toFixed(3)})`);
    filters.push(
      `saturate(${(normalized.color.saturation + normalized.color.vibrance * 0.25).toFixed(3)})`,
    );
    filters.push(`hue-rotate(${normalized.color.hue.toFixed(1)}deg)`);
  }

  return filters.join(" ");
}
