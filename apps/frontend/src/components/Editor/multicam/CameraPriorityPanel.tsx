import type { CameraPriorityEntry } from "../types";
import { getParticipantColor } from "../types";
import { GripVertical, Eye, EyeOff } from "lucide-react";

interface Props {
  priorities: CameraPriorityEntry[];
  participantKeys: string[];
  hiddenMap: Record<string, boolean>;
  onToggleHidden: (key: string) => void;
}

export function CameraPriorityPanel({
  priorities,
  participantKeys,
  hiddenMap,
  onToggleHidden,
}: Props) {
  if (!participantKeys.length) return null;

  const sortedKeys = [...participantKeys].sort((a, b) => {
    const pa = priorities.find((p) => p.participantKey === a)?.priority ?? 0;
    const pb = priorities.find((p) => p.participantKey === b)?.priority ?? 0;
    return pb - pa;
  });

  return (
    <div className="space-y-1">
      <div className="text-[11px] text-[#8d7850] uppercase tracking-wider px-1 mb-2">
        Camera Priority
      </div>
      {sortedKeys.map((key, i) => (
        <div
          key={key}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#060605]/40 border border-[#f5a623]/5"
        >
          <GripVertical className="h-3 w-3 text-[#8d7850] cursor-grab" />
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: getParticipantColor(i) }}
          />
          <span className="flex-1 text-xs text-[#bfa873] truncate">
            {key.slice(0, 12)}
          </span>
          <button
            onClick={() => onToggleHidden(key)}
            className="p-0.5 rounded text-[#8d7850] hover:text-[#f5a623] transition-colors"
          >
            {hiddenMap[key] ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
