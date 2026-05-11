import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Download, Plus, Scissors,
  Undo2, Redo2, RotateCcw, Check,
  ChevronDown, ChevronUp, Move, Maximize, Music2,
  ZoomIn, Activity, Zap, Film, Palette, PlayCircle,
  Sparkles, Mic, Gamepad2, Sparkle,
} from "lucide-react";
import { formatTime } from "./helpers";
import { PRESET_DEFINITIONS, type PresetType } from "./types";
import { toast } from "sonner";

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

interface ToolbarProps {
  onExport: () => void;
  isPlaying: boolean;
  currentTime: number;
  durationMs: number;
  onSeek: (timeMs: number) => void;
  saving: boolean;
  tracks: any[];
  onAddClip: () => void;
  onAddAudio: () => void;
  onPlayPause: () => void;
  onSplitAtPlayhead: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canvasTransform?: CanvasTransform;
  activePreset?: PresetType | null;
  onApplyPreset?: (presetType: PresetType) => void;
}

export function Toolbar({
  onExport,
  isPlaying,
  currentTime,
  durationMs,
  onSeek,
  saving,
  tracks,
  onAddClip,
  onAddAudio,
  onPlayPause,
  onSplitAtPlayhead,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  canvasTransform,
  activePreset,
  onApplyPreset,
}: ToolbarProps) {
  const [showTransform, setShowTransform] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const handleSliderChange = (value: number[]) => {
    onSeek(value[0]);
  };

  const isTransformModified = canvasTransform
    ? canvasTransform.stretchX !== 1 ||
      canvasTransform.stretchY !== 1 ||
      canvasTransform.offsetX !== 0 ||
      canvasTransform.offsetY !== 0
    : false;

  return (
    <div className="rounded-2xl border border-[#f5a623]/10 bg-[#0a0a08]/60 p-5 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#fff5de] mr-2">Controls</h3>
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
            {/* Saving indicator */}
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

        {/* Project Stats Badge */}
        <div className="flex items-center justify-center gap-4 px-3 py-1.5 bg-[#1a1a16]/50 rounded-md border border-[#f5a623]/10 text-[10px] text-[#8d7850]">
          <span className="flex flex-col items-center"><strong className="text-[#bfa873]">{tracks.length}</strong> tracks</span>
          <span className="w-px h-4 bg-[#f5a623]/20" />
          <span className="flex flex-col items-center"><strong className="text-[#bfa873]">{tracks.reduce((acc, t) => acc + t.clips.length, 0)}</strong> clips</span>
          <span className="w-px h-4 bg-[#f5a623]/20" />
          <span className="flex flex-col items-center font-mono"><strong className="text-[#bfa873]">{formatTime(durationMs)}</strong> duration</span>
        </div>
      </div>

      {/* Play/Pause + Time */}
      <div className="mt-4 flex items-center gap-4">
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
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs font-mono text-[#8d7850]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex gap-2 pt-4 border-t border-[#f5a623]/10">
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

      {/* Canvas Transform Controls */}
      {canvasTransform && (
        <div className="mt-4 pt-4 border-t border-[#f5a623]/5">
          <button
            onClick={() => setShowTransform(!showTransform)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-[#bfa873] transition-colors hover:bg-[#f5a623]/5"
          >
            <div className="flex items-center gap-2">
              <Maximize className="h-3.5 w-3.5 text-[#f5a623]" />
              <span>Canvas Transform</span>
              {isTransformModified && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#f5a623] animate-pulse" />
              )}
            </div>
            {showTransform ? (
              <ChevronUp className="h-3.5 w-3.5 text-[#8d7850]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-[#8d7850]" />
            )}
          </button>

          {showTransform && (
            <div className="mt-3 space-y-3 rounded-xl border border-[#f5a623]/10 bg-[#060605]/60 p-3">
              {/* Scale X */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    <Move className="h-3 w-3" />
                    Scale X
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.stretchX.toFixed(2)}×
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
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-[#8d7850]">
                    <Move className="h-3 w-3 rotate-90" />
                    Scale Y
                  </label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.stretchY.toFixed(2)}×
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
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[#8d7850]">Offset X</label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.offsetX}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="5"
                  value={canvasTransform.offsetX}
                  onChange={(e) => canvasTransform.setOffsetX(Number(e.target.value))}
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>

              {/* Offset Y */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-[#8d7850]">Offset Y</label>
                  <span className="text-[11px] font-mono text-[#bfa873]">
                    {canvasTransform.offsetY}px
                  </span>
                </div>
                <input
                  type="range"
                  min="-300"
                  max="300"
                  step="5"
                  value={canvasTransform.offsetY}
                  onChange={(e) => canvasTransform.setOffsetY(Number(e.target.value))}
                  className="w-full h-1.5 accent-[#f5a623] cursor-pointer"
                />
              </div>

              {/* Reset */}
              <Button
                variant="outline"
                size="sm"
                onClick={canvasTransform.reset}
                disabled={!isTransformModified}
                className="w-full border-[#f5a623]/20 bg-[#f5a623]/5 text-[#f5a623] hover:bg-[#f5a623]/10 hover:border-[#f5a623]/30 disabled:opacity-40"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset Transform
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Motion Graphics Presets */}
      <div className="mt-4 pt-4 border-t border-[#f5a623]/5">
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-[#bfa873] transition-colors hover:bg-[#f5a623]/5"
        >
          <div className="flex items-center gap-2">
            <Sparkle className="h-3.5 w-3.5 text-[#f5a623]" />
            <span>Motion Presets</span>
            {activePreset && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#f5a623] animate-pulse" />
            )}
          </div>
          {showPresets ? (
            <ChevronUp className="h-3.5 w-3.5 text-[#8d7850]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[#8d7850]" />
          )}
        </button>

        {showPresets && (
          <div className="mt-3 space-y-3">
            {/* Effect Presets */}
            <div className="space-y-2">
              <div className="text-[10px] text-[#8d7850] uppercase tracking-wider">Effects</div>
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
                    {preset.type === "zoom-pop" && <ZoomIn className="h-4 w-4 mb-1 text-[#f5a623]" />}
                    {preset.type === "shake" && <Activity className="h-4 w-4 mb-1 text-orange-400" />}
                    {preset.type === "glitch" && <Zap className="h-4 w-4 mb-1 text-purple-400" />}
                    {preset.type === "cinematic-bars" && <Maximize className="h-4 w-4 mb-1 text-blue-400" />}
                    {preset.type === "vhs" && <Film className="h-4 w-4 mb-1 text-green-400" />}
                    {preset.type === "chromakey" && <Palette className="h-4 w-4 mb-1 text-emerald-400" />}
                    <span className="text-[#bfa873]">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Template Presets */}
            <div className="space-y-2">
              <div className="text-[10px] text-[#8d7850] uppercase tracking-wider">Templates</div>
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
                    {preset.type === "intro-template" && <PlayCircle className="h-4 w-4 mb-1 text-[#22c55e]" />}
                    {preset.type === "meme-format" && <Sparkles className="h-4 w-4 mb-1 text-yellow-400" />}
                    {preset.type === "podcast-layout" && <Mic className="h-4 w-4 mb-1 text-pink-400" />}
                    {preset.type === "gaming-edit" && <Gamepad2 className="h-4 w-4 mb-1 text-red-400" />}
                    <span className="text-[#bfa873]">{preset.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Active preset indicator */}
            {activePreset && (
              <div className="flex items-center justify-between px-2 py-1.5 bg-[#f5a623]/10 rounded-md border border-[#f5a623]/20">
                <span className="text-[10px] text-[#bfa873]">
                  Active: <span className="text-[#f5a623] font-medium">
                    {PRESET_DEFINITIONS.find(p => p.type === activePreset)?.name}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onApplyPreset?.(null as any)}
                  className="h-5 text-[10px] text-[#8d7850] hover:text-[#f5a623]"
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
