import type {
  TransitionType,
  TransitionEasing,
  TransitionDirection,
} from "./transitions/types";
import type {
  TextOverlayStyle,
  AnimationType,
  AnimationEasing,
} from "./overlays/types";
import type { ClipEffects } from "./effects/types";

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
  /** Additive clip effects rendered in export and previewed in the editor */
  effects?: ClipEffects;
}

export interface Track {
  id: string;
  type: TrackType;
  order: number;
  visible: boolean;
  muted: boolean;
  volume: number;
  clips: Clip[];
  participantKey?: string;
  kind?: "video" | "audio" | "program" | "suggestion";
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
  | "chapter-title";

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

// V2 Multicam types

export interface ParticipantSourceInfo {
  participantKey: string;
  displayName: string;
  role: "host" | "guest" | "screen";
  sourceKind: "camera" | "screen" | "placeholder";
  assetId: string;
  url: string;
  durationMs: number;
  framing: ReframeSettings;
  hidden: boolean;
  priority: number;
  order: number;
}

export interface SpeakerSegment {
  participantKey: string;
  displayName: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export interface AutoCutSuggestion {
  id: string;
  timelineStartMs: number;
  durationMs: number;
  participantKey: string;
  applied: boolean;
}

export interface ReframeSettings {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  zoomPreset: "head" | "upper-body" | "full-body" | "custom";
}

export type LayoutPreset = "single" | "pip" | "split" | "grid";

export interface CameraPriorityEntry {
  participantKey: string;
  priority: number;
}

export interface MulticamProjectConfig {
  participantSources: ParticipantSourceInfo[];
  speakerTimeline: SpeakerSegment[];
  activeLayout: LayoutPreset;
  activeAngle: string | null;
  cameraPriority: CameraPriorityEntry[];
  autoCutSegments: AutoCutSuggestion[];
}

export const PARTICIPANT_COLORS = [
  "#f5a623", // gold
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#8b5cf6", // violet
];

export function getParticipantColor(index: number): string {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}

export const PRESET_DEFINITIONS: Omit<Preset, "id">[] = [
  { type: "zoom-pop", name: "Zoom Pop", shortcut: "Ctrl+1", icon: "ZoomIn" },
  { type: "shake", name: "Shake", shortcut: "Ctrl+2", icon: "Activity" },
  { type: "glitch", name: "Glitch", shortcut: "Ctrl+3", icon: "Zap" },
  {
    type: "cinematic-bars",
    name: "Cinematic Bars",
    shortcut: "Ctrl+4",
    icon: "Maximize2",
  },
  { type: "vhs", name: "VHS Effect", shortcut: "Ctrl+5", icon: "Film" },
  {
    type: "chromakey",
    name: "Green Screen",
    shortcut: "Ctrl+6",
    icon: "Palette",
  },
  {
    type: "intro-template",
    name: "Intro",
    shortcut: "Ctrl+I",
    icon: "PlayCircle",
  },
  { type: "meme-format", name: "Meme", shortcut: "Ctrl+M", icon: "Sparkles" },
  { type: "podcast-layout", name: "Podcast", shortcut: "Ctrl+P", icon: "Mic" },
];
