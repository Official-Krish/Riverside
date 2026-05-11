import type { RenderClip, AudioClipPlan } from "./types";
import { toLocalRecordingPath } from "./helpers";
import { prisma } from "@repo/db/client";

function normalizeTransitionMetadata(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const type = typeof candidate.type === "string" ? candidate.type : null;
  if (!type) return null;

  return {
    type,
    durationMs: Number.isFinite(candidate.durationMs) ? Number(candidate.durationMs) : 500,
    easing: typeof candidate.easing === "string" ? candidate.easing : "ease-in-out",
    direction: typeof candidate.direction === "string" ? candidate.direction : undefined,
    borderWidth: Number.isFinite(candidate.borderWidth) ? Number(candidate.borderWidth) : undefined,
    borderColor: typeof candidate.borderColor === "string" ? candidate.borderColor : undefined,
    reverse: typeof candidate.reverse === "boolean" ? candidate.reverse : undefined,
  };
}

export function normalizeClip(clip: any, trackType: RenderClip["trackType"], sourcePath: string): RenderClip {
  const metadata = (clip.metadata ?? {}) as Record<string, unknown>;

  return {
    id: clip.id,
    trackType,
    sourceAssetId: clip.sourceAssetId,
    sourcePath,
    sourceStartMs: clip.sourceStartMs,
    timelineStartMs: clip.timelineStartMs,
    durationMs: clip.durationMs,
    name: clip.name ?? null,
    audioMode: typeof metadata.audioMode === "string" ? (metadata.audioMode as "replace" | "layer") : undefined,
    transitionStart: normalizeTransitionMetadata(metadata.transitionStart),
    transitionEnd: normalizeTransitionMetadata(metadata.transitionEnd),
    transitionIn: clip.transitionIn ?? null,
    transitionOut: clip.transitionOut ?? null,
    preset: clip.preset ?? null,
    presetConfig: clip.presetConfig ?? undefined,
  };
}

export function collectRenderClips(project: any): { videoClips: RenderClip[]; audioClips: AudioClipPlan[] } {
  const assetMap = new Map<string, any>(project.assets.map((asset: any) => [asset.id, asset]));

  const videoClips = project.tracks
    .filter((track: any) => track.type === "VIDEO")
    .flatMap((track: any) => track.clips.map((clip: any) => {
      const asset = assetMap.get(clip.sourceAssetId);
      if (!asset?.url) {
        throw new Error(`Missing source asset for clip ${clip.id ?? clip.sourceAssetId}`);
      }

      if (!Number.isFinite(clip.durationMs) || clip.durationMs <= 0) {
        throw new Error(`Invalid clip duration: ${clip.durationMs} for clip ${clip.id}`);
      }

      return normalizeClip(clip, track.type, toLocalRecordingPath(asset.url));
    }))
    .sort((a: RenderClip, b: RenderClip) => a.timelineStartMs - b.timelineStartMs);

  const audioClips = project.tracks
    .filter((track: any) => track.type === "AUDIO")
    .flatMap((track: any) => {
      const trackVolume = Number.isFinite(track.volume) ? Number(track.volume) : 1;
      const muted = Boolean(track.muted);

      return track.clips.flatMap((clip: any) => {
        const asset = assetMap.get(clip.sourceAssetId);
        if (!asset?.url || muted || trackVolume <= 0) return [];

        return [{
          sourcePath: toLocalRecordingPath(asset.url),
          timelineStartMs: clip.timelineStartMs,
          sourceStartMs: clip.sourceStartMs,
          durationMs: clip.durationMs,
          volume: trackVolume,
          audioMode: typeof clip.audioMode === "string" ? clip.audioMode : "layer",
        } satisfies AudioClipPlan];
      });
    })
    .sort((a: AudioClipPlan, b: AudioClipPlan) => a.timelineStartMs - b.timelineStartMs);

  return { videoClips, audioClips };
}
