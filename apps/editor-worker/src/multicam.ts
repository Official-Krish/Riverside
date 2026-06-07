import * as path from "node:path";
import * as fs from "node:fs/promises";
import type {
  ParticipantSourcePlan,
  ProgramSegment,
  MulticamRenderConfig,
  LayoutPreset,
  AudioClipPlan,
} from "./types";
import { log } from "./logger";
import { CONFIG } from "./config";
import { runBinaryWithRetries } from "./helpers";
import { buildLayoutFilterGraph } from "./layouts";
import { resolveProgramSegments, resolveLayoutSegments } from "./program";
import { buildAudioMixArgs } from "./audio";
import { buildOverlayFilter } from "./overlay";
import { buildConcatArgs } from "./audio";
import { downloadSourceToLocal } from "./storage";

/**
 * Check whether a project should use the multicam render pipeline.
 */
export function isMulticamProject(project: {
  sourceMode?: string;
  tracks?: Array<{ kind?: string; participantKey?: string | null }>;
}): boolean {
  if (project.sourceMode === "MULTITRACK") return true;

  const hasParticipantTracks = (project.tracks ?? []).some(
    (t) => t.kind === "video" && t.participantKey,
  );
  return hasParticipantTracks;
}

/**
 * Resolve participant source plans from the project data.
 * Extracts per-participant asset URLs and reframe settings.
 */
export function resolveParticipantSources(
  project: any,
): ParticipantSourcePlan[] {
  const assetMap = new Map<string, any>(
    (project.assets ?? []).map((a: any) => [a.id, a]),
  );

  const participantSources: ParticipantSourcePlan[] = [];

  for (const track of project.tracks ?? []) {
    if (track.type !== "VIDEO" || !track.participantKey) continue;

    const clip = track.clips?.[0];
    if (!clip) continue;

    const asset = assetMap.get(clip.sourceAssetId);
    if (!asset?.url) continue;

    const framing =
      track.participantKey && project.participantFramings
        ? project.participantFramings.find(
            (f: any) => f.participantKey === track.participantKey,
          )
        : null;

    participantSources.push({
      participantKey: track.participantKey,
      sourcePath: asset.url,
      durationMs: clip.durationMs || asset.durationMs || 60000,
      hasAudio: true,
      reframeSettings: framing
        ? {
            cropX: framing.cropX ?? 0,
            cropY: framing.cropY ?? 0,
            cropW: framing.cropW ?? 1,
            cropH: framing.cropH ?? 1,
          }
        : { cropX: 0, cropY: 0, cropW: 1, cropH: 1 },
      displayName: track.participantKey,
    });
  }

  return participantSources;
}

/**
 * Extract program clips from the project's program track.
 */
function extractProgramClips(project: any): Array<{
  timelineStartMs: number;
  durationMs: number;
  participantKey: string | null;
}> {
  const programTrack = (project.tracks ?? []).find(
    (t: any) => t.kind === "program",
  );
  if (!programTrack) return [];

  return (programTrack.clips ?? []).map((clip: any) => ({
    timelineStartMs: clip.timelineStartMs,
    durationMs: clip.durationMs,
    participantKey: clip.participantKey ?? null,
  }));
}

/**
 * Extract MulticamSegment overrides from the project.
 */
function extractLayoutOverrides(project: any): Array<{
  timelineStartMs: number;
  durationMs: number;
  preset: string | null;
  activeAngle: string | null;
}> {
  return (project.multicamSegments ?? []).map((seg: any) => ({
    timelineStartMs: seg.timelineStartMs,
    durationMs: seg.durationMs,
    preset: seg.layoutPreset ?? null,
    activeAngle: seg.activeAngle ?? null,
  }));
}

/**
 * Download all participant source videos to local cache.
 * Returns a map of participantKey → local path.
 */
async function downloadParticipantSources(
  sources: ParticipantSourcePlan[],
  sourceCacheDir: string,
): Promise<Map<string, string>> {
  const localPaths = new Map<string, string>();

  await Promise.all(
    sources.map(async (source) => {
      try {
        const localPath = await downloadSourceToLocal(
          source.sourcePath,
          sourceCacheDir,
        );
        localPaths.set(source.participantKey, localPath);
      } catch (err: any) {
        log(
          "warn",
          "Failed to download participant source, will use placeholder",
          {
            participantKey: source.participantKey,
            err: err.message,
          },
        );
      }
    }),
  );

  return localPaths;
}

/**
 * Build a render plan for the multicam export.
 */
function buildRenderPlan(
  participantSources: ParticipantSourcePlan[],
  project: any,
  totalDurationMs: number,
): MulticamRenderConfig {
  const programClips = extractProgramClips(project);
  const participantKeys = participantSources.map((s) => s.participantKey);

  const activeLayout: LayoutPreset =
    (project.multicamLayout?.activePreset as LayoutPreset) ?? "single";
  const defaultAngle: string | null =
    project.multicamLayout?.activeAngle ?? null;

  const programSegments = resolveProgramSegments(
    programClips,
    totalDurationMs,
    defaultAngle,
    participantKeys,
  );

  const layoutOverrides = resolveLayoutSegments(
    totalDurationMs,
    activeLayout,
    extractLayoutOverrides(project),
    participantKeys,
  );

  const sourceMap = new Map<string, ParticipantSourcePlan>();
  for (const s of participantSources) {
    sourceMap.set(s.participantKey, s);
  }

  return {
    participantSources: sourceMap,
    programSegments,
    layoutDefault: activeLayout,
    layoutOverrides,
    showSpeakerLabels: true,
  };
}

/**
 * Render a single composed multicam segment as a video part file.
 */
async function renderMulticamSegment(
  segment: ProgramSegment,
  sources: ParticipantSourcePlan[],
  localPaths: Map<string, string>,
  layoutPreset: LayoutPreset,
  width: number,
  height: number,
  fps: number,
  outputPath: string,
  showLabels: boolean,
): Promise<void> {
  // Determine which participants are visible in this segment
  const visibleSources = sources.filter((s) =>
    localPaths.has(s.participantKey),
  );

  if (visibleSources.length === 0) {
    // No sources available — render placeholder
    const durSec = segment.durationMs / 1000;
    const args = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=#1a1a1a:s=${width}x${height}:r=${fps}:d=${durSec.toFixed(3)}`,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "22",
      "-an",
      outputPath,
    ];
    await runBinaryWithRetries(CONFIG.FFMPEG_BIN, args);
    return;
  }

  // Reorder visible sources so active angle is first
  const activeIdx = visibleSources.findIndex(
    (s) => s.participantKey === segment.activeAngle,
  );
  if (activeIdx > 0) {
    const removed = visibleSources.splice(activeIdx, 1);
    if (removed[0]) visibleSources.unshift(removed[0]);
  }

  // Build FFmpeg inputs
  const inputs: string[] = [];
  const inputCount = Math.min(visibleSources.length, 9);

  for (let i = 0; i < inputCount; i++) {
    const source = visibleSources[i]!;
    const localPath = localPaths.get(source.participantKey);
    if (!localPath) continue;

    inputs.push("-ss", "0", "-i", localPath);
  }

  // Build filter graph
  const graph = buildLayoutFilterGraph(
    layoutPreset,
    visibleSources.slice(0, inputCount),
    width,
    height,
    showLabels,
  );

  const durSec = segment.durationMs / 1000;

  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    graph.filterParts.join(";"),
    "-map",
    `[${graph.outputLabel}]`,
    "-t",
    durSec.toFixed(3),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    "-an",
    outputPath,
  ];

  await runBinaryWithRetries(CONFIG.FFMPEG_BIN, args);
}

/**
 * Main multicam export entry point.
 *
 * Pipeline:
 * 1. Resolve participant sources & build render plan
 * 2. Download all participant videos to local cache
 * 3. For each program segment, render a composed part via FFmpeg filter graph
 * 4. Concatenate all parts into the video-only output
 * 5. Attach audio (mixed from all participant sources)
 * 6. Burn in overlays + presets
 * 7. Promote to final
 */
export async function renderMulticamExport(
  project: any,
  exportDir: string,
  sourceCacheDir: string,
  fps: number,
  width: number,
  height: number,
): Promise<{
  partPaths: string[];
  videoOnlyPath: string;
  overlayedPath: string;
  outputPath: string;
}> {
  log("info", "Starting multicam export pipeline", {
    projectId: project.id,
    sourceMode: project.sourceMode,
  });

  const jobId = `multicam_${project.id}_${Date.now()}`;
  const outputPath = path.join(exportDir, `${jobId}.mp4`);
  const videoOnlyPath = outputPath.replace(/\.mp4$/, "_video.mp4");
  const overlayedPath = outputPath.replace(/\.mp4$/, "_overlay.mp4");

  // 1. Resolve sources & render plan
  const participantSources = resolveParticipantSources(project);
  const totalDurationMs = project.durationMs || 60000;

  log("info", "Resolved participant sources", {
    count: participantSources.length,
    keys: participantSources.map((s) => s.participantKey),
  });

  const renderPlan = buildRenderPlan(
    participantSources,
    project,
    totalDurationMs,
  );

  // 2. Download all participant videos
  const localPaths = await downloadParticipantSources(
    participantSources,
    sourceCacheDir,
  );

  log("info", "Downloaded participant sources", {
    downloaded: localPaths.size,
    total: participantSources.length,
  });

  // 3. Render each program segment as a part file
  const tempParts: string[] = [];

  for (let i = 0; i < renderPlan.programSegments.length; i++) {
    const segment = renderPlan.programSegments[i]!;
    const partPath = path.join(exportDir, `${jobId}_part${i}.mp4`);

    // Find matching layout override for this segment's time range
    const layoutOverride = renderPlan.layoutOverrides.find(
      (lo) =>
        segment.timelineStartMs >= lo.timelineStartMs &&
        segment.timelineStartMs < lo.timelineStartMs + lo.durationMs,
    );
    const layoutPreset = layoutOverride?.preset || renderPlan.layoutDefault;

    await renderMulticamSegment(
      segment,
      participantSources,
      localPaths,
      layoutPreset,
      width,
      height,
      fps,
      partPath,
      renderPlan.showSpeakerLabels,
    );

    tempParts.push(partPath);
  }

  // 4. Concatenate all parts into video-only output
  if (tempParts.length === 1) {
    await fs.copyFile(tempParts[0]!, videoOnlyPath);
  } else {
    const { args, listPath } = await buildConcatArgs(tempParts, videoOnlyPath);
    try {
      await runBinaryWithRetries(CONFIG.FFMPEG_BIN, args);
    } finally {
      if (listPath) await fs.rm(listPath, { force: true });
    }
  }

  // 5. Audio mixing — mix audio from all visible participant sources
  const audioClips: AudioClipPlan[] = [];
  for (const source of participantSources) {
    const localPath = localPaths.get(source.participantKey);
    if (!localPath) continue;

    audioClips.push({
      sourcePath: localPath,
      timelineStartMs: 0,
      sourceStartMs: 0,
      durationMs: totalDurationMs,
      volume: 1,
      audioMode: "layer",
    });
  }

  if (audioClips.length > 0) {
    const mixArgs = buildAudioMixArgs(
      videoOnlyPath,
      audioClips,
      overlayedPath,
      true,
    );
    await runBinaryWithRetries(CONFIG.FFMPEG_BIN, mixArgs);
  } else {
    await fs.copyFile(videoOnlyPath, overlayedPath);
  }

  // 6. Burn in editor overlays
  const allOverlays = [...(project.overlays ?? [])];
  if (allOverlays.length > 0) {
    const overlayFilter = buildOverlayFilter(allOverlays, 0);
    if (overlayFilter) {
      const overlayArgs = [
        "-y",
        "-i",
        overlayedPath,
        "-vf",
        overlayFilter,
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
      await runBinaryWithRetries(CONFIG.FFMPEG_BIN, overlayArgs);
    } else {
      await fs.copyFile(overlayedPath, outputPath);
    }
  } else {
    await fs.copyFile(overlayedPath, outputPath);
  }

  log("info", "Multicam export pipeline complete", { outputPath });

  // Copy overlayedPath to outputPath if not already done
  if (overlayedPath !== outputPath && allOverlays.length === 0) {
    await fs.copyFile(overlayedPath, outputPath);
  }

  return { partPaths: tempParts, videoOnlyPath, overlayedPath, outputPath };
}
