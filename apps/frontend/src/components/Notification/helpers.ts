import type { Notification } from "./types";
import { TYPE_CONFIG } from "./config";

export function formatAbsoluteTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function getNotificationTitle(notification: Notification): string {
  switch (notification.type) {
    case "MEETING_INVITE":
      return "Meeting invite";
    case "MEETING_REMINDER":
      return "Meeting reminder";
    case "RECORDING_REQUEST":
      return "Recording access request";
    case "RECORDING_REQUEST_APPROVED":
      return "Recording access approved";
    case "RECORDING_REQUEST_DENIED":
      return "Recording access denied";
    case "RECORDING_READY":
      return "Recording ready";
    case "RECORDING_FAILED":
      return "Recording failed";
    case "RENDER_COMPLETE":
      return "Export ready";
    case "RENDER_FAILED":
      return "Export failed";
    case "MERGE_COMPLETE":
      return "Merge complete";
    case "MERGE_FAILED":
      return "Merge failed";
    default:
      return TYPE_CONFIG[notification.type].label;
  }
}

export function getNotificationSummary(notification: Notification): string {
  const roomName = notification.metadata?.roomName?.trim();
  if (roomName) {
    return roomName;
  }

  switch (notification.type) {
    case "MEETING_INVITE":
      return "Open the invite to join or review meeting details.";
    case "MEETING_REMINDER":
      return "Upcoming meeting reminder for your schedule.";
    case "RECORDING_REQUEST":
      return "Someone is asking for access to a recording.";
    case "RECORDING_REQUEST_APPROVED":
      return "Your access request was approved.";
    case "RECORDING_REQUEST_DENIED":
      return "Your access request was denied.";
    case "RECORDING_READY":
      return "Your recording is ready to review.";
    case "RECORDING_FAILED":
      return (
        notification.metadata?.reason?.trim() || "Recording processing failed."
      );
    case "RENDER_COMPLETE":
      return "Your export finished successfully.";
    case "RENDER_FAILED":
      return (
        notification.metadata?.error?.trim() || "Export processing failed."
      );
    case "MERGE_COMPLETE":
      return "Recording merge completed successfully.";
    case "MERGE_FAILED":
      return notification.metadata?.error?.trim() || "Recording merge failed.";
    default:
      return notification.message;
  }
}

export function getNotificationContext(notification: Notification): string {
  const roomName = notification.metadata?.roomName?.trim();
  if (roomName) {
    return roomName;
  }

  const roomId = notification.metadata?.roomId?.trim();
  if (roomId) {
    return "Meeting update";
  }

  const meetingId = notification.metadata?.meetingId?.trim();
  if (meetingId) {
    return "Meeting update";
  }

  const projectId = notification.metadata?.projectId?.trim();
  if (projectId) {
    return "Export update";
  }

  return "Notification";
}

export function getNotificationTone(notification: Notification) {
  switch (notification.type) {
    case "RECORDING_READY":
    case "RECORDING_REQUEST_APPROVED":
      return {
        rail: "bg-[linear-gradient(180deg,#34d399,#10b981)]",
        shell: "border-emerald-400/12 bg-[#111215]",
        glow: "ring-1 ring-emerald-400/8",
        icon: "border-emerald-400/12 bg-[#14161a] text-emerald-300",
        title: "text-emerald-300",
        badge: "border-emerald-400/16 bg-emerald-400/10 text-emerald-100",
        dot: "bg-emerald-300 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]",
      };
    case "RENDER_COMPLETE":
    case "MERGE_COMPLETE":
      return {
        rail: "bg-[linear-gradient(180deg,#34d399,#059669)]",
        shell: "border-emerald-400/12 bg-[#111215]",
        glow: "ring-1 ring-emerald-400/8",
        icon: "border-emerald-400/12 bg-[#14161a] text-emerald-300",
        title: "text-emerald-300",
        badge: "border-emerald-400/16 bg-emerald-400/10 text-emerald-100",
        dot: "bg-emerald-300 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]",
      };
    case "MEETING_REMINDER":
    case "MEETING_INVITE":
      return {
        rail: "bg-[linear-gradient(180deg,#5eead4,#14b8a6)]",
        shell: "border-cyan-400/12 bg-[#111215]",
        glow: "ring-1 ring-cyan-400/8",
        icon: "border-cyan-400/12 bg-[#14161a] text-cyan-300",
        title: "text-cyan-200",
        badge: "border-cyan-400/16 bg-cyan-400/10 text-cyan-100",
        dot: "bg-cyan-300 shadow-[0_0_0_5px_rgba(34,211,238,0.12)]",
      };
    case "RECORDING_FAILED":
    case "RENDER_FAILED":
    case "MERGE_FAILED":
      return {
        rail: "bg-[linear-gradient(180deg,#fb7185,#ef4444)]",
        shell: "border-red-400/12 bg-[#111215]",
        glow: "ring-1 ring-red-400/8",
        icon: "border-red-400/12 bg-[#141215] text-red-300",
        title: "text-red-300",
        badge: "border-red-400/16 bg-red-400/10 text-red-100",
        dot: "bg-red-300 shadow-[0_0_0_5px_rgba(239,68,68,0.12)]",
      };
    default:
      return {
        rail: "bg-[linear-gradient(180deg,#6b7280,#374151)]",
        shell: "border-white/10 bg-[#111215]",
        glow: "ring-1 ring-white/5",
        icon: "border-white/10 bg-[#14161a] text-zinc-200",
        title: "text-zinc-100",
        badge: "border-white/10 bg-white/5 text-zinc-200",
        dot: "bg-zinc-300 shadow-[0_0_0_5px_rgba(148,163,184,0.12)]",
      };
  }
}

export function groupByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const d = new Date(n.createdAt);
    const now = new Date();
    let label: string;
    if (d.toDateString() === now.toDateString()) label = "Today";
    else {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      label =
        d.toDateString() === yesterday.toDateString()
          ? "Yesterday"
          : d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export function groupByDateWithFilter(
  notifications: Notification[],
  filter: string,
) {
  const grouped = groupByDate(notifications);

  if (filter === "All") {
    return grouped;
  }

  return Object.fromEntries(
    Object.entries(grouped).map(([label, items]) => [label, items]),
  );
}
