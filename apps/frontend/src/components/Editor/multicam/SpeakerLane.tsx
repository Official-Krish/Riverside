import { useMemo, useState } from "react";
import type { SpeakerSegment } from "../types";
import { getParticipantColor } from "../types";
import { ChevronDown, ChevronRight, Volume2 } from "lucide-react";

interface Props {
  speakerTimeline: SpeakerSegment[];
  durationMs: number;
  currentTime: number;
  onSeek: (timeMs: number) => void;
}

export function SpeakerLane({ speakerTimeline, durationMs, onSeek }: Props) {
  const [collapsed, setCollapsed] = useState(true);

  const participantKeys = useMemo(() => {
    const keys = new Set(speakerTimeline.map((s) => s.participantKey));
    return Array.from(keys);
  }, [speakerTimeline]);

  if (!speakerTimeline.length) return null;

  return (
    <div className="rounded-lg border border-[#a855f7]/15 bg-[#0a0a08]/60">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-medium text-[#a855f7] hover:bg-[#a855f7]/5 transition-colors rounded-lg"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <Volume2 className="h-3 w-3" />
        Speaker Activity
        <span className="text-[10px] text-[#8d7850]">
          ({speakerTimeline.length} segments)
        </span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-2">
          <div
            className="relative h-8 rounded-md bg-[#060605]/60 overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              onSeek(Math.round(ratio * durationMs));
            }}
          >
            {speakerTimeline.map((seg, i) => {
              const left = (seg.startMs / durationMs) * 100;
              const width = ((seg.endMs - seg.startMs) / durationMs) * 100;
              const colorIdx = participantKeys.indexOf(seg.participantKey);
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 rounded-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 0.3)}%`,
                    backgroundColor: getParticipantColor(colorIdx),
                    minWidth: "2px",
                  }}
                  title={`${seg.displayName || seg.participantKey}: ${(seg.startMs / 1000).toFixed(1)}s - ${(seg.endMs / 1000).toFixed(1)}s`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(seg.startMs);
                  }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {participantKeys.map((key, i) => {
              const segments = speakerTimeline.filter(
                (s) => s.participantKey === key,
              );
              const totalMs = segments.reduce(
                (acc, s) => acc + (s.endMs - s.startMs),
                0,
              );
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-[10px] text-[#bfa873]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getParticipantColor(i) }}
                  />
                  <span className="truncate max-w-20">
                    {segments[0]?.displayName || key.slice(0, 8)}
                  </span>
                  <span className="text-[#8d7850]">
                    {(totalMs / 1000).toFixed(0)}s
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {collapsed && (
        <div
          className="relative h-2 mx-3 mb-2 rounded-full bg-[#060605]/60 overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            onSeek(Math.round(ratio * durationMs));
          }}
        >
          {speakerTimeline.map((seg, i) => {
            const left = (seg.startMs / durationMs) * 100;
            const width = ((seg.endMs - seg.startMs) / durationMs) * 100;
            const colorIdx = participantKeys.indexOf(seg.participantKey);
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 rounded-sm"
                style={{
                  left: `${left}%`,
                  width: `${Math.max(width, 0.3)}%`,
                  backgroundColor: getParticipantColor(colorIdx),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
