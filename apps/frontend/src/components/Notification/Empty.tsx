import type { Filter } from "./types";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

export function EmptyState({ filter }: { filter: Filter }) {
  const copy =
    filter === "Unread"
      ? {
          title: "You're all caught up",
          body: "New activity will appear here as soon as it arrives.",
          cta: null,
        }
      : filter === "Recording"
        ? {
            title: "No recording notifications yet",
            body: "Recording-ready, export, and merge updates will land here when they're available.",
            cta: { label: "Open recordings", to: "/dashboard" },
          }
        : filter === "Meeting"
          ? {
              title: "No meeting notifications yet",
              body: "Meeting invites and reminders will show up here once you have active meetings.",
              cta: { label: "Schedule a meeting", to: "/meeting/schedule" },
            }
          : {
              title: "No notifications",
              body: "Activity will appear here once your workspace starts receiving updates.",
              cta: { label: "Go to dashboard", to: "/dashboard" },
            };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-[28px] border border-white/8 bg-white/3 py-20 text-center shadow-[0_14px_50px_rgba(0,0,0,0.18)]"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_14px_30px_rgba(0,0,0,0.22)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-6 h-6 text-zinc-400"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-zinc-100">{copy.title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
        {copy.body}
      </p>
      {copy.cta ? (
        <Link
          to={copy.cta.to}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/14"
        >
          {copy.cta.label}
        </Link>
      ) : null}
    </motion.div>
  );
}
