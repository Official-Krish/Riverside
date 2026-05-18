export type BlurEffectType =
  | "gaussian"
  | "background"
  | "face"
  | "motion"
  | "radial";

export type ChromaBackgroundMode = "none" | "solid";

export type SpeedCurveType = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export interface FocusRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
}

export interface BlurEffectSettings {
  enabled: boolean;
  type: BlurEffectType;
  amount: number;
  focusRegion: FocusRegion;
  angle: number;
  mix: number;
  temporalFrames: number;
}

export interface LutEffectSettings {
  enabled: boolean;
  name?: string;
  cubeData?: string;
  intensity: number;
}

export interface ColorEffectSettings {
  enabled: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  hue: number;
  shadows: number;
  highlights: number;
  lut: LutEffectSettings;
}

export interface ChromaKeySettings {
  enabled: boolean;
  color: string;
  similarity: number;
  blend: number;
  spill: number;
  backgroundMode: ChromaBackgroundMode;
  backgroundColor: string;
}

export interface SpeedPoint {
  id: string;
  at: number;
  speed: number;
}

export interface FreezeFrameSegment {
  id: string;
  at: number;
  durationMs: number;
}

export interface SpeedEffectSettings {
  enabled: boolean;
  preservePitch: boolean;
  curve: SpeedCurveType;
  points: SpeedPoint[];
  freezeFrames: FreezeFrameSegment[];
}

export interface ClipEffects {
  blur: BlurEffectSettings;
  color: ColorEffectSettings;
  chromaKey: ChromaKeySettings;
  speed: SpeedEffectSettings;
}

export const DEFAULT_CLIP_EFFECTS: ClipEffects = {
  blur: {
    enabled: false,
    type: "gaussian",
    amount: 12,
    focusRegion: {
      x: 480,
      y: 180,
      width: 960,
      height: 720,
      feather: 24,
    },
    angle: 0,
    mix: 0.35,
    temporalFrames: 4,
  },
  color: {
    enabled: false,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    vibrance: 0,
    temperature: 0,
    hue: 0,
    shadows: 0,
    highlights: 0,
    lut: {
      enabled: false,
      intensity: 1,
    },
  },
  chromaKey: {
    enabled: false,
    color: "#00ff00",
    similarity: 0.24,
    blend: 0.08,
    spill: 0.15,
    backgroundMode: "none",
    backgroundColor: "#101014",
  },
  speed: {
    enabled: false,
    preservePitch: true,
    curve: "linear",
    points: [
      { id: "speed-start", at: 0, speed: 1 },
      { id: "speed-end", at: 1, speed: 1 },
    ],
    freezeFrames: [],
  },
};
