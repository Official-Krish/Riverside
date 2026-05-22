import { useCallback, type ChangeEvent } from "react";
import { editorApi } from "../api";
import type { EditorProject, Track, Asset } from "../types";
import { handleApiError } from "@/lib/errorHandler";

export function useMediaUpload(
  project: EditorProject | null,
  tracks: Track[],
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>,
  setAssetsById: React.Dispatch<React.SetStateAction<Record<string, Asset>>>,
  setDurationMs: React.Dispatch<React.SetStateAction<number>>,
  sourceUrl: string,
  setSourceUrl: (url: string) => void,
  setActiveAssetId: (id: string | null) => void,
  extractThumbnailsForAsset: (
    assetId: string,
    url: string,
    durationMs: number,
  ) => Promise<void>,
) {
  const handleMediaFilePicked = useCallback(
    async (
      e: ChangeEvent<HTMLInputElement>,
      forcedAssetType?: "VIDEO" | "AUDIO",
    ) => {
      const file = e.target.files?.[0];
      e.currentTarget.value = "";
      if (!file || !project) return;

      const objectUrl = URL.createObjectURL(file);
      const isAudio = forcedAssetType
        ? forcedAssetType === "AUDIO"
        : file.type.startsWith("audio/");
      const assetType: "VIDEO" | "AUDIO" = isAudio ? "AUDIO" : "VIDEO";

      const metaElement = document.createElement(isAudio ? "audio" : "video");
      metaElement.preload = "metadata";
      metaElement.src = objectUrl;

      const duration = await new Promise<number>((resolve) => {
        const handleLoaded = () => {
          resolve(Math.round((metaElement.duration || 1) * 1000));
          cleanup();
        };
        const handleError = () => {
          resolve(5000);
          cleanup();
        };
        const cleanup = () => {
          metaElement.removeEventListener("loadedmetadata", handleLoaded);
          metaElement.removeEventListener("error", handleError);
          metaElement.src = "";
          metaElement.remove();
        };
        metaElement.addEventListener("loadedmetadata", handleLoaded);
        metaElement.addEventListener("error", handleError);
      });

      let assetId: string;
      try {
        const uploaded = await editorApi.uploadAsset(
          project.id,
          file,
          duration,
          assetType,
        );
        assetId = uploaded.id;
      } catch (error) {
        handleApiError(error, "Failed to upload asset");
        assetId = crypto.randomUUID();
      }

      const newAsset: Asset = {
        id: assetId,
        assetType,
        url: objectUrl,
        durationMs: duration,
      };
      setAssetsById((prev) => ({ ...prev, [assetId]: newAsset }));

      if (!isAudio) {
        void extractThumbnailsForAsset(assetId, objectUrl, duration);
      }

      const GAP_MS = 500;

      setTracks((prev) => {
        const trackType = assetType;
        const existingTrack = prev.find((t) => t.type === trackType);

        if (existingTrack) {
          const lastClipEnd = existingTrack.clips.reduce(
            (max, c) => Math.max(max, c.timelineStartMs + c.durationMs),
            0,
          );
          const newClipStart = lastClipEnd > 0 ? lastClipEnd + GAP_MS : 0;

          return prev.map((track) => {
            if (track.id !== existingTrack.id) return track;
            return {
              ...track,
              clips: [
                ...track.clips,
                {
                  id: crypto.randomUUID(),
                  sourceAssetId: assetId,
                  sourceStartMs: 0,
                  timelineStartMs: newClipStart,
                  durationMs: duration,
                  name: file.name,
                  audioMode: isAudio ? "replace" : undefined,
                },
              ],
            };
          });
        }

        const maxOrder =
          prev.length > 0 ? Math.max(...prev.map((t) => t.order)) : -1;
        const newTrack: Track = {
          id: crypto.randomUUID(),
          type: trackType,
          order: maxOrder + 1,
          visible: true,
          muted: false,
          volume: 100,
          clips: [
            {
              id: crypto.randomUUID(),
              sourceAssetId: assetId,
              sourceStartMs: 0,
              timelineStartMs: 0,
              durationMs: duration,
              name: file.name,
              audioMode: isAudio ? "replace" : undefined,
            },
          ],
        };
        return [...prev, newTrack];
      });

      setDurationMs((prev) => {
        const existingTrack = tracks.find((t) => t.type === assetType);
        const lastClipEnd = existingTrack
          ? existingTrack.clips.reduce(
              (max, c) => Math.max(max, c.timelineStartMs + c.durationMs),
              0,
            )
          : 0;
        const newClipStart = lastClipEnd > 0 ? lastClipEnd + GAP_MS : 0;
        const newClipEnd = newClipStart + duration;
        return Math.max(prev, newClipEnd) + 2000;
      });

      if (!sourceUrl) {
        setSourceUrl(objectUrl);
        setActiveAssetId(assetId);
      }
    },
    [
      sourceUrl,
      tracks,
      extractThumbnailsForAsset,
      project,
      setAssetsById,
      setTracks,
      setDurationMs,
      setActiveAssetId,
      setSourceUrl,
    ],
  );

  const handleClipFilePicked = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void handleMediaFilePicked(e);
    },
    [handleMediaFilePicked],
  );

  const handleAudioFilePicked = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      void handleMediaFilePicked(e, "AUDIO");
    },
    [handleMediaFilePicked],
  );

  return { handleClipFilePicked, handleAudioFilePicked };
}
