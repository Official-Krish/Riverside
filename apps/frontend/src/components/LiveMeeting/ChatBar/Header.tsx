import { FolderGit2, GitBranch, MessageSquare, X } from "lucide-react";

export default function Header(props: {
  githubStatus: { label: string; className: string };
  participantsLength: number;
  onClose: () => void;
}) {
  const { githubStatus, participantsLength, onClose } = props;

  return (
    <div className="border-b border-[#f5a623]/10 px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-2xl border border-[#f5a623]/12 bg-[#f5a623]/10">
            <MessageSquare className="size-4 text-[#f5a623]" />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-[#fff5de]">Meeting chat</p>
            <p className="text-[11px] text-[#b89a63]">Team notes and GitHub actions</p>
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
        {participantsLength > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[11px] text-[#d8c198]">
            {participantsLength} online
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
            <p className="mt-1 truncate text-sm font-medium text-[#fff5de]">{/* selected repo displayed by parent */}</p>
          </div>
        </div>

        <p className="mt-2 text-[12px] leading-relaxed text-[#cbb38a]">
          Slash commands in this room act on the repo shown here. You can switch it before creating or updating issues.
        </p>
      </div>
    </div>
  );
}
