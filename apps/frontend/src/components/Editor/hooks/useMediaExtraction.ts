import { useState, useCallback, useEffect } from "react";
import type { Asset } from "../types";

export function useMediaExtraction(
  assetsById: Record<string, Asset>,
  sourceUrl: string,
  durationMs: number,
) {
  const [thumbnailsByAsset, setThumbnailsByAsset] = useState<
    Record<string, string[]>
  >({});
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [extractingAssets, setExtractingAssets] = useState<
    Record<string, boolean>
  >({});

  const extractThumbnailsForAsset = useCallback(
    async (assetId: string, url: string, assetDurationMs: number) => {
      setExtractingAssets((prev) => ({ ...prev, [assetId]: true }));
      try {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        video.muted = true;
        video.src = url;

        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("error", onError);
            resolve();
          };
          const onError = () => {
            video.removeEventListener("loadedmetadata", onLoaded);
            video.removeEventListener("error", onError);
            reject(new Error("failed to load video metadata"));
          };
          video.addEventListener("loadedmetadata", onLoaded);
          video.addEventListener("error", onError);
        });

        const durSec =
          (assetDurationMs > 0 ? assetDurationMs : video.duration * 1000) /
          1000;
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const count = Math.min(
          25,
          Math.max(5, Math.floor((durSec * 1000) / 2000)),
        );
        const thumbs: string[] = [];
        for (let i = 0; i < count; i += 1) {
          const t = durSec * (i / Math.max(1, count - 1));
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked, { once: true });
            video.currentTime = Math.max(0, Math.min(t, durSec - 0.05));
          });
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbs.push(canvas.toDataURL("image/webp", 0.5));

          // Incrementally update state so frames appear progressively
          if (i % 5 === 0 || i === count - 1) {
            setThumbnailsByAsset((prev) => ({
              ...prev,
              [assetId]: [...thumbs],
            }));
          }

          // Yield to the main thread to prevent UI freezing
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } catch (error) {
        console.warn(`Thumbnail extraction failed for asset ${assetId}`, error);
      } finally {
        setExtractingAssets((prev) => ({ ...prev, [assetId]: false }));
      }
    },
    [],
  );

  useEffect(() => {
    if (Object.keys(assetsById).length === 0) return;
    let cancelled = false;
    let primaryTimer: ReturnType<typeof setTimeout> | null = null;

    // OPTIMIZATION: Only extract the primary/active video immediately
    // Defer extracting other videos until user scrolls/interacts with them
    const primaryAsset = Object.values(assetsById).find(
      (a) => a.id === sourceUrl?.slice(-36),
    ); // rough match
    const videoAssets = Object.values(assetsById).filter(
      (a) => a.assetType === "VIDEO" && a.url && !thumbnailsByAsset[a.id],
    );

    // Extract primary video immediately
    if (
      primaryAsset?.assetType === "VIDEO" &&
      primaryAsset.url &&
      !thumbnailsByAsset[primaryAsset.id]
    ) {
      primaryTimer = setTimeout(() => {
        if (!cancelled) {
          void extractThumbnailsForAsset(
            primaryAsset.id,
            primaryAsset.url,
            primaryAsset.durationMs || durationMs,
          );
        }
      }, 0);
    }

    // Defer other video extractions to prioritize UI responsiveness
    // Queue them with throttling to avoid excessive parallel decoding
    const queue = videoAssets.filter((a) => a.id !== primaryAsset?.id);
    if (queue.length > 0) {
      const timer = setTimeout(() => {
        let index = 0;
        const processNext = () => {
          if (index < queue.length && !cancelled) {
            const asset = queue[index];
            void extractThumbnailsForAsset(
              asset.id,
              asset.url,
              asset.durationMs || durationMs,
            ).then(() => {
              index++;
              // Space out extractions to avoid UI lag
              setTimeout(processNext, 300);
            });
          }
        };
        processNext();
      }, 500); // Start after initial render completes

      return () => {
        cancelled = true;
        if (primaryTimer) {
          clearTimeout(primaryTimer);
        }
        clearTimeout(timer);
      };
    }

    if (sourceUrl && durationMs > 0 && waveformData.length === 0) {
      const extractWaveform = async () => {
        try {
          const response = await fetch(sourceUrl);
          const data = await response.arrayBuffer();
          const audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(data.slice(0));
          const channelData = audioBuffer.getChannelData(0);
          const bins = 240;
          const blockSize = Math.max(1, Math.floor(channelData.length / bins));
          const points = Array.from({ length: bins }, (_, i) => {
            const start = i * blockSize;
            const end = Math.min(channelData.length, start + blockSize);
            let sum = 0;
            for (let j = start; j < end; j += 1)
              sum += Math.abs(channelData[j]);
            return sum / Math.max(1, end - start);
          });
          const max = Math.max(...points, 0.0001);
          if (!cancelled) setWaveformData(points.map((p) => p / max));
          void audioCtx.close();
        } catch (error) {
          console.warn("Waveform extraction failed", error);
          if (!cancelled) setWaveformData([]);
        }
      };
      void extractWaveform();
    }

    return () => {
      cancelled = true;
      if (primaryTimer) {
        clearTimeout(primaryTimer);
      }
    };
  }, [
    assetsById,
    sourceUrl,
    durationMs,
    thumbnailsByAsset,
    waveformData.length,
    extractThumbnailsForAsset,
  ]);

  return {
    thumbnailsByAsset,
    waveformData,
    extractThumbnailsForAsset,
    extractingAssets,
  };
}
