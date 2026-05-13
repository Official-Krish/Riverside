import type { TransitionType, TransitionEasing, TransitionDirection } from "./transitions/types";
import type { TextOverlayStyle, AnimationType, AnimationEasing } from "./overlays/types";

export type TrackType = "VIDEO" | "AUDIO" | "TEXT";
export type OverlayType = "TEXT";
export type ActiveTool = "select" | "split" | "text" | "transition";

export type { TextOverlayStyle, AnimationType, AnimationEasing };

/**
 * Transition between two clips
 * Can be at start (transitionIn), end (transitionOut), or between clips
 */
export interface ClipTransition {
  type: TransitionType;
  durationMs: number;
  easing: TransitionEasing;
  direction?: TransitionDirection;
  // Visual options
  borderWidth?: number;
  borderColor?: string;
  reverse?: boolean;
}

export interface Clip {
  id?: string;
  sourceAssetId: string;
  sourceStartMs: number;
  timelineStartMs: number;
  durationMs: number;
  /** Audio behavior for audio tracks. replace mutes the source video audio during this range. */
  audioMode?: "replace" | "layer";
  /** @deprecated Use transitionStart/transitionEnd instead */
  transitionIn?: "fade" | "cut";
  /** @deprecated Use transitionStart/transitionEnd instead */
  transitionOut?: "fade" | "cut";
  /** Transition at the start of the clip (fade in from previous or black) */
  transitionStart?: ClipTransition;
  /** Transition at the end of the clip (fade out to next or black) */
  transitionEnd?: ClipTransition;
  name?: string;
  /** Applied motion graphics preset */
  preset?: PresetType | null;
}

export interface Track {
  id: string;
  type: TrackType;
  order: number;
  visible: boolean;
  muted: boolean;
  volume: number;
  clips: Clip[];
}

export type OverlayStyle = Partial<TextOverlayStyle>;

export interface Overlay {
  id: string;
  type: OverlayType;
  content: {
    text: string;
  };
  zIndex?: number;
  timelineStartMs: number;
  durationMs: number;
  transform: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
  };
  style?: OverlayStyle;
  /** Animation for overlay appearance */
  animation?: {
    type: AnimationType;
    durationMs: number;
    delayMs?: number;
    easing?: AnimationEasing;
    direction?: "in" | "out" | "both";
  };
}

/**
 * Timeline element for the info bar - shows what's at a given position
 */
export interface TimelineElement {
  id: string;
  type: "clip" | "overlay" | "transition" | "effect" | "audio";
  name: string;
  startMs: number;
  endMs: number;
  trackId?: string;
  trackType?: TrackType;
  icon?: string;
  color?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Asset {
  id: string;
  assetType: "VIDEO" | "AUDIO";
  url: string;
  durationMs?: number;
  participantId?: string | null;
  waveformUrl?: string | null;
  thumbUrl?: string | null;
}

export interface EditorProject {
  id: string;
  meetingId: string;
  sourceMode: "FINAL" | "MULTITRACK";
  tracks: Track[];
  overlays: Overlay[];
  assets: Asset[];
  durationMs: number;
  status: "EDITING" | "EXPORTING" | "COMPLETED" | "FAILED";
  exports?: ExportJob[];
  fps: number;
  width: number;
  height: number;
}

export interface ExportJob {
  id: string;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  progress?: number | null;
  outputUrl?: string | null;
  error?: string | null;
}

export interface HistoryEntry {
  tracks: Track[];
  overlays: Overlay[];
}

export interface EditorState {
  projectId: string | null;
  meetingId: string;
  tracks: Track[];
  overlays: Overlay[];
  assets: Asset[];
  durationMs: number;
  currentTime: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoom: number;
  fps: number;
  width: number;
  height: number;
}

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "error";
}

export type TransformState = {
  stretchX: number;
  stretchY: number;
  offsetX: number;
  offsetY: number;
};

export type TrimState = {
  start: number;
  end: number;
};

export type PresetType =
  | "zoom-pop"
  | "shake"
  | "glitch"
  | "cinematic-bars"
  | "vhs"
  | "chromakey"
  | "intro-template"
  | "meme-format"
  | "podcast-layout"
  | "lower-third"
  | "cta-button"
  | "chapter-title"

export interface PresetConfig {
  durationMs?: number;
  intensity?: number;
  color?: string;
  threshold?: number;
}

export interface Preset {
  id: string;
  type: PresetType;
  name: string;
  shortcut: string;
  icon: string;
  config?: PresetConfig;
}

export interface ClipPreset {
  clipId: string;
  preset: Preset | null;
  appliedAt: number;
}

export const PRESET_DEFINITIONS: Omit<Preset, "id">[] = [
  { type: "zoom-pop", name: "Zoom Pop", shortcut: "Ctrl+1", icon: "ZoomIn" },
  { type: "shake", name: "Shake", shortcut: "Ctrl+2", icon: "Activity" },
  { type: "glitch", name: "Glitch", shortcut: "Ctrl+3", icon: "Zap" },
  { type: "cinematic-bars", name: "Cinematic Bars", shortcut: "Ctrl+4", icon: "Maximize2" },
  { type: "vhs", name: "VHS Effect", shortcut: "Ctrl+5", icon: "Film" },
  { type: "chromakey", name: "Green Screen", shortcut: "Ctrl+6", icon: "Palette" },
  { type: "intro-template", name: "Intro", shortcut: "Ctrl+I", icon: "PlayCircle" },
  { type: "meme-format", name: "Meme", shortcut: "Ctrl+M", icon: "Sparkles" },
  { type: "podcast-layout", name: "Podcast", shortcut: "Ctrl+P", icon: "Mic" },
];