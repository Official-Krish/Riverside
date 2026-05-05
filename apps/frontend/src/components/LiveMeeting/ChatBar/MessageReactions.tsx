import { useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
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
      <AnimatePresence mode="popLayout">
        {reactions.filter((r) => r.count > 0).map((reaction, index) => {
          const userReacted = reaction.reactors.includes(participantId || "");
          const reactorNames = reaction.reactors.map((reactorId) => {
            if (participantId && reactorId === participantId) {
              return "You";
            }
            return participantNamesById[reactorId] || reactorId;
          });

          return (
            <motion.div
              key={reaction.emoji}
              className="group relative"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                duration: 0.2,
                delay: index * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
            >
              <motion.button
                onClick={() => handleReactionClick(reaction.emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-all cursor-pointer ${
                  userReacted
                    ? "border border-[#f5a623]/40 bg-[#f5a623]/15"
                    : "border border-white/10 bg-white/5 hover:bg-white/8"
                }`}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <span>{reaction.emoji}</span>
                <span className="text-[11px] font-semibold text-white/70">{reaction.count}</span>
              </motion.button>

              <motion.div
                className={[
                  "pointer-events-none invisible absolute bottom-full z-30 mb-1.5 w-max max-w-52 rounded-md border border-white/10 bg-[#140f0c] px-2 py-1 text-[11px] text-[#f4e7cc] shadow-lg group-hover:visible",
                  align === "end" ? "right-0" : "left-0",
                ].join(" ")}
                initial={{ opacity: 0, y: 4 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {reactorNames.join(", ")}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>

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
      <motion.button
        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] transition-all hover:bg-[#f5a623]/20 hover:border-[#f5a623]/40 cursor-pointer"
        title="Add reaction"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        😊
      </motion.button>

      {/* Dropdown picker */}
      <AnimatePresence>
        <motion.div
          className={[
            "invisible absolute bottom-full mb-2 flex w-max max-w-56 flex-wrap gap-1 rounded-lg border border-white/10 bg-[#1a1410] p-2 shadow-lg group-hover:visible",
            align === "end" ? "right-0" : "left-0",
          ].join(" ")}
          initial={{ opacity: 0, scale: 0.8, y: 8 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 8 }}
          transition={{ duration: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        >
          {COMMON_EMOJIS.map((emoji, index) => (
            <motion.button
              key={emoji}
              onClick={() => handleEmojClick(emoji)}
              className="flex h-7 w-7 items-center justify-center rounded text-base transition-all hover:bg-white/10 cursor-pointer"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                duration: 0.15,
                delay: index * 0.03,
                type: "spring",
                stiffness: 250,
                damping: 15,
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
            >
              {emoji}
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
