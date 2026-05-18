import type { PresetType, PresetConfig } from "./types";
import { normalizeFfmpegColor } from "./ffmpegUtils";

export interface GeneratedOverlay {
  content: { text: string };
  timelineStartMs: number;
  durationMs: number;
  transform: { x: number; y: number; width?: number; height?: number };
  style?: Record<string, unknown>;
}

export function generateTemplateOverlays(
  preset: PresetType,
  durationMs: number,
  width = 1920,
  height = 1080,
): GeneratedOverlay[] {
  switch (preset) {
    case "intro-template":
      return [
        {
          content: { text: "INTRO" },
          timelineStartMs: 0,
          durationMs: Math.min(durationMs, 3000),
          transform: {
            x: width / 2 - 100,
            y: height / 2 - 30,
            width: 200,
            height: 60,
          },
          style: {
            fontSize: 48,
            fontWeight: "bold" as const,
            color: "ffffff",
            textAlign: "center" as const,
            background: {
              color: "#000000",
              opacity: 0.7,
              radius: 6,
              paddingX: 12,
              paddingY: 8,
            },
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
          transform: {
            x: width / 2 - 150,
            y: height - 90,
            width: 300,
            height: 50,
          },
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
            background: {
              color: "#ec4899",
              opacity: 0.8,
              radius: 4,
              paddingX: 8,
              paddingY: 4,
            },
          },
        },
      ];

    default:
      return [];
  }
}

export function buildPresetFilter(
  preset: PresetType | null | undefined,
  config?: PresetConfig,
  width = 1920,
  height = 1080,
  fps = 60,
): string | null {
  if (!preset) return null;

  const intensity = config?.intensity ?? 1;
  const threshold = config?.threshold ?? 0.3;

  switch (preset) {
    case "zoom-pop":
      return buildZoomPopFilter(intensity, width, height, fps);
    case "shake":
      return buildShakeFilter(intensity);
    case "glitch":
      return buildGlitchFilter(intensity);
    case "cinematic-bars":
      return buildCinematicBarsFilter(config?.color ?? "black", width, height);
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
    case "lower-third":
      return buildLowerThirdFilter(width, height);
    case "cta-button":
      return buildCTAButtonFilter();
    case "chapter-title":
      return buildChapterTitleFilter();
    default:
      return null;
  }
}

function buildZoomPopFilter(
  intensity: number,
  width: number,
  height: number,
  fps: number,
): string | null {
  const zoomAmount = 1 + intensity * 0.15;
  return `zoompan=z='min(zoom+0.005,${zoomAmount})':d=1:s=${width}x${height}:fps=${fps}`;
}

function buildShakeFilter(intensity: number): string | null {
  const blur = (intensity * 0.3).toFixed(2);
  return `unsharp=5:5:${blur}:5:5:0,format=yuv420p`;
}

function buildGlitchFilter(intensity: number): string | null {
  return `colorbalance=rs=${intensity * 0.1}:gs=0:bs=-${intensity * 0.1},format=yuv420p`;
}

// normalized by import from ffmpegUtils.ts

function buildCinematicBarsFilter(
  color: string,
  width: number,
  height: number,
): string | null {
  const padColor = normalizeFfmpegColor(color, "000000");
  const barHeight = Math.max(1, Math.round(height * 0.25));
  return `drawbox=x=0:y=0:w=${width}:h=${barHeight}:color=${padColor}:t=fill,drawbox=x=0:y=${height - barHeight}:w=${width}:h=${barHeight}:color=${padColor}:t=fill`;
}

function buildVHSFilter(_intensity: number): string | null {
  return `eq=brightness=-0.03:saturation=1.15:contrast=1.05,format=yuv420p`;
}

function buildChromaKeyFilter(color: string, threshold: number): string | null {
  const keyColor = normalizeFfmpegColor(color, "00ff00");
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

function buildLowerThirdFilter(width: number, height: number): string | null {
  const padColor = "0x000000";
  const cropHeight = Math.max(1, Math.round(height * 0.22));
  return `crop=in_w:${cropHeight}:0:ih-${cropHeight},pad=${width}:${height}:0:(oh-ih)/2:${padColor}`;
}

function buildCTAButtonFilter(): string | null {
  return null;
}

function buildChapterTitleFilter(): string | null {
  return null;
}

export function applyPresetToClip(
  inputPath: string,
  outputPath: string,
  preset: PresetType,
  config?: PresetConfig,
  _ffmpegBin = "ffmpeg",
): string[] {
  const filter = buildPresetFilter(preset, config);

  if (!filter) {
    return ["-y", "-i", inputPath, "-c", "copy", outputPath];
  }

  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-c:a",
    "copy",
    outputPath,
  ];
}
