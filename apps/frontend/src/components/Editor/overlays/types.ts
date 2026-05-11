export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type TextAlignment = "left" | "center" | "right" | "justify";
export type TextDirection = "ltr" | "rtl";
export type AnimationType = "none" | "fade-in" | "slide-in" | "typewriter" | "bounce" | "scale-in" | "slide-up" | "slide-down" | "slide-left" | "slide-right";
export type AnimationEasing = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";

export interface TextShadowStyle {
  color?: string;
  blur?: number;
  x?: number;
  y?: number;
  opacity?: number;
}

export interface TextGradient {
  enabled: boolean;
  color1: string;
  color2: string;
  direction: number;
}

export interface BackgroundStyle {
  color: string;
  opacity: number;
  radius: number;
  paddingX: number;
  paddingY: number;
}

export interface AnimationStyle {
  type: AnimationType;
  durationMs: number;
  delayMs: number;
  easing: AnimationEasing;
  direction?: "in" | "out" | "both";
}

export interface TextOverlayStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textAlign: TextAlignment;
  textDirection: TextDirection;
  textTransform: TextTransform;
  letterSpacing: number;
  lineHeight: number;
  wordSpacing?: number;
  underline: boolean;
  strikeThrough: boolean;
  maxWidth: number;
  strokeWidth: number;
  strokeColor: string;
  textShadow: boolean | TextShadowStyle;
  gradient: TextGradient;
  background: BackgroundStyle;
}

export const DEFAULT_TEXT_OVERLAY_STYLE: TextOverlayStyle = {
  fontSize: 24,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#ffffff",
  fontWeight: "normal",
  fontStyle: "normal",
  textAlign: "left",
  textDirection: "ltr",
  textTransform: "none",
  letterSpacing: 0,
  lineHeight: 1.2,
  underline: false,
  strikeThrough: false,
  maxWidth: 320,
  strokeWidth: 0,
  strokeColor: "#000000",
  textShadow: false,
  gradient: {
    enabled: false,
    color1: "#ffffff",
    color2: "#000000",
    direction: 90,
  },
  background: {
    color: "#000000",
    opacity: 0,
    radius: 6,
    paddingX: 8,
    paddingY: 4,
  },
};

export const AVAILABLE_FONTS = [
  { name: "Inter", value: "Inter, system-ui, sans-serif", category: "sans-serif" },
  { name: "Poppins", value: "'Poppins', sans-serif", category: "sans-serif" },
  { name: "Montserrat", value: "'Montserrat', sans-serif", category: "sans-serif" },
  { name: "Roboto", value: "'Roboto', sans-serif", category: "sans-serif" },
  { name: "Open Sans", value: "'Open Sans', sans-serif", category: "sans-serif" },
  { name: "Lato", value: "'Lato', sans-serif", category: "sans-serif" },
  { name: "Raleway", value: "'Raleway', sans-serif", category: "sans-serif" },
  { name: "Source Sans", value: "'Source Sans 3', sans-serif", category: "sans-serif" },
  { name: "Playfair Display", value: "'Playfair Display', serif", category: "serif" },
  { name: "Merriweather", value: "'Merriweather', serif", category: "serif" },
  { name: "Lora", value: "'Lora', serif", category: "serif" },
  { name: "Georgia", value: "Georgia, serif", category: "serif" },
  { name: "Roboto Mono", value: "'Roboto Mono', monospace", category: "mono" },
  { name: "Fira Code", value: "'Fira Code', monospace", category: "mono" },
  { name: "Courier New", value: "'Courier New', monospace", category: "mono" },
  { name: "Oswald", value: "'Oswald', sans-serif", category: "display" },
  { name: "Bebas Neue", value: "'Bebas Neue', sans-serif", category: "display" },
  { name: "Abril Fatface", value: "'Abril Fatface', cursive", category: "display" },
] as const;