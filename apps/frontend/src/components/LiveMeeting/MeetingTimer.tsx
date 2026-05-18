import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { http } from "../../https";
import { useNavigate } from "react-router-dom";

interface MeetingStatus {
  isEnded: boolean;
  elapsedMs: number;
  remainingMs: number;
  maxDurationMs: number;
  shouldAutoEnd: boolean;
  percentage: number;
}

interface MeetingTimerProps {
  meetingId: string;
  isHost: boolean;
  isRecording?: boolean;
}

export function MeetingTimer({
  meetingId,
  isHost,
  isRecording,
}: MeetingTimerProps) {
  const navigate = useNavigate();
  const hasEndedRef = useRef(false);
  const [displayTime, setDisplayTime] = useState({
    elapsed: 0,
    remaining: 0,
    percentage: 0,
    isEnded: false,
  });

  const { data: status } = useQuery<MeetingStatus>({
    queryKey: ["meeting-status", meetingId],
    queryFn: async () => {
      const response = await http.get<MeetingStatus>(
        `/meeting/status/${meetingId}`,
      );
      return response.data;
    },
    refetchInterval: 30000,
  });

  const endMeetingMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/meeting/end/${meetingId}`);
    },
    onSuccess: () => {
      navigate("/dashboard");
    },
  });

  useEffect(() => {
    if (!status || hasEndedRef.current) return;

    setDisplayTime({
      elapsed: status.elapsedMs,
      remaining: status.remainingMs || 0,
      percentage: status.percentage || 0,
      isEnded: status.isEnded,
    });

    if (status.isEnded) {
      hasEndedRef.current = true;
      navigate("/dashboard");
      return;
    }

    if (status.shouldAutoEnd) {
      hasEndedRef.current = true;
      if (isHost) {
        endMeetingMutation.mutate();
      } else {
        navigate("/dashboard");
      }
    }
  }, [status, isHost, navigate, endMeetingMutation]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const isWarning = displayTime.percentage >= 80;
  const isCritical = displayTime.percentage >= 95;

  return (
    <div
      className={`fixed left-4 ${isRecording ? "top-16" : "top-4"} z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
        isCritical
          ? "border border-red-500/50 bg-red-950/80 text-red-400"
          : isWarning
            ? "border border-amber-500/50 bg-amber-950/80 text-amber-400"
            : "border border-white/20 bg-black/40 text-white/70"
      }`}
    >
      <div className="relative h-2 w-20 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full transition-all duration-1000 ${
            isCritical
              ? "bg-red-500"
              : isWarning
                ? "bg-amber-500"
                : "bg-white/50"
          }`}
          style={{ width: `${Math.min(100, displayTime.percentage)}%` }}
        />
      </div>
      <span className="tabular-nums">{formatTime(displayTime.remaining)}</span>
    </div>
  );
}
