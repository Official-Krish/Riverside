import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Maximize2,
  Monitor,
  User,
  Layout as LayoutIcon,
} from "lucide-react";

type PreviewMode = "program" | "angle" | "layout";

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isLoaded: boolean;
  activeAngle: string | null;
  activeLayout: "single" | "pip" | "split" | "grid";
  participantCount: number;
  onDoubleClickFullscreen?: () => void;
}

export function MulticamPreview({
  canvasRef,
  isLoaded,
  activeAngle,
  activeLayout,
  participantCount,
  onDoubleClickFullscreen,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("program");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;
      const aspectRatio = 16 / 9;
      let w = containerW;
      let h = containerW / aspectRatio;
      if (h > containerH) {
        h = containerH;
        w = containerH * aspectRatio;
      }
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

  const modeLabel =
    previewMode === "program"
      ? `${activeLayout === "single" ? "Camera" : activeLayout.toUpperCase()}`
      : previewMode === "angle"
        ? "Angle View"
        : "Layout Preview";

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="block"
          onDoubleClick={onDoubleClickFullscreen}
          style={{ cursor: "pointer" }}
        />
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#f5a623]" />
            <span className="text-xs text-[#bfa873] font-medium tracking-wide">
              Loading participant videos...
            </span>
          </div>
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none z-1"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.15) 100%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-black/20 to-transparent pointer-events-none z-1" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-black/30 to-transparent pointer-events-none z-1" />

      {/* Mode selector bar */}
      <div
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 px-1.5 py-1 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={() => setPreviewMode("program")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
            previewMode === "program"
              ? "bg-[#f5a623]/20 text-[#f5a623]"
              : "text-white/60 hover:text-white/90"
          }`}
        >
          <Monitor className="h-3 w-3" />
          Program
        </button>
        <button
          onClick={() => setPreviewMode("angle")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
            previewMode === "angle"
              ? "bg-[#f5a623]/20 text-[#f5a623]"
              : "text-white/60 hover:text-white/90"
          }`}
        >
          <User className="h-3 w-3" />
          Angle
        </button>
        <button
          onClick={() => setPreviewMode("layout")}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
            previewMode === "layout"
              ? "bg-[#f5a623]/20 text-[#f5a623]"
              : "text-white/60 hover:text-white/90"
          }`}
        >
          <LayoutIcon className="h-3 w-3" />
          Layout
        </button>
      </div>

      {/* Status badge */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-black/50 backdrop-blur-sm px-2 py-1">
          <span className="text-[10px] text-white/70 font-medium">
            {modeLabel}
          </span>
          {activeAngle && (
            <>
              <span className="text-white/30">•</span>
              <span className="text-[10px] text-[#f5a623] font-medium">
                {activeAngle.slice(0, 8)}
              </span>
            </>
          )}
          <span className="text-white/30">•</span>
          <span className="text-[10px] text-white/50">
            {participantCount} cam{participantCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Fullscreen button */}
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
