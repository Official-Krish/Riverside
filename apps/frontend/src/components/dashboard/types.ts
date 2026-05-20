import type { MeetingDetails } from "@repo/types/api";

export type MeetingsProps = {
  meetings: MeetingDetails[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onOpenMeeting: (meeting: MeetingDetails) => void;
  onOpenRecording: (recordingId: string) => void;
};

export function getMeetingParticipantCount(meeting: MeetingDetails) {
  return meeting.participants.length;
}

export function getMeetingDate(meeting: MeetingDetails) {
  return meeting.createdAt;
}

export function getStatusTone(meeting: MeetingDetails) {
  if (!meeting.isEnded) {
    return "live";
  }

  if (meeting.recordingState === "READY") {
    return "ended with ready recording";
  }

  if (meeting.recordingState === "FAILED") {
    return "failed";
  }

  return "processing";
}

export function getStatusLabel(meeting: MeetingDetails) {
  if (!meeting.isEnded) {
    return "Live";
  }

  if (meeting.recordingState === "READY") {
    return "ended with ready recording";
  }

  if (meeting.recordingState === "FAILED") {
    return "Failed";
  }

  if (meeting.recordingState === "PROCESSING") {
    return "Processing";
  }

  return "Ended";
}

export type RecordingsPageProps = {
  meetings: MeetingDetails[];
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onOpenRecording: (recordingId: string) => void;
};

export function getDuration(
  start?: Date | string | null,
  end?: Date | string | null,
) {
  if (!start || !end) return "00:00:00";

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diff = endDate.getTime() - startDate.getTime();

  return new Date(diff).toISOString().substring(11, 19);
}
