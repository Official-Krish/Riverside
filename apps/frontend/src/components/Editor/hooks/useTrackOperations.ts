/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import type { Track, Clip } from "../types";
import { splitClipAtTime } from "../helpers";

export function useTrackOperations(
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
  setSplitMode: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const handleUpdateClip = useCallback(
    (trackIndex: number, clipId: string, updates: Partial<Clip>) => {
      setTracks((prev) =>
        prev.map((track, i) => {
          if (i !== trackIndex) return track;
          return {
            ...track,
            clips: track.clips.map((c) =>
              (c.id ?? c.sourceAssetId) === clipId ? { ...c, ...updates } : c,
            ),
          };
        }),
      );
    },
    [setTracks],
  );

  const handleDeleteClip = useCallback(
    (trackIndex: number, clipId: string) => {
      setTracks((prev) =>
        prev.map((track, i) => {
          if (i !== trackIndex) return track;
          return {
            ...track,
            clips: track.clips.filter(
              (c) => (c.id ?? c.sourceAssetId) !== clipId,
            ),
          };
        }),
      );
    },
    [setTracks],
  );

  const handleUpdateTrack = useCallback(
    (trackIndex: number, updates: Partial<Track>) => {
      setTracks((prev) =>
        prev.map((track, i) =>
          i === trackIndex ? { ...track, ...updates } : track,
        ),
      );
    },
    [setTracks],
  );

  const handleSplitClip = useCallback(
    (trackIndex: number, clipId: string, splitAtMs: number) => {
      setTracks((prevTracks) =>
        prevTracks.map((track, i) => {
          if (i !== trackIndex) return track;
          const updated: Clip[] = [];
          for (const clip of track.clips) {
            const id = clip.id ?? clip.sourceAssetId;
            if (id !== clipId) {
              updated.push(clip);
              continue;
            }
            const split = splitClipAtTime({ ...clip, id }, splitAtMs, 500);
            if (!split) {
              updated.push(clip);
              continue;
            }
            updated.push(split[0], split[1]);
          }
          return { ...track, clips: updated };
        }),
      );
      setSplitMode(false);
    },
    [setTracks, setSplitMode],
  );

  const handleAddTransitionAtPosition = useCallback(
    (
      trackIndex: number,
      clipId: string,
      timelineMs: number,
      position: "start" | "end" | "middle",
      transitionType: string = "cross-dissolve",
    ) => {
      setTracks((prevTracks) =>
        prevTracks.map((track, i) => {
          if (i !== trackIndex) return track;
          const updated: Clip[] = [];
          for (const clip of track.clips) {
            const id = clip.id ?? clip.sourceAssetId;
            if (id !== clipId) {
              updated.push(clip);
              continue;
            }

            const clipStart = clip.timelineStartMs;
            const clipEnd = clipStart + clip.durationMs;

            if (
              position === "start" &&
              Math.abs(timelineMs - clipStart) < 500
            ) {
              updated.push({
                ...clip,
                transitionStart: {
                  type: transitionType as any,
                  durationMs: 500,
                  easing: "ease-in-out" as const,
                },
              });
              continue;
            }
            if (position === "end" && Math.abs(timelineMs - clipEnd) < 500) {
              updated.push({
                ...clip,
                transitionEnd: {
                  type: transitionType as any,
                  durationMs: 500,
                  easing: "ease-in-out" as const,
                },
              });
              continue;
            }

            const split = splitClipAtTime({ ...clip, id }, timelineMs, 0);
            if (!split) {
              updated.push(clip);
              continue;
            }

            const [leftClip, rightClip] = split;
            updated.push(
              {
                ...leftClip,
                transitionEnd: {
                  type: transitionType as any,
                  durationMs: 500,
                  easing: "ease-in-out" as const,
                },
              },
              rightClip,
            );
          }
          return { ...track, clips: updated };
        }),
      );
    },
    [setTracks],
  );

  const handlePlaceTransitionAtTime = useCallback(
    (
      trackIndex: number,
      timelineMs: number,
      transitionType: string = "cross-dissolve",
    ) => {
      setTracks((prevTracks) =>
        prevTracks.map((track, i) => {
          if (i !== trackIndex) return track;

          const clips = track.clips;
          if (clips.length === 0) return track;

          const updated: Clip[] = [];
          const EDGE_THRESHOLD = 300;

          for (let c = 0; c < clips.length; c++) {
            const clip = clips[c];
            const id = clip.id ?? clip.sourceAssetId;
            const clipStart = clip.timelineStartMs;
            const clipEnd = clipStart + clip.durationMs;

            // Case 1: Inside this clip
            if (timelineMs > clipStart && timelineMs < clipEnd) {
              const distToStart = timelineMs - clipStart;
              const distToEnd = clipEnd - timelineMs;

              if (distToStart < EDGE_THRESHOLD) {
                updated.push({
                  ...clip,
                  transitionStart: {
                    type: transitionType as any,
                    durationMs: 500,
                    easing: "ease-in-out" as const,
                  },
                });
                continue;
              }
              if (distToEnd < EDGE_THRESHOLD) {
                updated.push({
                  ...clip,
                  transitionEnd: {
                    type: transitionType as any,
                    durationMs: 500,
                    easing: "ease-in-out" as const,
                  },
                });
                continue;
              }

              // Mid-clip: split with 0 gap, place transitionEnd on left clip
              const split = splitClipAtTime({ ...clip, id }, timelineMs, 0);
              if (split) {
                const [leftClip, rightClip] = split;
                updated.push({
                  ...leftClip,
                  transitionEnd: {
                    type: transitionType as any,
                    durationMs: 500,
                    easing: "ease-in-out" as const,
                  },
                });
                updated.push(rightClip);
                continue;
              }

              if (distToStart <= distToEnd) {
                updated.push({
                  ...clip,
                  transitionStart: {
                    type: transitionType as any,
                    durationMs: 500,
                    easing: "ease-in-out" as const,
                  },
                });
              } else {
                updated.push({
                  ...clip,
                  transitionEnd: {
                    type: transitionType as any,
                    durationMs: 500,
                    easing: "ease-in-out" as const,
                  },
                });
              }
              continue;
            }

            // Case 2: At exact boundary
            if (Math.abs(timelineMs - clipStart) < EDGE_THRESHOLD) {
              updated.push({
                ...clip,
                transitionStart: {
                  type: transitionType as any,
                  durationMs: 500,
                  easing: "ease-in-out" as const,
                },
              });
              continue;
            }
            if (Math.abs(timelineMs - clipEnd) < EDGE_THRESHOLD) {
              updated.push({
                ...clip,
                transitionEnd: {
                  type: transitionType as any,
                  durationMs: 500,
                  easing: "ease-in-out" as const,
                },
              });
              continue;
            }

            updated.push(clip);
          }

          return { ...track, clips: updated };
        }),
      );
    },
    [setTracks],
  );

  return {
    handleUpdateClip,
    handleDeleteClip,
    handleUpdateTrack,
    handleSplitClip,
    handleAddTransitionAtPosition,
    handlePlaceTransitionAtTime,
  };
}
