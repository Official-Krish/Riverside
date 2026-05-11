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
} from "lucide-react";
import { TextStyleControls } from "./overlays";
import { TransitionPanel } from "./transitions";
import { TransitionControls } from "./transitions/TransitionControls";
import type { TransitionType } from "./transitions/types";
import { PRESET_DEFINITIONS, type PresetType } from "./types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type PanelTab = "controls" | "transition" | "presets" | "transform";

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
    selectedTransitionLocation?: { trackIndex: number; clipId: string; position: "start" | "end" } | null;
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
  { id: "controls" as PanelTab, label: "Controls", icon: Type },
  { id: "transition" as PanelTab, label: "Transition", icon: ArrowLeftRight },
  { id: "presets" as PanelTab, label: "Presets", icon: Sparkles },
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
  const isTransformModified = canvasTransform
    ? canvasTransform.stretchX !== 1 ||
      canvasTransform.stretchY !== 1 ||
      canvasTransform.offsetX !== 0 ||
      canvasTransform.offsetY !== 0
    : false;

  return (
    <div className="flex flex-col h-full rounded-2xl border border-[#f5a623]/20 bg-[#0a0a08] overflow-hidden">
      {/* Header with toolbar controls */}
      <div className="p-4 border-b border-[#f5a623]/10 space-y-4">
        {/* Undo/Redo + Save Status + Export */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-7 w-7 border-[#f5a623]/20 bg-[#f5a623]/5 text-[#f5a623] hover:bg-[#f5a623]/10 disabled:opacity-40"
              title="Undo (Ctrl/Cmd + Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-7 w-7 border-[#f5a623]/20 bg-[#f5a623]/5 text-[#f5a623] hover:bg-[#f5a623]/10 disabled:opacity-40"
              title="Redo (Ctrl/Cmd + Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-end">
              {saving ? (
                <span className="flex items-center gap-1.5 text-[10px] text-[#f5a623] animate-pulse">
                  <RotateCcw className="h-3 w-3 animate-spin" /> Saving
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] text-[#4ade80]">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
            </div>
            <Button
              onClick={onExport}
              className="h-8 bg-[#f5a623]/10 text-[#f5a623] hover:bg-[#f5a623]/20 hover:text-[#f5a623]"
              size="sm"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>

        {/* Project Stats */}
        <div className="flex items-center justify-center gap-4 px-3 py-1.5 bg-[#1a1a16]/50 rounded-md border border-[#f5a623]/10 text-[10px] text-[#8d7850]">
          <span className="flex flex-col items-center">
            <strong className="text-[#bfa873]">{tracks.length}</strong> tracks
          </span>
          <span className="w-px h-4 bg-[#f5a623]/20" />
          <span className="flex flex-col items-center">
            <strong className="text-[#bfa873]">{tracks.reduce((acc, t) => acc + t.clips.length, 0)}</strong> clips
          </span>
          <span className="w-px h-4 bg-[#f5a623]/20" />
          <span className="flex flex-col items-center font-mono">
            <strong className="text-[#bfa873]">{formatTime(durationMs)}</strong> duration
          </span>
        </div>

        {/* Play/Pause + Timeline */}
        <div className="flex items-center gap-4">
          <Button
            variant="default"
            size="icon"
            onClick={onPlayPause}
            className="h-11 w-11 rounded-full bg-[#f5a623] text-[#0a0a08] hover:bg-[#f5a623]/90"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          <div className="flex-1 space-y-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={durationMs || 1}
              step={100}
              onValueChange={(val) => onSeek(val[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs font-mono text-[#8d7850]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(durationMs)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddClip}
            className="flex-1 border-[#f5a623]/20 bg-[#f5a623]/5 text-[#f5a623] hover:bg-[#f5a623]/10 hover:border-[#f5a623]/30"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Video
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddAudio}
            className="flex-1 border-[#22c55e]/20 bg-[#22c55e]/5 text-[#4ade80] hover:bg-[#22c55e]/10 hover:border-[#22c55e]/30"
          >
            <Music2 className="mr-2 h-4 w-4" />
            Add Audio
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSplitAtPlayhead}
            className="flex-1 border-[#f5a623]/20 bg-[#f5a623]/5 text-[#f5a623] hover:bg-[#f5a623]/10 hover:border-[#f5a623]/30"
            title="Split clip at current playhead position"
          >
            <Scissors className="mr-2 h-4 w-4" />
            Split
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-[#f5a623]/10 bg-[#0d0d0b]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-[#f5a623]/20 text-[#f5a623]"
                  : "text-[#8d7850] hover:text-[#bfa873] hover:bg-[#f5a623]/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === "transform" && isTransformModified && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#f5a623] animate-pulse" />
              )}
            </button>
          );
        })}
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
            {transitionProps.selectedTransitionId && transitionProps.selectedTransitionLocation && transitionProps.tracks ? (
              (() => {
                const loc = transitionProps.selectedTransitionLocation;
                if (!loc) return null;
                const track = transitionProps.tracks[loc.trackIndex];
                const clip = track?.clips.find((c: any) => (c.id ?? c.sourceAssetId) === loc.clipId);
                const trans = clip ? (loc.position === "start" ? clip.transitionStart : clip.transitionEnd) : null;
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
                selectedTransition={transitionProps.selectedTransition as TransitionType | null}
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
                      activePreset === preset.type ? "ring-1 ring-[#f5a623]" : ""
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
                  Active: <span className="text-[#f5a623] font-medium">{activePreset}</span>
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
                  onChange={(e) => canvasTransform.setStretchX(Number(e.target.value))}
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
                  onChange={(e) => canvasTransform.setStretchY(Number(e.target.value))}
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
                  onChange={(e) => canvasTransform.setOffsetX(Number(e.target.value))}
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
                  onChange={(e) => canvasTransform.setOffsetY(Number(e.target.value))}
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

export type { PanelTab };