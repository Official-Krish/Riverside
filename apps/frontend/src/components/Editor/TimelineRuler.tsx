import { useRef } from "react";
import type { Track } from "./types";

interface TimelineRulerProps {
  durationMs: number;
  currentTime: number;
  zoom: number;
  onSeek: (timeMs: number) => void;
  tracks: Track[];
}

export function TimelineRuler({
  durationMs,
  currentTime,
  zoom,
  onSeek,
  tracks,
}: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const getTimeFromEvent = (e: React.MouseEvent | MouseEvent): number => {
    const el = rulerRef.current;
    if (!el || durationMs === 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    return ratio * durationMs;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    onSeek(getTimeFromEvent(e));

    const onMove = (ev: MouseEvent) => {
      if (isDragging.current) onSeek(getTimeFromEvent(ev));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Adaptive tick spacing based on zoom & duration
  const totalSeconds = durationMs / 1000;
  const [majorInterval, minorInterval] =
    totalSeconds / zoom <= 10
      ? [1, 0.1]
      : totalSeconds / zoom <= 30
        ? [5, 0.5]
        : totalSeconds / zoom <= 120
          ? [10, 1]
          : totalSeconds / zoom <= 600
            ? [30, 5]
            : [60, 10];

  const majorTicks: number[] = [];
  const minorTicks: number[] = [];

  for (let t = 0; t <= totalSeconds; t += minorInterval) {
    const rounded = Math.round(t * 10) / 10;
    if (Math.abs(rounded % majorInterval) < 0.01) {
      majorTicks.push(rounded);
    } else {
      minorTicks.push(rounded);
    }
  }

  const pct = (s: number) => `${(s / totalSeconds) * 100}%`;

  const formatLabel = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cent = Math.round((s % 1) * 10);
    if (m > 0) return `${m}:${sec.toString().padStart(2, "0")}`;
    if (cent > 0) return `${sec}.${cent}`;
    return `${sec}s`;
  };

  const playheadPct = durationMs > 0 ? (currentTime / durationMs) * 100 : 0;

  return (
    <div
      ref={rulerRef}
      className="relative h-10 select-none cursor-crosshair overflow-hidden rounded-lg border border-[#f5a623]/15 bg-[#0d0d0b]"
      onMouseDown={handleMouseDown}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-linear-to-b from-[#f5a623]/5 to-transparent pointer-events-none" />

      {/* Minor ticks */}
      {minorTicks.map((s) => (
        <div
          key={`minor-${s}`}
          className="absolute bottom-0 w-px bg-[#f5a623]/15"
          style={{ left: pct(s), height: "30%" }}
        />
      ))}

      {/* Major ticks + labels */}
      {majorTicks.map((s) => (
        <div
          key={`major-${s}`}
          className="absolute top-0 flex flex-col items-center pointer-events-none"
          style={{ left: pct(s) }}
        >
          <div className="w-px bg-[#f5a623]/40" style={{ height: "55%" }} />
          <span className="text-[9px] font-mono text-[#8d7850] mt-0.5 -translate-x-1/2">
            {formatLabel(s)}
          </span>
        </div>
      ))}

      {/* Clip start markers */}
      <div className="absolute inset-0 pointer-events-none">
        {tracks.flatMap((t) =>
          t.clips.map((clip) => (
            <div
              key={clip.id ?? clip.sourceAssetId}
              className="absolute top-0 bottom-0 w-px bg-[#f5a623]/40"
              style={{
                left: pct(clip.timelineStartMs / 1000),
              }}
            />
          )),
        )}
      </div>

      {/* Playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-[#f5a623] z-10 pointer-events-none shadow-[0_0_8px_rgba(245,166,35,0.7)]"
        style={{ left: `${playheadPct}%` }}
      >
        {/* Playhead cap */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <div
            className="h-0 w-0"
            style={{
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "6px solid #f5a623",
            }}
          />
        </div>
        {/* Playhead line glow */}
        <div className="absolute inset-0 w-px bg-[#f5a623]/30 scale-x-150" />
      </div>

      {/* Current time badge */}
      <div
        className="absolute top-1 pointer-events-none z-20"
        style={{
          left: `clamp(24px, ${playheadPct}%, calc(100% - 48px))`,
          transform: "translateX(-50%)",
        }}
      >
        <div className="rounded bg-[#f5a623] px-1 py-px text-[8px] font-mono font-bold text-[#0a0a08] shadow-md">
          {formatLabel(currentTime / 1000)}
        </div>
      </div>
    </div>
  );
}
