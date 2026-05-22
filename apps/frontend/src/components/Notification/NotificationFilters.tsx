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
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(9,9,9,0.96))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.34)] lg:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Inbox
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        <div className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
          {activeFilter}
        </div>
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
              className={`group flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 cursor-pointer ${
                activeFilter === f
                  ? "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.1),rgba(16,185,129,0.04))] text-white shadow-[0_10px_30px_rgba(16,185,129,0.08)]"
                  : "border-white/8 bg-white/2 text-zinc-400 hover:border-white/12 hover:bg-white/4 hover:text-zinc-200"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    activeFilter === f
                      ? "bg-black/20 text-emerald-100"
                      : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {count > 99 ? "99+" : count}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{f}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
