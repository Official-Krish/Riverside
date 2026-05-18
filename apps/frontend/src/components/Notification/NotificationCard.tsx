import { useNavigate } from "react-router-dom";
import { TYPE_CONFIG } from "./config";
import { timeAgo } from "./helpers";
import type { Notification } from "./types";
import { motion } from "motion/react";
import { MeetingJoinPopover } from "@/components/Meetings";

export function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onAcceptRecording,
  onDeclineRecording,
  onAcceptInvite,
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
}) {
  const config = TYPE_CONFIG[notification.type];
  const navigate = useNavigate();
  const isActionable =
    notification.type === "RECORDING_REQUEST" ||
    notification.type === "MEETING_INVITE" ||
    notification.type === "MEETING_REMINDER" ||
    notification.type === "RECORDING_READY" ||
    notification.type === "RECORDING_REQUEST_APPROVED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={`
        relative group flex gap-4 rounded-[24px] border p-4 transition-all duration-200
        ${
          notification.isRead
            ? "border-white/8 bg-white/[0.025]"
            : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_14px_40px_rgba(0,0,0,0.2)]"
        }
        hover:-translate-y-0.5 hover:border-white/14
      `}
    >
      {/* Icon */}
      <div
        className={`
          flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
          ${config.bg} ${config.accent}
        `}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <span
              className={`
                text-[11px] font-semibold uppercase tracking-[0.24em]
                ${config.accent}
              `}
            >
              {config.label}
            </span>
            <p
              className={`
                mt-1 text-sm leading-6
                ${
                  notification.isRead
                    ? "text-zinc-500"
                    : "font-medium text-zinc-100"
                }
              `}
            >
              {notification.message}
            </p>
            {/* Room metadata pill */}
            {notification.metadata?.roomId && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                  <svg
                    viewBox="0 0 12 12"
                    className="w-2.5 h-2.5"
                    fill="currentColor"
                  >
                    <circle cx="6" cy="6" r="2" />
                    <circle
                      cx="6"
                      cy="6"
                      r="5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                  {notification.metadata.roomId}
                </span>
              </div>
            )}
            {/* Scheduled time for reminders */}
            {notification.type === "MEETING_REMINDER" &&
              notification.metadata?.scheduledAt && (
                <p className="text-xs text-zinc-500 mt-2">
                  Scheduled:{" "}
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
              )}
            {/* Failed reason */}
            {notification.type === "RECORDING_FAILED" && (
              <p className="font-mono text-xs text-red-300 mt-2">
                ↳ {notification?.metadata?.reason} || Contact support if you
                think this is a mistake.
              </p>
            )}
            {/* Action buttons */}
            {isActionable && !notification.isRead && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {notification.type === "RECORDING_REQUEST" && (
                  <>
                    <button
                      onClick={() =>
                        onAcceptRecording(
                          notification.metadata!.roomId!,
                          notification.metadata!.requestedBy!,
                          notification.id,
                        )
                      }
                      className="
                        inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-3.5 py-2 text-xs font-semibold text-black cursor-pointer
                        shadow-[0_12px_24px_rgba(245,166,35,0.18)] transition-all duration-150 active:scale-95
                        hover:bg-[linear-gradient(135deg,#ffd166,#f5a623)] hover:brightness-110
                      "
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="w-3 h-3"
                      >
                        <path d="M2 4a2 2 0 012-2h5l4 4v6a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm9.5 3.5l-4-4H4a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V7.5z" />
                        <path
                          d="M5.5 9.5l1.5 1.5 3-3"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Grant Access
                    </button>
                    <button
                      onClick={() => onDeclineRecording(notification.id)}
                      className="
                        inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold
                        text-zinc-200 cursor-pointer
                        transition-all duration-150 active:scale-95
                        hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100
                      "
                    >
                      Decline
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {isActionable && !notification.isRead && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 pt-1"
                onClick={(e) => e.stopPropagation()}
              >
                {(notification.type === "RECORDING_READY" ||
                  notification.type === "RECORDING_REQUEST_APPROVED") && (
                  <>
                    <button
                      onClick={() => {
                        onMarkRead(notification.id);
                        navigate(
                          `/recordings/${notification?.metadata?.recordingId}`,
                        );
                      }}
                      className="
                        inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-3.5 py-2 text-xs font-semibold text-black cursor-pointer
                        shadow-[0_12px_24px_rgba(245,166,35,0.18)] transition-all duration-150 active:scale-95
                        hover:bg-[linear-gradient(135deg,#ffd166,#f5a623)] hover:brightness-110
                      "
                    >
                      View Recording
                    </button>
                  </>
                )}
              </motion.div>
            )}

            {/* Mark as read button */}
            {!notification.isRead && (
              <button
                onClick={() => onMarkRead(notification.id)}
                className="mt-2 rounded-lg cursor-pointer border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition-all"
              >
                Mark as read
              </button>
            )}
            {/* Time ago */}
            <span className="mt-2 flex-shrink-0 text-[11px] text-zinc-500 block">
              {timeAgo(notification.createdAt)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {isActionable && !notification.isRead && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center gap-2 pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            {notification.type === "MEETING_INVITE" && (
              <>
                <MeetingJoinPopover
                  triggerLabel="Join meeting"
                  variant="blue"
                  onJoin={async (devices) => {
                    if (!notification.metadata?.roomId) {
                      return;
                    }

                    await onAcceptInvite(
                      notification.metadata.roomId,
                      notification.id,
                      devices,
                    );
                    onMarkRead(notification.id);
                  }}
                />
                <button
                  onClick={() => onDeclineRecording(notification.id)}
                  className="
                    inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold
                    text-zinc-200 cursor-pointer
                    transition-all duration-150 active:scale-95
                    hover:border-white/20 hover:bg-white/6 hover:text-zinc-100
                  "
                >
                  Decline
                </button>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* Delete always visible */}
      <button
        className="absolute right-8 cursor-pointer top-3 flex h-7 w-7 items-center border border-neutral-800 justify-center rounded-lg text-zinc-500 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        aria-label="Delete notification"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M6 2h4a1 1 0 011 1v1H5V3a1 1 0 011-1zM3 5h10l-.8 8H3.8L3 5zm3 2v5h1V7H6zm3 0v5h1V7H9z" />
        </svg>
      </button>
    </motion.div>
  );
}
