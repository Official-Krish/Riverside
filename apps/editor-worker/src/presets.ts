import type { PresetType, PresetConfig } from "./types";

export interface GeneratedOverlay {
  content: { text: string };
  timelineStartMs: number;
  durationMs: number;
  transform: { x: number; y: number; width?: number; height?: number };
  style?: Record<string, unknown>;
}

export function generateTemplateOverlays(preset: PresetType, durationMs: number, width = 1280, height = 720): GeneratedOverlay[] {
  switch (preset) {
    case "intro-template":
      return [
        {
          content: { text: "INTRO" },
          timelineStartMs: 0,
          durationMs: Math.min(durationMs, 3000),
          transform: { x: width / 2 - 100, y: height / 2 - 30, width: 200, height: 60 },
          style: {
            fontSize: 48,
            fontWeight: "bold" as const,
            color: "ffffff",
            textAlign: "center" as const,
            backgroundColor: "#000000",
            backgroundOpacity: 0.7,
          },
        },
      ];

    case "meme-format":
      return [
        {
          content: { text: "TOP TEXT" },
          timelineStartMs: 0,
          durationMs,
          transform: { x: width / 2 - 150, y: 40, width: 300, height: 50 },
          style: {
            fontSize: 32,
            fontWeight: "bold" as const,
            color: "ffffff",
            textAlign: "center" as const,
            textShadow: { color: "000000", blur: 2, x: 2, y: 2, opacity: 1 },
          },
        },
        {
          content: { text: "BOTTOM TEXT" },
          timelineStartMs: 0,
          durationMs,
          transform: { x: width / 2 - 150, y: height - 90, width: 300, height: 50 },
          style: {
            fontSize: 32,
            fontWeight: "bold" as const,
            color: "ffffff",
            textAlign: "center" as const,
            textShadow: { color: "000000", blur: 2, x: 2, y: 2, opacity: 1 },
          },
        },
      ];

    case "podcast-layout":
      return [
        {
          content: { text: "PODCAST" },
          timelineStartMs: 0,
          durationMs,
          transform: { x: width - 150, y: 30, width: 120, height: 40 },
          style: {
            fontSize: 18,
            color: "ffffff",
            textAlign: "center" as const,
            backgroundColor: "#ec4899",
            backgroundOpacity: 0.8,
            backgroundRadius: 4,
          },
        },
      ];

    default:
      return [];
  }
}

export function buildPresetFilter(preset: PresetType | null | undefined, config?: PresetConfig): string | null {
  if (!preset) return null;

  const intensity = config?.intensity ?? 1;
  const threshold = config?.threshold ?? 0.3;

  switch (preset) {
    case "zoom-pop":
      return buildZoomPopFilter(intensity);
    case "shake":
      return buildShakeFilter(intensity);
    case "glitch":
      return buildGlitchFilter(intensity);
    case "cinematic-bars":
      return buildCinematicBarsFilter(config?.color ?? "black");
    case "vhs":
      return buildVHSFilter(intensity);
    case "chromakey":
      return buildChromaKeyFilter(config?.color ?? "0x00ff00", threshold);
    case "intro-template":
      return buildIntroTemplateFilter();
    case "meme-format":
      return buildMemeFormatFilter();
    case "podcast-layout":
      return buildPodcastLayoutFilter();
    case "gaming-edit":
      return buildGamingEditFilter();
    default:
      return null;
  }
}

function buildZoomPopFilter(intensity: number): string | null {
  const zoomAmount = 1 + (intensity * 0.15);
  return `zoompan=z='min(zoom+0.005,${zoomAmount})':d=1:s=1280x720:fps=30`;
}

function buildShakeFilter(intensity: number): string | null {
  const blur = (intensity * 0.3).toFixed(2);
  return `unsharp=5:5:${blur}:5:5:0,format=yuv420p`;
}

function buildGlitchFilter(intensity: number): string | null {
  const shift = Math.round(intensity * 3);
  return `colorbalance=rs=${intensity * 0.1}:gs=0:bs=-${intensity * 0.1},format=yuv420p`;
}

function buildCinematicBarsFilter(color: string): string | null {
  const padColor = color.startsWith("0x") ? color.replace("0x", "") : color.replace("#", "");
  return `pad=1280:720:0:(ow-ih)/2:0x${padColor || "000000"}`;
}

function buildVHSFilter(intensity: number): string | null {
  return `eq=brightness=-0.03:saturation=1.15:contrast=1.05,format=yuv420p`;
}

function buildChromaKeyFilter(color: string, threshold: number): string | null {
  const keyColor = color.startsWith("0x") ? color : `0x${color.replace("#", "")}`;
  return `colorkey=${keyColor}:${threshold}:0.15`;
}

function buildIntroTemplateFilter(): string | null {
  return null;
}

function buildMemeFormatFilter(): string | null {
  return null;
}

function buildPodcastLayoutFilter(): string | null {
  return null;
}

function buildGamingEditFilter(): string | null {
  return null;
}

export function applyPresetToClip(inputPath: string, outputPath: string, preset: PresetType, config?: PresetConfig, ffmpegBin = "ffmpeg"): string[] {
  const filter = buildPresetFilter(preset, config);
  
  if (!filter) {
    return ["-y", "-i", inputPath, "-c", "copy", outputPath];
  }

  return [
    "-y",
    "-i", inputPath,
    "-vf", filter,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "copy",
    outputPath,
  ];
}