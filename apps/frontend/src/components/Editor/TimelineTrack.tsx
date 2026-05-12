import { useState, useCallback, useEffect } from "react";
import React from "react";
import type { Track, Clip } from "./types";
import { Eye, EyeOff, Volume2, VolumeX, Video, AudioWaveform, Type, X, Blend, Loader2 } from "lucide-react";
import { getTrackColors } from "./helpers";

interface TimelineTrackProps {
  track: Track;
  index: number;
  durationMs: number;
  currentTime: number;
  onAddClip: (trackIndex: number) => void;
  onAddAudio: () => void;
  onUpdateTrack: (trackIndex: number, updates: Partial<Track>) => void;
  onUpdateClip: (trackIndex: number, clipId: string, updates: Partial<Clip>) => void;
  onDeleteClip: (trackIndex: number, clipId: string) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSplitClip: (trackIndex: number, clipId: string, timelineMs: number) => void;
  onAddTransitionAtPosition: (trackIndex: number, clipId: string, timelineMs: number, position: "start" | "end" | "middle", transitionType?: string) => void;
  splitMode: boolean;
  thumbnailsByAsset: Record<string, string[]>;
  extractingAssets: Record<string, boolean>;
  waveformData: number[];
  assetsById: Record<string, any>;
  // Transition props
  onSelectTransition: (trackIndex: number, clipId: string, position: "start" | "end") => void;
  // Drag-to-place transition props
  transitionMode?: boolean;
}

export function getTrackIcon(type: Track["type"]) {
  switch (type) {
    case "VIDEO": return <Video className="h-3.5 w-3.5" />;
    case "AUDIO": return <AudioWaveform className="h-3.5 w-3.5" />;
    case "TEXT": return <Type className="h-3.5 w-3.5" />;
  }
}

type DragMode = "move" | "resize-left" | "resize-right";

function TimelineTrackComponent({
  track,
  index,
  durationMs,
  currentTime,
  onAddClip,
  onAddAudio,
  onUpdateTrack,
  onUpdateClip,
  onDeleteClip,
  onClick,
  onSplitClip,
  onAddTransitionAtPosition,
  splitMode,
  thumbnailsByAsset,
  extractingAssets,
  waveformData,
  assetsById,
  onSelectTransition,
  transitionMode = false,
}: TimelineTrackProps) {
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    clipId: string;
    mode: DragMode;
    startX: number;
    startTimelineMs: number;
    startDurationMs: number;
    startSourceStartMs: number;
  } | null>(null);
  const [dragOverZone, setDragOverZone] = useState<{ clipId: string; position: "start" | "end" } | null>(null);
  const colors = getTrackColors(track.type);

  const handleClipClick = (e: React.MouseEvent, clip: Clip, clipId: string) => {
    if (splitMode && durationMs > 0) {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const splitTime = clip.timelineStartMs + clip.durationMs * ratio;
      onSplitClip(index, clipId, Math.round(splitTime));
      return;
    }
    if (transitionMode) return;
    setSelectedClip(clipId);
  };

  const handleDeleteClip = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    onDeleteClip(index, clipId);
  };

  const startDrag = (e: React.MouseEvent, clip: Clip, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    const clipId = clip.id ?? clip.sourceAssetId;
    setDragging({
      clipId,
      mode,
      startX: e.clientX,
      startTimelineMs: clip.timelineStartMs,
      startDurationMs: clip.durationMs,
      startSourceStartMs: clip.sourceStartMs,
    });
  };

  // Use window events for drag so it works outside the track lane
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const lane = document.querySelector(`[data-track-lane="${track.id}"]`) as HTMLDivElement;
      if (!lane || durationMs <= 0) return;

      const laneWidth = lane.getBoundingClientRect().width;
      if (laneWidth <= 0) return;

      const deltaX = e.clientX - dragging.startX;
      const deltaMs = (deltaX / laneWidth) * durationMs;

      const clip = track.clips.find((c) => (c.id ?? c.sourceAssetId) === dragging.clipId);
      if (!clip) return;

      const asset = assetsById[clip.sourceAssetId];
      const assetDurationMs = asset?.durationMs || Infinity;

      if (dragging.mode === "move") {
        const nextStart = Math.max(0, Math.min(dragging.startTimelineMs + deltaMs, durationMs - clip.durationMs));
        onUpdateClip(index, dragging.clipId, {
          timelineStartMs: Math.round(nextStart),
        });
        return;
      }

      if (dragging.mode === "resize-left") {
        const MIN_DURATION = 200;
        // Shift the left edge: changes timelineStartMs, sourceStartMs, and durationMs
        const rawDelta = Math.max(
          -dragging.startSourceStartMs, // Can't go before source start = 0
          Math.min(deltaMs, dragging.startDurationMs - MIN_DURATION) // Can't shrink below min
        );
        onUpdateClip(index, dragging.clipId, {
          timelineStartMs: Math.round(Math.max(0, dragging.startTimelineMs + rawDelta)),
          sourceStartMs: Math.round(Math.max(0, dragging.startSourceStartMs + rawDelta)),
          durationMs: Math.round(Math.max(MIN_DURATION, dragging.startDurationMs - rawDelta)),
        });
        return;
      }

      if (dragging.mode === "resize-right") {
        const MIN_DURATION = 200;
        // Extend/shrink from the right edge
        const maxExtend = assetDurationMs - (dragging.startSourceStartMs + dragging.startDurationMs);
        const rawDelta = Math.max(
          -(dragging.startDurationMs - MIN_DURATION),
          Math.min(deltaMs, maxExtend)
        );
        onUpdateClip(index, dragging.clipId, {
          durationMs: Math.round(Math.max(MIN_DURATION, dragging.startDurationMs + rawDelta)),
        });
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, durationMs, track, index, onUpdateClip, assetsById]);

  const activeClip = track.clips.find(
    (clip) =>
      currentTime >= clip.timelineStartMs &&
      currentTime < clip.timelineStartMs + clip.durationMs
  );

  /**
   * Render per-clip frame thumbnails.
   * For VIDEO clips, we look up thumbnails by the clip's sourceAssetId and
   * slice them based on the clip's sourceStartMs/durationMs range to show
   * the correct frames for split segments.
   */
  const renderClipVisual = useCallback((clip: Clip, clipId: string, trackType: Track["type"]) => {
    if (trackType === "AUDIO") {
      if (!waveformData.length || durationMs <= 0) return null;
      const slice = waveformData;
      if (!slice.length) return null;
      const bars = Array.from({ length: 28 }, (_, i) => {
        const idx = Math.floor((i / 28) * slice.length);
        const amp = slice[Math.min(slice.length - 1, idx)] ?? 0.1;
        const height = Math.max(12, Math.min(96, amp * 100));
        return (
          <div
            key={`${clipId}-bar-${i}`}
            className="w-1 rounded-sm bg-[#4ade80]/70"
            style={{ height: `${height}%` }}
          />
        );
      });
      return (
        <div className="absolute inset-0 flex items-end gap-0.5 px-1 py-1 opacity-80 pointer-events-none">
          {bars}
        </div>
      );
    }

    if (trackType === "VIDEO") {
      const assetThumbs = thumbnailsByAsset[clip.sourceAssetId];
      const isExtracting = extractingAssets[clip.sourceAssetId];

      if (!assetThumbs || assetThumbs.length === 0) {
        // Placeholder shimmer when thumbnails are loading
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
            <div
              className="absolute inset-0 h-full w-[200%] bg-linear-to-r from-transparent via-white/5 to-transparent"
              style={{ animation: "editor-slide-shimmer 1.5s ease-in-out infinite" }}
            />
            {isExtracting && <Loader2 className="h-4 w-4 text-[#f5a623] animate-spin absolute" />}
          </div>
        );
      }

      // Get the asset's total duration to map clip range to thumbnail indices
      const asset = assetsById[clip.sourceAssetId];
      const assetDurationMs = asset?.durationMs || durationMs;

      // Calculate which portion of the source this clip represents
      const sourceStartRatio = clip.sourceStartMs / assetDurationMs;
      const sourceEndRatio = (clip.sourceStartMs + clip.durationMs) / assetDurationMs;

      // Map to thumbnail indices
      const startThumbIdx = Math.floor(sourceStartRatio * assetThumbs.length);
      const endThumbIdx = Math.ceil(sourceEndRatio * assetThumbs.length);

      // Get the slice of thumbnails for this clip's source range
      const clipThumbs = assetThumbs.slice(
        Math.max(0, startThumbIdx),
        Math.min(assetThumbs.length, Math.max(startThumbIdx + 1, endThumbIdx))
      );

      // Determine how many frames to show based on clip width
      const numFrames = Math.min(4, clipThumbs.length);
      const frames = Array.from({ length: numFrames }, (_, i) => {
        const idx = Math.floor((i / Math.max(1, numFrames - 1)) * (clipThumbs.length - 1));
        return clipThumbs[Math.min(clipThumbs.length - 1, Math.max(0, idx))];
      });

      return (
        <div
          className="absolute inset-0 flex pointer-events-none overflow-hidden"
          style={{ borderRadius: "inherit" }}
        >
          {frames.map((frame, i) => (
            <div
              key={`${clipId}-thumb-${i}`}
              className="flex-1 bg-cover bg-center min-w-0"
              style={{
                backgroundImage: `url("${frame}")`,
                borderRight: i < frames.length - 1 ? "1px solid rgba(0,0,0,0.3)" : "none",
              }}
            />
          ))}
          {/* Subtle dark overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-black/20" />

          {/* Spinner overlay if still extracting more frames */}
          {isExtracting && (
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <Loader2 className="h-4 w-4 text-[#f5dc5f] animate-spin" />
            </div>
          )}
        </div>
      );
    }

    return null;
  }, [thumbnailsByAsset, extractingAssets, assetsById, durationMs, waveformData]);

  return (
    <div className="group">
      {/* Track Header */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className={`flex items-center gap-1.5 rounded-lg border border-[#f5a623]/10 bg-[#0a0a08]/60 px-2.5 py-1.5 ${colors.label}`}>
          {getTrackIcon(track.type)}
          <span className="text-xs font-medium">{track.type}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            title={track.visible ? "Hide track" : "Show track"}
            onClick={() => onUpdateTrack(index, { visible: !track.visible })}
            className="rounded p-1 text-[#8d7850] transition-colors hover:bg-[#f5a623]/10 hover:text-[#f5a623]"
          >
            {track.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            title={track.muted ? "Unmute" : "Mute"}
            onClick={() => onUpdateTrack(index, { muted: !track.muted })}
            className="rounded p-1 text-[#8d7850] transition-colors hover:bg-[#f5a623]/10 hover:text-[#f5a623]"
          >
            {track.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={track.volume}
            onChange={(e) => onUpdateTrack(index, { volume: Number(e.target.value) })}
            className="h-1 w-20 accent-[#f5a623]"
          />
          <span className="w-8 text-xs font-mono text-[#8d7850]">{track.volume}%</span>
        </div>

        {/* Add Clip Button */}
        <button
          className="ml-2 rounded bg-[#f5a623]/10 px-2 py-1 text-xs text-[#f5a623] hover:bg-[#f5a623]/20 transition-colors"
          title={track.type === "AUDIO" ? "Add Audio Clip" : "Add Clip"}
          onClick={() => {
              if (track.type === "AUDIO") {
                onAddAudio();
            } else {
              onAddClip(index);
            }
          }}
        >
          {track.type === "AUDIO" ? "+ Audio" : "+ Clip"}
        </button>
      </div>

      {/* Track Lane */}
      <div
        data-track-lane={track.id}
        data-track-index={index}
        className={`relative overflow-hidden rounded-xl border-2 transition-all duration-200
          ${track.type === "VIDEO" ? "h-18 border-[#eab308]/50 bg-[#1a1a16]/80" : `h-14 ${colors.border} ${colors.bg}`}
          hover:border-opacity-60 ${splitMode ? "cursor-crosshair" : "cursor-pointer"}
          ${transitionMode ? "cursor-crosshair border-[#a855f7]/50" : ""}`}
        onClick={onClick}
      >
        {track.type === "AUDIO" && (
          <div className="absolute left-3 top-1 z-10 rounded-full border border-[#22c55e]/20 bg-[#22c55e]/10 px-2 py-0.5 text-[9px] font-medium text-[#4ade80]">
            Drag to move, trim handles to control playback range
          </div>
        )}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[#f5a623] z-20 pointer-events-none shadow-[0_0_8px_rgba(245,166,35,0.6)]"
          style={{ left: `${durationMs > 0 && (currentTime / durationMs) * 100}%` }}
        >
          <div className="absolute -top-1 -translate-x-1/2">
            <div className="h-0 w-0 border-l-4 border-r-4 border-t-5 border-l-transparent border-r-transparent border-t-[#f5a623]" />
          </div>
        </div>

        {/* Clips */}
        {track.clips.map((clip) => {
          const leftPercent = (clip.timelineStartMs / durationMs) * 100;
          const widthPercent = (clip.durationMs / durationMs) * 100;
          const clipId = clip.id ?? clip.sourceAssetId;
          const isSelected = selectedClip === clipId;
          const isActive = activeClip
            ? (activeClip.id ?? activeClip.sourceAssetId) === clipId
            : false;

          const isVideoTrack = track.type === "VIDEO";

          const startTransWidthPercent = clip.transitionStart ? (clip.transitionStart.durationMs / clip.durationMs) * 100 : 0;
          const endTransWidthPercent = clip.transitionEnd ? (clip.transitionEnd.durationMs / clip.durationMs) * 100 : 0;

          return (
            <div
              key={clip.id ?? clip.sourceAssetId}
              className={`absolute top-1 bottom-1 overflow-hidden rounded-lg transition-all duration-150
                ${isVideoTrack
                  ? `border-2 ${isActive
                    ? "border-[#eab308] ring-2 ring-[#eab308]/50 shadow-[0_0_12px_rgba(234,179,8,0.4)]"
                    : isSelected
                      ? "border-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                      : "border-[#eab308]/60"
                  }`
                  : `border ${isActive
                    ? "ring-2 ring-[#f5a623] shadow-[0_0_10px_rgba(245,166,35,0.6)]"
                    : isSelected
                      ? colors.clipSelected
                      : colors.clip
                  }`
                }
                group/clip hover:shadow-[0_2px_12px_rgba(234,179,8,0.3)]`}
              style={{
                left: `calc(${leftPercent}% + 1px)`,
                width: `calc(${Math.max(widthPercent, 0.5)}% - 2px)`,
                minWidth: "24px",
              }}
            >
              {/* Frame thumbnails / visual */}
              {renderClipVisual(clip, clipId, track.type)}

              {/* Left resize handle */}
              <div
                className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize z-10
                  bg-linear-to-r from-[#eab308]/40 to-transparent
                  hover:from-[#eab308]/80 transition-colors"
                onMouseDown={(e) => startDrag(e, clip, "resize-left")}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#eab308]/60 rounded-full" />
              </div>

              {/* Right resize handle */}
              <div
                className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize z-10
                  bg-linear-to-l from-[#eab308]/40 to-transparent
                  hover:from-[#eab308]/80 transition-colors"
                onMouseDown={(e) => startDrag(e, clip, "resize-right")}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#eab308]/60 rounded-full" />
              </div>

              {/* Clip label (only visible at larger sizes) */}
              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-0.5 z-10 pointer-events-none"
                onClick={(e) => handleClipClick(e, clip, clipId)}
              >
                <span className="truncate text-[9px] font-medium text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {clip.name || `Clip ${track.clips.indexOf(clip) + 1}`}
                </span>
              </div>

              {/* Clickable area for selecting / splitting */}
              <div
                className="absolute inset-0 z-5"
                style={{ left: "6px", right: "6px" }} // Don't overlap resize handles
                onClick={(e) => handleClipClick(e, clip, clipId)}
                onMouseDown={(e) => {
                  if (!splitMode) startDrag(e, clip, "move");
                }}
                onDragOver={(e) => {
                  // Only allow dropping transitions
                  if (e.dataTransfer.types.includes("application/json")) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                    const rect = e.currentTarget.getBoundingClientRect();
                    const isStart = (e.clientX - rect.left) < (rect.width / 2);
                    setDragOverZone({ clipId, position: isStart ? "start" : "end" });
                  }
                }}
                onDragLeave={() => setDragOverZone(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverZone(null);
                  try {
                    const data = JSON.parse(e.dataTransfer.getData("application/json"));
                    if (data.type === "transition") {
                      const rect = e.currentTarget.getBoundingClientRect();
                      // If dropped on the left half, it's a start transition; otherwise end
                      const isStart = (e.clientX - rect.left) < (rect.width / 2);
                      const clipIdToUse = clip.id ?? clip.sourceAssetId;
                      onUpdateClip(index, clipIdToUse, {
                        [isStart ? "transitionStart" : "transitionEnd"]: {
                          type: data.transitionType,
                          durationMs: 500, // Default duration
                          easing: "ease-in-out",
                        },
                      });
                    }
                  } catch (err) {
                    // Ignore JSON parse errors for other drag events
                  }
                }}
              />

              {/* Transition indicators and controls */}

              {/* Drag Over Drop Zone Indicators */}
              {dragOverZone?.clipId === clipId && dragOverZone.position === "start" && (
                <div className="absolute left-0 top-0 bottom-0 w-1/4 max-w-15 bg-[#06b6d4]/30 border-2 border-dashed border-[#06b6d4] z-30 pointer-events-none rounded-l-lg" />
              )}
              {dragOverZone?.clipId === clipId && dragOverZone.position === "end" && (
                <div className="absolute right-0 top-0 bottom-0 w-1/4 max-w-15 bg-[#06b6d4]/30 border-2 border-dashed border-[#06b6d4] z-30 pointer-events-none rounded-r-lg" />
              )}

              {/* Start Transition Block */}
              {clip.transitionStart && (
                <div
                  className="absolute left-0 top-0 bottom-0 z-20 flex items-center justify-center cursor-pointer group/trans overflow-hidden
                    bg-[#06b6d4]/40 border-r border-[#06b6d4]/60 hover:bg-[#06b6d4]/60 transition-colors backdrop-blur-[1px]"
                  style={{ width: `${Math.max(startTransWidthPercent, 2)}%`, minWidth: "16px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTransition(index, clipId, "start");
                  }}
                  title="Edit start transition"
                >
                  <Blend className="h-3 w-3 text-white opacity-80 group-hover/trans:opacity-100 group-hover/trans:scale-110 transition-all drop-shadow-md" />
                </div>
              )}

              {/* End Transition Block */}
              {clip.transitionEnd && (
                <div
                  className="absolute right-0 top-0 bottom-0 z-20 flex items-center justify-center cursor-pointer group/trans overflow-hidden
                    bg-[#06b6d4]/40 border-l border-[#06b6d4]/60 hover:bg-[#06b6d4]/60 transition-colors backdrop-blur-[1px]"
                  style={{ width: `${Math.max(endTransWidthPercent, 2)}%`, minWidth: "16px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTransition(index, clipId, "end");
                  }}
                  title="Edit end transition"
                >
                  <Blend className="h-3 w-3 text-white opacity-80 group-hover/trans:opacity-100 group-hover/trans:scale-110 transition-all drop-shadow-md" />
                </div>
              )}

              {/* Add Transition Hover Buttons (zero-gap split for mid-clip) */}
              {!clip.transitionStart && (
                <button
                  className="absolute left-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded text-[7px] shadow-md transition-all hover:scale-110 bg-black/50 text-[#8d7850] opacity-0 group-hover/clip:opacity-100 hover:bg-[#06b6d4]/80 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTransitionAtPosition(index, clipId, clip.timelineStartMs, "start", "cross-dissolve");
                  }}
                  title="Add start transition"
                >
                  <Blend className="h-3 w-3" />
                </button>
              )}

              {!clip.transitionEnd && (
                <button
                  className="absolute right-0.5 top-0.5 z-20 flex h-5 w-5 items-center justify-center rounded text-[7px] shadow-md transition-all hover:scale-110 bg-black/50 text-[#8d7850] opacity-0 group-hover/clip:opacity-100 hover:bg-[#06b6d4]/80 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTransitionAtPosition(index, clipId, clip.timelineStartMs + clip.durationMs, "end", "cross-dissolve");
                  }}
                  title="Add end transition"
                >
                  <Blend className="h-3 w-3" />
                </button>
              )}
              {/* Delete button — yellow ✕ in bottom-right, matching reference */}
              <button
                className="absolute right-1.5 bottom-1.5 z-20 flex h-5 w-5 items-center justify-center rounded
                  bg-[#eab308] text-black shadow-md
                  opacity-0 transition-all group-hover/clip:opacity-100
                  hover:bg-[#facc15] hover:scale-110"
                onClick={(e) => handleDeleteClip(e, clip.id ?? clip.sourceAssetId)}
                title="Delete clip"
              >
                <X className="h-3 w-3" strokeWidth={3} />
              </button>
            </div>
          );
        })}

        {/* Empty state */}
        {track.clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-[#8d7850]/60">Drop clips here</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoize to prevent re-renders when parent re-renders but props haven't changed
export const TimelineTrack = React.memo(TimelineTrackComponent);
