import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import type { Track, Overlay, Asset, ClipTransition, PresetType } from "./types";
import type { TransitionType } from "./transitions/types";
import { Timeline } from "./Timeline";
import { Toolbar } from "./Toolbar";
import { ExportDialog } from "./ExportDialog";
import { Loader2, Film } from "lucide-react";
import { CanvasPlayer, useCanvasVideo } from "./CanvasPlayer";
import { OverlayLayer } from "./OverlayLayer";
import { TimelineInfoBar } from "./TimelineInfoBar";
import { TransitionPanel } from "./transitions/TransitionPanel";
import { TransitionControls } from "./transitions/TransitionControls";
import { toast } from "sonner";
import { useTransitions } from "./hooks/useTransitions";
import { useActiveTransition } from "./hooks/useActiveTransition";
import type { ActiveTransitionInfo } from "./CanvasPlayer/hooks/useCanvasVideo";
import { useEditorHistory } from "./hooks/useEditorHistory";
import { useMediaExtraction } from "./hooks/useMediaExtraction";
import { useEditorShortcuts } from "./hooks/useEditorShortcuts";
import { useEditorProject } from "./hooks/useEditorProject";
import { useOverlayOperations } from "./hooks/useOverlayOperations";
import { useTrackOperations } from "./hooks/useTrackOperations";
import { usePlaybackState } from "./hooks/usePlaybackState";
import { useMediaUpload } from "./hooks/useMediaUpload";
import { useExport } from "./hooks/useExport";

const EDITOR_CSS = `
  @keyframes editor-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes editor-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes editor-pulse-soft {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes editor-slide-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

export function Editor() {
  const { meetingId } = useParams();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [durationMs, setDurationMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [sourceUrl, setSourceUrl] = useState<string>("");
  const [assetsById, setAssetsById] = useState<Record<string, Asset>>({});
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);

  const [splitMode, setSplitMode] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [videoTime, setVideoTime] = useState<number>(0);

  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [containerSize, setContainerSize] = useState({ width: 1280, height: 720 });

  // Transition state
  const [showTransitionPanel, setShowTransitionPanel] = useState(false);
  const [shouldResetAfterExport, setShouldResetAfterExport] = useState(false);

  // Preset state
  const [activePreset, setActivePreset] = useState<PresetType | null>(null);

  // Automatically recalculate duration when clips/overlays are added, deleted, or split
  useEffect(() => {
    let maxMs = 0;
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        maxMs = Math.max(maxMs, clip.timelineStartMs + clip.durationMs);
      });
    });
    overlays.forEach((overlay) => {
      maxMs = Math.max(maxMs, overlay.timelineStartMs + overlay.durationMs);
    });
    setDurationMs(maxMs > 0 ? maxMs + 2000 : 0);
  }, [tracks, overlays]);

  // Cleanup: revoke blob URLs for assets that are no longer referenced in tracks
  // This prevents memory bloat from accumulated blob:// URLs
  useEffect(() => {
    const usedAssetIds = new Set<string>();
    tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        usedAssetIds.add(clip.sourceAssetId);
      });
    });

    // Find and revoke unused blob URLs
    const toDelete: string[] = [];
    Object.entries(assetsById).forEach(([assetId, asset]) => {
      if (!usedAssetIds.has(assetId) && asset.url?.startsWith("blob:")) {
        URL.revokeObjectURL(asset.url);
        toDelete.push(assetId);
      }
    });

    // Batch the deletion to avoid multiple state updates
    if (toDelete.length > 0) {
      setAssetsById((prev) => {
        const updated = { ...prev };
        toDelete.forEach((id) => delete updated[id]);
        return updated;
      });
    }
  }, [tracks]);

  // Cleanup on unmount: revoke all remaining blob URLs
  useEffect(() => {
    return () => {
      Object.values(assetsById).forEach((asset) => {
        if (asset.url?.startsWith("blob:")) {
          URL.revokeObjectURL(asset.url);
        }
      });
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeUpdateRef = useRef<((t: number) => void) | null>(null);
  const playStateChangeRef = useRef<((p: boolean) => void) | null>(null);

  const { canUndo, canRedo, handleUndo, handleRedo, resetHistory } = useEditorHistory(
    tracks, overlays, setTracks, setOverlays
  );

  const handleUndoWithToast = useCallback(() => {
    handleUndo();
    toast.info("Undid previous action");
  }, [handleUndo]);

  const handleRedoWithToast = useCallback(() => {
    handleRedo();
    toast.info("Redid action");
  }, [handleRedo]);

  const { thumbnailsByAsset, waveformData, extractThumbnailsForAsset, extractingAssets } = useMediaExtraction(
    assetsById, sourceUrl, durationMs
  );

  // Global editor busy flag: true while thumbnails or waveform are being extracted
  const isEditorBusy = Boolean(
    Object.values(extractingAssets).some((v) => v) ||
    (sourceUrl && durationMs > 0 && waveformData.length === 0)
  );

  const { project, loading, saving, accessDenied } = useEditorProject(
    meetingId, tracks, overlays, durationMs, setTracks, setOverlays, setDurationMs, setAssetsById, setSourceUrl, setActiveAssetId, resetHistory, extractThumbnailsForAsset
  );

  const { exportJob, showExportDialog, setShowExportDialog, handleExport } = useExport(project);

  const { handleDeleteOverlay, handleUpdateOverlay, handleAddOverlay } = useOverlayOperations(setOverlays);

  const { handleUpdateClip, handleDeleteClip, handleUpdateTrack, handleSplitClip } = useTrackOperations(setTracks, setSplitMode);

  const {
    selectedTransitionId,
    selectedTransitionLocation,
    setSelectedTransition,
    clearSelectedTransition,
    addTransition,
    updateTransition,
    removeTransition,
  } = useTransitions(tracks, setTracks);

  const { handleSeek, handleTimeUpdate, handlePlayPause, handlePlayStateChange } = usePlaybackState(
    tracks, assetsById, activeAssetId, setActiveAssetId, setSourceUrl, setTimelineTime, setVideoTime, setIsPlaying
  );

  const audioClips = useMemo(() => {
    return tracks.flatMap((track) => {
      if (track.type !== "AUDIO") return [];

      return track.clips.flatMap((clip) => {
        const asset = assetsById[clip.sourceAssetId];
        if (!asset?.url) return [];

        return [{
          assetId: clip.sourceAssetId,
          url: asset.url,
          timelineStartMs: clip.timelineStartMs,
          durationMs: clip.durationMs,
          sourceStartMs: clip.sourceStartMs,
          muted: track.muted,
          volume: track.volume / 100,
          audioMode: clip.audioMode,
        }];
      });
    });
  }, [tracks, assetsById]);

  const { handleClipFilePicked, handleAudioFilePicked } = useMediaUpload(
    project, tracks, setTracks, setAssetsById, setDurationMs, sourceUrl, setSourceUrl, setActiveAssetId, extractThumbnailsForAsset
  );

  const handleApplyPreset = useCallback((preset: PresetType | null) => {
    if (preset === null) {
      setActivePreset(null);
      setTracks((prev) => prev.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => ({ ...clip, preset: null })),
      })));
    } else {
      setActivePreset(preset);
      setTracks((prev) => prev.map((track, trackIndex) => ({
        ...track,
        clips: track.clips.map((clip, clipIndex) => {
          if (trackIndex === 0 && clipIndex === 0) {
            return { ...clip, preset };
          }
          return clip;
        }),
      })));
    }
  }, []);

  useEditorShortcuts(
    overlays,
    selectedOverlayId,
    editingOverlayId,
    handleDeleteOverlay,
    handleUpdateOverlay,
    handleAddOverlay,
    handleUndo,
    handleRedo,
    setTimelineZoom,
    handleApplyPreset
  );

  const stageWidth = project?.width || 1280;
  const stageHeight = project?.height || 720;

  // Compute active transition based on current timeline position
  const activeTransitionState = useActiveTransition(tracks, timelineTime);

  // Convert to the format expected by useCanvasVideo
  const activeTransitionInfo: ActiveTransitionInfo | null = activeTransitionState
    ? {
        type: activeTransitionState.type,
        progress: activeTransitionState.progress,
        position: activeTransitionState.position,
      }
    : null;

  const {
    videoRef,
    audioRef,
    canvasRef,
    state: canvasState,
    transform: canvasTransform,
  } = useCanvasVideo(sourceUrl, {
    currentTime: videoTime,
    isPlaying,
    onTimeUpdate: (t) => timeUpdateRef.current?.(t),
    onPlayStateChange: (p) => playStateChangeRef.current?.(p),
    overlays,
    timelineTimeMs: timelineTime,
    videoAlpha: 1, // Always use full opacity - transitions handled by TransitionRenderer
    audioClips,
    activeTransition: activeTransitionInfo,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setContainerSize({
        width: rect.width,
        height: rect.height,
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  timeUpdateRef.current = handleTimeUpdate;
  playStateChangeRef.current = handlePlayStateChange;

  const handleStartTextEdit = useCallback((overlay: Overlay) => {
    setEditingOverlayId(overlay.id!);
    setEditText(overlay.content.text);
    setIsPlaying(false);
  }, []);

  const handleCommitTextEdit = useCallback(() => {
    if (editingOverlayId) {
      handleUpdateOverlay(editingOverlayId, {
        content: { text: editText },
      });
    }
    setEditingOverlayId(null);
    setEditText("");
  }, [editingOverlayId, editText, handleUpdateOverlay]);

  const handleAddClip = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddAudio = useCallback(() => {
    audioInputRef.current?.click();
  }, []);

  const handleSelectTransition = useCallback((type: TransitionType) => {
    if (selectedTransitionLocation) {
      addTransition(
        selectedTransitionLocation.trackIndex,
        selectedTransitionLocation.clipId,
        selectedTransitionLocation.position,
        type
      );
    }
  }, [selectedTransitionLocation, addTransition]);

  const handleUpdateSelectedTransition = useCallback((updates: Partial<ClipTransition>) => {
    if (selectedTransitionLocation) {
      updateTransition(
        selectedTransitionLocation.trackIndex,
        selectedTransitionLocation.clipId,
        selectedTransitionLocation.position,
        updates
      );
    }
  }, [selectedTransitionLocation, updateTransition]);

  const handleDeleteSelectedTransition = useCallback(() => {
    if (selectedTransitionLocation) {
      removeTransition(
        selectedTransitionLocation.trackIndex,
        selectedTransitionLocation.clipId,
        selectedTransitionLocation.position
      );
      clearSelectedTransition();
    }
  }, [selectedTransitionLocation, removeTransition, clearSelectedTransition]);

  const handleSplitAtPlayhead = useCallback(() => {
    const currentMs = timelineTime;
    let foundTrackIndex = -1;
    let foundClipId = "";

    for (let i = 0; i < tracks.length; i++) {
      for (const clip of tracks[i].clips) {
        const start = clip.timelineStartMs;
        const end = start + clip.durationMs;
        if (currentMs > start && currentMs < end) {
          foundTrackIndex = i;
          foundClipId = clip.id ?? clip.sourceAssetId;
          break;
        }
      }
      if (foundTrackIndex >= 0) break;
    }

    if (foundTrackIndex < 0) return;
    setIsPlaying(false);
    handleSplitClip(foundTrackIndex, foundClipId, currentMs);
  }, [timelineTime, tracks, handleSplitClip]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#f5a623]" />
          <p className="text-sm text-[#bfa873]">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-[#f5a623]/10 bg-[#0a0a08]/40 p-8 text-center">
        <Film className="h-12 w-12 text-[#f5a623]/40" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-[#fff5de]">You don't have access</h2>
          <p className="text-[#bfa873]">Ask the host for access to edit this recording.</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-[#f5a623]/10 bg-[#0a0a08]/40 p-8">
        <Film className="h-12 w-12 text-[#f5a623]/40" />
        <p className="text-[#bfa873]">No project found</p>
      </div>
    );
  }

  return (
    <>
      <style>{EDITOR_CSS}</style>
      <div className="editor-root space-y-4 relative">
        {/* Global busy overlay while we prepare thumbnails/waveforms */}
        {isEditorBusy && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-[#f5a623]" />
              <p className="text-sm text-[#f5a623]">Preparing editor assets...</p>
            </div>
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2" ref={containerRef}>
            <div className="overflow-hidden rounded-2xl border border-[#f5a623]/15 bg-[#0a0a08] shadow-[0_0_0_1px_rgba(245,166,35,0.06),0_16px_48px_rgba(0,0,0,0.5)]">
              {sourceUrl ? (
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                  <CanvasPlayer
                    canvasRef={canvasRef}
                    videoRef={videoRef}
                    audioRef={audioRef}
                    isLoaded={canvasState.isLoaded}
                    onClickToggle={() => setSelectedOverlayId(null)}
                    onDoubleClickFullscreen={() => canvasRef.current?.requestFullscreen?.()}
                    preset={activePreset}
                  />

                  <OverlayLayer
                    overlays={overlays}
                    timelineTime={timelineTime}
                    containerSize={containerSize}
                    stageWidth={stageWidth}
                    stageHeight={stageHeight}
                    selectedOverlayId={selectedOverlayId}
                    setSelectedOverlayId={setSelectedOverlayId}
                    editingOverlayId={editingOverlayId}
                    setEditingOverlayId={setEditingOverlayId}
                    editText={editText}
                    setEditText={setEditText}
                    handleUpdateOverlay={handleUpdateOverlay}
                    handleDeleteOverlay={handleDeleteOverlay}
                    handleStartTextEdit={handleStartTextEdit}
                    handleCommitTextEdit={handleCommitTextEdit}
                    isPlaying={isPlaying}
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Film className="h-10 w-10 text-[#f5a623]/30" />
                    <p className="text-sm text-[#bfa873]">No video source available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Toolbar
              onExport={handleExport}
              isPlaying={isPlaying}
              currentTime={timelineTime}
              durationMs={durationMs}
              onSeek={handleSeek}
              saving={saving}
              tracks={tracks}
              onAddClip={handleAddClip}
              onAddAudio={handleAddAudio}
              onPlayPause={handlePlayPause}
              onSplitAtPlayhead={handleSplitAtPlayhead}
              onUndo={handleUndoWithToast}
              onRedo={handleRedoWithToast}
              canUndo={canUndo}
              canRedo={canRedo}
              canvasTransform={canvasTransform}
              activePreset={activePreset}
              onApplyPreset={handleApplyPreset}
            />

            {showTransitionPanel ? (
              <div className="flex-1 min-h-75 overflow-hidden rounded-2xl border border-[#f5a623]/20 bg-[#0a0a08] shadow-lg">
                <TransitionPanel
                  onSelectTransition={handleSelectTransition}
                  selectedTransition={selectedTransitionId ? (() => {
                    if (!selectedTransitionLocation) return null;
                    const track = tracks[selectedTransitionLocation.trackIndex];
                    if (!track) return null;
                    const clip = track.clips.find(c => (c.id ?? c.sourceAssetId) === selectedTransitionLocation.clipId);
                    if (!clip) return null;
                    const trans = selectedTransitionLocation.position === "start" ? clip.transitionStart : clip.transitionEnd;
                    return trans?.type || null;
                  })() : null}
                  onClose={() => setShowTransitionPanel(false)}
                />
              </div>
            ) : selectedTransitionId && selectedTransitionLocation ? (
              <div className="flex-1 min-h-75 overflow-hidden rounded-2xl border border-[#f5a623]/20 bg-[#0a0a08] shadow-lg">
                <TransitionControls
                  transition={(() => {
                    const track = tracks[selectedTransitionLocation.trackIndex];
                    if (!track) return null;
                    const clip = track.clips.find(c => (c.id ?? c.sourceAssetId) === selectedTransitionLocation.clipId);
                    if (!clip) return null;
                    const trans = selectedTransitionLocation.position === "start" ? clip.transitionStart : clip.transitionEnd;
                    if (!trans) return null;
                    return {
                      ...trans,
                      id: selectedTransitionId,
                      type: trans.type,
                      category: "basic",
                      name: trans.type,
                      position: selectedTransitionLocation.position,
                    };
                  })()}
                  onUpdate={handleUpdateSelectedTransition}
                  onDelete={handleDeleteSelectedTransition}
                  onClose={clearSelectedTransition}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Timeline Info Bar - Shows all elements (transitions, overlays, effects) */}
        <TimelineInfoBar
          tracks={tracks}
          overlays={overlays}
          durationMs={durationMs}
          currentTime={timelineTime}
          onSeek={handleSeek}
        />

        <Timeline
          tracks={tracks}
          overlays={overlays}
          durationMs={durationMs}
          currentTime={timelineTime}
          zoom={timelineZoom}
          onZoomChange={setTimelineZoom}
          onAddClip={handleAddClip}
          onAddAudio={handleAddAudio}
          onUpdateTrack={handleUpdateTrack}
          onUpdateClip={handleUpdateClip}
          onDeleteClip={handleDeleteClip}
          onAddOverlay={handleAddOverlay}
          onUpdateOverlay={handleUpdateOverlay}
          onDeleteOverlay={handleDeleteOverlay}
          onSeek={handleSeek}
          onSplitClip={handleSplitClip}
          splitMode={splitMode}
          thumbnailsByAsset={thumbnailsByAsset}
          extractingAssets={extractingAssets}
          waveformData={waveformData}
          assetsById={assetsById}
          timelineZoom={timelineZoom}
          onZoomIn={() => setTimelineZoom((prev) => Math.min(8, +(prev + 0.25).toFixed(2)))}
          onZoomOut={() => setTimelineZoom((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)))}
          onZoomReset={() => setTimelineZoom(1)}
          selectedTransitionId={selectedTransitionId}
          onSelectTransition={setSelectedTransition}
          onToggleTransitionPanel={() => setShowTransitionPanel((prev) => !prev)}
          showTransitionPanel={showTransitionPanel}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleClipFilePicked}
        />

        <input
          ref={audioInputRef}
          type="file"
          accept=".mp3,.MP3,.m4a,.M4A,.aac,.AAC,.wav,.WAV,.ogg,.OGG,.flac,.FLAC,.webm,.WEBM,audio/*,audio/mpeg,audio/mp3"
          className="hidden"
          onChange={handleAudioFilePicked}
        />

        {showExportDialog && exportJob && (
          <ExportDialog
            job={exportJob}
            onClose={() => {
              setShowExportDialog(false);
              if (shouldResetAfterExport) {
                window.location.reload();
              }
            }}
            onCompleted={() => setShouldResetAfterExport(true)}
          />
        )}
      </div>
    </>
  );
}
