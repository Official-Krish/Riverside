import type { MeetingDetails, MeetingSchedule } from "@repo/types/api";
import { CalendarDays, LogIn, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function Topbar({
  name,
  schedules,
}: {
  name: string | null;
  liveMeetings?: unknown[];
  meetings?: MeetingDetails[];
  schedules: MeetingSchedule[];
}) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const nextScheduledMeeting =
    schedules
      .slice()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
      .find((schedule) => new Date(schedule.startTime).getTime() >= now) ??
    null;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <header className="pb-6 border-b border-white/6 px-8 pt-8">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#f5a623]">
            {greeting}
          </p>
          <h1 className="text-[42px] font-normal leading-none tracking-tight text-[#F0EDE6] font-serif">
            Welcome back,{" "}
            <em className="not-italic text-white/35">{name ?? "User"}</em>
          </h1>
          <p className="text-[12.5px] font-light text-white/50 tracking-wide max-w-2xl">
            {nextScheduledMeeting
              ? `Next up: ${nextScheduledMeeting.title} on ${new Date(
                  nextScheduledMeeting.startTime,
                ).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}.`
              : "Your workspace is ready — start a room, schedule a session, or review recordings."}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/meeting/schedule")}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-[12.5px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white/80 cursor-pointer"
          >
            <CalendarDays className="size-3.5" /> Schedule
          </button>
          <button
            onClick={() => navigate("/meetingSetup")}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-[12.5px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white/80 cursor-pointer"
          >
            <LogIn className="size-3.5" /> Join
          </button>
          <button
            onClick={() => navigate("/meetingSetup")}
            className="flex items-center justify-center group relative overflow-hidden rounded-full px-6 py-3 text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            style={{
              background: "#F5A623",
              color: "#0c0c0e",
            }}
          >
            {/* Shimmer sweep */}
            <span
              className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              }}
            />
            <Plus className="size-3.5 mr-1" /> New meeting
          </button>
        </div>
      </div>
    </header>
  );
}
