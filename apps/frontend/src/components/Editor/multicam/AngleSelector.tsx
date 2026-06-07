import { getParticipantColor } from "../types";

interface Props {
  participantKeys: string[];
  activeAngle: string | null | undefined;
  onSelectAngle: (participantKey: string) => void;
}

export function AngleSelector({
  participantKeys,
  activeAngle,
  onSelectAngle,
}: Props) {
  if (!participantKeys.length) return null;

  return (
    <div className="flex items-center gap-1">
      {participantKeys.map((key, i) => (
        <button
          key={key}
          onClick={() => onSelectAngle(key)}
          className={`h-7 w-7 rounded-full text-[10px] font-bold transition-all duration-200 cursor-pointer ${
            activeAngle === key
              ? "ring-2 ring-white scale-110"
              : "opacity-60 hover:opacity-100 hover:scale-105"
          }`}
          style={{
            backgroundColor: getParticipantColor(i),
            color: "#fff",
          }}
          title={`Switch to ${key} (${i + 1})`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
