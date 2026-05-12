import {
  AlertCircle,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Trash2,
  Users,
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

  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const pageSize = 4;
  const recordingItems = meetings.filter(
    (meeting) => meeting.recordingStartedAt !== null || meeting.recordingState !== "IDLE"
  );
  const readyRecordings = recordingItems.filter((meeting) => meeting.recordingState === "READY");
  const processingRecordings = recordingItems.filter(
    (meeting) =>
      meeting.recordingState === "PROCESSING" ||
      meeting.recordingState === "UPLOADING" ||
      meeting.recordingState === "RECORDING"
  );
  const failedRecordings = recordingItems.filter((meeting) => meeting.recordingState === "FAILED");
  const paginatedMeetings = recordingItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(recordingItems.length / pageSize);

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
    <div className="px-8 py-7">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#f5a623]/55">
            Recordings
          </p>
          <h2 className="mt-2 text-[26px] font-normal leading-none tracking-tight text-white font-serif">
            Playback, export, and status in one view
          </h2>
        </div>

        <div className="flex gap-0">
          {[
            { label: "Ready", value: readyRecordings.length },
            { label: "Processing", value: processingRecordings.length },
            { label: "Failed", value: failedRecordings.length },
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
          Loading recordings...
        </div>
      ) : isError ? (
        <div className="px-4 py-3 text-sm text-red-300/85 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {getHttpErrorMessage(error, "Could not load recordings.")}
        </div>
      ) : recordingItems.length === 0 ? (
        <div className="py-12 text-sm text-white/40">
          No recordings found yet. End a recorded meeting and it will appear here.
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { title: "Ready to export", items: paginatedMeetings.filter((meeting) => meeting.recordingState === "READY"), tone: "ready" },
            { title: "Still processing", items: paginatedMeetings.filter((meeting) => meeting.recordingState === "PROCESSING" || meeting.recordingState === "UPLOADING" || meeting.recordingState === "RECORDING"), tone: "processing" },
            { title: "Attention needed", items: paginatedMeetings.filter((meeting) => meeting.recordingState === "FAILED"), tone: "failed" },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-4 mb-5">
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/22">{group.title}</span>
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-[11px] text-white/45">{group.items.length} items</span>
                </div>

                <div className="grid grid-cols-2 gap-0">
                  {group.items.map((meeting, index) => (
                    meeting.finalRecording !== null && (
                      <motion.div
                        key={meeting.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: index * 0.03 }}
                        className="flex items-center gap-4 py-4 pr-6 hover:bg-white/3 transition-colors cursor-pointer px-4 rounded-lg border-b border-amber-300"
                        onClick={() => onOpenRecording(meeting.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[15px] font-medium text-white/85">
                              {meeting.roomName?.trim() || `Meeting ${meeting.roomId.slice(0, 8)}`}
                            </p>
                            <span
                              className={[
                                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                                group.tone === "ready"
                                  ? "border border-green-500/20 text-green-300/90"
                                  : group.tone === "failed"
                                    ? "border border-red-500/20 text-red-300/90"
                                    : "border border-white/15 text-white/50",
                              ].join(" ")}
                            >
                              {group.tone === "ready" ? "Ready" : group.tone === "failed" ? "Failed" : "Processing"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/35">
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
                              {getDuration(meeting.startedAt, meeting.endedAt)}
                            </span>
                          </div>
                        </div>

                        <button
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-white/40 hover:text-red-400 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(meeting.roomId);
                          }}
                          disabled={deletingId === meeting.id}
                          aria-label="Delete recording"
                        >
                          {deletingId === meeting.id ? (
                            <LoaderCircle className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </motion.div>
                    )
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      
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
    </div>
  );
}