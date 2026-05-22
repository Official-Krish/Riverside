type ModeToggleProps = {
  mode: "create" | "join";
  onChange: (mode: "create" | "join") => void;
};

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="grid grid-cols-2 rounded-[16px] border border-white/8 bg-black/20 p-1.5">
      <button
        type="button"
        onClick={() => onChange("create")}
        className={[
          "rounded-[12px] px-4 py-2 text-sm font-semibold transition cursor-pointer",
          mode === "create"
            ? "bg-[#f5a623] text-[#1b1100] shadow-[0_10px_22px_rgba(245,166,35,0.18)]"
            : "text-[#c8a870]/60 hover:bg-white/4 hover:text-[#fff5de]",
        ].join(" ")}
      >
        Create
      </button>
      <button
        type="button"
        onClick={() => onChange("join")}
        className={[
          "rounded-[12px] px-4 py-2 text-sm font-semibold transition cursor-pointer",
          mode === "join"
            ? "bg-[#f5a623] text-[#1b1100] shadow-[0_10px_22px_rgba(245,166,35,0.18)]"
            : "text-[#c8a870]/60 hover:bg-white/4 hover:text-[#fff5de]",
        ].join(" ")}
      >
        Join
      </button>
    </div>
  );
}
