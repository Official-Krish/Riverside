/* eslint-disable */
/**
 * useActiveTransition Hook
 * Computes the currently active transition (if any) based on timeline position.
 * This is the bridge between the clip transition data and the canvas renderer.
 */
import { useMemo } from "react";
import type { Track, ClipTransition } from "../types";

export interface ActiveTransitionState {
  type: ClipTransition;
  progress: number; // 0-1
  /** The clip that "owns" this transition */
  clipId: string;
  position: "start" | "end";
}

/**
 * Given the current timeline time and all tracks, determine if we are
 * currently inside a transition zone of any clip. Returns the transition
 * config + a normalised progress value (0→1).
 *
 * For a **start transition** on a clip:
 *   - The transition zone is [clip.timelineStartMs, clip.timelineStartMs + transitionStart.durationMs]
 *   - progress goes from 0 → 1 as we move through the zone
 *   - This means the clip fades IN (or wipes in, etc.)
 *
 * For an **end transition** on a clip:
 *   - The transition zone is [clipEnd - transitionEnd.durationMs, clipEnd]
 *   - progress goes from 0 → 1 as we approach the end
 *   - This means the clip fades OUT
 */
export function useActiveTransition(
  tracks: Track[],
  timelineTimeMs: number,
): ActiveTransitionState | null {
  return useMemo(() => {
    for (const track of tracks) {
      for (const clip of track.clips) {
        const clipStart = clip.timelineStartMs;
        const clipEnd = clipStart + clip.durationMs;
        const clipId = clip.id ?? clip.sourceAssetId;

        // Check end transition first (takes priority when both overlap)
        if (clip.transitionEnd) {
          const transitionDuration = clip.transitionEnd.durationMs;
          const transitionStart = clipEnd - transitionDuration;

          if (timelineTimeMs >= transitionStart && timelineTimeMs <= clipEnd) {
            const elapsed = timelineTimeMs - transitionStart;
            const progress = Math.min(
              1,
              Math.max(0, elapsed / transitionDuration),
            );
            return {
              type: clip.transitionEnd,
              progress,
              clipId,
              position: "end",
            };
          }
        }

        // Check start transition
        if (clip.transitionStart) {
          const transitionDuration = clip.transitionStart.durationMs;
          const transitionEnd = clipStart + transitionDuration;

          if (timelineTimeMs >= clipStart && timelineTimeMs <= transitionEnd) {
            const elapsed = timelineTimeMs - clipStart;
            const progress = Math.min(
              1,
              Math.max(0, elapsed / transitionDuration),
            );
            return {
              type: clip.transitionStart,
              progress,
              clipId,
              position: "start",
            };
          }
        }
      }
    }

    return null;
  }, [tracks, timelineTimeMs]);
}

/**
 * Standalone function version (for use outside React components)
 */
export function computeActiveTransition(
  tracks: Track[],
  timelineTimeMs: number,
): ActiveTransitionState | null {
  for (const track of tracks) {
    for (const clip of track.clips) {
      const clipStart = clip.timelineStartMs;
      const clipEnd = clipStart + clip.durationMs;
      const clipId = clip.id ?? clip.sourceAssetId;

      if (clip.transitionEnd) {
        const transitionDuration = clip.transitionEnd.durationMs;
        const transitionStart = clipEnd - transitionDuration;

        if (timelineTimeMs >= transitionStart && timelineTimeMs <= clipEnd) {
          const elapsed = timelineTimeMs - transitionStart;
          const progress = Math.min(
            1,
            Math.max(0, elapsed / transitionDuration),
          );
          return {
            type: clip.transitionEnd,
            progress,
            clipId,
            position: "end",
          };
        }
      }

      if (clip.transitionStart) {
        const transitionDuration = clip.transitionStart.durationMs;
        const transitionEnd = clipStart + transitionDuration;

        if (timelineTimeMs >= clipStart && timelineTimeMs <= transitionEnd) {
          const elapsed = timelineTimeMs - clipStart;
          const progress = Math.min(
            1,
            Math.max(0, elapsed / transitionDuration),
          );
          return {
            type: clip.transitionStart,
            progress,
            clipId,
            position: "start",
          };
        }
      }
    }
  }

  return null;
}
