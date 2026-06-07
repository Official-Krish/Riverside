import type { ProgramSegment, LayoutPreset } from "./types";

/**
 * Resolve program timeline segments from program-track clips and defaults.
 *
 * Strategy:
 * - If the project has a program track (kind === "program") with clips,
 *   segment boundaries = clip boundaries, activeAngle = clip's participantKey.
 * - If no program clips exist but a default activeAngle is set,
 *   create one segment covering the full duration with that angle.
 * - Otherwise, fall back to the first participant as active angle.
 */
export function resolveProgramSegments(
  programClips: Array<{
    timelineStartMs: number;
    durationMs: number;
    participantKey?: string | null;
  }>,
  totalDurationMs: number,
  defaultAngle: string | null,
  participantKeys: string[],
): ProgramSegment[] {
  if (programClips.length > 0) {
    return programClips
      .filter((c) => c.participantKey)
      .map((c) => ({
        timelineStartMs: c.timelineStartMs,
        durationMs: c.durationMs,
        activeAngle: c.participantKey!,
      }));
  }

  const angle = defaultAngle || participantKeys[0] || "unknown";
  return [
    { timelineStartMs: 0, durationMs: totalDurationMs, activeAngle: angle },
  ];
}

/**
 * Build layout timeline segments from per-segment overrides + default.
 *
 * Strategy:
 * - Apply any MulticamSegment overrides at their timeline positions.
 * - Between overrides, use the layoutDefault.
 * - Merge consecutive segments with identical layout+angles.
 */
export function resolveLayoutSegments(
  totalDurationMs: number,
  layoutDefault: LayoutPreset,
  segmentOverrides: Array<{
    timelineStartMs: number;
    durationMs: number;
    preset?: string | null;
    activeAngle?: string | null;
  }>,
  participantKeys: string[],
): Array<{
  timelineStartMs: number;
  durationMs: number;
  preset: LayoutPreset;
  angles: string[];
}> {
  if (segmentOverrides.length === 0) {
    return [
      {
        timelineStartMs: 0,
        durationMs: totalDurationMs,
        preset: layoutDefault,
        angles: participantKeys,
      },
    ];
  }

  const sorted = [...segmentOverrides].sort(
    (a, b) => a.timelineStartMs - b.timelineStartMs,
  );

  const result: Array<{
    timelineStartMs: number;
    durationMs: number;
    preset: LayoutPreset;
    angles: string[];
  }> = [];

  let cursor = 0;

  for (const seg of sorted) {
    if (seg.timelineStartMs > cursor) {
      result.push({
        timelineStartMs: cursor,
        durationMs: seg.timelineStartMs - cursor,
        preset: layoutDefault,
        angles: participantKeys,
      });
    }

    const preset = (seg.preset as LayoutPreset) || layoutDefault;
    const angles = seg.activeAngle
      ? [
          seg.activeAngle,
          ...participantKeys.filter((k) => k !== seg.activeAngle),
        ]
      : participantKeys;

    result.push({
      timelineStartMs: seg.timelineStartMs,
      durationMs: seg.durationMs,
      preset,
      angles,
    });

    cursor = seg.timelineStartMs + seg.durationMs;
  }

  if (cursor < totalDurationMs) {
    result.push({
      timelineStartMs: cursor,
      durationMs: totalDurationMs - cursor,
      preset: layoutDefault,
      angles: participantKeys,
    });
  }

  // Merge consecutive segments with identical preset and angles
  const merged: typeof result = [];
  for (const seg of result) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.preset === seg.preset &&
      arraysEqual(last.angles, seg.angles)
    ) {
      last.durationMs += seg.durationMs;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
