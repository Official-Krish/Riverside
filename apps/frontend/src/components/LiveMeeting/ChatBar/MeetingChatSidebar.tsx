import { useQuery } from "@tanstack/react-query";
import { FolderGit2, GitBranch, MessageSquare, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../../../https";
import type { RealtimeChatMessage } from "../../../hooks/useMeetingRealtime";
import type { ChatReaction } from "@repo/types";
import IssueActionsModal from "./IssueActionsModal";
import IssueCreateModal from "./IssueCreateModal";
import {
  AVATAR_GRADIENTS,
  AVATAR_TEXT,
  COMMAND_ITEMS,
  getCommandFromDraft,
  type CommandItem,
} from "./meetingChatSidebar.shared";
import MessageList from "./MessageList";
import { Composer } from "./Composer";

type MeetingChatSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  messages: RealtimeChatMessage[];
  typingNames: string[];
  selfName?: string;
  participants?: { name: string; color: string }[];
  reactions?: Record<string, ChatReaction[]>;
  participantNamesById?: Record<string, string>;
  participantId?: string | null;
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onSendReaction?: (messageId: string, emoji: string, action: "add" | "remove") => void;
};

type RepoItem = {
  full_name: string;
};

export function MeetingChatSidebar({
  isOpen,
  onClose,
  messages,
  typingNames,
  selfName,
  participants = [],
  reactions = {},
  participantNamesById = {},
  participantId,
  onSendMessage,
  onTyping,
  onSendReaction,
}: MeetingChatSidebarProps) {
  const [draft, setDraft] = useState("");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuePrefillTitle, setIssuePrefillTitle] = useState<
    string | undefined
  >(undefined);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionsPrefill, setActionsPrefill] = useState<string | undefined>(
    undefined,
  );
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const reposQuery = useQuery<RepoItem[]>({
    queryKey: ["github", "repos"],
    queryFn: async () => {
      const res = await http.get("/github/repos");
      return res.data.githubRepos || res.data.repos || [];
    },
    enabled: isOpen,
    retry: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isOpen || selectedRepo || !reposQuery.data?.length) return;
    setSelectedRepo(reposQuery.data[0].full_name);
  }, [isOpen, reposQuery.data, selectedRepo]);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return "";
    if (typingNames.length === 1) return `${typingNames[0]} is typing…`;
    return `${typingNames[0]} and others are typing…`;
  }, [typingNames]);

  const commandQuery = draft.trim().startsWith("/")
    ? draft.trim().slice(1).toLowerCase()
    : "";

  const filteredCommands = useMemo(() => {
    if (!commandQuery) {
      return COMMAND_ITEMS;
    }

    return COMMAND_ITEMS.filter((item) => {
      const haystack = [
        item.cmd,
        item.title,
        item.description,
        item.group,
      ].join(" ");

      return haystack.toLowerCase().includes(commandQuery);
    });
  }, [commandQuery]);

  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce<Record<string, CommandItem[]>>(
      (acc, item) => {
        if (!acc[item.group]) {
          acc[item.group] = [];
        }

        acc[item.group].push(item);
        return acc;
      },
      {},
    );
  }, [filteredCommands]);

  useEffect(() => {
    if (!showCommandPalette) return;
    setActiveCommandIndex((index) =>
      Math.min(index, Math.max(filteredCommands.length - 1, 0)),
    );
  }, [filteredCommands.length, showCommandPalette]);

  const send = () => {
    const value = draft.trim();
    if (!value) return;
    onSendMessage(value);
    onTyping(false);
    setDraft("");
    setShowCommandPalette(false);
    inputRef.current?.focus();
  };

  const openCommand = (command: CommandItem) => {
    if (command.id === "createissue") {
      const remainder = draft
        .trim()
        .replace(/^\/createissue(?:\s|$)/, "")
        .trim();
      setIssuePrefillTitle(remainder || undefined);
      setShowIssueModal(true);
    } else {
      setActionsPrefill(selectedRepo || undefined);
      setShowActionsModal(true);
    }

    setDraft("");
    setShowCommandPalette(false);
    onTyping(false);
  };

  const submitDraft = () => {
    const matchedCommand = getCommandFromDraft(draft);
    if (matchedCommand) {
      openCommand(matchedCommand);
      return;
    }

    send();
  };

  const activeCommand = filteredCommands[activeCommandIndex] || null;
  const hasRepoAccess = Boolean(reposQuery.data && reposQuery.data.length > 0);
  const githubStatus = reposQuery.isLoading
    ? {
        label: "Checking GitHub",
        className: "border-[#f5a623]/18 bg-[#f5a623]/10 text-[#ffe0a8]",
      }
    : reposQuery.isError
      ? {
          label: "GitHub unavailable",
          className: "border-red-400/18 bg-red-500/10 text-red-200",
        }
      : hasRepoAccess
        ? {
            label: "GitHub ready",
            className:
              "border-emerald-400/18 bg-emerald-400/10 text-emerald-200",
          }
        : {
            label: "No repo access",
            className: "border-[#f5a623]/18 bg-[#f5a623]/10 text-[#ffe0a8]",
          };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.24, ease: "easeInOut" }}
          className="fixed bottom-0 right-0 top-0 z-50 flex w-105 max-w-[96vw] flex-col border-l border-[#f5a623]/12 bg-[linear-gradient(180deg,#110d09_0%,#080705_100%)]"
        >
          <div className="border-b border-[#f5a623]/10 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-2xl border border-[#f5a623]/12 bg-[#f5a623]/10">
                  <MessageSquare className="size-4 text-[#f5a623]" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[#fff5de]">
                    Meeting chat
                  </p>
                  <p className="text-[11px] text-[#b89a63]">
                    Team notes and GitHub actions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-xl border border-white/8 bg-white/4 transition hover:bg-white/8"
              >
                <X className="size-4 text-[#c8a870]/70" />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${githubStatus.className}`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                {githubStatus.label}
              </span>
              {participants.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[11px] text-[#d8c198]">
                  {participants.length} online
                </span>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-[#f5a623]/12 bg-[#120f0b] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f8251]">
                    <FolderGit2 className="h-3.5 w-3.5" />
                    Active repo
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-[#fff5de]">
                    {selectedRepo ||
                      (reposQuery.isError
                        ? "Connect GitHub in profile"
                        : "No repo selected")}
                  </p>
                </div>
                {reposQuery.data && reposQuery.data.length > 1 ? (
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="max-w-40 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-[#fff5de] outline-none focus:border-[#f5a623]/40"
                  >
                    {reposQuery.data.map((repo) => (
                      <option key={repo.full_name} value={repo.full_name}>
                        {repo.full_name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              <p className="mt-2 text-[12px] leading-relaxed text-[#cbb38a]">
                {reposQuery.isError
                  ? "GitHub commands need an active GitHub connection before the issue forms can open."
                  : "Slash commands in this room act on the repo shown here. You can switch it before creating or updating issues."}
              </p>
            </div>
          </div>

          {participants.length > 0 && (
            <div className="flex shrink-0 items-center gap-2.5 border-b border-[#f5a623]/7 bg-black/15 px-4 py-2.5">
              <div className="flex">
                {participants.slice(0, 5).map((participant, index) => (
                  <span
                    key={participant.name}
                    className={`inline-flex size-6 items-center justify-center rounded-full border-[1.5px] border-[#0d0b08] bg-linear-to-br ${AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]} ${AVATAR_TEXT[index % AVATAR_TEXT.length]} text-[9px] font-extrabold`}
                    style={{ marginLeft: index === 0 ? 0 : -6 }}
                    title={participant.name}
                  >
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
              <span className="truncate text-[11px] text-[#c8a870]/55">
                {participants.map((participant) => participant.name).join(", ")}
              </span>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <MessageList 
              messages={messages} 
              selfName={selfName} 
              reactions={reactions}
              participantNamesById={participantNamesById}
              participantId={participantId}
              onSendReaction={onSendReaction}
            />
            <div ref={bottomRef} />
          </div>

          <div className="shrink-0 px-4 py-1.5" style={{ minHeight: 24 }}>
            {typingLabel && (
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="inline-block size-1 rounded-full bg-[#f5a623]/50"
                      style={{
                        animation: `bounce 1.2s ease ${index * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-[#c8a870]/50">
                  {typingLabel}
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0">
            <Composer
                draft={draft}
                setDraft={setDraft}
                onTyping={onTyping}
                submitDraft={submitDraft}
                showCommandPalette={showCommandPalette}
                filteredCommands={filteredCommands}
                activeCommandIndex={activeCommandIndex}
                openCommand={openCommand}
                setShowCommandPalette={setShowCommandPalette}
                inputRef={inputRef}
                setActiveCommandIndex={setActiveCommandIndex}
                selectedRepo={selectedRepo}
                activeCommand={activeCommand}
                groupedCommands={groupedCommands}
            />
          </div>

          {showIssueModal && (
            <IssueCreateModal
              isOpen={showIssueModal}
              initialRepo={selectedRepo || undefined}
              prefillTitle={issuePrefillTitle}
              onClose={() => setShowIssueModal(false)}
              onCreated={(issue) => {
                try {
                  const url = issue?.html_url ? ` ${issue.html_url}` : "";
                  onSendMessage(
                    `[GitHub] Issue created: ${issue?.title || "Untitled"}${url}`,
                  );
                } catch {
                  // best-effort
                }
              }}
            />
          )}

          {showActionsModal && (
            <IssueActionsModal
              isOpen={showActionsModal}
              initialRepo={selectedRepo || undefined}
              prefillCmd={actionsPrefill}
              onClose={() => setShowActionsModal(false)}
            />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export default MeetingChatSidebar;