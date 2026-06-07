import { useEffect, useRef, useState, useMemo } from "react";
import type { LayoutPreset, ReframeSettings } from "../../types";
import { getParticipantColor } from "../../types";

interface ParticipantVideoSource {
  participantKey: string;
  displayName: string;
  url: string;
  framing: ReframeSettings;
  hidden: boolean;
}

interface MulticamVideoOptions {
  sources: ParticipantVideoSource[];
  currentTimeMs: number;
  isPlaying: boolean;
  activeLayout: LayoutPreset;
  activeAngle: string | null;
  showSpeakerLabels: boolean;
  stageWidth: number;
  stageHeight: number;
  onTimeUpdate?: (timeMs: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function computeLayout(
  activeLayout: LayoutPreset,
  visibleCount: number,
  w: number,
  h: number,
): LayoutRect[] {
  if (visibleCount === 0) return [];

  switch (activeLayout) {
    case "single":
      return [{ x: 0, y: 0, w, h }];

    case "pip": {
      if (visibleCount < 2) return [{ x: 0, y: 0, w, h }];
      const pipW = Math.round(w * 0.25);
      const pipH = Math.round(pipW * (9 / 16));
      const rects: LayoutRect[] = [];
      rects.push({ x: 0, y: 0, w, h });
      for (let i = 1; i < visibleCount; i++) {
        const offsetX = w - pipW - 16;
        const offsetY = 16 + (i - 1) * (pipH + 8);
        rects.push({
          x: offsetX,
          y: Math.min(offsetY, h - pipH - 16),
          w: pipW,
          h: pipH,
        });
      }
      return rects;
    }

    case "split": {
      if (visibleCount < 2) return [{ x: 0, y: 0, w, h }];
      const count = Math.min(visibleCount, 4);
      const cols = count <= 2 ? count : 2;
      const rows = Math.ceil(count / cols);
      const cw = Math.round(w / cols);
      const ch = Math.round(h / rows);
      const rects: LayoutRect[] = [];
      for (let i = 0; i < count; i++) {
        rects.push({
          x: (i % cols) * cw,
          y: Math.floor(i / cols) * ch,
          w: cw,
          h: ch,
        });
      }
      return rects;
    }

    case "grid": {
      const count = Math.min(visibleCount, 9);
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const cw = Math.round(w / cols);
      const ch = Math.round(h / rows);
      const rects: LayoutRect[] = [];
      for (let i = 0; i < count; i++) {
        rects.push({
          x: (i % cols) * cw,
          y: Math.floor(i / cols) * ch,
          w: cw,
          h: ch,
        });
      }
      return rects;
    }

    default:
      return [{ x: 0, y: 0, w, h }];
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSpeakerLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  rect: LayoutRect,
) {
  const fontSize = Math.max(11, Math.round(rect.h * 0.035));
  const padding = 6;
  const labelH = fontSize + padding * 2;
  const labelY = rect.y + rect.h - labelH - 4;

  ctx.save();
  ctx.globalAlpha = 0.85;
  const grad = ctx.createLinearGradient(
    rect.x,
    labelY,
    rect.x,
    labelY + labelH,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.15, "rgba(0,0,0,0.7)");
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, labelY, rect.w, labelH);
  ctx.restore();

  const dotSize = 6;
  ctx.beginPath();
  ctx.arc(
    rect.x + 12 + dotSize / 2,
    labelY + labelH / 2,
    dotSize / 2,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = color;
  ctx.fill();

  ctx.save();
  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(name, rect.x + 24, labelY + labelH / 2);
  ctx.restore();
}

function drawPlaceholderFrame(
  ctx: CanvasRenderingContext2D,
  displayName: string,
  color: string,
  rect: LayoutRect,
) {
  const { x, y, w, h } = rect;

  ctx.save();
  ctx.fillStyle = "#1a1a1a";
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fill();

  const circleR = Math.min(w, h) * 0.12;
  const cx = x + w / 2;
  const cy = y + h / 2 - circleR * 0.4;

  ctx.beginPath();
  ctx.arc(cx, cy, circleR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const initial = displayName.charAt(0).toUpperCase();
  const fontSize = Math.round(circleR * 0.75);
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initial, cx, cy);

  ctx.font = `${Math.round(circleR * 0.4)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(displayName, cx, y + h - Math.round(h * 0.12));

  ctx.restore();
}

export function useMulticamVideo(options: MulticamVideoOptions) {
  const {
    sources,
    currentTimeMs,
    isPlaying,
    activeLayout,
    activeAngle,
    showSpeakerLabels,
    stageWidth,
    stageHeight,
    onTimeUpdate,
    onPlayStateChange,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedCountRef = useRef(0);
  const totalSourcesRef = useRef(0);

  const visibleSources = useMemo(
    () => sources.filter((s) => !s.hidden && s.url),
    [sources],
  );

  const layoutRects = useMemo(
    () =>
      computeLayout(
        activeLayout,
        visibleSources.length,
        stageWidth,
        stageHeight,
      ),
    [activeLayout, visibleSources.length, stageWidth, stageHeight],
  );

  const angleIndex = useMemo(
    () =>
      activeAngle
        ? visibleSources.findIndex((s) => s.participantKey === activeAngle)
        : -1,
    [activeAngle, visibleSources],
  );

  // Manage video elements
  useEffect(() => {
    videoRefs.current.forEach((video, key) => {
      if (!sources.find((s) => s.participantKey === key)) {
        video.pause();
        video.src = "";
        video.load();
        video.remove();
        videoRefs.current.delete(key);
      }
    });

    totalSourcesRef.current = sources.length;
    loadedCountRef.current = 0;

    sources.forEach((source) => {
      if (videoRefs.current.has(source.participantKey)) return;

      const video = document.createElement("video");
      video.playsInline = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.style.position = "absolute";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";

      video.addEventListener("loadedmetadata", () => {
        loadedCountRef.current++;
        if (loadedCountRef.current >= totalSourcesRef.current) {
          setIsLoaded(true);
        }
      });

      video.addEventListener("canplay", () => {
        setIsLoaded(true);
      });

      video.src = source.url;
      video.load();

      document.body.appendChild(video);
      videoRefs.current.set(source.participantKey, video);
    });

    const refs = videoRefs.current;
    return () => {
      refs.forEach((video) => {
        video.pause();
        video.src = "";
        video.load();
        video.remove();
      });
      refs.clear();
      setIsLoaded(false);
    };
  }, [sources]);

  // Sync time across all videos
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      const currentSec = video.currentTime * 1000;
      if (Math.abs(currentSec - currentTimeMs) > 150) {
        video.currentTime = currentTimeMs / 1000;
      }
    });
  }, [currentTimeMs]);

  // Sync play/pause
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (isPlaying && video.paused) {
        video.play().catch(() => {});
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    });
  }, [isPlaying]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stopLoopRef.current?.();

    let running = true;
    let animId = 0;

    const cvs = canvas;
    const c = ctx;

    function render() {
      if (!running) return;

      c.clearRect(0, 0, cvs.width, cvs.height);

      if (activeLayout === "single" && angleIndex >= 0) {
        const source = visibleSources[angleIndex];
        const video = videoRefs.current.get(source.participantKey);
        if (video && video.readyState >= 2) {
          const { framing } = source;
          const cropW = video.videoWidth * framing.cropW;
          const cropH = video.videoHeight * framing.cropH;
          const cropX = video.videoWidth * framing.cropX;
          const cropY = video.videoHeight * framing.cropY;
          c.drawImage(
            video,
            cropX,
            cropY,
            cropW,
            cropH,
            0,
            0,
            cvs.width,
            cvs.height,
          );

          if (showSpeakerLabels) {
            drawSpeakerLabel(
              c,
              source.displayName,
              getParticipantColor(angleIndex),
              {
                x: 0,
                y: 0,
                w: cvs.width,
                h: cvs.height,
              },
            );
          }
        } else {
          drawPlaceholderFrame(
            c,
            source.displayName,
            getParticipantColor(angleIndex),
            { x: 0, y: 0, w: cvs.width, h: cvs.height },
          );
        }
      } else {
        for (let i = 0; i < visibleSources.length; i++) {
          const source = visibleSources[i];
          const video = videoRefs.current.get(source.participantKey);
          const rect = layoutRects[i];
          if (!rect) continue;

          const sx = (rect.x / stageWidth) * cvs.width;
          const sy = (rect.y / stageHeight) * cvs.height;
          const sw = (rect.w / stageWidth) * cvs.width;
          const sh = (rect.h / stageHeight) * cvs.height;

          if (video && video.readyState >= 2) {
            const { framing } = source;
            const cropW = video.videoWidth * framing.cropW;
            const cropH = video.videoHeight * framing.cropH;
            const cropX = video.videoWidth * framing.cropX;
            const cropY = video.videoHeight * framing.cropY;
            c.drawImage(video, cropX, cropY, cropW, cropH, sx, sy, sw, sh);
          } else {
            drawPlaceholderFrame(
              c,
              source.displayName,
              getParticipantColor(i),
              {
                x: sx,
                y: sy,
                w: sw,
                h: sh,
              },
            );
          }

          if (showSpeakerLabels) {
            drawSpeakerLabel(
              c,
              source.displayName,
              getParticipantColor(i),
              rect,
            );
          }
        }

        // Highlight active angle when in layout mode
        if (
          activeLayout !== "single" &&
          angleIndex >= 0 &&
          angleIndex < visibleSources.length
        ) {
          const rect = layoutRects[angleIndex];
          if (rect) {
            const sx = (rect.x / stageWidth) * cvs.width;
            const sy = (rect.y / stageHeight) * cvs.height;
            const sw = (rect.w / stageWidth) * cvs.width;
            const sh = (rect.h / stageHeight) * cvs.height;
            c.save();
            c.strokeStyle = "#f5a623";
            c.lineWidth = 3;
            c.strokeRect(sx, sy, sw, sh);
            c.restore();
          }
        }
      }

      const firstVideo = videoRefs.current.values().next().value;
      if (firstVideo) {
        onTimeUpdate?.(firstVideo.currentTime * 1000);
      }

      animId = requestAnimationFrame(render);
    }

    render();

    return () => {
      running = false;
      cancelAnimationFrame(animId);
    };
  }, [
    visibleSources,
    activeLayout,
    angleIndex,
    showSpeakerLabels,
    layoutRects,
    stageWidth,
    stageHeight,
    onTimeUpdate,
  ]);

  useEffect(() => {
    onPlayStateChange?.(isPlaying);
  }, [isPlaying, onPlayStateChange]);

  return {
    canvasRef,
    containerRef,
    isLoaded,
  };
}
