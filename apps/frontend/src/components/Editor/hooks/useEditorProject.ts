import { useState, useEffect, useRef } from "react";
import { editorApi } from "../api";
import type { EditorProject, Track, Overlay, Asset } from "../types";
import { handleApiError } from "@/lib/errorHandler";

export function useEditorProject(
  meetingId: string | undefined,
  tracks: Track[],
  overlays: Overlay[],
  durationMs: number,
  setTracks: (tracks: Track[]) => void,
  setOverlays: (overlays: Overlay[]) => void,
  setDurationMs: (duration: number) => void,
  setAssetsById: (assets: Record<string, Asset>) => void,
  setSourceUrl: (url: string) => void,
  setActiveAssetId: (id: string | null) => void,
  resetHistory: (initialTracks: Track[], initialOverlays: Overlay[]) => void,
  extractThumbnailsForAsset: (
    assetId: string,
    url: string,
    durationMs: number,
  ) => Promise<void>,
  pauseSaving?: boolean,
) {
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<EditorProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function initProject() {
      if (!meetingId) {
        console.error("No meetingId provided in URL");
        setLoading(false);
        return;
      }
      try {
        setAccessDenied(false);
        setLoading(true);
        const { projectId } = await editorApi.createProject(meetingId, "FINAL");
        const projectData = await editorApi.getProject(projectId);

        setProject(projectData);
        setTracks(projectData.tracks || []);
        setOverlays(projectData.overlays || []);
        setDurationMs(projectData.durationMs || 0);

        const assetsMap = Object.fromEntries(
          (projectData.assets || []).map((a) => [a.id, a]),
        );
        setAssetsById(assetsMap);

        resetHistory(projectData.tracks || [], projectData.overlays || []);

        const videoAsset = projectData.assets?.find(
          (a) => a.assetType === "VIDEO",
        );
        if (videoAsset?.url) {
          setSourceUrl(videoAsset.url);
          setActiveAssetId(videoAsset.id);
        }

        const existingVideoTrack = (projectData.tracks || []).find(
          (t) => t.type === "VIDEO",
        );
        const hasClips = (projectData.tracks || []).some(
          (t) => t.type === "VIDEO" && t.clips && t.clips.length > 0,
        );

        if (!hasClips && videoAsset?.url) {
          let assetDuration =
            videoAsset.durationMs || projectData.durationMs || 0;

          if (assetDuration <= 0) {
            try {
              assetDuration = await new Promise<number>((resolve) => {
                const probe = document.createElement("video");
                probe.preload = "metadata";
                probe.src = videoAsset.url;
                probe.onloadedmetadata = () => {
                  const dur = Math.round((probe.duration || 1) * 1000);
                  resolve(dur);
                };
                probe.onerror = () => resolve(60000);
              });
            } catch {
              assetDuration = 60000;
            }
          }

          const newClip = {
            id: crypto.randomUUID(),
            sourceAssetId: videoAsset.id,
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: assetDuration,
            name: "Recording",
          };

          if (existingVideoTrack) {
            const updatedTracks = (projectData.tracks || []).map((t) =>
              t.id === existingVideoTrack.id ? { ...t, clips: [newClip] } : t,
            );
            setTracks(updatedTracks);
          } else {
            const defaultTrack: Track = {
              id: crypto.randomUUID(),
              type: "VIDEO",
              order: 0,
              visible: true,
              muted: false,
              volume: 100,
              clips: [newClip],
            };
            setTracks([...(projectData.tracks || []), defaultTrack]);
          }

          if (assetDuration > 0) setDurationMs(assetDuration);

          void extractThumbnailsForAsset(
            videoAsset.id,
            videoAsset.url,
            assetDuration,
          );
        } else if (videoAsset?.url) {
          void extractThumbnailsForAsset(
            videoAsset.id,
            videoAsset.url,
            videoAsset.durationMs || projectData.durationMs || 0,
          );
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status === 403) {
          setAccessDenied(true);
          return;
        }
        handleApiError(error, "Failed to initialize project");
      } finally {
        setLoading(false);
      }
    }

    initProject();
  }, [meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project || !tracks.length || pauseSaving) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await editorApi.saveProject(project.id, {
          tracks,
          overlays,
          durationMs,
          fps: project.fps ?? 60,
          width: project.width ?? 1920,
          height: project.height ?? 1080,
        });
      } catch (error) {
        handleApiError(error, "Failed to save project");
      } finally {
        setSaving(false);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [project, tracks, overlays, durationMs, pauseSaving]);

  return { project, loading, saving, accessDenied };
}
