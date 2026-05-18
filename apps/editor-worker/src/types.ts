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
