/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Type,
  ArrowLeftRight,
  Sparkles,
  Maximize,
  Move,
  Play,
  Pause,
  Plus,
  Music2,
  Scissors,
  Undo2,
  Redo2,
  Download,
  RotateCcw,
  Check,
  Film,
  Clock,
  Layers,
  Wand2,
} from "lucide-react";
import { TextStyleControls } from "./overlays";
import { TransitionPanel } from "./transitions";
import { TransitionControls } from "./transitions/TransitionControls";
import type { TransitionType } from "./transitions/types";
import { PRESET_DEFINITIONS, type PresetType } from "./types";
import { EffectControls } from "./effects";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export type PanelTab =
  | "controls"
  | "transition"
  | "presets"
  | "effects"
  | "transform";

interface CanvasTransform {
  stretchX: number;
  stretchY: number;
  offsetX: number;
  offsetY: number;
  setStretchX: (v: number) => void;
  setStretchY: (v: number) => void;
  setOffsetX: (v: number) => void;
  setOffsetY: (v: number) => void;
  reset: () => void;
}

interface EditorPanelProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  activePreset?: PresetType | null;
  onApplyPreset?: (presetType: PresetType) => void;
  clipEffects?: any;
  onClipEffectsChange?: (effects: any) => void;
  activeClipName?: string | null;
  activeClipDurationMs?: number;
  canvasTransform?: CanvasTransform;
  textOverlayStyle?: any;
  onTextStyleChange?: (updates: any) => void;
  textAnimation?: any;
  onTextAnimationChange?: (animation: any) => void;
  transitionProps?: {
    onSelectTransition: (transition: any) => void;
    selectedTransition: string | null;
    onClose: () => void;
    selectedTransitionId?: string | null;
    selectedTransitionLocation?: {
      trackIndex: number;
      clipId: string;
      position: "start" | "end";
    } | null;
    tracks?: any[];
    onUpdateTransition?: (updates: any) => void;
    onDeleteTransition?: () => void;
    onClearSelection?: () => void;
  };
  // Toolbar props
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  durationMs: number;
  onSeek: (timeMs: number) => void;
  onAddClip: () => void;
  onAddAudio: () => void;
  onSplitAtPlayhead: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  saving: boolean;
  tracks: any[];
}

const TABS = [
  { id: "controls" as PanelTab, label: "Text", icon: Type },
  { id: "transition" as PanelTab, label: "Transitions", icon: ArrowLeftRight },
  { id: "presets" as PanelTab, label: "Presets", icon: Wand2 },
  { id: "effects" as PanelTab, label: "Effects", icon: Sparkles },
  { id: "transform" as PanelTab, label: "Transform", icon: Maximize },
];

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function EditorPanel({
  activeTab,
  onTabChange,
  activePreset,
  onApplyPreset,
  clipEffects,
  onClipEffectsChange,
  activeClipName,
  activeClipDurationMs = 0,
  canvasTransform,
  textOverlayStyle,
  onTextStyleChange,
  textAnimation,
  onTextAnimationChange,
  transitionProps,
  isPlaying,
  onPlayPause,
  currentTime,
  durationMs,
  onSeek,
  onAddClip,
  onAddAudio,
  onSplitAtPlayhead,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  saving,
  tracks,
}: EditorPanelProps) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const isTransformModified = canvasTransform
    ? canvasTransform.stretchX !== 1 ||
      canvasTransform.stretchY !== 1 ||
      canvasTransform.offsetX !== 0 ||
      canvasTransform.offsetY !== 0
    : false;

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0c0c0a 0%, #080806 100%)",
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        className="px-4 pt-4 pb-3 space-y-3"
        style={{ borderBottom: "1px solid rgba(245,166,35,0.08)" }}
      >
        {/* Top row: undo/redo · status · export */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="group relative h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-30"
              style={{
                background: "rgba(245,166,35,0.04)",
                border: "1px solid rgba(245,166,35,0.1)",
              }}
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="h-3.5 w-3.5 text-[#bfa873] group-hover:text-[#f5a623] transition-colors" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="group relative h-7 w-7 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-30"
              style={{
                background: "rgba(245,166,35,0.04)",
                border: "1px solid rgba(245,166,35,0.1)",
              }}
              title="Redo (Ctrl/Cmd + Y)"
            >
              <Redo2 className="h-3.5 w-3.5 text-[#bfa873] group-hover:text-[#f5a623] transition-colors" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {saving ? (
              <span className="flex items-center gap-1.5 text-[10px] text-[#f5a623]/80 animate-pulse font-medium">
                <RotateCcw className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 font-medium">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
            <button
              onClick={onExport}
              className="group flex items-center gap-1.5 h-7 px-3.5 rounded-lg text-[11px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #f5a623 0%, #e8941a 100%)",
                color: "#0a0a08",
                boxShadow:
                  "0 2px 8px rgba(245,166,35,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <Download className="h-3 w-3" />
              Export
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg"
          style={{
            background: "rgba(245,166,35,0.03)",
            border: "1px solid rgba(245,166,35,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5 text-[10px] text-[#8d7850]">
            <Layers className="h-3 w-3 text-[#f5a623]/50" />
            <span className="font-semibold text-[#bfa873]">
              {tracks.length}
            </span>{" "}
            tracks
          </div>
          <div className="w-px h-3 bg-[#f5a623]/10" />
          <div className="flex items-center gap-1.5 text-[10px] text-[#8d7850]">
            <Film className="h-3 w-3 text-[#f5a623]/50" />
            <span className="font-semibold text-[#bfa873]">
              {tracks.reduce((acc, t) => acc + t.clips.length, 0)}
            </span>{" "}
            clips
          </div>
          <div className="w-px h-3 bg-[#f5a623]/10" />
          <div className="flex items-center gap-1.5 text-[10px] text-[#8d7850] font-mono">
            <Clock className="h-3 w-3 text-[#f5a623]/50" />
            <span className="font-semibold text-[#bfa873]">
              {formatTime(durationMs)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Playback ───────────────────────────────────────── */}
      <div
        className="px-4 py-3 space-y-3"
        style={{ borderBottom: "1px solid rgba(245,166,35,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onPlayPause}
            className="relative h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #f5a623 0%, #e0900f 100%)",
              boxShadow: isPlaying
                ? "0 0 0 3px rgba(245,166,35,0.15), 0 4px 12px rgba(245,166,35,0.3)"
                : "0 2px 8px rgba(245,166,35,0.2)",
            }}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-[#0a0a08]" />
            ) : (
              <Play className="h-4 w-4 text-[#0a0a08] ml-0.5" />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1.5">
            <Slider
              value={[currentTime]}
              min={0}
              max={durationMs || 1}
              step={100}
              onValueChange={(val) => onSeek(val[0])}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] font-mono tabular-nums">
              <span className="text-[#f5a623]/70">
                {formatTime(currentTime)}
              </span>
              <span className="text-[#8d7850]">{formatTime(durationMs)}</span>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={onAddClip}
            className="group flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "rgba(245,166,35,0.06)",
              border: "1px solid rgba(245,166,35,0.12)",
              color: "#d4a54a",
            }}
          >
            <Plus className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            Video
          </button>
          <button
            onClick={onAddAudio}
            className="group flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "rgba(74,222,128,0.05)",
              border: "1px solid rgba(74,222,128,0.12)",
              color: "#4ade80",
            }}
          >
            <Music2 className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            Audio
          </button>
          <button
            onClick={onSplitAtPlayhead}
            className="group flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "rgba(245,166,35,0.06)",
              border: "1px solid rgba(245,166,35,0.12)",
              color: "#d4a54a",
            }}
            title="Split clip at playhead"
          >
            <Scissors className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
            Split
          </button>
        </div>
      </div>

      {/* ── Tab Bar (segmented pill style) ──────────────────── */}
      <div
        className="px-3 py-2"
        style={{ borderBottom: "1px solid rgba(245,166,35,0.06)" }}
      >
        <div
          className="flex items-center gap-0.5 p-0.5 rounded-lg"
          style={{ background: "rgba(245,166,35,0.03)" }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-medium transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: "rgba(245,166,35,0.12)",
                        color: "#f5a623",
                        boxShadow: "0 1px 4px rgba(245,166,35,0.1)",
                      }
                    : {
                        color: "#6b5e45",
                      }
                }
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "transform" && isTransformModified && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#f5a623]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "controls" && (
          <div className="space-y-4">
            {textOverlayStyle && onTextStyleChange ? (
              <TextStyleControls
                style={textOverlayStyle}
                onStyleChange={onTextStyleChange}
                animation={textAnimation}
                onAnimationChange={onTextAnimationChange}
              />
            ) : (
              <div className="text-center text-[#8d7850] text-sm py-8">
                Select a text overlay to edit
              </div>
            )}
          </div>
        )}

        {activeTab === "transition" && transitionProps && (
          <>
            {transitionProps.selectedTransitionId &&
            transitionProps.selectedTransitionLocation &&
            transitionProps.tracks ? (
              (() => {
                const loc = transitionProps.selectedTransitionLocation;
                if (!loc) return null;
                const track = transitionProps.tracks[loc.trackIndex];
                const clip = track?.clips.find(
                  (c: any) => (c.id ?? c.sourceAssetId) === loc.clipId,
                );
                const trans = clip
                  ? loc.position === "start"
                    ? clip.transitionStart
                    : clip.transitionEnd
                  : null;
                if (!trans) return null;
                return (
                  <TransitionControls
                    transition={{
                      id: transitionProps.selectedTransitionId,
                      type: trans.type,
                      category: "basic",
                      name: trans.type,
                      position: loc.position,
                      durationMs: trans.durationMs || 1000,
                      easing: trans.easing || "ease-in-out",
                    }}
                    onUpdate={transitionProps.onUpdateTransition || (() => {})}
                    onDelete={transitionProps.onDeleteTransition}
                    onClose={transitionProps.onClose}
                    onBackToList={transitionProps.onClearSelection}
                  />
                );
              })()
            ) : (
              <TransitionPanel
                onSelectTransition={transitionProps.onSelectTransition}
                selectedTransition={
                  transitionProps.selectedTransition as TransitionType | null
                }
                onClose={transitionProps.onClose}
              />
            )}
          </>
        )}

        {activeTab === "presets" && (
          <div className="space-y-6">
            {/* Effects */}
            <div className="space-y-3">
              <div className="text-[11px] text-[#8d7850] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                Effects
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DEFINITIONS.slice(0, 6).map((preset) => (
                  <Button
                    key={preset.type}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onApplyPreset?.(preset.type);
                      toast.success(`${preset.name} applied`);
                    }}
                    className={`flex flex-col h-auto py-2 text-[10px] border-[#f5a623]/20 bg-[#f5a623]/5 hover:bg-[#f5a623]/10 hover:border-[#f5a623]/30 ${
                      activePreset === preset.type
                        ? "ring-1 ring-[#f5a623]"
                        : ""
                    }`}
                    title={`${preset.name} (${preset.shortcut})`}
                  >
                    <span className="text-[#bfa873]">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div className="space-y-3">
              <div className="text-[11px] text-[#8d7850] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                Templates
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_DEFINITIONS.slice(6).map((preset) => (
                  <Button
                    key={preset.type}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onApplyPreset?.(preset.type);
                      toast.success(`${preset.name} applied`);
                    }}
                    className="flex flex-col h-auto py-2 text-[10px] border-[#22c55e]/20 bg-[#22c55e]/5 hover:bg-[#22c55e]/10 hover:border-[#22c55e]/30"
                    title={`${preset.name} (${preset.shortcut})`}
                  >
                    <span className="text-[#bfa873]">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Active preset indicator */}
            {activePreset && (
              <div className="flex items-center justify-between px-3 py-2 bg-[#f5a623]/10 rounded-lg border border-[#f5a623]/20">
                <span className="text-[11px] text-[#bfa873]">
                  Active:{" "}
                  <span className="text-[#f5a623] font-medium">
                    {activePreset}
                  </span>
                </span>
                <button
                  onClick={() => onApplyPreset?.(null as any)}
                  className="text-[10px] text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "effects" && (
          <div className="space-y-4">
            {clipEffects && onClipEffectsChange ? (
              <>
                <div className="rounded-xl border border-[#f5a623]/10 bg-[#060605]/60 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wider text-[#8d7850]">
                    Active clip
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#fff5de]">
                    {activeClipName || "Clip at playhead"}
                  </div>
                  <div className="mt-1 text-[11px] text-[#8d7850]">
                    Move the playhead onto a video clip to edit blur, color,
                    LUT, chroma key, and speed ramp settings.
                  </div>
                </div>
                <EffectControls
                  value={clipEffects}
                  onChange={onClipEffectsChange}
                  clipDurationMs={activeClipDurationMs}
                />
              </>
            ) : (
              <div className="text-center text-[#8d7850] text-sm py-8">
                Move the playhead onto a video clip to edit effects
              </div>
            )}
          </div>
        )}

        {activeTab === "transform" && canvasTransform && (
          <div className="space-y-4">
            {/* Canvas Transform Controls */}
            <div className="space-y-4 rounded-xl border border-[#f5a623]/10 bg-[#060605]/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] text-[#bfa873] font-medium">
                  <Maximize className="h-4 w-4 text-[#f5a623]" />
                  Canvas Transform
                </div>
                {isTransformModified && (
                  <button
                    onClick={canvasTransform.reset}
                    className="text-[10px] text-[#f5a623] hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Scale X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    <Move className="h-3 w-3" />
                    Scale X
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.stretchX.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={canvasTransform.stretchX}
                  onChange={(e) =>
                    canvasTransform.setStretchX(Number(e.target.value))
                  }
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>

              {/* Scale Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    <Move className="h-3 w-3 rotate-90" />
                    Scale Y
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.stretchY.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={canvasTransform.stretchY}
                  onChange={(e) =>
                    canvasTransform.setStretchY(Number(e.target.value))
                  }
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>

              {/* Offset X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    ↔ Offset X
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.offsetX}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="10"
                  value={canvasTransform.offsetX}
                  onChange={(e) =>
                    canvasTransform.setOffsetX(Number(e.target.value))
                  }
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>

              {/* Offset Y */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    ↕ Offset Y
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.offsetY}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="10"
                  value={canvasTransform.offsetY}
                  onChange={(e) =>
                    canvasTransform.setOffsetY(Number(e.target.value))
                  }
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "transform" && !canvasTransform && (
          <div className="text-center text-[#8d7850] text-sm py-8">
            Canvas transform not available
          </div>
        )}
      </div>
    </div>
  );
}
