import { AnimatePresence, motion } from "motion/react";
import {
  LogIn,
  Mic,
  MicOff,
  Plus,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CreateMeetingForm,
  DevicePreview,
  JoinMeetingForm,
} from "../components/Meetings";
import { useAuth } from "../hooks/useAuth";
import { useMeetingSetup } from "../hooks/useMeetingSetup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function MeetingSetupPage() {
  const navigate = useNavigate();
  const { name } = useAuth();

  const {
    videoRef,
    mode,
    setMode,
    createRoomName,
    setCreateRoomName,
    createPasscode,
    setCreatePasscode,
    joinMeetingId,
    setJoinMeetingId,
    joinPasscode,
    setJoinPasscode,
    inviteEmail,
    setInviteEmail,
    invites,
    cameraDevices,
    micDevices,
    selectedCameraId,
    setSelectedCameraId,
    selectedMicId,
    setSelectedMicId,
    joinWithMicOff,
    setJoinWithMicOff,
    joinWithVideoOff,
    setJoinWithVideoOff,
    micLevel,
    micMonitorEnabled,
    monitorAudioRef,
    toggleMicMonitor,
    previewError,
    errorMessage,
    addInvite,
    removeInvite,
    createMeetingMutation,
    joinMeetingMutation,
    isBusy,
    busyLabel,
    submitCreate,
    submitJoin,
  } = useMeetingSetup({ displayNameFallback: name || "", navigate });

  return (
    <div className="flex min-h-[calc(100vh-76px)] items-center justify-center bg-[#0a0908] px-4 py-8 sm:px-5 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="grid w-full max-w-215 gap-4 xl:grid-cols-[minmax(0,1fr)_440px]"
      >
        {/* Left — form */}
        <div className="flex flex-col gap-5 rounded-3xl border border-[#f5a623]/12 bg-[#0f0d0a] p-7">
          {/* Brand */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="7" fill="#111009" />
                <path
                  d="M5 9 L11 23 L16 12 L21 23 L27 9"
                  stroke="url(#wg)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffcf6b" />
                    <stop offset="100%" stopColor="#c97d10" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-[16px] font-extrabold tracking-tight text-[#fff5de]">
                Weave
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f5a623]/55">
              Ready to record
            </p>
            <h1 className="mt-1 text-[22px] font-black leading-tight tracking-tight text-[#fff5de]">
              {mode === "create" ? "Create a meeting" : "Join a meeting"}
            </h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#c8a870]/55">
              Configure your room, then check your camera and mic on the right.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["create", "join"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  "flex items-center gap-2.5 rounded-[14px] border p-3 text-left transition cursor-pointer",
                  mode === m
                    ? "border-[#f5a623]/28 bg-[#f5a623]/9"
                    : "border-white/7 bg-white/2 hover:border-[#f5a623]/15 hover:bg-[#f5a623]/4",
                ].join(" ")}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f5a623]/10 text-[#f5a623]">
                  {m === "create" ? (
                    <Plus className="size-3.5" />
                  ) : (
                    <LogIn className="size-3.5" />
                  )}
                </span>
                <div>
                  <p className="text-[13px] font-bold text-[#fff5de]">
                    {m === "create" ? "Create" : "Join"}
                  </p>
                  <p className="text-[11px] text-[#b49650]/55">
                    {m === "create" ? "Start a new room" : "Enter a room ID"}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <div className="h-px bg-[#f5a623]/8" />

          {/* Form */}
          <div className="overflow-hidden rounded-2xl border border-white/6 bg-black/20 p-4">
            <AnimatePresence mode="wait" initial={false}>
              {mode === "create" ? (
                <motion.div
                  key="create"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <CreateMeetingForm
                    roomName={createRoomName}
                    passcode={createPasscode}
                    inviteEmail={inviteEmail}
                    invites={invites}
                    isBusy={isBusy}
                    isPending={createMeetingMutation.isPending}
                    onRoomNameChange={setCreateRoomName}
                    onPasscodeChange={setCreatePasscode}
                    onInviteEmailChange={setInviteEmail}
                    onAddInvite={addInvite}
                    onRemoveInvite={removeInvite}
                    onSubmit={submitCreate}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="join"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <JoinMeetingForm
                    meetingId={joinMeetingId}
                    passcode={joinPasscode}
                    isBusy={isBusy}
                    isPending={joinMeetingMutation.isPending}
                    onMeetingIdChange={setJoinMeetingId}
                    onPasscodeChange={setJoinPasscode}
                    onSubmit={submitJoin}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {busyLabel ? (
            <p className="rounded-xl border border-[#f5a623]/15 bg-[#f5a623]/8 px-4 py-2.5 text-[12px] text-[#f5d08d]">
              {busyLabel}
            </p>
          ) : null}

          {errorMessage && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] text-red-400">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Right — preview */}
        <div className="flex flex-col gap-4 rounded-3xl border border-[#f5a623]/12 bg-[#0f0d0a] p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f5a623]/55">
                Camera preview
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#c8a870]/58">
                Check framing, verify your mic, and make sure the room feels
                ready before you enter.
              </p>
            </div>
            <span className="rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5d08d]">
              Preflight
            </span>
          </div>

          <DevicePreview videoRef={videoRef} previewError={previewError} />

          {/* Device selectors */}
          <div className="flex flex-col gap-2.5">
            <DeviceSelect
              icon={<Video className="size-3" />}
              label="Camera"
              devices={cameraDevices}
              value={selectedCameraId}
              onChange={setSelectedCameraId}
            />
            <DeviceSelect
              icon={<Mic className="size-3" />}
              label="Microphone"
              devices={micDevices}
              value={selectedMicId}
              onChange={setSelectedMicId}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setJoinWithVideoOff((current) => !current)}
              className={[
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition cursor-pointer",
                joinWithVideoOff
                  ? "border-[#f5a623]/24 bg-[#f5a623]/10 text-[#fff5de]"
                  : "border-white/8 bg-white/4 text-[#fff5de]/78 hover:border-[#f5a623]/18 hover:bg-[#f5a623]/6",
              ].join(" ")}
            >
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]">
                  Join with camera off
                </span>
                <span className="mt-1 block text-[12px] text-[#c8a870]/65">
                  Enter dark, then turn camera on when you are ready.
                </span>
              </span>
              {joinWithVideoOff ? (
                <VideoOff className="size-4 text-[#f5a623]" />
              ) : (
                <Video className="size-4 text-[#f5a623]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setJoinWithMicOff((current) => !current)}
              className={[
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition cursor-pointer",
                joinWithMicOff
                  ? "border-[#f5a623]/24 bg-[#f5a623]/10 text-[#fff5de]"
                  : "border-white/8 bg-white/4 text-[#fff5de]/78 hover:border-[#f5a623]/18 hover:bg-[#f5a623]/6",
              ].join(" ")}
            >
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.14em]">
                  Join muted
                </span>
                <span className="mt-1 block text-[12px] text-[#c8a870]/65">
                  Helpful when a recording is already live and you join late.
                </span>
              </span>
              {joinWithMicOff ? (
                <MicOff className="size-4 text-[#f5a623]" />
              ) : (
                <Mic className="size-4 text-[#f5a623]" />
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-[#f5a623]/12 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5a623]/60">
                  Mic test
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#c8a870]/60">
                  Listen to your own voice and watch the input level move in
                  real time.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleMicMonitor}
                className={[
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition cursor-pointer",
                  micMonitorEnabled
                    ? "border-[#f5a623]/24 bg-[#f5a623]/12 text-[#f5c050]"
                    : "border-white/8 bg-white/4 text-[#fff5de]/75 hover:border-[#f5a623]/18 hover:bg-[#f5a623]/8",
                ].join(" ")}
              >
                <Volume2 className="size-3.5" />
                {micMonitorEnabled ? "Stop" : "Listen"}
              </button>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-linear-to-r from-[#ffcf6b] via-[#f5a623] to-[#d98a10] transition-[width] duration-150"
                style={{ width: `${Math.max(8, micLevel)}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#b49650]/55">
              <span>Input level</span>
              <span>{micLevel}%</span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-[#c8a870]/55">
              Use headphones while monitoring to avoid feedback.
            </p>
          </div>

          <audio
            ref={monitorAudioRef}
            autoPlay
            playsInline
            className="hidden"
          />

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5a623]/60">
              Before you continue
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                "Frame your face in the center of the preview.",
                "Use headphones if you enable mic monitoring.",
                "Invite teammates now or share the room after joining.",
                "Network drops will not affect local capture quality.",
              ].map((tip) => (
                <div
                  key={tip}
                  className="rounded-xl border border-white/7 bg-black/18 px-3 py-3 text-[12px] leading-5 text-[#fff5de]/78"
                >
                  {tip}
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-[#f5a623]/8" />

          {/* Status row */}
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: "Camera ready", ok: !previewError },
              { label: "Mic detected", ok: micDevices.length > 0 },
              { label: "Local recording", ok: true },
            ].map(({ label, ok }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[11px] text-[#b49650]/60"
              >
                <span
                  className={[
                    "size-1.5 rounded-full",
                    ok ? "bg-green-400/80" : "bg-red-400/70",
                  ].join(" ")}
                />
                {label}
              </div>
            ))}
          </div>

          <p className="rounded-xl border border-[#f5a623]/10 bg-[#f5a623]/6 px-3.5 py-2.5 text-[11px] leading-relaxed text-[#c8a870]/60">
            Recording happens locally on each device — network quality never
            affects your audio or video.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

type DeviceSelectProps = {
  icon: React.ReactNode;
  label: string;
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (id: string) => void;
};

function DeviceSelect({
  icon,
  label,
  devices,
  value,
  onChange,
}: DeviceSelectProps) {
  const hasDevices = devices.length > 0;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b49650]/60">
        <span className="text-[#f5a623]/50">{icon}</span>
        {label}
      </p>
      <Select value={value} onValueChange={onChange} disabled={!hasDevices}>
        <SelectTrigger className="h-11 w-full rounded-xl border border-white/8 bg-white/4 px-3 text-[12px] font-medium text-[#fff5de]/80 shadow-none outline-none transition focus-visible:border-[#f5a623]/45 focus-visible:ring-2 focus-visible:ring-[#f5a623]/20">
          <SelectValue
            placeholder={
              hasDevices
                ? `Select ${label.toLowerCase()}`
                : `No ${label.toLowerCase()} found`
            }
          />
        </SelectTrigger>
        <SelectContent className="border border-[#f5a623]/12 bg-[#100e09] text-[#fff5de] shadow-xl">
          {devices.map((device) => (
            <SelectItem
              key={device.deviceId}
              value={device.deviceId}
              className="text-[12px] focus:bg-[#f5a623]/12 focus:text-[#fff5de]"
            >
              {device.label || `${label} ${device.deviceId.slice(0, 6)}`}
            </SelectItem>
          ))}
          {!hasDevices && (
            <SelectItem
              value="none"
              disabled
              className="text-[12px] text-[#b49650]/55"
            >
              No {label.toLowerCase()} found
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
