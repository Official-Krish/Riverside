import { FILTERS, type Filter, type Notification } from "./types";

interface NotificationFiltersProps {
  activeFilter: Filter;
  setActiveFilter: (filter: Filter) => void;
  unreadCount: number;
  notifications: Notification[];
}

export function NotificationFilters({
  activeFilter,
  setActiveFilter,
  unreadCount,
  notifications,
}: NotificationFiltersProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#111111]/94 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.34)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Inbox Filters
      </div>
      <div className="mt-4 space-y-2">
        {FILTERS.map((f) => {
          const count =
            f === "Unread"
              ? unreadCount
              : f === "Recording"
                ? notifications.filter(
                    (n) =>
                      n.type.startsWith("RECORDING") ||
                      n.type.startsWith("RENDER") ||
                      n.type.startsWith("MERGE"),
                  ).length
                : f === "Meeting"
                  ? notifications.filter((n) => n.type.startsWith("MEETING"))
                      .length
                  : notifications.length;

          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer ${
                activeFilter === f
                  ? "border-amber-400/20 bg-amber-400/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/12 hover:bg-white/[0.04] hover:text-zinc-200"
              }`}
            >
              <div>
                <div className="text-sm font-medium">{f}</div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {f === "All"
                    ? "Everything in your inbox"
                    : f === "Unread"
                      ? "New items only"
                      : f === "Recording"
                        ? "Access, exports, and media updates"
                        : "Invites and reminders"}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] uppercase ${
                  activeFilter === f
                    ? "bg-black/20 text-amber-100"
                    : "bg-white/[0.05] text-zinc-500"
                }`}
              >
                {count > 99 ? "99+" : count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
