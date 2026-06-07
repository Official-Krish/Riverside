import type { AutoCutSuggestion } from "../types";
import { getParticipantColor } from "../types";
import { Sparkles, Check } from "lucide-react";

interface Props {
  suggestions: AutoCutSuggestion[];
  durationMs: number;
  onApply: (id: string) => void;
  onApplyAll: () => void;
  onRegenerate: () => void;
}

export function AutoCutTrack({
  suggestions,
  durationMs,
  onApply,
  onApplyAll,
  onRegenerate,
}: Props) {
  if (!suggestions.length) return null;

  const participantKeys = [
    ...new Set(suggestions.map((s) => s.participantKey)),
  ];

  return (
    <div className="rounded-lg border border-[#06b6d4]/15 bg-[#0a0a08]/60">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] font-medium text-[#06b6d4]">
          <Sparkles className="h-3 w-3" />
          Auto-Cut Suggestions
          <span className="text-[10px] text-[#8d7850]">
            ({suggestions.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onApplyAll}
            className="px-2 py-1 text-[10px] font-medium rounded bg-[#06b6d4]/10 text-[#06b6d4] hover:bg-[#06b6d4]/20 transition-colors"
          >
            Apply All
          </button>
          <button
            onClick={onRegenerate}
            className="px-2 py-1 text-[10px] font-medium rounded bg-[#f5a623]/10 text-[#f5a623] hover:bg-[#f5a623]/20 transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>

      <div className="relative h-6 mx-3 mb-2 rounded bg-[#060605]/60 overflow-hidden">
        {suggestions.map((s) => {
          const left = (s.timelineStartMs / durationMs) * 100;
          const width = (s.durationMs / durationMs) * 100;
          const colorIdx = participantKeys.indexOf(s.participantKey);
          return (
            <div
              key={s.id}
              className={`absolute top-0 bottom-0 rounded-sm cursor-pointer transition-all hover:opacity-80 group ${s.applied ? "opacity-40" : "opacity-90"}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.5)}%`,
                backgroundColor: getParticipantColor(Math.max(0, colorIdx)),
                minWidth: "4px",
              }}
              onClick={() => !s.applied && onApply(s.id)}
              title={`${s.participantKey} ${(s.timelineStartMs / 1000).toFixed(1)}s - ${((s.timelineStartMs + s.durationMs) / 1000).toFixed(1)}s${s.applied ? " (applied)" : ""}`}
            >
              {s.applied && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
