import { useNavigate } from "react-router-dom";
import { TYPE_CONFIG } from "./config";
import {
  formatAbsoluteTimestamp,
  getNotificationContext,
  getNotificationSummary,
  getNotificationTitle,
  timeAgo,
} from "./helpers";
import type { Notification } from "./types";
import { motion } from "motion/react";
import { MeetingJoinPopover } from "@/components/Meetings";
import { getNotificationTone } from "./helpers";

export function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onAcceptRecording,
  onDeclineRecording,
  onAcceptInvite,
  isSelected,
  onToggleSelected,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAcceptRecording: (
    roomId: string,
    requestedBy: string,
    notifId: string,
  ) => void;
  onDeclineRecording: (notifId: string) => void;
  onAcceptInvite: (
    targetId: string,
    notifId: string,
    devices: {
      micId?: string;
      cameraId?: string;
      initialMicOff?: boolean;
      initialVideoOff?: boolean;
    },
  ) => Promise<void> | void;
  isSelected?: boolean;
  onToggleSelected?: (id: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type];
  const navigate = useNavigate();
  const title = getNotificationTitle(notification);
  const summary = getNotificationSummary(notification);
  const context = getNotificationContext(notification);
  const absoluteTime = formatAbsoluteTimestamp(notification.createdAt);
  const relativeTime = timeAgo(notification.createdAt);
  const tone = getNotificationTone(notification);
  const primaryActionLabel =
    notification.type === "RECORDING_READY" ||
    notification.type === "RECORDING_REQUEST_APPROVED"
      ? "View recording"
      : notification.type === "MEETING_INVITE"
        ? "Join meeting"
        : notification.type === "MEETING_REMINDER"
          ? "View meeting"
          : notification.type === "RECORDING_REQUEST"
            ? "Grant access"
            : notification.type === "RENDER_COMPLETE"
              ? "Download export"
              : notification.type === "MERGE_COMPLETE"
                ? "Open export"
                : null;

  const isActionable =
    notification.type === "RECORDING_REQUEST" ||
    notification.type === "MEETING_INVITE" ||
    notification.type === "MEETING_REMINDER" ||
    notification.type === "RECORDING_READY" ||
    notification.type === "RECORDING_REQUEST_APPROVED" ||
    notification.type === "RENDER_COMPLETE" ||
    notification.type === "MERGE_COMPLETE";

  const canOpenPrimaryAction =
    ((notification.type === "RECORDING_READY" ||
      notification.type === "RECORDING_REQUEST_APPROVED") &&
      Boolean(notification.metadata?.recordingId)) ||
    (notification.type === "MEETING_REMINDER" ? true : false) ||
    (notification.type === "RENDER_COMPLETE" &&
      Boolean(notification.metadata?.downloadUrl)) ||
    (notification.type === "MERGE_COMPLETE" &&
      Boolean(notification.metadata?.finalPath));

  const openPrimaryAction = () => {
    if (
      (notification.type === "RECORDING_READY" ||
        notification.type === "RECORDING_REQUEST_APPROVED") &&
      notification.metadata?.recordingId
    ) {
      onMarkRead(notification.id);
      navigate(`/recordings/${notification.metadata.recordingId}`);
      return;
    }

    if (notification.type === "MEETING_REMINDER") {
      onMarkRead(notification.id);
      navigate("/meeting/schedule");
      return;
    }

    if (
      notification.type === "RENDER_COMPLETE" &&
      notification.metadata?.downloadUrl
    ) {
      onMarkRead(notification.id);
      window.open(
        notification.metadata.downloadUrl,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    if (
      notification.type === "MERGE_COMPLETE" &&
      notification.metadata?.finalPath
    ) {
      onMarkRead(notification.id);
      window.open(
        notification.metadata.finalPath,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={`relative group overflow-hidden flex gap-4 rounded-[24px] border p-4 transition-all duration-200 ${tone.shell} ${
        notification.isRead ? "opacity-78" : tone.glow
      } hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_14px_36px_rgba(0,0,0,0.24)] cursor-pointer`}
      onClick={() => {
        if (canOpenPrimaryAction) {
          openPrimaryAction();
          return;
        }

        if (!notification.isRead) {
          onMarkRead(notification.id);
        }
      }}
    >
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-1.5 rounded-l-[24px] ${tone.rail}`}
      />

      {onToggleSelected ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelected(notification.id);
          }}
          className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
            isSelected
              ? "border-amber-400 bg-amber-400 text-black"
              : "border-white/15 bg-white/3 text-transparent group-hover:text-zinc-200"
          }`}
          aria-label="Select notification"
        >
          {isSelected ? "✓" : ""}
        </button>
      ) : null}

      <div
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${tone.icon}`}
      >
        {config.icon}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${notification.isRead ? "text-zinc-400" : tone.title}`}
            >
              {title}
            </span>
            <p
              className={`mt-1 text-sm leading-6 ${notification.isRead ? "text-zinc-500" : "font-medium text-zinc-100"}`}
            >
              {summary}
            </p>
            <p className="mt-2 text-xs text-zinc-500">{context}</p>
            {notification.type === "MEETING_REMINDER" &&
            notification.metadata?.scheduledAt ? (
              <p className="mt-1 text-xs text-zinc-500">
                Scheduled for{" "}
                {new Date(notification.metadata.scheduledAt).toLocaleString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </p>
            ) : null}
            {notification.type === "RECORDING_FAILED" ? (
              <p className="mt-2 text-xs text-red-300">
                {notification.metadata?.reason ||
                  "Contact support if you think this is a mistake."}
              </p>
            ) : null}
            {notification.type === "RENDER_FAILED" ||
            notification.type === "MERGE_FAILED" ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-red-300">
                  {notification.metadata?.error || "An unknown error occurred"}
                </p>
                {notification.metadata?.errorCode ? (
                  <p className="text-[11px] text-zinc-500">
                    Error code: {notification.metadata.errorCode}
                    {notification.metadata.recoverable === false ? (
                      <span className="ml-2 text-amber-500">
                        (non-recoverable)
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="absolute right-3 top-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-800 text-zinc-500 opacity-0 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(notification.id);
            }}
            aria-label="Delete notification"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <path d="M6 2h4a1 1 0 011 1v1H5V3a1 1 0 011-1zM3 5h10l-.8 8H3.8L3 5zm3 2v5h1V7H6zm3 0v5h1V7H9z" />
            </svg>
          </button>
        </div>

        {isActionable && !notification.isRead ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex flex-wrap items-center gap-2 pt-1"
            onClick={(event) => event.stopPropagation()}
          >
            {notification.type === "RECORDING_REQUEST" &&
            notification.metadata?.roomId &&
            notification.metadata?.requestedBy ? (
              <>
                <button
                  onClick={() =>
                    onAcceptRecording(
                      notification.metadata!.roomId!,
                      notification.metadata!.requestedBy!,
                      notification.id,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-3.5 py-2 text-xs font-semibold text-black cursor-pointer shadow-[0_12px_24px_rgba(245,166,35,0.18)] transition-all duration-150 active:scale-95 hover:brightness-110"
                >
                  Grant access
                </button>
                <button
                  onClick={() => onDeclineRecording(notification.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3.5 py-2 text-xs font-semibold text-zinc-200 cursor-pointer transition-all duration-150 active:scale-95 hover:border-white/20 hover:bg-white/6 hover:text-zinc-100"
                >
                  Decline
                </button>
              </>
            ) : null}

            {notification.type === "MEETING_INVITE" &&
            notification.metadata?.roomId ? (
              <MeetingJoinPopover
                triggerLabel="Join meeting"
                variant="blue"
                onJoin={async (devices) => {
                  await onAcceptInvite(
                    notification.metadata!.roomId!,
                    notification.id,
                    devices,
                  );
                  onMarkRead(notification.id);
                }}
              />
            ) : null}

            {canOpenPrimaryAction
              ? primaryActionButton(
                  primaryActionLabel,
                  openPrimaryAction,
                  tone.badge,
                )
              : null}
          </motion.div>
        ) : null}

        {!notification.isRead ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 transition-all hover:bg-emerald-400/15 cursor-pointer"
          >
            Mark as read
          </button>
        ) : null}

        <span
          className={`mt-2 flex items-center gap-2 text-[11px] ${notification.isRead ? "text-zinc-600" : "text-zinc-400"}`}
          title={absoluteTime}
        >
          <span
            className={`inline-block size-1.5 rounded-full ${notification.isRead ? "bg-zinc-600" : tone.dot}`}
          />
          {relativeTime}
        </span>
      </div>
    </motion.div>
  );
}

function primaryActionButton(
  label: string | null,
  onClick: () => void,
  className: string,
) {
  if (!label) {
    return null;
  }

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer transition-all duration-150 hover:brightness-110 ${className}`}
    >
      {label}
    </button>
  );
}
