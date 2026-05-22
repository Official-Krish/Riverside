import { X } from "lucide-react";
import type { NotificationType } from "./types";

export const TYPE_CONFIG: Record<
  NotificationType,
  {
    label: string;
    icon: React.ReactNode;
    accent: string;
    bg: string;
    darkBg: string;
  }
> = {
  RECORDING_REQUEST: {
    label: "Recording Request",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
      </svg>
    ),
    accent: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    darkBg: "dark:bg-amber-500/10 dark:border-amber-500/20",
  },
  RECORDING_REQUEST_APPROVED: {
    label: "Recording Request Approved",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-green-500",
    bg: "bg-green-500/10 border-green-500/20",
    darkBg: "dark:bg-green-500/10 dark:border-green-500/20",
  },
  RECORDING_REQUEST_DENIED: {
    label: "Recording Request Denied",
    icon: <X className="w-5 h-5" />,
    accent: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    darkBg: "dark:bg-red-500/10 dark:border-red-500/20",
  },
  RECORDING_READY: {
    label: "Recording Ready",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    darkBg: "dark:bg-emerald-500/10 dark:border-emerald-500/20",
  },
  RECORDING_FAILED: {
    label: "Recording Failed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    darkBg: "dark:bg-red-500/10 dark:border-red-500/20",
  },
  MEETING_INVITE: {
    label: "Meeting Invite",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
      </svg>
    ),
    accent: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    darkBg: "dark:bg-blue-500/10 dark:border-blue-500/20",
  },
  MEETING_REMINDER: {
    label: "Reminder",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
      </svg>
    ),
    accent: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    darkBg: "dark:bg-violet-500/10 dark:border-violet-500/20",
  },
  OTHER: {
    label: "Update",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    darkBg: "dark:bg-zinc-500/10 dark:border-zinc-500/20",
  },
  RENDER_COMPLETE: {
    label: "Export Ready",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    darkBg: "dark:bg-emerald-500/10 dark:border-emerald-500/20",
  },
  RENDER_FAILED: {
    label: "Export Failed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    darkBg: "dark:bg-red-500/10 dark:border-red-500/20",
  },
  MERGE_COMPLETE: {
    label: "Merge Complete",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    darkBg: "dark:bg-emerald-500/10 dark:border-emerald-500/20",
  },
  MERGE_FAILED: {
    label: "Merge Failed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    ),
    accent: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    darkBg: "dark:bg-red-500/10 dark:border-red-500/20",
  },
};
