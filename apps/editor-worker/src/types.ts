import type { ClipEffects } from "./effects/types";

export type RenderPayload = {
  projectId: string;
  jobId: string;
  roomId: string;
  retryCount?: number;
};

export type RenderClip = {
  id: string;
  trackType: "VIDEO" | "AUDIO" | "TEXT";
  sourceAssetId: string;
  sourcePath: string;
  sourceStartMs: number;
  timelineStartMs: number;
  durationMs: number;
  name?: string | null;
  sourceDurationMs?: number | null;
  hasAudio?: boolean;
  audioMode?: "replace" | "layer";
  transitionStart?: Record<string, unknown> | null;
  transitionEnd?: Record<string, unknown> | null;
  transitionIn?: "fade" | "cut" | null;
  transitionOut?: "fade" | "cut" | null;
  preset?: PresetType | null;
  presetConfig?: PresetConfig;
  effects?: ClipEffects;
};

export type AudioClipPlan = {
  sourcePath: string;
  timelineStartMs: number;
  sourceStartMs: number;
  durationMs: number;
  volume: number;
  audioMode: "replace" | "layer";
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

// ── Multicam Render Types ──

export type LayoutPreset = "single" | "pip" | "split" | "grid";

export interface ParticipantSourcePlan {
  participantKey: string;
  sourcePath: string;
  durationMs: number;
  hasAudio: boolean;
  reframeSettings: {
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
  };
  displayName: string;
}

export interface ProgramSegment {
  timelineStartMs: number;
  durationMs: number;
  activeAngle: string;
}

export interface LayoutSegment {
  timelineStartMs: number;
  durationMs: number;
  preset: LayoutPreset;
  angles: string[];
}

export interface MulticamRenderConfig {
  participantSources: Map<string, ParticipantSourcePlan>;
  programSegments: ProgramSegment[];
  layoutDefault: LayoutPreset;
  layoutOverrides: LayoutSegment[];
  showSpeakerLabels: boolean;
}
