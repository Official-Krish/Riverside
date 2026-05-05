import { useCallback } from "react";
import type { ChatReaction } from "@repo/types";

type MessageReactionsProps = {
  reactions?: ChatReaction[];
  participantId?: string | null;
  participantNamesById?: Record<string, string>;
  align?: "start" | "end";
  onReactionClick: (emoji: string, action: "add" | "remove") => void;
};

const COMMON_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀", "✨", "🔥"];

export function MessageReactions({
  reactions = [],
  participantId,
  participantNamesById = {},
  align = "start",
  onReactionClick,
}: MessageReactionsProps) {
  const handleReactionClick = useCallback(
    (emoji: string) => {
      // Check if current user already added this reaction
      const reaction = reactions.find((r) => r.emoji === emoji);
      const userReacted = reaction?.reactors.includes(participantId || "");

      if (userReacted) {
        onReactionClick(emoji, "remove");
      } else {
        onReactionClick(emoji, "add");
      }
    },
    [reactions, participantId, onReactionClick]
  );

  return (
    <div
      className={[
        "relative z-10 mt-2 flex w-full flex-wrap items-center gap-1.5",
        align === "end" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {/* Show existing reactions */}
      {reactions.filter((r) => r.count > 0).map((reaction) => {
        const userReacted = reaction.reactors.includes(participantId || "");
        const reactorNames = reaction.reactors.map((reactorId) => {
          if (participantId && reactorId === participantId) {
            return "You";
          }
          return participantNamesById[reactorId] || reactorId;
        });

        return (
          <div key={reaction.emoji} className="group relative">
            <button
              onClick={() => handleReactionClick(reaction.emoji)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-all ${
                userReacted
                  ? "border border-[#f5a623]/40 bg-[#f5a623]/15"
                  : "border border-white/10 bg-white/5 hover:bg-white/8"
              }`}
            >
              <span>{reaction.emoji}</span>
              <span className="text-[11px] font-semibold text-white/70">{reaction.count}</span>
            </button>

            <div
              className={[
                "pointer-events-none invisible absolute bottom-full z-30 mb-1.5 w-max max-w-52 rounded-md border border-white/10 bg-[#140f0c] px-2 py-1 text-[11px] text-[#f4e7cc] shadow-lg group-hover:visible",
                align === "end" ? "right-0" : "left-0",
              ].join(" ")}
            >
              {reactorNames.join(", ")}
            </div>
          </div>
        );
      })}

      {/* Add reaction button */}
      <ReactionPicker
        align={align}
        onSelectEmoji={(emoji) => {
          handleReactionClick(emoji);
        }}
      />
    </div>
  );
}

type ReactionPickerProps = {
  onSelectEmoji: (emoji: string) => void;
  align?: "start" | "end";
};

export function ReactionPicker({ onSelectEmoji, align = "start" }: ReactionPickerProps) {
  const handleEmojClick = useCallback(
    (emoji: string) => {
      onSelectEmoji(emoji);
    },
    [onSelectEmoji]
  );

  return (
    <div className="group relative z-20">
      <button
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] transition-all hover:bg-[#f5a623]/20 hover:border-[#f5a623]/40"
        title="Add reaction"
      >
        😊
      </button>

      {/* Dropdown picker */}
      <div
        className={[
          "invisible absolute bottom-full mb-2 flex w-max max-w-56 flex-wrap gap-1 rounded-lg border border-white/10 bg-[#1a1410] p-2 shadow-lg transition-all group-hover:visible",
          align === "end" ? "right-0" : "left-0",
        ].join(" ")}
      >
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleEmojClick(emoji)}
            className="flex h-7 w-7 items-center justify-center rounded text-base transition-all hover:bg-white/10"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
