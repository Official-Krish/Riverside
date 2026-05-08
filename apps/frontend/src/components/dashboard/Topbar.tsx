import type { MeetingDetails, MeetingSchedule } from "@repo/types/api";
import { CalendarDays, Clock3, Download, LogIn, Plus, Sparkles, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function Topbar({
    name,
    liveMeetings,
    meetings,
    schedules,
}: {
    name: string | null;
    liveMeetings: unknown[];
    meetings: MeetingDetails[];
    schedules: MeetingSchedule[];
}) {
    const navigate = useNavigate();
    const readyMeetings = meetings.filter((meeting) => meeting.recordingState === "READY");
    const endedMeetings = meetings.filter((meeting) => meeting.startedAt && meeting.endedAt);
    const totalRecordedMinutes = endedMeetings.reduce((total, meeting) => {
        const startedAt = new Date(meeting.startedAt as string).getTime();
        const endedAt = new Date(meeting.endedAt as string).getTime();
        return total + Math.max(0, Math.round((endedAt - startedAt) / 60000));
    }, 0);
    const recordedHoursLabel =
        totalRecordedMinutes >= 60
            ? `${(totalRecordedMinutes / 60).toFixed(totalRecordedMinutes >= 600 ? 0 : 1)}h`
            : `${totalRecordedMinutes}m`;
    const nextScheduledMeeting = schedules
        .slice()
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .find((schedule) => new Date(schedule.startTime).getTime() >= Date.now()) ?? null;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return (
        <div className="pt-2 sm:pt-4">
            <div className="flex flex-col gap-5 pb-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-[#f5a623]/55">{greeting}</p>
                    <h1 className="text-[30px] font-black leading-none tracking-tight text-[#fff5de]">
                    Welcome back, {name ?? "User"}
                    </h1>
                    <p className="max-w-2xl text-sm leading-6 text-[#c8a870]/62">
                        {nextScheduledMeeting
                            ? `Next up: ${nextScheduledMeeting.title} on ${new Date(nextScheduledMeeting.startTime).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}.`
                            : "Your workspace is ready for a new room, a scheduled session, or a recording review."}
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button
                        onClick={() => navigate("/meeting/schedule")}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f5a623]/15 bg-white/4 px-4 py-2.5 text-[13px] font-semibold text-[#fff5de]/80 transition hover:border-[#f5a623]/28 cursor-pointer"
                    >
                        <CalendarDays className="size-3.5" /> Schedule
                    </button>
                    <button
                        onClick={() => navigate("/meetingSetup")}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#f5a623]/15 bg-white/4 px-4 py-2.5 text-[13px] font-semibold text-[#fff5de]/80 transition hover:border-[#f5a623]/28 cursor-pointer"
                    >
                        <LogIn className="size-3.5" /> Join room
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
                                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                            }}
                        />
                        <Plus className="size-3.5 mr-1" /> New meeting
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {[
                { label: "Total meetings", value: meetings.length, icon: <Video className="size-3.5" /> },
                { label: "Live now", value: liveMeetings.length, delta: liveMeetings.length > 0 ? "Active sessions" : "Nothing live", live: true, icon: <Clock3 className="size-3.5" /> },
                { label: "Upcoming", value: schedules.length, delta: nextScheduledMeeting ? "Next session booked" : "No sessions booked", icon: <CalendarDays className="size-3.5" /> },
                { label: "Ready to review", value: readyMeetings.length, delta: readyMeetings.length > 0 ? "Recordings available" : "Nothing queued", icon: <Download className="size-3.5" /> },
                { label: "Recorded time", value: recordedHoursLabel, delta: endedMeetings.length > 0 ? `${endedMeetings.length} completed session${endedMeetings.length === 1 ? "" : "s"}` : "No finished sessions yet", accent: true, icon: <Sparkles className="size-3.5" /> },
            ].map(({ label, value, delta, live, accent, icon }) => (
                <div key={label} className="rounded-2xl border border-[#f5a623]/10 bg-white/2.5 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b49650]/60">{label}</p>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[#f5a623]/10 text-[#f5a623]">{icon}</span>
                </div>
                <p className="text-[28px] font-black leading-none tracking-tight text-[#fff5de]">{value}</p>
                <p className={[
                    "mt-1.5 flex items-center gap-1.5 text-[11px]",
                    accent ? "text-[#f5c86a]/75" : live && liveMeetings.length > 0 ? "text-red-400/80" : "text-green-400/70",
                ].join(" ")}
                >
                    {live && liveMeetings.length > 0 ? <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-400" /> : null}
                    {delta}
                </p>
                </div>
            ))}
            </div>
        </div>
    )
}
