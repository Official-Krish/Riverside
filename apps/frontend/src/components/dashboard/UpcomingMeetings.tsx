import type { MeetingSchedule } from "@repo/types/api";
import { CalendarDays, Clock3, LoaderCircle, Repeat, Users, CalendarClock } from "lucide-react";
import { motion } from "motion/react";
import { MeetingJoinPopover } from "@/components/Meetings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/https";
import { toast } from "sonner";
import { getHttpErrorMessage } from "@/lib/httpError";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerTime } from "@/components/ui/TimePicker";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

type UpcomingMeetingsProps = {
  schedules: MeetingSchedule[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  joiningScheduleId?: string | null;
  onJoinSchedule: (scheduleId: string, devices: { micId?: string; cameraId?: string }) => Promise<void>;
  onScheduleMeeting: () => void;
  compact?: boolean;
  isDashboard?: boolean;
};

export function UpcomingMeetings({
  schedules,
  isLoading,
  isError,
  errorMessage,
  joiningScheduleId,
  onJoinSchedule,
  onScheduleMeeting,
  compact = false,
  isDashboard = false,
}: UpcomingMeetingsProps) {
  const queryClient = useQueryClient();
  const [rescheduleScheduleId, setRescheduleScheduleId] = useState<string | null>(null);
  const [rescheduleStartTime, setRescheduleStartTime] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  const upcoming = schedules
    .slice()
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const pageSize = 4;
  const totalPages = Math.ceil(upcoming.length / pageSize);
  const visibleSchedules = compact
    ? upcoming.slice(0, 3)
    : upcoming.slice((page - 1) * pageSize, page * pageSize);

  const activeSchedule = useMemo(
    () => upcoming.find((schedule) => schedule.id === rescheduleScheduleId) ?? null,
    [upcoming, rescheduleScheduleId]
  );

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, startTime }: { id: string; startTime: Date }) => {
      const response = await http.post(`/meeting/reschedule/schedule/${id}`, {
        startTime: startTime.toISOString(),
      });
      return response.data;
    },
    onSuccess: async () => {
      toast.success("Meeting rescheduled successfully.");
      setRescheduleScheduleId(null);
      setRescheduleStartTime(null);
      await queryClient.invalidateQueries({ queryKey: ["meetings"] });
    },
    onError: (error) => {
      toast.error(getHttpErrorMessage(error, "Could not reschedule the meeting."));
    },
  });

  const handleOpenReschedule = (schedule: MeetingSchedule, open: boolean) => {
    if (!open) {
      setRescheduleScheduleId((current) => (current === schedule.id ? null : current));
      setRescheduleStartTime((current) => (rescheduleScheduleId === schedule.id ? null : current));
      return;
    }
    setRescheduleScheduleId(schedule.id);
    setRescheduleStartTime(new Date(schedule.startTime));
  };

  const handleSubmitReschedule = async () => {
    if (!activeSchedule || !rescheduleStartTime) {
      toast.error("Choose a new start date and time.");
      return;
    }
    await rescheduleMutation.mutateAsync({
      id: activeSchedule.id,
      startTime: rescheduleStartTime,
    });
  };

  return (
    <div className={`${!compact ? 'px-8 py-7' : ''}`}>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#f5a623]/55">
            Upcoming meetings
          </p>
          <h2 className="mt-2 text-[26px] font-normal leading-none tracking-tight text-white font-serif">
            Scheduled rooms, ready when your team is
          </h2>
          {!isDashboard && (
            <p className="mt-2 text-sm text-white/45 font-light max-w-2xl leading-relaxed">
              Hosts can start the room from here, and invited participants can join once it goes live.
            </p>
          )}
        </div>
        {!isDashboard && (
          <button
            type="button"
            onClick={onScheduleMeeting}
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 hover:brightness-110 active:scale-[0.98] cursor-pointer"
            style={{
              background: "#f5a623",
              color: "#0C0C0E",
            }}
          >
            Schedule meeting
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white/65">
          <LoaderCircle className="size-4 animate-spin" />
          Loading scheduled meetings...
        </div>
      ) : isError ? (
        <div className="px-4 py-3 text-sm text-red-300/85">
          {errorMessage || "Could not load scheduled meetings."}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="py-12 text-sm text-white/40">
          No upcoming meetings yet. Schedule one to see it here.
        </div>
      ) : (
        <div className="space-y-0">
          {visibleSchedules.map((schedule, index) => {
            const start = new Date(schedule.startTime);
            const buttonLabel = schedule.isHost ? "Join as host" : "Join";
            const isRescheduleOpen = rescheduleScheduleId === schedule.id;

            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.03 }}
                className="flex items-center gap-4 py-5 border-b hover:bg-white/3 transition-colors px-4 rounded-lg border-amber-300"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-medium text-white/85">{schedule.title}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/15 text-white/50">
                      {schedule.isHost ? "Host" : "Participant"}
                    </span>
                  </div>

                  {schedule.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-white/45">{schedule.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-white/35">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {start.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {schedule.participantCount} participant{schedule.participantCount !== 1 ? "s" : ""}
                    </span>
                    {schedule.isRecurring ? (
                      <span className="flex items-center gap-1">
                        <Repeat className="size-3" />
                        Recurring
                      </span>
                    ) : null}
                  </div>
                </div>
                
                {!isDashboard && (
                  <div className="flex items-center gap-2">
                    {schedule.isHost ? (
                      <Popover
                        open={isRescheduleOpen}
                        onOpenChange={(open) => handleOpenReschedule(schedule, open)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white/55 hover:text-white/85 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                          >
                            <CalendarClock className="size-3.5" />
                            Reschedule
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[420px] border border-white/10 bg-[#0C0C0E] p-4 text-white"
                          align="end"
                        >
                          <div className="space-y-4">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5a623]/75">
                                Reschedule meeting
                              </p>
                              <h3 className="mt-1 text-base font-medium text-white">{schedule.title}</h3>
                              <p className="mt-1 text-sm leading-relaxed text-white/45">
                                Pick a new start time and attendees will receive an updated reminder.
                              </p>
                            </div>

                            <DatePickerTime
                              value={rescheduleStartTime}
                              onChange={setRescheduleStartTime}
                              dateLabel="New date"
                              timeLabel="New time"
                            />

                            <div className="flex items-center justify-between px-4 py-3 text-sm text-white/50 bg-white/5 rounded-xl border border-white/8">
                              <span>Current start</span>
                              <span className="font-medium text-white">{start.toLocaleString()}</span>
                            </div>

                            <Button
                              type="button"
                              onClick={() => void handleSubmitReschedule()}
                              disabled={rescheduleMutation.isPending || !rescheduleStartTime}
                              className="h-11 w-full font-semibold text-black hover:brightness-105 cursor-pointer disabled:pointer-events-none disabled:opacity-50"
                              style={{ background: "#f5a623" }}
                            >
                              {rescheduleMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
                              Save new time
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}

                    <MeetingJoinPopover
                      triggerLabel={buttonLabel}
                      scheduleId={schedule.id}
                      cancelMeetingLabel={schedule.isHost ? "Cancel meeting" : null}
                      busy={joiningScheduleId === schedule.id}
                      onJoin={(devices) => onJoinSchedule(schedule.id, devices)}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}

          {!compact && !isDashboard && totalPages > 1 && (
            <div className="pt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      aria-disabled={page === 1}
                      tabIndex={page === 1 ? -1 : 0}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }).map((_, index) => (
                    <PaginationItem key={index}>
                      <PaginationLink
                        isActive={page === index + 1}
                        onClick={() => setPage(index + 1)}
                        className="cursor-pointer"
                      >
                        {index + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
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