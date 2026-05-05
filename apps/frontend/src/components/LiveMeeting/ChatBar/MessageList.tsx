import type { RealtimeChatMessage } from "../../../hooks/useMeetingRealtime";
import { formatTimestamp } from "./meetingChatSidebar.shared";
import SenderAvatar from "./SenderAvatar";
import { MessageReactions } from "./MessageReactions";
import type { ChatReaction } from "@repo/types";

export default function MessageList(props: {
  messages: RealtimeChatMessage[];
  selfName?: string;
  reactions?: Record<string, ChatReaction[]>;
  participantNamesById?: Record<string, string>;
  participantId?: string | null;
  onSendReaction?: (messageId: string, emoji: string, action: "add" | "remove") => void;
}) {
  const { messages, selfName, reactions = {}, participantNamesById = {}, participantId, onSendReaction } = props;

  const normalizedSelfName = (selfName || "").trim().toLowerCase();

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 [scrollbar-color:rgba(245,166,35,0.1)_transparent] [scrollbar-width:thin]">
      {messages.length === 0 ? (
        <div className="rounded-[28px] border border-[#f5a623]/12 bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.12),transparent_45%),linear-gradient(180deg,rgba(31,23,14,0.9),rgba(13,10,7,0.94))] px-5 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#f5a623]/16 bg-[#f5a623]/10">
            <div className="h-7 w-7 text-[#f5c050]">
                <img src="/icon-512.svg"/>
            </div>
          </div>
          <p className="mt-4 text-base font-semibold text-[#fff5de]">Start the conversation or open an issue together</p>
          <p className="mt-2 text-sm leading-relaxed text-[#ccb48b]">
            Type <span className="font-semibold text-[#fff0cc]">/</span> to browse GitHub commands, capture bugs from the meeting, or assign follow-up work without leaving the call.
          </p>
        </div>
      ) : null}

      {messages.map((message, index) => {
        const systemMessage = message as RealtimeChatMessage & { isSystem?: boolean };
        const isOwnMessage =
          message.isOwn || (normalizedSelfName.length > 0 && message.senderName.trim().toLowerCase() === normalizedSelfName);
        const prevSame = index > 0 && messages[index - 1].senderName === message.senderName && !(messages[index - 1] as RealtimeChatMessage & { isSystem?: boolean }).isSystem;
        const isSystem = Boolean(systemMessage.isSystem);

        if (isSystem) {
          return (
            <p key={message.id} className="rounded-full bg-white/4 px-3 py-1 text-center text-[10px] text-[#b49650]/50">
              {message.text}
            </p>
          );
        }

        return (
          <div key={message.id} className={["flex w-full flex-col gap-0.5", isOwnMessage ? "items-end" : "items-start"].join(" ")}>
            {isOwnMessage ? (
              !prevSame && (
                <div className="mb-1 flex w-full justify-end gap-1.5 pr-1">
                  <span className="rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5c050]/65">You</span>
                  <span className="pt-1 text-[11px] text-[#b49650]/35">{formatTimestamp(message.timestamp)}</span>
                </div>
              )
            ) : (
              !prevSame && (
                <div className="mb-1 flex items-center gap-2">
                  <SenderAvatar name={message.senderName} size="lg" />
                  <span className="text-[12px] font-bold tracking-wide text-[#c8a870]/65">{message.senderName}</span>
                  <span className="text-[11px] text-neutral-600">{formatTimestamp(message.timestamp)}</span>
                </div>
              )
            )}

            <div className={["max-w-[84%] rounded-[22px] px-3.5 py-3 shadow-[0_8px_20px_rgba(0,0,0,0.12)]", isOwnMessage ? "rounded-br-md border border-[#f5a623]/20 bg-linear-to-br from-[#6f4815] via-[#53340f] to-[#3c250a]" : "rounded-bl-md border border-white/7 bg-white/4"].join(" ")}>
              <p className="text-[13px] leading-relaxed text-[#fff5de]">{message.text}</p>
            </div>

            <MessageReactions
              reactions={reactions[message.id] || []}
              participantId={participantId}
              participantNamesById={participantNamesById}
              align={isOwnMessage ? "end" : "start"}
              onReactionClick={(emoji, action) => {
                onSendReaction?.(message.id, emoji, action);
              }}
            />
          </div>
        );
      })}

      <div />
    </div>
  );
}
