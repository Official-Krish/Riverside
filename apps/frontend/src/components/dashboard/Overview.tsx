import { CalendarDays, Clock3, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import type { MeetingDetails, MeetingSchedule } from "@repo/types/api";
import { findDuration } from "@/lib/utils";
import { getMeetingDate, getMeetingParticipantCount } from "./types";
import { toast } from "sonner";

export function Overview({
  meetings,
  schedules,
  setSection,
  onScheduleMeeting,
}: {
  meetings: MeetingDetails[];
  schedules: MeetingSchedule[];
  setSection: (
    section: "overview" | "meetings" | "recordings" | "upcoming",
  ) => void;
  onJoinSchedule?: (
    scheduleId: string,
    devices: {
      micId?: string;
      cameraId?: string;
      initialMicOff?: boolean;
      initialVideoOff?: boolean;
    },
  ) => Promise<void>;
  joiningScheduleId?: string | null;
  onScheduleMeeting: () => void;
}) {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());

  const [meetingsPage, setMeetingsPage] = useState(1);
  const [recordingsPage, setRecordingsPage] = useState(1);
  const pageSize = 4;

  const readyMeetings = meetings.filter(
    (meeting) => meeting.recordingState === "READY",
  );
  const liveMeetings = meetings.filter((meeting) => !meeting.isEnded);
  const nextScheduledMeeting =
    schedules
      .slice()
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      )
      .find((schedule) => new Date(schedule.startTime).getTime() >= now) ??
    null;
  const endedMeetings = meetings.filter(
    (meeting) => meeting.startedAt && meeting.endedAt,
  );
  const totalRecordedMinutes = endedMeetings.reduce((total, meeting) => {
    const startedAt = new Date(meeting.startedAt as string).getTime();
    const endedAt = new Date(meeting.endedAt as string).getTime();
    return total + Math.max(0, Math.round((endedAt - startedAt) / 60000));
  }, 0);

  const totalMeetingsPages = Math.ceil(meetings.length / pageSize);
  const paginatedMeetings = meetings.slice(
    (meetingsPage - 1) * pageSize,
    meetingsPage * pageSize,
  );

  const totalRecordingsPages = Math.ceil(readyMeetings.length / pageSize);
  const paginatedRecordings = readyMeetings.slice(
    (recordingsPage - 1) * pageSize,
    recordingsPage * pageSize,
  );

  return (
    <div className="grid grid-cols-[1fr_240px] px-8">
      <div className="pr-8 border-r border-white/6">
        <div className="flex gap-0 mb-10">
          <div className="flex-1 pr-7 border-r border-white/7">
            <div className="text-[48px] font-normal text-white leading-none tracking-tight font-serif">
              {meetings.length}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/50 mt-1.5">
              Total meetings
            </div>
          </div>
          <div className="flex-1 px-7 border-r border-white/7">
            <div className="text-[48px] font-normal text-white leading-none tracking-tight font-serif">
              {liveMeetings.length}
              <span className="text-[14px] font-sans font-normal text-white/30 ml-1">
                live
              </span>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/50 mt-1.5">
              Right now
            </div>
          </div>
          <div className="flex-1 px-7 border-r border-white/7">
            <div className="text-[48px] font-normal text-white leading-none tracking-tight font-serif">
              {schedules.length}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/50 mt-1.5">
              Upcoming
            </div>
          </div>
          <div className="flex-1 pl-7">
            <div className="text-[48px] font-normal text-white leading-none tracking-tight font-serif">
              {totalRecordedMinutes >= 60
                ? `${(totalRecordedMinutes / 60).toFixed(0)}h`
                : `${totalRecordedMinutes}min`}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-white/50 mt-1.5">
              Recorded
            </div>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-medium">
              Recent meetings
            </span>
            <div className="flex-1 h-px bg-white/6" />
            <button
              onClick={() => setSection("meetings")}
              className="text-[10px] text-[#f5a623]/70 font-medium tracking-wider hover:text-[#f5a623] transition-colors cursor-pointer"
            >
              View all
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="py-8">
              <EmptyRow />
              <EmptyRow width="55%" />
              <EmptyRow width="40%" />
              <p className="text-[12px] text-white/40 font-light mt-5">
                No meetings yet — create your first room above
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-0">
                {paginatedMeetings.map((meeting, index) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    index={index}
                    onClick={() => {
                      if (meeting.recordingStartedAt === null) {
                        toast.info(
                          "This meeting has no recording, so it cannot be viewed.",
                        );
                        return;
                      }
                      navigate(`/recordings/${meeting.id}`);
                    }}
                  />
                ))}
              </div>
              {totalMeetingsPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setMeetingsPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            meetingsPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from(
                        { length: totalMeetingsPages },
                        (_, i) => i + 1,
                      ).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            onClick={() => setMeetingsPage(p)}
                            isActive={meetingsPage === p}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setMeetingsPage((p) =>
                              Math.min(totalMeetingsPages, p + 1),
                            )
                          }
                          className={
                            meetingsPage === totalMeetingsPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <div className="flex items-center gap-4 mb-5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-medium">
              Recordings
            </span>
            <div className="flex-1 h-px bg-white/6" />
            <button
              onClick={() => setSection("recordings")}
              className="text-[10px] text-[#f5a623]/70 font-medium tracking-wider hover:text-[#f5a623] transition-colors cursor-pointer"
            >
              View all
            </button>
          </div>

          {readyMeetings.length === 0 ? (
            <div className="py-8">
              <EmptyRow />
              <EmptyRow width="45%" />
              <p className="text-[12px] text-white/50 font-light mt-5">
                Finished sessions will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-0">
                {paginatedRecordings.map((meeting, index) => (
                  <div
                    key={meeting.id}
                    onClick={() => navigate(`/recordings/${meeting.id}`)}
                    className="flex items-center gap-3 py-3.5 hover:bg-white/2 transition-colors cursor-pointer px-4 rounded-lg border-b-amber-300"
                  >
                    <div className="size-4 rounded-full border border-white/40 flex items-center justify-center">
                      <div className="size-1.5 bg-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white/80 truncate">
                        {meeting.roomName?.trim() ||
                          `Meeting ${meeting.roomId.slice(0, 8)}`}
                      </p>
                    </div>
                    <div
                      className="h-px bg-white/20"
                      style={{ width: `${40 + index * 10}%` }}
                    />
                    <span className="text-[11px] text-white/25">
                      {new Date(getMeetingDate(meeting)).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
              {totalRecordingsPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setRecordingsPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            recordingsPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from(
                        { length: totalRecordingsPages },
                        (_, i) => i + 1,
                      ).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            onClick={() => setRecordingsPage(p)}
                            isActive={recordingsPage === p}
                            className="cursor-pointer"
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setRecordingsPage((p) =>
                              Math.min(totalRecordingsPages, p + 1),
                            )
                          }
                          className={
                            recordingsPage === totalRecordingsPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="pl-6 flex flex-col">
        <div className="mb-6">
          <div className="text-[9.5px] uppercase tracking-[0.13em] text-white/40 font-semibold my-4">
            Upcoming
          </div>
          <p className="text-[22px] font-normal text-white/70 leading-tight font-serif">
            Rooms ready
            <br />
            when your
            <br />
            team <em className="not-italic text-[#f5a623]">is</em>
          </p>
          <p className="text-[11px] text-white/40 font-light leading-relaxed mt-3">
            {nextScheduledMeeting
              ? `Next session: ${nextScheduledMeeting.title}`
              : "No sessions scheduled yet. Book a time and your team will see it here."}
          </p>
          <button
            onClick={onScheduleMeeting}
            className="mt-3 text-[11px] text-[#f5a623] font-medium tracking-wider flex items-center gap-1.5 hover:text-[#f5c86a] transition-colors cursor-pointer hover:underline"
          >
            <CalendarDays className="size-3.5" />
            Schedule a session
          </button>
        </div>

        <div className="pt-6 border-t border-white/6">
          <div className="text-[9.5px] uppercase tracking-[0.13em] text-white/40 font-semibold mb-4">
            Quick actions
          </div>
          <div className="space-y-0">
            {[
              {
                icon: "+",
                label: "New room",
                onClick: () => navigate("/meetingSetup"),
              },
              {
                icon: "→",
                label: "Join a room",
                onClick: () => navigate("/meetingSetup"),
              },
              {
                icon: "📅",
                label: "Schedule session",
                onClick: () => navigate("/meeting/schedule"),
              },
              {
                icon: "▶",
                label: "Browse recordings",
                onClick: () => navigate("/dashboard?section=recordings"),
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="w-full flex items-center gap-2.5 py-2.5 border-b border-white/4 hover:bg-white/3 transition-colors cursor-pointer"
              >
                <span className="text-[15px] text-white/50 w-5 text-center">
                  {action.icon}
                </span>
                <span className="text-[12.5px] text-white/40 font-medium hover:text-white/80 transition-colors">
                  {action.label}
                </span>
                <span className="ml-auto text-[12px] text-white/10">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ width = "60%" }: { width?: string }) {
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/4 opacity-25">
      <div className="size-4 rounded-full border border-white/50" />
      <div className="h-px bg-white/40" style={{ width }} />
    </div>
  );
}

const INITIAL_COLORS = [
  "from-[#ffcf6b] to-[#f5a623]",
  "from-[#85b7eb] to-[#378add]",
  "from-[#97c459] to-[#639922]",
  "from-[#f0997b] to-[#d85a30]",
  "from-[#afa9ec] to-[#7f77dd]",
];
const TEXT_COLORS = [
  "text-[#1b1100]",
  "text-[#042c53]",
  "text-[#173404]",
  "text-[#4a1b0c]",
  "text-[#26215c]",
];

function MeetingRow({
  meeting,
  index,
  onClick,
}: {
  meeting: MeetingDetails;
  index: number;
  onClick: () => void;
}) {
  const initial = (meeting.roomName?.trim() || "M").charAt(0).toUpperCase();
  const gradient = INITIAL_COLORS[index % INITIAL_COLORS.length];
  const textCol = TEXT_COLORS[index % TEXT_COLORS.length];
  const isLive = !meeting.isEnded;
  const startedAt = meeting.startedAt ? new Date(meeting.startedAt) : null;
  const endedAt = meeting.endedAt ? new Date(meeting.endedAt) : null;
  const durationLabel = findDuration(
    startedAt ?? new Date(),
    endedAt ?? new Date(),
  );

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 border-amber-300 text-left hover:bg-white/3 transition-colors cursor-pointer rounded-lg px-4"
    >
      <span
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br ${gradient} ${textCol} text-[12px] font-extrabold`}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white/80 truncate">
          {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-white/35">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-2.5" />
            {new Date(getMeetingDate(meeting)).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-2.5" />
            {getMeetingParticipantCount(meeting)}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-2.5" />
            {durationLabel}
          </span>
        </div>
      </div>
      {isLive ? (
        <span className="flex items-center gap-1.5 text-[10px] text-red-400/90">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-400" />{" "}
          Live
        </span>
      ) : (
        <span className="text-[10px] text-green-400/85">Ended</span>
      )}
    </motion.button>
  );
}
