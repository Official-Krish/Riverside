import {
  CalendarDays,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Users,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { getMeetingDate, getMeetingParticipantCount, getStatusLabel, getStatusTone, type MeetingsProps } from "./types";

export function Meetings({
  meetings,
  isLoading,
  isError,
  errorMessage,
  onOpenMeeting,
  onOpenRecording,
}: MeetingsProps) {
  const liveMeetings = meetings.filter((meeting) => !meeting.isEnded);
  const endedMeetings = meetings.filter((meeting) => meeting.isEnded);

  const [page, setPage] = useState(1);
  const pageSize = 4;
  const allMeetings = [...liveMeetings, ...endedMeetings];
  const totalPages = Math.ceil(allMeetings.length / pageSize);
  const paginatedMeetings = allMeetings.slice((page - 1) * pageSize, page * pageSize);
  const paginatedLive = paginatedMeetings.filter((meeting) => !meeting.isEnded);
  const paginatedEnded = paginatedMeetings.filter((meeting) => meeting.isEnded);

  return (
    <div className="px-8 py-7">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#f5a623]/55">
            Meetings
          </p>
          <h2 className="mt-2 text-[26px] font-normal leading-none tracking-tight text-white font-serif">
            All meetings in one workspace
          </h2>
        </div>

        <div className="flex gap-0">
          {[
            { label: "Total", value: meetings.length },
            { label: "Live", value: liveMeetings.length },
            { label: "Ready", value: meetings.filter((m) => m.recordingState === "READY").length },
            { label: "Ended", value: endedMeetings.length },
          ].map((item) => (
            <div key={item.label} className="px-5 py-3 border-l border-white/7">
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/28">{item.label}</p>
              <p className="mt-1 text-[28px] font-normal text-white font-serif">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white/65">
          <LoaderCircle className="size-4 animate-spin" />
          Loading meetings...
        </div>
      ) : isError ? (
        <div className="px-4 py-3 text-sm text-red-300/85">
          {errorMessage || "Could not load meetings."}
        </div>
      ) : meetings.length === 0 ? (
        <div className="py-12 text-sm text-white/40">
          No meetings yet. Your first room will show up here once you create it.
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { title: "Live now", items: paginatedLive },
            { title: "Ended sessions", items: paginatedEnded },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/22">{group.title}</span>
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-[11px] text-white/45">{group.items.length} items</span>
                </div>

                <div className="space-y-0">
                  {group.items.map((meeting, index) => {
                    const tone = getStatusTone(meeting);

                    return (
                      <motion.div
                        key={meeting.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: index * 0.03 }}
                        className="flex items-center gap-4 py-4 border-b hover:bg-white/3 transition-colors px-4 rounded-lg border-amber-300"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-medium text-white/85">
                              {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
                            </p>
                            <span
                              className={[
                                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                tone === "live"
                                  ? "border border-red-500/20 text-red-300/90"
                                  : tone === "ended with ready recording"
                                    ? "border border-green-500/20 text-green-300/90"
                                    : tone === "failed"
                                      ? "border border-red-500/15 text-red-300/80"
                                      : "border border-white/15 text-white/50",
                              ].join(" ")}
                            >
                              {getStatusLabel(meeting)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/35">
                            <span className="flex items-center gap-1">
                              <Video className="size-3" />
                              {meeting.roomId.slice(0, 12)}...
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="size-3" />
                              {getMeetingParticipantCount(meeting)} participants
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="size-3" />
                              {new Date(getMeetingDate(meeting)).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock3 className="size-3" />
                              {meeting.startedAt
                                ? new Date(meeting.startedAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : (meeting.isEnded ? "Ended" : "Not started")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!meeting.isEnded ? (
                            <button
                              type="button"
                              onClick={() => onOpenMeeting(meeting.roomId)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-[#f5a623] hover:bg-[#f5a623]/10 rounded-full transition-colors cursor-pointer"
                            >
                              Open room
                              <ChevronRight className="size-3.5" />
                            </button>
                          ) : null}
                          {meeting.recordingStartedAt != null && (
                            <button
                              type="button"
                              onClick={() => onOpenRecording(meeting.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white/55 hover:text-white/85 transition-colors cursor-pointer"
                            >
                              Details
                              <ChevronRight className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          
          {totalPages > 1 && (
            <div className="pt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-disabled={page === 1}
                      tabIndex={page === 1 ? -1 : 0}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        isActive={page === i + 1}
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      aria-disabled={page === totalPages}
                      tabIndex={page === totalPages ? -1 : 0}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </div>
  );
}