import * as path from "node:path";
import * as fs from "node:fs/promises";
import { prisma } from "@repo/db/client";
import type { RenderPayload } from "./types";
import { log } from "./logger";
import { CONFIG } from "./config";
import { recordingsRoot, ensureDir, runBinary } from "./helpers";
import { verifySourceExists, updateProgress } from "./utils";
import { collectRenderClips } from "./clips";
import { buildClipRenderArgs, getTransitionPlan, buildCrossfadeConcatArgs } from "./transitions";
import { buildOverlayFilter } from "./overlay";
import { buildAudioMixArgs, buildConcatArgs } from "./audio";
import { promoteRenderedVideo, refreshMeetingRecordingArtifacts } from "./artifacts";
import { downloadSourceToLocal } from "./storage";
import { generateTemplateOverlays, type GeneratedOverlay } from "./presets";

function buildOverlayBurnInArgs(inputPath: string, overlays: any[], outputPath: string, width: number, height: number): string[] {
  const overlay = buildOverlayFilter(overlays, 0);
  if (!overlay) {
    return ["-y", "-i", inputPath, "-c", "copy", outputPath];
  }

  return [
    "-y",
    "-i", inputPath,
    "-vf", overlay,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "22",
    "-c:a", "copy",
    outputPath,
  ];
}

export async function processRenderJob(payload: RenderPayload): Promise<void> {
  const { projectId, jobId, roomId } = payload;

  log("info", "Job started", { jobId, projectId });

  const project = await prisma.editorProject.findFirst({
    where: { id: projectId },
    include: {
      tracks: { include: { clips: true }, orderBy: { order: "asc" } },
      overlays: true,
      meeting: { include: { finalRecording: true } },
      assets: true,
    },
  });

  if (!project) throw new Error(`Project not found: ${projectId}`);

  const fps = project.fps ?? 30;
  const width = project.width ?? 1920;
  const height = project.height ?? 1080;

  log("info", "Project loaded", {
    jobId,
    projectId,
    trackCount: project.tracks.length,
    clipCount: project.tracks.reduce((acc, t) => acc + t.clips.length, 0),
    overlayCount: project.overlays.length,
    assetCount: project.assets.length,
    fps,
    width,
    height,
  });

  const { videoClips, audioClips } = collectRenderClips(project);

  log("info", "Clips collected", {
    jobId,
    videoClipCount: videoClips.length,
    audioClipCount: audioClips.length,
    clips: videoClips.map(c => ({
      id: c.id,
      sourceAssetId: c.sourceAssetId,
      sourcePath: c.sourcePath,
      sourceStartMs: c.sourceStartMs,
      timelineStartMs: c.timelineStartMs,
      durationMs: c.durationMs,
      preset: c.preset,
      transitionStart: c.transitionStart,
      transitionEnd: c.transitionEnd,
    })),
  });

  if (!videoClips.length) throw new Error("No video clips found in project");

  const exportDir = path.join(recordingsRoot, roomId, "editor", "projects", projectId, "exports");
  await ensureDir(exportDir);
  const sourceCacheDir = path.join(recordingsRoot, roomId, "editor", "projects", projectId, "sources");

  const sourcePaths = new Set([
    ...videoClips.map((clip) => clip.sourcePath),
    ...audioClips.map((clip) => clip.sourcePath),
  ]);

  const sourceMap = new Map<string, string>();
  log("info", "Downloading sources", { jobId, sourcePathCount: sourcePaths.size });

  await Promise.all(
    [...sourcePaths].map(async (sourcePath) => {
      log("debug", "Resolving source", { jobId, sourcePath });
      try {
        const resolved = await downloadSourceToLocal(sourcePath, sourceCacheDir);
        log("debug", "Source resolved", { jobId, sourcePath, resolved });
        sourceMap.set(sourcePath, resolved);
        await verifySourceExists(resolved);
      } catch (err: any) {
        log("error", "Failed to resolve source", { jobId, sourcePath, err: err.message });
        throw err;
      }
    })
  );

  log("info", "All sources resolved", {
    jobId,
    sourceMapEntries: sourceMap.size,
    sources: [...sourceMap.entries()].map(([k, v]) => ({ original: k, resolved: v })),
  });

  const resolvedVideoClips = videoClips.map((clip) => ({
    ...clip,
    sourcePath: sourceMap.get(clip.sourcePath) || clip.sourcePath,
  }));

  const resolvedAudioClips = audioClips.map((clip) => ({
    ...clip,
    sourcePath: sourceMap.get(clip.sourcePath) || clip.sourcePath,
  }));

  const outputPath = path.join(exportDir, `${jobId}.mp4`);
  const videoOnlyPath = outputPath.replace(/\.mp4$/, "_video.mp4");
  const overlayedPath = outputPath.replace(/\.mp4$/, "_overlay.mp4");
  const previewPath = outputPath.replace(/\.mp4$/, "_preview.mp4");

  const firstClip = resolvedVideoClips[0]!;

  log("info", "Generating preview", { jobId, previewPath, sourcePath: firstClip.sourcePath, sourceStartMs: firstClip.sourceStartMs, durationMs: firstClip.durationMs });
  await runBinary(CONFIG.FFMPEG_BIN, [
    "-y",
    "-ss", (firstClip.sourceStartMs / 1000).toFixed(3),
    "-i", firstClip.sourcePath,
    "-t", (firstClip.durationMs / 1000).toFixed(3),
    "-vf", "scale=640:-2",
    "-preset", "ultrafast",
    "-crf", "32",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    previewPath,
  ]);

  await updateProgress(jobId, 10);

  const tempFiles: string[] = [];
  let concatListPath: string | null = null;

  try {
    if (resolvedVideoClips.length === 1) {
      const c = resolvedVideoClips[0]!;
      log("info", "Single clip encoding", { jobId, clipId: c.id, sourcePath: c.sourcePath, outputPath: videoOnlyPath });
      const args = buildClipRenderArgs(c, videoOnlyPath, width, height, fps);
      log("debug", "FFmpeg args for single clip", { jobId, args });
      await runBinary(CONFIG.FFMPEG_BIN, args);

      const videoOnlyStats = await fs.stat(videoOnlyPath);
      log("info", "Video encoding complete", {
        jobId,
        videoOnlyPath,
        sizeBytes: videoOnlyStats.size,
        durationMs: videoOnlyStats.mtime,
      });

      await updateProgress(jobId, 75);
    } else {
      log("info", "Multi-clip encoding", { jobId, clipCount: resolvedVideoClips.length });
      const clipParts: Array<{ path: string; transition?: { type: string; durationMs: number } | null }> = [];
      for (let i = 0; i < resolvedVideoClips.length; i++) {
        const c = resolvedVideoClips[i]!;
        const partPath = path.join(exportDir, `${jobId}_part${i}.mp4`);

        log("debug", `Encoding part ${i + 1}/${resolvedVideoClips.length}`, { jobId, clipId: c.id, sourcePath: c.sourcePath, partPath });

        const args = buildClipRenderArgs(c, partPath, width, height, fps);
        log("debug", `FFmpeg args for part ${i + 1}`, { jobId, args });

        try {
          await runBinary(CONFIG.FFMPEG_BIN, args);
        } catch (err: any) {
          log("error", `Failed to encode part ${i + 1}`, { jobId, partPath, err: err.message });
          throw err;
        }

        const nextClip = resolvedVideoClips[i + 1];
        const transition = nextClip
          ? getTransitionPlan(c, "end") ?? (getTransitionPlan(nextClip, "start") ? { type: nextClip.transitionIn as string ?? "fade", durationMs: (nextClip.transitionStart as any)?.durationMs ?? 500 } : null)
          : null;

        log("debug", `Transition for part ${i + 1}`, { jobId, hasTransition: !!transition, transition });

        clipParts.push({ path: partPath, transition });
        tempFiles.push(partPath);
        await updateProgress(jobId, 10 + Math.round(((i + 1) / resolvedVideoClips.length) * 70));
      }

      log("info", "Concatenating clips", { jobId, clipParts: clipParts.length, transitions: clipParts.filter(p => p.transition).length });
      log("debug", "Clip parts detail", { jobId, clipParts });

      const crossfadeResult = buildCrossfadeConcatArgs(clipParts, videoOnlyPath, fps);
      if (crossfadeResult) {
        const transitionsUsed = clipParts.filter(p => p.transition).length;
        log("debug", "Using crossfade concat", { jobId, args: crossfadeResult.args });
        try {
          await runBinary(CONFIG.FFMPEG_BIN, crossfadeResult.args);
        } catch (err: any) {
          log("error", "Crossfade concat failed", { jobId, err: err.message });
          throw err;
        }
      } else {
        const { args, listPath } = await buildConcatArgs(clipParts.map(p => p.path), videoOnlyPath);
        concatListPath = listPath;
        log("debug", "Using simple concat", { jobId, args, listPath });
        try {
          await runBinary(CONFIG.FFMPEG_BIN, args);
        } catch (err: any) {
          log("error", "Simple concat failed", { jobId, err: err.message });
          throw err;
        }
      }
      await updateProgress(jobId, 90);
    }

    const allOverlays = [...project.overlays];
    log("info", "Building overlay list", { jobId, projectOverlays: project.overlays.length, fromPresets: 0 });

    for (const clip of videoClips) {
      if (clip.preset && ["intro-template", "meme-format", "podcast-layout"].includes(clip.preset)) {
        const templateOverlays = generateTemplateOverlays(clip.preset, clip.durationMs, width, height)
          .map((overlay) => ({
            ...overlay,
            timelineStartMs: overlay.timelineStartMs + clip.timelineStartMs,
          }));
        allOverlays.push(...templateOverlays as any);
        log("debug", `Generated ${templateOverlays.length} template overlays for preset ${clip.preset}`, { jobId });
      }
    }

    log("info", "Final overlay list", { jobId, totalOverlays: allOverlays.length, overlays: allOverlays });

    if (allOverlays.length > 0) {
      log("debug", "Burning overlay timeline into composed video", { jobId, overlays: allOverlays.length });
      const overlayArgs = buildOverlayBurnInArgs(videoOnlyPath, allOverlays, overlayedPath, width, height);
      log("debug", "Overlay ffmpeg args", { jobId, args: overlayArgs });
      try {
        await runBinary(CONFIG.FFMPEG_BIN, overlayArgs);

        const overlayedStats = await fs.stat(overlayedPath);
        log("info", "Overlay burn-in complete", {
          jobId,
          overlayedPath,
          sizeBytes: overlayedStats.size,
          overlaysApplied: allOverlays.length,
        });
      } catch (err: any) {
        log("error", "Overlay burn-in failed", { jobId, err: err.message });
        throw err;
      }
      await updateProgress(jobId, 93);
    } else {
      log("info", "No overlays to burn in, copying videoOnlyPath to overlayedPath", { jobId });
      await fs.copyFile(videoOnlyPath, overlayedPath);
      const overlayedStats = await fs.stat(overlayedPath);
      log("info", "Copy complete", { jobId, overlayedPath, sizeBytes: overlayedStats.size });
      await updateProgress(jobId, 93);
    }

    if (resolvedAudioClips.length > 0) {
      log("debug", "Mixing external audio tracks", { jobId, audioClips: resolvedAudioClips.length });
      const mixArgs = buildAudioMixArgs(overlayedPath, resolvedAudioClips, outputPath);
      await runBinary(CONFIG.FFMPEG_BIN, mixArgs);
      await updateProgress(jobId, 98);
      // Clean up intermediate files (will be skipped in finally block)
      await fs.rm(videoOnlyPath, { force: true });
      await fs.rm(overlayedPath, { force: true });
    } else {
      await fs.rename(overlayedPath, outputPath);
      await updateProgress(jobId, 98);
    }

    // ── Promote to canonical final recording and trigger retranscode ──────
    const version = String(Date.now());
    const finalPath = await promoteRenderedVideo(roomId, outputPath, version);
    const publicFinalPath = await refreshMeetingRecordingArtifacts(roomId, finalPath, jobId, projectId, version);

    log("info", "Job completed and promoted to final recording", {
      jobId,
      finalPath,
      publicFinalPath,
      transcodeQueue: CONFIG.TRANSCODE_QUEUE_NAME,
    });
  } finally {
    // Clean up temp files and intermediates (videoOnlyPath/overlayedPath already deleted on success path)
    await Promise.allSettled([
      fs.unlink(previewPath),
      fs.unlink(outputPath), // only needed if job failed before promotion
      ...tempFiles.map((f) => fs.unlink(f)),
      concatListPath ? fs.unlink(concatListPath) : Promise.resolve(),
    ]);
  }
}