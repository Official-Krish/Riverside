import { useEffect, useRef, useState, useCallback } from "react";
import { startRenderLoop, drawSingleFrame } from "../utils/RenderLoop";
import type { RenderState, RenderOverlay } from "../utils/RenderLoop";
import type { Overlay, ClipTransition } from "../../types";

export interface ActiveTransitionInfo {
  type: ClipTransition;
  progress: number;
  position?: "start" | "end";
  sourceVideo?: HTMLVideoElement;
  targetVideo?: HTMLVideoElement;
}

export interface UseCanvasVideoOptions {
  currentTime?: number; // ms — seek target from editor
  isPlaying?: boolean;
  onTimeUpdate?: (timeMs: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  overlays?: Overlay[];
  timelineTimeMs?: number;
  videoAlpha?: number;
  audioClips?: Array<{
    assetId: string;
    url: string;
    timelineStartMs: number;
    durationMs: number;
    sourceStartMs: number;
    muted?: boolean;
    volume?: number;
    audioMode?: "replace" | "layer";
  }>;
  /** Active transition state computed by useActiveTransition hook */
  activeTransition?: ActiveTransitionInfo | null;
  stageWidth?: number;
  stageHeight?: number;
}

export function useCanvasVideo(
  src: string,
  options: UseCanvasVideoOptions = {},
) {
  const {
    currentTime,
    isPlaying,
    onTimeUpdate,
    onPlayStateChange,
    overlays = [],
    timelineTimeMs = 0,
    videoAlpha = 1,
    audioClips = [],
    activeTransition = null,
    stageWidth = 1920,
    stageHeight = 1080,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const isSeekingInternalRef = useRef(false);
  const prevSrcRef = useRef<string>("");

  // Transform state
  const [stretchX, setStretchX] = useState(1);
  const [stretchY, setStretchY] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  // Trim
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  // Internal state
  const [duration, setDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  // Keep refs for state getters (avoids stale closures in render loop)
  const transformRef = useRef<RenderState>({
    stretchX: 1,
    stretchY: 1,
    offsetX: 0,
    offsetY: 0,
    trimStart: 0,
    trimEnd: 0,
    videoAlpha: 1,
  });

  const activeTransitionRef = useRef<ActiveTransitionInfo | null>(null);

  const overlaysRef = useRef<Overlay[]>([]);
  const timelineTimeMsRef = useRef(0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayStateChangeRef = useRef(onPlayStateChange);

  const getActiveAudioClip = useCallback(
    (timeMs: number) => {
      return (
        audioClips.find(
          (clip) =>
            timeMs >= clip.timelineStartMs &&
            timeMs < clip.timelineStartMs + clip.durationMs,
        ) ?? null
      );
    },
    [audioClips],
  );

  // Update refs synchronously during render (no effects needed for refs)
  activeTransitionRef.current = activeTransition ?? null;
  transformRef.current = {
    stretchX,
    stretchY,
    offsetX,
    offsetY,
    trimStart,
    trimEnd,
    videoAlpha,
    activeTransition: activeTransitionRef.current
      ? {
          type: activeTransitionRef.current.type,
          progress: activeTransitionRef.current.progress,
          position: activeTransitionRef.current.position,
          sourceVideo: activeTransitionRef.current.sourceVideo,
          targetVideo: activeTransitionRef.current.targetVideo,
        }
      : undefined,
  };
  overlaysRef.current = overlays;
  timelineTimeMsRef.current = timelineTimeMs;
  onTimeUpdateRef.current = onTimeUpdate;
  onPlayStateChangeRef.current = onPlayStateChange;

  // ─── Helpers ──────────────────────────────────────────────────────
  const getVisibleOverlays = useCallback((): RenderOverlay[] => {
    const tMs = timelineTimeMsRef.current;
    return overlaysRef.current
      .filter(
        (o) =>
          tMs >= o.timelineStartMs && tMs <= o.timelineStartMs + o.durationMs,
      )
      .map((overlay) => ({ overlay, timelineTimeMs: tMs }));
  }, []);

  const startLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Stop any previous loop
    stopLoopRef.current?.();

    const stop = startRenderLoop(
      ctx,
      video,
      canvas,
      () => transformRef.current,
      () => getVisibleOverlays(),
      (videoTimeMs) => {
        setVideoCurrentTime(videoTimeMs / 1000);
        onTimeUpdateRef.current?.(videoTimeMs);
      },
      stageWidth,
      stageHeight,
    );

    stopLoopRef.current = stop;
  }, [getVisibleOverlays, stageHeight, stageWidth]);

  const drawCurrentFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const activeOverlays = getVisibleOverlays();
    drawSingleFrame(
      ctx,
      video,
      canvas,
      transformRef.current,
      activeOverlays,
      stageWidth,
      stageHeight,
    );
  }, [getVisibleOverlays, stageHeight, stageWidth]);

  const syncExternalAudio = useCallback(async () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const isActuallyPlaying = !video.paused; // Source of truth from DOM
    const activeAudioClip = getActiveAudioClip(timelineTimeMsRef.current);
    const shouldReplaceSourceAudio = Boolean(
      activeAudioClip && (activeAudioClip.audioMode ?? "replace") === "replace",
    );

    if (!activeAudioClip || !isActuallyPlaying) {
      audio.pause();
      video.muted = shouldReplaceSourceAudio ? true : muted;
      return;
    }

    // Only change audio src if it's different (avoid redundant load() calls)
    const timelineOffsetMs =
      timelineTimeMsRef.current - activeAudioClip.timelineStartMs;
    const nextAudioTime = Math.max(
      0,
      (activeAudioClip.sourceStartMs + timelineOffsetMs) / 1000,
    );

    // If URL changed, set up a one-time loadeddata handler before attempting to seek/play.
    if (audio.src !== activeAudioClip.url) {
      // Pause and reset to avoid artifacts while loading new source
      try {
        audio.pause();
      } catch (_error) {
        /* ignore pause race */
      }
      audio.src = activeAudioClip.url;

      const handleLoaded = () => {
        audio.removeEventListener("loadeddata", handleLoaded);
        // Only seek if the target time differs meaningfully
        if (
          Number.isFinite(nextAudioTime) &&
          Math.abs((audio.currentTime || 0) - nextAudioTime) > 0.5
        ) {
          try {
            audio.currentTime = nextAudioTime;
          } catch (_error) {
            /* ignore invalid seek while loading */
          }
        }
        audio.volume = Math.max(0, Math.min(1, activeAudioClip.volume ?? 1));
        audio.muted = Boolean(activeAudioClip.muted);
        // Attempt to play; if blocked, user gesture will resume
        void audio.play().catch(() => {});
      };

      audio.addEventListener("loadeddata", handleLoaded, { once: true });
      // Trigger load by setting src; some browsers auto-load with src assignment
      try {
        audio.load();
      } catch (_error) {
        /* ignore load errors for external audio */
      }
    } else {
      // Same URL: only adjust playback time if audio is ready
      if (audio.readyState >= 2) {
        if (
          Number.isFinite(nextAudioTime) &&
          Math.abs((audio.currentTime || 0) - nextAudioTime) > 0.5
        ) {
          try {
            audio.currentTime = nextAudioTime;
          } catch (_error) {
            /* ignore minor seek failures */
          }
        }
        audio.volume = Math.max(0, Math.min(1, activeAudioClip.volume ?? 1));
        audio.muted = Boolean(activeAudioClip.muted);
        try {
          await audio.play();
        } catch (_error) {
          /* autoplay restrictions are expected */
        }
      } else {
        // Not ready yet: wait for loadeddata then continue in handler to avoid seeks that cause crackle
        const onReady = () => {
          audio.removeEventListener("loadeddata", onReady);
          try {
            if (
              Number.isFinite(nextAudioTime) &&
              Math.abs((audio.currentTime || 0) - nextAudioTime) > 0.5
            ) {
              audio.currentTime = nextAudioTime;
            }
            audio.volume = Math.max(
              0,
              Math.min(1, activeAudioClip.volume ?? 1),
            );
            audio.muted = Boolean(activeAudioClip.muted);
            void audio.play();
          } catch (_error) {
            /* ignore stale loadeddata handler races */
          }
        };
        audio.addEventListener("loadeddata", onReady, { once: true });
      }
    }

    if (shouldReplaceSourceAudio) {
      video.muted = true;
    } else {
      video.muted = muted;
    }
  }, [getActiveAudioClip, muted]);

  // Stable refs for startLoop / getVisibleOverlays so the heavy source-switching
  // effect only re-runs when `src` actually changes (not on every re-render).
  const startLoopRef = useRef(startLoop);
  startLoopRef.current = startLoop;
  const getVisibleOverlaysRef = useRef(getVisibleOverlays);
  getVisibleOverlaysRef.current = getVisibleOverlays;
  const syncExternalAudioRef = useRef(syncExternalAudio);
  syncExternalAudioRef.current = syncExternalAudio;

  // ─── Source switching + Event listeners (merged to avoid mount-order issues) ───
  // This effect re-runs ONLY when `src` changes. All other callback dependencies
  // are accessed through refs to avoid re-running the effect and losing listeners.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Stop any existing render loop
    stopLoopRef.current?.();
    stopLoopRef.current = null;

    // If src is empty, just reset state
    if (!src) {
      setIsLoaded(false);
      prevSrcRef.current = "";
      return;
    }

    setIsLoaded(false);
    prevSrcRef.current = src;

    // ─── Event handlers ─────────────────────────────────────────
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoaded(true);
      // Draw first frame
      const canvas = canvasRef.current;
      if (canvas) {
        // Ensure canvas has dimensions
        if (canvas.width === 0 || canvas.height === 0) {
          const dpr = window.devicePixelRatio || 1;
          canvas.width = stageWidth * dpr;
          canvas.height = stageHeight * dpr;
          canvas.style.width = `${stageWidth}px`;
          canvas.style.height = `${stageHeight}px`;
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawSingleFrame(
            ctx,
            video,
            canvas,
            transformRef.current,
            undefined,
            stageWidth,
            stageHeight,
          );
        }
      }
    };

    const handleLoadedData = () => {
      setDuration(video.duration);
      setIsLoaded(true);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawSingleFrame(
            ctx,
            video,
            canvas,
            transformRef.current,
            undefined,
            stageWidth,
            stageHeight,
          );
        }
      }
    };

    const handleCanPlay = () => {
      // Also mark as loaded on canplay — covers edge cases where
      // loadeddata fires before the effect attaches listeners.
      setIsLoaded(true);
      if (video.paused) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            drawSingleFrame(
              ctx,
              video,
              canvas,
              transformRef.current,
              undefined,
              stageWidth,
              stageHeight,
            );
          }
        }
      }
    };

    const handlePlay = () => {
      onPlayStateChangeRef.current?.(true);
      startLoopRef.current();
      // Let DOM settle to ensure video.paused has flipped to false before syncExternalAudio reads it
      setTimeout(() => void syncExternalAudioRef.current(), 0);
    };

    const handlePause = () => {
      onPlayStateChangeRef.current?.(false);
      stopLoopRef.current?.();
      stopLoopRef.current = null;
      audioRef.current?.pause();
      // Draw a single frame so the canvas isn't blank
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const activeOverlays = getVisibleOverlaysRef.current();
          drawSingleFrame(
            ctx,
            video,
            canvas,
            transformRef.current,
            activeOverlays,
            stageWidth,
            stageHeight,
          );
        }
      }
    };

    const handleSeeked = () => {
      isSeekingInternalRef.current = false;
      // Redraw frame at new position
      const canvas = canvasRef.current;
      if (canvas && video.paused) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const activeOverlays = getVisibleOverlaysRef.current();
          drawSingleFrame(
            ctx,
            video,
            canvas,
            transformRef.current,
            activeOverlays,
            stageWidth,
            stageHeight,
          );
        }
      }
    };

    const handleEnded = () => {
      onPlayStateChangeRef.current?.(false);
      stopLoopRef.current?.();
      stopLoopRef.current = null;
      audioRef.current?.pause();
    };

    const handleTimeUpdate = () => {
      // Fallback time update for when rAF loop isn't running
      onTimeUpdateRef.current?.(video.currentTime * 1000);
    };

    // ─── Attach listeners ───────────────────────────────────────
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", handleTimeUpdate);

    // ─── Set source ─────────────────────────────────────────────
    video.src = src;
    video.load();

    // ─── Handle already-loaded video (race condition safety) ────
    // If the video has already loaded (readyState >= 2) by the time
    // this effect runs, the loadeddata/canplay events won't fire again.
    // Detect this and set isLoaded immediately.
    const checkAlreadyLoaded = () => {
      if (video.readyState >= 2) {
        setDuration(video.duration);
        setIsLoaded(true);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            drawSingleFrame(
              ctx,
              video,
              canvas,
              transformRef.current,
              undefined,
              stageWidth,
              stageHeight,
            );
          }
        }
      }
    };

    // Check synchronously (video may be cached)
    checkAlreadyLoaded();

    // Also check after a microtask — handles the case where load() triggers
    // synchronous readyState update in some browsers
    const raf = requestAnimationFrame(checkAlreadyLoaded);

    // Fallback timeout in case all events are missed
    const fallbackTimeout = setTimeout(() => {
      if (video.readyState >= 1) {
        setDuration(video.duration);
        setIsLoaded(true);
      }
    }, 5000);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      cancelAnimationFrame(raf);
      clearTimeout(fallbackTimeout);
      stopLoopRef.current?.();
    };
  }, [src]);

  useEffect(() => {
    void syncExternalAudio();
    // Only sync on audioClips changes — not on every timelineTimeMs tick (60fps)
    // to avoid constant audio restarts during playback
  }, [syncExternalAudio, audioClips]);

  // ─── Sync play/pause from editor ──────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isPlaying === undefined || !isLoaded) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
    }
    if (!isPlaying && !video.paused) {
      video.pause();
    }
  }, [isPlaying, isLoaded]);

  // ─── Sync seek from editor ────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || currentTime == null || !isLoaded) return;

    const currentMs = video.currentTime * 1000;
    if (Math.abs(currentMs - currentTime) > 150) {
      isSeekingInternalRef.current = true;
      video.currentTime = currentTime / 1000;
    }
  }, [currentTime, isLoaded]);

  // ─── Redraw on transform change (when paused) ────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.paused || !isLoaded) return;
    drawCurrentFrame();
  }, [
    stretchX,
    stretchY,
    offsetX,
    offsetY,
    videoAlpha,
    drawCurrentFrame,
    isLoaded,
  ]);

  // ─── Redraw on overlay change (when paused) ───────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.paused || !isLoaded) return;
    drawCurrentFrame();
  }, [overlays, timelineTimeMs, isLoaded, drawCurrentFrame]);

  // ─── Actions ──────────────────────────────────────────────────────
  const actions = {
    play: useCallback(() => {
      videoRef.current?.play().catch(() => {});
    }, []),
    pause: useCallback(() => {
      videoRef.current?.pause();
    }, []),
    toggle: useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }, []),
    seek: useCallback((sec: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime += sec;
    }, []),
    setTime: useCallback((t: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = t;
    }, []),
    setVolume: useCallback((vol: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.volume = vol;
      setVolumeState(vol);
    }, []),
    toggleMute: useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !v.muted;
      setMutedState(v.muted);
    }, []),
    setPlaybackRate: useCallback((r: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.playbackRate = r;
      setPlaybackRateState(r);
    }, []),
    fullscreen: useCallback(() => {
      canvasRef.current?.requestFullscreen?.();
    }, []),
  };

  const state = {
    duration,
    currentTime: videoCurrentTime,
    volume,
    muted,
    playbackRate,
    isLoaded,
    paused: !isPlaying,
  };

  const transform = {
    stretchX,
    stretchY,
    offsetX,
    offsetY,
    setStretchX,
    setStretchY,
    setOffsetX,
    setOffsetY,
    reset: useCallback(() => {
      setStretchX(1);
      setStretchY(1);
      setOffsetX(0);
      setOffsetY(0);
    }, []),
  };

  const trim = {
    trimStart,
    trimEnd,
    setTrimStart,
    setTrimEnd,
  };

  return {
    videoRef,
    audioRef,
    canvasRef,
    state,
    actions,
    transform,
    trim,
  };
}
