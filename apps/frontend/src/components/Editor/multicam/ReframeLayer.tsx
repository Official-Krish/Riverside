import { useRef, useState, useCallback, useEffect } from "react";
import type { ReframeSettings } from "../types";

interface Props {
  participantKey: string | null;
  framing: ReframeSettings;
  onChange: (participantKey: string, framing: ReframeSettings) => void;
  canvasWidth: number;
  canvasHeight: number;
}

const ZOOM_PRESETS: {
  label: string;
  value: ReframeSettings["zoomPreset"];
  framing: ReframeSettings;
}[] = [
  {
    label: "Head",
    value: "head",
    framing: { cropX: 0, cropY: 0, cropW: 0.3, cropH: 0.3, zoomPreset: "head" },
  },
  {
    label: "Upper",
    value: "upper-body",
    framing: {
      cropX: 0,
      cropY: 0,
      cropW: 0.4,
      cropH: 0.5,
      zoomPreset: "upper-body",
    },
  },
  {
    label: "Full",
    value: "full-body",
    framing: {
      cropX: 0,
      cropY: 0,
      cropW: 0.6,
      cropH: 0.9,
      zoomPreset: "full-body",
    },
  },
  {
    label: "Custom",
    value: "custom",
    framing: { cropX: 0, cropY: 0, cropW: 1, cropH: 1, zoomPreset: "custom" },
  },
];

const HANDLE_SIZE = 10;

export function ReframeLayer({
  participantKey,
  framing,
  onChange,
  canvasWidth,
  canvasHeight,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<
    "tl" | "tr" | "bl" | "br" | null
  >(null);
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });
  const resizeStart = useRef({
    x: 0,
    y: 0,
    cropW: 0,
    cropH: 0,
    cropX: 0,
    cropY: 0,
  });

  const rectX = framing.cropX * canvasWidth;
  const rectY = framing.cropY * canvasHeight;
  const rectW = framing.cropW * canvasWidth;
  const rectH = framing.cropH * canvasHeight;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        cropX: framing.cropX,
        cropY: framing.cropY,
      };
    },
    [framing],
  );

  const handleResizeStart = useCallback(
    (corner: "tl" | "tr" | "bl" | "br") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(corner);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        cropW: framing.cropW,
        cropH: framing.cropH,
        cropX: framing.cropX,
        cropY: framing.cropY,
      };
    },
    [framing],
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = (e.clientX - dragStart.current.x) / canvasWidth;
        const dy = (e.clientY - dragStart.current.y) / canvasHeight;
        const newX = Math.max(
          0,
          Math.min(1 - framing.cropW, dragStart.current.cropX + dx),
        );
        const newY = Math.max(
          0,
          Math.min(1 - framing.cropH, dragStart.current.cropY + dy),
        );
        if (participantKey) {
          onChange(participantKey, { ...framing, cropX: newX, cropY: newY });
        }
      }

      if (isResizing) {
        const dx = (e.clientX - resizeStart.current.x) / canvasWidth;
        const dy = (e.clientY - resizeStart.current.y) / canvasHeight;
        let { cropW, cropH, cropX, cropY } = resizeStart.current;

        switch (isResizing) {
          case "br":
            cropW = Math.max(0.05, Math.min(1, resizeStart.current.cropW + dx));
            cropH = Math.max(0.05, Math.min(1, resizeStart.current.cropH + dy));
            break;
          case "bl":
            cropW = Math.max(0.05, Math.min(1, resizeStart.current.cropW - dx));
            cropX =
              resizeStart.current.cropX + (resizeStart.current.cropW - cropW);
            cropH = Math.max(0.05, Math.min(1, resizeStart.current.cropH + dy));
            break;
          case "tr":
            cropW = Math.max(0.05, Math.min(1, resizeStart.current.cropW + dx));
            cropH = Math.max(0.05, Math.min(1, resizeStart.current.cropH - dy));
            cropY =
              resizeStart.current.cropY + (resizeStart.current.cropH - cropH);
            break;
          case "tl":
            cropW = Math.max(0.05, Math.min(1, resizeStart.current.cropW - dx));
            cropX =
              resizeStart.current.cropX + (resizeStart.current.cropW - cropW);
            cropH = Math.max(0.05, Math.min(1, resizeStart.current.cropH - dy));
            cropY =
              resizeStart.current.cropY + (resizeStart.current.cropH - cropH);
            break;
        }

        if (participantKey) {
          onChange(participantKey, { ...framing, cropX, cropY, cropW, cropH });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    isResizing,
    framing,
    participantKey,
    onChange,
    canvasWidth,
    canvasHeight,
  ]);

  if (!participantKey || canvasWidth === 0 || canvasHeight === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {/* Crop rectangle */}
      <div
        className="absolute pointer-events-auto cursor-move"
        style={{
          left: rectX,
          top: rectY,
          width: rectW,
          height: rectH,
          border: "2px solid rgba(245, 166, 35, 0.8)",
          borderRadius: 2,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Dark overlay outside crop */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -rectY,
            left: -rectX,
            width: canvasWidth,
            height: canvasHeight,
            boxShadow: `inset ${rectX}px ${rectY}px 0 9999px rgba(0,0,0,0.3)`,
          }}
        />

        {/* Corner handles */}
        {(["tl", "tr", "bl", "br"] as const).map((corner) => {
          const pos = {
            tl: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
            tr: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
            bl: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 },
            br: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
          }[corner];

          return (
            <div
              key={corner}
              className="absolute pointer-events-auto z-30 bg-[#f5a623] border border-white rounded-sm"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                cursor: `${corner}-resize`,
                ...pos,
              }}
              onMouseDown={handleResizeStart(corner)}
            />
          );
        })}
      </div>

      {/* Zoom preset buttons */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 pointer-events-auto">
        {ZOOM_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() =>
              participantKey && onChange(participantKey, preset.framing)
            }
            className={`px-2 py-0.5 text-[9px] font-medium rounded border transition-colors ${
              framing.zoomPreset === preset.value
                ? "bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]"
                : "bg-black/50 border-white/10 text-white/60 hover:text-white/90"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
