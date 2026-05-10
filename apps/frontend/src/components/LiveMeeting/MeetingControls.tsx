import {
  Circle,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  OctagonX,
  PhoneOff,
  Sidebar,
  Video,
  VideoOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type ReactNode, useEffect, useRef, useState, useCallback } from "react";

/** How long (ms) of mouse inactivity before controls hide */
const HIDE_AFTER_MS = 3000;

type MeetingControlsProps = {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSidebarOpen: boolean;
  isChatOpen: boolean;
  activeLayout: "grid" | "focus";
  isHost: boolean;
  isUploadingChunks: boolean;
  isRecordingBusy: boolean;
  canToggleRecording: boolean;
  recordingLimitExceeded?: boolean;
  unreadMessages: number;
  recordingButtonLabel: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSidebar: () => void;
  onToggleChat: () => void;
  onToggleLayout: () => void;
  onToggleRecording: () => void;
  onEndForAll: () => void;
  onLeaveCall: () => void;
};

type ControlButtonProps = {
  label: string;
  hint: string;
  kbd?: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  icon: ReactNode;
  disabled?: boolean;
  badge?: string | number | null;
  /** Shows a pulsing ring around the button (e.g. mic active / speaking) */
  speakingRing?: boolean;
  /** Shows a red blinking dot inside the button (recording indicator) */
  recDot?: boolean;
};

function ControlButton({
  label,
  hint,
  kbd,
  onClick,
  active,
  danger,
  icon,
  disabled,
  badge,
  speakingRing,
  recDot,
}: ControlButtonProps) {
  return (
    <div className="group relative flex flex-col items-center gap-1.5">
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full mb-3 w-max max-w-44 rounded-xl border border-white/8 bg-[#080603]/97 px-2.5 py-2 text-center text-[11px] text-[#f5e8cb] opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.5)] transition duration-200 group-hover:opacity-100 z-50">
        {hint}
        {kbd && (
          <span className="ml-1.5 inline-block rounded border border-white/20 bg-white/10 px-1 py-px font-mono text-[10px] text-[#d0b070]">
            {kbd}
          </span>
        )}
      </div>

      <div className="relative">
        {/* Pulsing speaking ring */}
        {speakingRing && (
          <span className="absolute inset-[-5px] rounded-[18px] border-2 border-[rgba(245,166,35,0.5)] animate-[pulse-ring_1.8s_ease-in-out_infinite] pointer-events-none" />
        )}

        <motion.button
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.96 }}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={[
            "relative flex h-[46px] w-[46px] items-center justify-center rounded-[14px] border transition-all duration-150",
            danger
              ? "border-red-400/35 bg-red-700/88 text-white hover:bg-red-600/92"
              : active
                ? "border-[#f5c362]/42 bg-gradient-to-br from-[#ffcf6b] via-[#f5a623] to-[#d98a10] text-[#1b1100] shadow-[0_8px_20px_rgba(245,166,35,0.24)]"
                : "border-[#f5a623]/14 bg-[#18120d]/95 text-[#f4e2bf] hover:border-[#f5a623]/28 hover:bg-[#21180f]",
            disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
          ].join(" ")}
          aria-label={label}
        >
          {/* Recording blink dot */}
          {recDot && (
            <span className="absolute top-2 right-2 h-[9px] w-[9px] rounded-full bg-red-500 animate-[pulse-rec_1.3s_ease-in-out_infinite]" />
          )}

          {icon}

          {/* Unread badge */}
          {badge != null && (
            <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {badge}
            </span>
          )}
        </motion.button>
      </div>

      <span className="text-[9.5px] font-medium text-[#c6a96f]">{label}</span>
    </div>
  );
}

function ControlGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0 rounded-[22px] border border-white/7 bg-black/20 px-3 pt-1.5 pb-2.5">
      <span className="mb-2 self-start text-[9px] font-semibold uppercase tracking-[0.22em] text-[#7a6240]">
        {title}
      </span>
      <div className="flex items-end gap-2">{children}</div>
    </div>
  );
}

/** Thin vertical divider between sections */
function Divider() {
  return (
    <div className="mx-0.5 h-8 w-px self-center bg-white/8" aria-hidden />
  );
}

export function MeetingControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isSidebarOpen,
  isChatOpen,
  activeLayout,
  isHost,
  isUploadingChunks,
  isRecordingBusy,
  canToggleRecording,
  recordingLimitExceeded,
  unreadMessages,
  recordingButtonLabel,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSidebar,
  onToggleChat,
  onToggleLayout,
  onToggleRecording,
  onEndForAll,
  onLeaveCall,
}: MeetingControlsProps) {
  const recordingActive = recordingButtonLabel.toLowerCase().includes("stop");
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  useEffect(() => {
    resetHideTimer();

    const handleActivity = () => {
      resetHideTimer();
    };

    window.addEventListener("pointermove", handleActivity, { passive: true });
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }

      window.removeEventListener("pointermove", handleActivity);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [resetHideTimer]);

  return (
    <>
      {/* Keyframe definitions — inject once via a style tag */}
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.18); }
        }
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>

      <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 flex flex-col items-center gap-2 px-3">
        {/* Upload progress pill — now sits above bar for visibility */}
        <AnimatePresence>
          {isUploadingChunks && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#f5a623]/20 bg-[#120f0a]/96 px-4 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[#d0af72]"
            >
              {/* Spinner */}
              <span className="block h-2 w-2 animate-spin rounded-full border-[1.5px] border-[rgba(245,166,35,0.3)] border-t-[#f5a623]" />
              Uploading chunks
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main control bar */}
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={controlsVisible ? { y: 0, opacity: 1 } : { y: 14, opacity: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          onPointerMove={resetHideTimer}
          onPointerDown={resetHideTimer}
          onFocusCapture={resetHideTimer}
          className={[
            "pointer-events-auto flex max-w-[calc(100vw-1.5rem)] flex-wrap items-end justify-center gap-2 rounded-[32px] border border-[#f5a623]/16 bg-[#0e0b08]/90 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.52)] backdrop-blur-md transition-[transform,opacity] duration-200",
            controlsVisible ? "translate-y-0" : "pointer-events-none translate-y-3",
          ].join(" ")}
          aria-hidden={!controlsVisible}
        >
          {/* ── Media ── */}
          <ControlGroup title="Media">
            <ControlButton
              label={isMuted ? "Unmute" : "Mute"}
              hint={isMuted ? "Unmute your microphone" : "Mute your microphone"}
              kbd="M"
              onClick={onToggleAudio}
              active={!isMuted}
              speakingRing={!isMuted}
              icon={isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            />
            <ControlButton
              label={isVideoOff ? "Start cam" : "Stop cam"}
              hint={isVideoOff ? "Turn camera on" : "Pause your camera"}
              kbd="V"
              onClick={onToggleVideo}
              active={!isVideoOff}
              icon={isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
            />
            <ControlButton
              label={isScreenSharing ? "Stop share" : "Share"}
              hint={isScreenSharing ? "Stop sharing your screen" : "Share screen with the room"}
              kbd="S"
              onClick={onToggleScreenShare}
              active={isScreenSharing}
              icon={<MonitorUp size={18} />}
            />
          </ControlGroup>

          {/* ── Room ── */}
          <ControlGroup title="Room">
            <ControlButton
              label={activeLayout === "focus" ? "Grid" : "Focus"}
              hint={
                activeLayout === "focus"
                  ? "Return to grid view"
                  : "Pin one participant, shrink others"
              }
              kbd="L"
              onClick={onToggleLayout}
              active={activeLayout === "focus"}
              icon={<LayoutGrid size={18} />}
            />
            <ControlButton
              label={isSidebarOpen ? "Hide users" : "Users"}
              hint={isSidebarOpen ? "Close participant list" : "Open participant list"}
              kbd="U"
              onClick={onToggleSidebar}
              active={isSidebarOpen}
              icon={<Sidebar size={18} />}
            />
            <ControlButton
              label={isChatOpen ? "Hide chat" : "Chat"}
              hint={isChatOpen ? "Close chat" : "Open chat & GitHub commands"}
              kbd="C"
              onClick={onToggleChat}
              active={isChatOpen}
              badge={
                unreadMessages > 0 && !isChatOpen
                  ? unreadMessages > 9
                    ? "9+"
                    : unreadMessages
                  : null
              }
              icon={<MessageSquare size={18} />}
            />
          </ControlGroup>

          {/* ── Actions (host only) ── */}
          {isHost && (
            <ControlGroup title="Actions">
              <ControlButton
                label={recordingActive ? "Stop rec" : "Record"}
                hint={
                  recordingActive
                    ? "Stop the current recording"
                    : recordingLimitExceeded
                      ? "Recording limit exceeded"
                      : canToggleRecording
                        ? "Start recording this meeting"
                        : "Recording unavailable right now"
                }
                onClick={onToggleRecording}
                active={recordingActive}
                disabled={isRecordingBusy || !canToggleRecording}
                recDot={recordingActive}
                icon={
                  <Circle
                    size={18}
                    className={recordingActive ? "text-red-400" : "text-[#a57a26]"}
                  />
                }
              />
              {/* Divider between record and destructive actions */}
              <Divider />
              <ControlButton
                label="End all"
                hint="End the meeting for every participant"
                onClick={onEndForAll}
                danger
                icon={<OctagonX size={18} />}
              />
            </ControlGroup>
          )}

          {/* ── Leave (always visible, separated) ── */}
          <Divider />
          <ControlButton
            label="Leave"
            hint="Leave this meeting"
            kbd="⌘W"
            onClick={onLeaveCall}
            danger
            icon={<PhoneOff size={18} />}
          />
        </motion.div>
      </div>
    </>
  );
}