import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
import { getHttpErrorMessage } from "@/lib/httpError";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { http } from "@/https";
import { getDuration, getMeetingDate, getMeetingParticipantCount, type RecordingsPageProps } from "./types";

export function RecordingsPage({
  meetings,
  isLoading,
  isError,
  error,
  onOpenRecording,
}: RecordingsPageProps) {

  // Pagination state
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const pageSize = 4;
  // Paginate meetings
  const readyRecordings = meetings.filter((meeting) => {return meeting.recordingState === "READY" && meeting.finalRecording !== null});
  const paginatedMeetings = readyRecordings.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(readyRecordings.length / pageSize);

  const processingRecordings = paginatedMeetings.filter(
    (meeting) =>
      meeting.recordingState === "PROCESSING" ||
      meeting.recordingState === "UPLOADING" ||
      meeting.recordingState === "RECORDING"
  );
  const failedRecordings = paginatedMeetings.filter((meeting) => meeting.recordingState === "FAILED");

  const deleteMutation = useMutation({
    mutationFn: async (roomId: string) => {
      await http.delete(`/recording/delete/${roomId}`);
    },

    onError: (error, _id) => {
      toast.error(getHttpErrorMessage(error, "Failed to delete recording."));
    },

    onSuccess: async () => {
      setDeletingId(null);
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Recording deleted successfully");
    },
  });

  return (
    <section className="rounded-2xl border border-[#f5a623]/10 bg-white/[0.022] p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5a623]/55">
            Recordings
          </p>
          <h2 className="mt-1 text-[26px] font-black leading-none tracking-tight text-[#fff5de]">
            Playback, export, and status in one view
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b49650]/65">
            Ready assets, in-progress merges, and failed jobs stay visible inside
            the dashboard instead of sending you to a separate route.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Ready", value: readyRecordings.length },
            { label: "Processing", value: processingRecordings.length },
            { label: "Failed", value: failedRecordings.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[#f5a623]/10 bg-black/18 px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b49650]/55">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-black text-[#fff5de]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/10 bg-black/18 px-4 py-2 text-sm text-[#fff5de]/65">
          <LoaderCircle className="size-4 animate-spin" />
          Loading recordings...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-sm text-red-300/85">
          <p className="inline-flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4" />
            {getHttpErrorMessage(error, "Could not load recordings.")}
          </p>
        </div>
      ) : (meetings.length === 0 || readyRecordings.length === 0) ? (
        <div className="rounded-2xl border border-[#f5a623]/10 bg-black/18 px-5 py-6 text-sm text-[#a89880]">
          No recordings found yet. End a recorded meeting and it will appear here.
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { title: "Ready to export", items: readyRecordings, tone: "ready" },
            { title: "Still processing", items: processingRecordings, tone: "processing" },
            { title: "Attention needed", items: failedRecordings, tone: "failed" },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f5a623]/55">
                    {group.title}
                  </p>
                  <span className="text-[11px] text-[#b49650]/45">
                    {group.items.length} item{group.items.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {group.items.map((meeting, index) => (
                    meeting.finalRecording !== null && (
                      <motion.div
                        key={meeting.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: index * 0.03 }}
                        className="rounded-2xl border border-[#f5a623]/8 bg-black/18 p-4 text-left transition hover:border-[#f5a623]/18 hover:bg-black/28 cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex space-x-3">
                              <p className="truncate text-[15px] font-bold text-[#fff5de]">
                                {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
                              </p>
                              <span
                                className={[
                                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                                  group.tone === "ready"
                                    ? "border border-green-500/20 bg-green-500/12 text-green-300"
                                    : group.tone === "failed"
                                      ? "border border-red-500/20 bg-red-500/12 text-red-300"
                                      : "border border-[#f5a623]/20 bg-[#f5a623]/10 text-[#f5a623]",
                                ].join(" ")
                              }
                              >
                                {group.tone === "ready"
                                  ? "Ready"
                                  : group.tone === "failed"
                                    ? "Failed"
                                    : "Processing"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#b49650]/60">
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3" />
                                {getMeetingParticipantCount(meeting)} participants
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="size-3" />
                                {new Date(getMeetingDate(meeting)).toLocaleDateString()}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="size-3" />
                                {getDuration(meeting.startedAt, meeting.endedAt)}
                              </span>
                            </div>
                          </div>

                          <button
                            className="cursor-pointer border border-neutral-800 rounded-lg px-2 py-2 hover:bg-red-500 hover:text-white transition-colors duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(meeting.roomId);
                            }}
                            disabled={deletingId === meeting.id}
                            aria-label="Delete recording"
                          >
                            {deletingId === meeting.id ? (
                              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/10 bg-[#f5a623]/7 px-3 py-1.5 text-[11px] font-medium text-[#f5d08d]">
                            <Video className="size-3.5" />
                            {group.tone === "ready" ? "Open recording" : "View status"}
                          </div>
                          <motion.button
                            initial={{ opacity: 0, x: 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: 0.1 + index * 0.03 }}
                            className="flex items-center cursor-pointer gap-1 rounded-full border border-[#f5a623]/15 bg-[#f5a623]/10 px-4 py-2 text-[12px] font-bold text-[#f5a623] transition hover:border-[#f5a623]/30 hover:bg-[#f5a623]/14 focus:outline-none focus:ring-2 focus:ring-[#f5a623]/40"
                            onClick={() => onOpenRecording(meeting.id)}
                          >
                            More details
                            <ChevronRight className="size-4 text-[#f5a623]/70" />
                          </motion.button>
                        </div>
                      </motion.div>
                    )
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pt-6 flex justify-center">
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
    </section>
  );
}
