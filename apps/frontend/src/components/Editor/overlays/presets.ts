import type { TextOverlayStyle, AnimationType, TextAlignment } from "./types";

export interface TextPreset {
  name: string;
  category: "title" | "subtitle" | "lower-third" | "caption" | "cta" | "custom";
  style: Partial<TextOverlayStyle>;
  animation?: {
    entry: AnimationType;
    durationMs: number;
    delayMs: number;
  };
}

export const TEXT_PRESETS: TextPreset[] = [
  {
    name: "Main Title",
    category: "title",
    style: {
      fontSize: 56,
      fontWeight: "bold",
      textAlign: "center" as TextAlignment,
      textTransform: "uppercase",
      letterSpacing: 4,
      textShadow: {
        color: "#000000",
        blur: 8,
        x: 2,
        y: 2,
        opacity: 0.8,
      },
    },
    animation: {
      entry: "fade-in",
      durationMs: 1000,
      delayMs: 0,
    },
  },
  {
    name: "Subtitle",
    category: "subtitle",
    style: {
      fontSize: 28,
      fontWeight: "normal",
      textAlign: "center" as TextAlignment,
      color: "#e0e0e0",
      letterSpacing: 2,
    },
    animation: {
      entry: "slide-up",
      durationMs: 800,
      delayMs: 300,
    },
  },
  {
    name: "Lower Third - Left",
    category: "lower-third",
    style: {
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "left" as TextAlignment,
      background: {
        color: "#1a1a1a",
        opacity: 0.85,
        radius: 8,
        paddingX: 16,
        paddingY: 8,
      },
    },
    animation: {
      entry: "slide-in",
      durationMs: 600,
      delayMs: 0,
    },
  },
  {
    name: "Lower Third - Name",
    category: "lower-third",
    style: {
      fontSize: 32,
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: 2,
    },
  },
  {
    name: "Lower Third - Title",
    category: "lower-third",
    style: {
      fontSize: 18,
      color: "#aaaaaa",
      fontWeight: "normal",
    },
  },
  {
    name: "Caption",
    category: "caption",
    style: {
      fontSize: 16,
      color: "#cccccc",
      background: {
        color: "#000000",
        opacity: 0.6,
        radius: 4,
        paddingX: 8,
        paddingY: 4,
      },
    },
    animation: {
      entry: "fade-in",
      durationMs: 400,
      delayMs: 0,
    },
  },
  {
    name: "Call to Action",
    category: "cta",
    style: {
      fontSize: 32,
      fontWeight: "bold",
      textAlign: "center" as TextAlignment,
      textTransform: "uppercase",
      letterSpacing: 4,
      background: {
        color: "#f5a623",
        opacity: 1,
        radius: 8,
        paddingX: 24,
        paddingY: 12,
      },
      color: "#000000",
    },
    animation: {
      entry: "bounce",
      durationMs: 800,
      delayMs: 0,
    },
  },
  {
    name: "Chapter Title",
    category: "title",
    style: {
      fontSize: 64,
      fontWeight: "bold",
      textAlign: "center" as TextAlignment,
      textTransform: "uppercase",
      letterSpacing: 8,
      color: "#f5a623",
      textShadow: {
        color: "#000000",
        blur: 12,
        x: 4,
        y: 4,
        opacity: 1,
      },
    },
    animation: {
      entry: "scale-in",
      durationMs: 1200,
      delayMs: 0,
    },
  },
  {
    name: "Highlight Box",
    category: "custom",
    style: {
      fontSize: 20,
      fontWeight: "bold",
      background: {
        color: "#f5a623",
        opacity: 1,
        radius: 6,
        paddingX: 12,
        paddingY: 8,
      },
      color: "#000000",
    },
    animation: {
      entry: "slide-left",
      durationMs: 500,
      delayMs: 0,
    },
  },
  {
    name: "Timestamp",
    category: "caption",
    style: {
      fontSize: 14,
      fontFamily: "'Roboto Mono', monospace",
      color: "#888888",
      textAlign: "right" as TextAlignment,
    },
  },
  {
    name: "Progress Indicator",
    category: "caption",
    style: {
      fontSize: 14,
      fontWeight: "bold",
      color: "#f5a623",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
  },
];

export const ANIMATION_PRESETS: { type: AnimationType; name: string; icon: string }[] = [
  { type: "none", name: "None", icon: "○" },
  { type: "fade-in", name: "Fade In", icon: "◐" },
  { type: "slide-in", name: "Slide In", icon: "→" },
  { type: "slide-up", name: "Slide Up", icon: "↑" },
  { type: "slide-down", name: "Slide Down", icon: "↓" },
  { type: "slide-left", name: "Slide Left", icon: "←" },
  { type: "slide-right", name: "Slide Right", icon: "→" },
  { type: "typewriter", name: "Typewriter", icon: "⌨" },
  { type: "bounce", name: "Bounce", icon: "◎" },
  { type: "scale-in", name: "Scale In", icon: "⊕" },
];

export function applyPreset(preset: TextPreset): Partial<TextOverlayStyle> {
  return {
    ...preset.style,
    ...(preset.animation && {
      animation: {
        type: preset.animation.entry,
        durationMs: preset.animation.durationMs,
        delayMs: preset.animation.delayMs,
        easing: "ease-out",
        direction: "in" as const,
      },
    }),
  };
}

export function getPresetsByCategory(category: TextPreset["category"]): TextPreset[] {
  return TEXT_PRESETS.filter((p) => p.category === category);
}