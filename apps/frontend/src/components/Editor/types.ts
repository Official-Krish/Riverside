import type { TransitionType, TransitionEasing, TransitionDirection } from "./transitions/types";

export type TrackType = "VIDEO" | "AUDIO" | "TEXT";
export type OverlayType = "TEXT";
export type ActiveTool = "select" | "split" | "text" | "transition";

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

export interface OverlayStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  textShadow?:
    | boolean
    | {
        color?: string;
        blur?: number;
        x?: number;
        y?: number;
        opacity?: number;
      };
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundRadius?: number;
  letterSpacing?: number;
  lineHeight?: number;
  underline?: boolean;
  strikeThrough?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  maxWidth?: number;
}

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
    type: "fade-in" | "slide-in" | "typewriter" | "bounce" | "none";
    durationMs: number;
    delayMs?: number;
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