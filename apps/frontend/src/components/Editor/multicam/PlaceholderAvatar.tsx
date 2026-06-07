import { getParticipantColor } from "../types";

interface Props {
  participantKey: string;
  displayName?: string;
  size?: number;
}

export function PlaceholderAvatar({
  participantKey,
  displayName,
  size = 48,
}: Props) {
  const initial = (displayName || participantKey).charAt(0).toUpperCase();
  const colorIdx = 0;

  return (
    <div
      className="flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: `${getParticipantColor(colorIdx)}22`,
        border: `2px solid ${getParticipantColor(colorIdx)}44`,
      }}
    >
      <span
        className="font-semibold select-none"
        style={{
          fontSize: size * 0.42,
          color: getParticipantColor(colorIdx),
        }}
      >
        {initial}
      </span>
    </div>
  );
}
