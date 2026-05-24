import { formatDate } from "./helpers";
import { MeetingRow } from "./icons";
import type { User } from "./types";
import { motion } from "motion/react";
import { Calendar, RefreshCw, Lock } from "lucide-react";

export const Overview = ({
  user,
  setActiveTab,
  dark,
}: {
  user: User;
  setActiveTab: (
    tab: "overview" | "meetings" | "billing" | "integrations",
  ) => void;
  dark: boolean;
}) => {
  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`rounded-[24px] border p-5 transition-colors shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${dark ? "border-white/8 bg-white/[0.03]" : "bg-white border-zinc-200"}`}
      >
        <div
          className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] ${dark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          Recent Meetings
        </div>
        <div className="space-y-2">
          {user.hostedMeetings.slice(0, 2).map((m) => (
            <MeetingRow key={m.roomId} meeting={m} dark={dark} />
          ))}
        </div>
        <button
          onClick={() => setActiveTab("meetings")}
          className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${dark ? "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:border-amber-300/30 hover:bg-amber-400/14" : "text-amber-600 hover:text-amber-500 "}`}
        >
          View all meetings
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* Account info */}
      <div
        className={`rounded-[24px] border p-5 transition-colors shadow-[0_12px_40px_rgba(0,0,0,0.18)] ${
          dark ? "border-white/8 bg-white/[0.03]" : "bg-white border-zinc-200"
        }`}
      >
        <div
          className={`mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] ${dark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          Account
        </div>
        <div className="space-y-2">
          {[
            {
              label: "Member since",
              value: formatDate(user.createdAt),
              icon: <Calendar className="size-4 text-zinc-400" />,
            },
            {
              label: "Last updated",
              value: formatDate(user.updatedAt),
              icon: <RefreshCw className="size-4 text-zinc-400" />,
            },
            {
              label: "Encryption",
              value: "AES-128",
              icon: <Lock className="size-4 text-zinc-400" />,
            },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${dark ? "border-white/8 bg-black/20" : "border-zinc-100"}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${dark ? "bg-white/[0.03] text-zinc-400" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {icon}
                </div>
                <span
                  className={`text-xs uppercase tracking-[0.18em] ${dark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  {label}
                </span>
              </div>
              <div>
                {label === "Encryption" ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-sm font-medium text-blue-300">
                    {value}
                  </span>
                ) : (
                  <span
                    className={`text-sm font-medium ${dark ? "text-zinc-200" : "text-zinc-700"}`}
                  >
                    {value}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
