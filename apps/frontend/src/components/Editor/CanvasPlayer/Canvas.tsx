import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2 } from "lucide-react";
import type { PresetType } from "../types";

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  isLoaded?: boolean;
  onClickToggle?: () => void;
  onDoubleClickFullscreen?: () => void;
  preset?: PresetType | null;
  previewFilter?: string;
};

export default function CanvasPlayer({
  canvasRef,
  videoRef,
  audioRef,
  isLoaded = true,
  onClickToggle,
  onDoubleClickFullscreen,
  preset,
  previewFilter,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize canvas to fill container while maintaining 16:9 aspect
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;

      // Fit 16:9 inside container
      const aspectRatio = 16 / 9;
      let w = containerW;
      let h = containerW / aspectRatio;

      if (h > containerH) {
        h = containerH;
        w = containerH * aspectRatio;
      }

      // Use device pixel ratio for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${Math.round(w)}px`;
      canvas.style.height = `${Math.round(h)}px`;
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [canvasRef]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 2500);
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Canvas — centered in container */}
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="block"
          onClick={onClickToggle}
          onDoubleClick={onDoubleClickFullscreen}
          style={{ cursor: "pointer", filter: previewFilter || undefined }}
        />
      </div>

      {/* Hidden video element — source for canvas rendering */}
      <video
        ref={videoRef}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          left: 0,
          top: 0,
        }}
      />

      {/* Hidden audio element — source for external audio playback */}
      <audio
        ref={audioRef}
        preload="auto"
        crossOrigin="anonymous"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          left: 0,
          top: 0,
        }}
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#f5a623]" />
            <span className="text-xs text-[#bfa873] font-medium tracking-wide">
              Loading video...
            </span>
          </div>
        </div>
      )}

      {/* Vignette overlay for premium feel */}
      <div
        className="absolute inset-0 pointer-events-none z-1"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)",
        }}
      />

      {/* Subtle top/bottom bars */}
      <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-black/20 to-transparent pointer-events-none z-1" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/30 to-transparent pointer-events-none z-1" />

      {/* Preset Effects Overlay */}
      {preset && (
        <div className="absolute inset-0 pointer-events-none z-5">
          {/* Cinematic Bars (Letterbox) */}
          {preset === "cinematic-bars" && (
            <>
              <div className="absolute inset-x-0 top-0 h-1/4 bg-black" />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-black" />
            </>
          )}

          {/* VHS Effect */}
          {preset === "vhs" && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{
                background:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 1px, transparent 1px, transparent 2px)",
                mixBlendMode: "overlay",
              }}
            />
          )}

          {/* Glitch Effect - RGB Split */}
          {preset === "glitch" && (
            <>
              <div
                className="absolute inset-0 bg-red-500/10 mix-blend-screen animate-pulse"
                style={{ animationDuration: "0.1s" }}
              />
              <div
                className="absolute inset-0 bg-blue-500/10 mix-blend-screen animate-pulse"
                style={{ animationDuration: "0.15s", animationDelay: "0.05s" }}
              />
              <div
                className="absolute inset-0 bg-green-500/5 mix-blend-screen animate-pulse"
                style={{ animationDuration: "0.12s", animationDelay: "0.02s" }}
              />
            </>
          )}

          {/* Shake Effect - Border Animation */}
          {preset === "shake" && (
            <div className="absolute inset-0 border-4 border-orange-500/30 animate-pulse" />
          )}

          {/* Zoom Pop Effect - Subtle scale pulse */}
          {preset === "zoom-pop" && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-500/10 to-transparent animate-pulse" />
          )}

          {/* Chromakey Indicator */}
          {preset === "chromakey" && (
            <div className="absolute inset-0 border-4 border-emerald-500/40">
              <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500/80 text-white text-[10px] rounded">
                Green Screen
              </div>
            </div>
          )}

          {/* Intro Template */}
          {preset === "intro-template" && (
            <div className="absolute inset-0 border-4 border-green-500/30">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 bg-green-500/20 text-green-400 text-xs rounded">
                INTRO
              </div>
            </div>
          )}

          {/* Meme Format */}
          {preset === "meme-format" && (
            <div className="absolute inset-0 border-4 border-yellow-500/30">
              <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/80 text-black text-[10px] rounded font-bold">
                TOP TEXT
              </div>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-yellow-500/80 text-black text-[10px] rounded font-bold">
                BOTTOM TEXT
              </div>
            </div>
          )}

          {/* Podcast Layout */}
          {preset === "podcast-layout" && (
            <div className="absolute inset-0 border-4 border-pink-500/30">
              <div className="absolute top-2 left-2 w-20 h-20 bg-pink-500/20 rounded-lg" />
              <div className="absolute bottom-2 right-2 w-16 h-16 bg-pink-500/20 rounded-lg" />
              <div className="absolute top-2 right-2 px-2 py-1 bg-pink-500/80 text-white text-[10px] rounded">
                PODCAST
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen button (appears on hover) */}
      <button
        onClick={onDoubleClickFullscreen}
        className={`absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg
          bg-black/50 text-white/70 backdrop-blur-sm border border-white/10
          transition-all duration-300 hover:bg-black/70 hover:text-white hover:scale-105
          ${showControls ? "opacity-100" : "opacity-0"}`}
        title="Fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
