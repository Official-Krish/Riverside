import { CalendarDays, ChevronRight, Clock3, Users, Video } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useNavigate } from "react-router-dom";
import type { MeetingDetails, MeetingSchedule } from "@repo/types/api";
import { findDuration } from "@/lib/utils";
import { UpcomingMeetings } from "./UpcomingMeetings";
import { getMeetingDate, getMeetingParticipantCount } from "./types";
import { toast } from "sonner";

export function Overview({
  meetings,
  schedules,
  setSection,
  onJoinSchedule,
  joiningScheduleId,
  onScheduleMeeting,
}: {
  meetings: MeetingDetails[];
  schedules: MeetingSchedule[];
  setSection: (section: "overview" | "meetings" | "recordings" | "upcoming") => void;
  onJoinSchedule: (scheduleId: string, devices: { micId?: string; cameraId?: string }) => Promise<void>;
  joiningScheduleId?: string | null;
  onScheduleMeeting: () => void;
}) {
  const navigate = useNavigate();
  const [recentPage, setRecentPage] = useState(1);
  const recentPageSize = 2;
  const totalRecentPages = Math.ceil(meetings.length / recentPageSize);
  const paginatedRecentMeetings = meetings.slice((recentPage - 1) * recentPageSize, recentPage * recentPageSize);

  const [readyPage, setReadyPage] = useState(1);
  const readyMeetings = meetings.filter((meeting) => meeting.recordingState === "READY");
  const readyPageSize = 2;
  const totalReadyPages = Math.ceil(readyMeetings.length / readyPageSize);
  const paginatedReadyMeetings = readyMeetings.slice((readyPage - 1) * readyPageSize, readyPage * readyPageSize);

  return (
    <motion.div
      key="overview"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="grid gap-4 lg:grid-cols-[1fr_320px]"
    >
      <div className="flex flex-col gap-4">
        <SectionCard title="Recent meetings" linkLabel="View all" onLink={() => setSection("meetings")}>
          {meetings.length === 0 ? (
            <p className="rounded-xl border border-white/6 bg-white/3 px-4 py-4 text-sm text-[#a89880]">
              No meetings yet. Create your first one above.
            </p>
          ) : (
            paginatedRecentMeetings.map((meeting, index) => (
              <MeetingRow key={meeting.id} meeting={meeting} index={index} onClick={() => {
                if(meeting.recordingStartedAt === null) {
                  toast.info("This meeting has no recording, so it cannot be viewed.")
                  return;
                }
                navigate(`/recordings/${meeting.id}`)
              }} />
            ))
          )}

          {totalRecentPages > 1 ? (
            <Pager page={recentPage} totalPages={totalRecentPages} onChange={setRecentPage} />
          ) : null}
        </SectionCard>

        <SectionCard title="Recordings" linkLabel="View all" onLink={() => setSection("recordings")}>
          {paginatedReadyMeetings.map((meeting) => (
            <div
              key={meeting.id}
              onClick={() => navigate(`/recordings/${meeting.id}`)}
              className="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-[#f5a623]/7 bg-black/18 px-3.5 py-2.5 transition last:mb-0 hover:bg-black/30"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-[#f5a623]/12 bg-[#f5a623]/8">
                <Video className="size-4 text-[#f5a623]/60" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#fff5de]">
                  {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
                </p>
                <p className="mt-0.5 text-[11px] text-[#b49650]/60">
                  {new Date(getMeetingDate(meeting)).toLocaleDateString()} · {getMeetingParticipantCount(meeting)} tracks
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-300/90">
                Ready
              </span>
            </div>
          ))}

          {readyMeetings.length === 0 ? (
            <p className="rounded-xl border border-white/6 bg-white/3 px-4 py-4 text-sm text-[#a89880]">
              No ready recordings yet.
            </p>
          ) : null}

          {totalReadyPages > 1 ? (
            <Pager page={readyPage} totalPages={totalReadyPages} onChange={setReadyPage} />
          ) : null}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <UpcomingMeetings
          schedules={schedules}
          joiningScheduleId={joiningScheduleId}
          onJoinSchedule={onJoinSchedule}
          onScheduleMeeting={onScheduleMeeting}
          compact
          isDashboard={true}
        />
      </div>
    </motion.div>
  );
}

function SectionCard({
  title,
  linkLabel,
  onLink,
  extra,
  children,
}: {
  title: string;
  linkLabel?: string;
  onLink?: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#f5a623]/10 bg-white/[0.022] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5a623]/55">{title}</p>
        <div className="flex items-center gap-2">
          {extra}
          {linkLabel ? (
            <button onClick={onLink} className="flex items-center gap-1 text-[12px] font-semibold text-[#f5a623]/70 transition hover:text-[#f5a623]">
              {linkLabel} <ChevronRight className="size-3" />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pt-4 flex justify-center">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious onClick={() => onChange(Math.max(1, page - 1))} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : 0} />
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, index) => (
            <PaginationItem key={index}>
              <PaginationLink isActive={page === index + 1} onClick={() => onChange(index + 1)}>
                {index + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext onClick={() => onChange(Math.min(totalPages, page + 1))} aria-disabled={page === totalPages} tabIndex={page === totalPages ? -1 : 0} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

const INITIAL_COLORS = ["from-[#ffcf6b] to-[#f5a623]", "from-[#85b7eb] to-[#378add]", "from-[#97c459] to-[#639922]", "from-[#f0997b] to-[#d85a30]", "from-[#afa9ec] to-[#7f77dd]"];
const TEXT_COLORS = ["text-[#1b1100]", "text-[#042c53]", "text-[#173404]", "text-[#4a1b0c]", "text-[#26215c]"];

function MeetingRow({ meeting, index, onClick }: { meeting: MeetingDetails; index: number; onClick: () => void }) {
  const initial = (meeting.roomName?.trim() || "M").charAt(0).toUpperCase();
  const gradient = INITIAL_COLORS[index % INITIAL_COLORS.length];
  const textCol = TEXT_COLORS[index % TEXT_COLORS.length];
  const isLive = !meeting.isEnded;
  const startedAt = meeting.startedAt ? new Date(meeting.startedAt) : null;
  const endedAt = meeting.endedAt ? new Date(meeting.endedAt) : null;
  const durationLabel = findDuration(startedAt ?? new Date(), endedAt ?? new Date());

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      onClick={onClick}
      className="mb-2 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[#f5a623]/7 bg-black/20 px-3.5 py-2.5 text-left transition last:mb-0 hover:border-[#f5a623]/18 hover:bg-black/35"
    >
      <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${gradient} ${textCol} text-[13px] font-extrabold`}>
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#fff5de]">
          {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5 text-[11px] text-[#b49650]/60">
          <span className="flex items-center gap-1"><CalendarDays className="size-2.5" />{new Date(getMeetingDate(meeting)).toLocaleDateString()}</span>
          <span className="flex items-center gap-1"><Users className="size-2.5" />{getMeetingParticipantCount(meeting)}</span>
          <span className="flex items-center gap-1"><Clock3 className="size-2.5" />{durationLabel}</span>
        </div>
      </div>
      {isLive ? (
        <span className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/12 px-2.5 py-0.5 text-[10px] font-bold text-red-400/90">
          <span className="inline-block size-1.5 animate-pulse rounded-full bg-red-400" /> Live
        </span>
      ) : (
        <span className="rounded-full border border-green-500/20 bg-green-500/12 px-2.5 py-0.5 text-[10px] font-bold text-green-400/85">Ended</span>
      )}
    </motion.button>
  );
}
