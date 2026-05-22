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
  ModeToggle,
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
        <div className="flex min-h-[calc(100vh-140px)] flex-col rounded-3xl border border-[#f5a623]/12 bg-[#0f0d0a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] xl:sticky xl:top-24">
          <div className="space-y-4 border-b border-white/6 pb-5">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f5d08d]">
                Step 1 of 2
              </span>
              <span className="hidden rounded-full border border-white/8 bg-white/3 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c8a870]/55 sm:inline-flex">
                Room setup
              </span>
            </div>
            <h1 className="text-[24px] font-black leading-tight tracking-tight text-[#fff5de]">
              {mode === "create" ? "Create a meeting" : "Join a meeting"}
            </h1>
            <p className="max-w-xl text-[13px] leading-relaxed text-[#c8a870]/58">
              Configure the room, then move to the camera preflight on the
              right.
            </p>
            <ModeToggle mode={mode} onChange={setMode} />
          </div>

          <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
            <div className="rounded-2xl border border-white/6 bg-black/20 p-4">
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
                      formId="meeting-setup-create"
                      roomName={createRoomName}
                      passcode={createPasscode}
                      inviteEmail={inviteEmail}
                      invites={invites}
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
                      formId="meeting-setup-join"
                      meetingId={joinMeetingId}
                      passcode={joinPasscode}
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

            <div className="mt-auto pt-2">
              <button
                type="submit"
                form={
                  mode === "create"
                    ? "meeting-setup-create"
                    : "meeting-setup-join"
                }
                disabled={
                  isBusy ||
                  (mode === "create"
                    ? !createRoomName.trim()
                    : !joinMeetingId.trim())
                }
                className="sticky bottom-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#ffcf6b] via-[#f5a623] to-[#d98a10] px-5 py-3 text-sm font-extrabold text-[#1b1100] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <Plus className="size-4 animate-pulse" />
                ) : mode === "create" ? (
                  <Plus className="size-4" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {mode === "create" ? "Create & Join Meeting" : "Join Meeting"}
              </button>
            </div>
          </div>
        </div>

        {/* Right — preview */}
        <div className="relative flex max-h-[calc(100vh-140px)] flex-col gap-4 overflow-hidden rounded-3xl border border-[#f5a623]/12 bg-[#0f0d0a] p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#f5a623]/55">
                Camera preview
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#c8a870]/58">
                Check framing, verify your mic, and make sure the room feels
                ready before you enter.
              </p>
            </div>
            <span className="inline-flex w-fit shrink-0 whitespace-nowrap rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5d08d]">
              Step 2 of 2
            </span>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-4 pb-12">
              <DevicePreview videoRef={videoRef} previewError={previewError} />

              <div className="rounded-2xl border border-[#f5a623]/12 bg-[#0b0a08] px-4 py-3">
                <div className="flex items-center gap-2.5 text-[11px] font-semibold text-[#fff5de]/78">
                  <span className="size-2 rounded-full bg-green-400/80" />
                  Camera ready
                  <span className="text-[#b49650]/40">·</span>
                  Mic detected
                  <span className="text-[#b49650]/40">·</span>
                  Local recording
                </div>
              </div>

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

              <div className="rounded-2xl border border-[#f5a623]/10 bg-black/18 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f5a623]/58 pt-8">
                    Join options
                  </p>
                  <span className="text-[11px] text-[#c8a870]/45">
                    Optional
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setJoinWithVideoOff((current) => !current)}
                    className={[
                      "group flex min-h-24 items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition cursor-pointer",
                      joinWithVideoOff
                        ? "border-[#f5a623]/28 bg-[#f5a623]/12 text-[#fff5de] shadow-[0_12px_24px_rgba(245,166,35,0.09)] ring-1 ring-[#f5a623]/20"
                        : "border-white/8 bg-white/4 text-[#fff5de]/78 hover:border-[#f5a623]/18 hover:bg-white/6",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border transition",
                        joinWithVideoOff
                          ? "border-[#f5a623]/25 bg-[#f5a623]/12 text-[#f5a623]"
                          : "border-white/8 bg-black/15 text-[#f5a623]/75 group-hover:bg-black/10",
                      ].join(" ")}
                    >
                      {joinWithVideoOff ? (
                        <VideoOff className="size-4" />
                      ) : (
                        <Video className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-tight text-[#fff5de]">
                        Join with camera off
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-[#c8a870]/65">
                        Enter dark, then turn camera on when you are ready.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setJoinWithMicOff((current) => !current)}
                    className={[
                      "group flex min-h-24 items-start gap-3 rounded-[18px] border px-4 py-4 text-left transition cursor-pointer",
                      joinWithMicOff
                        ? "border-[#f5a623]/28 bg-[#f5a623]/12 text-[#fff5de] shadow-[0_12px_24px_rgba(245,166,35,0.09)] ring-1 ring-[#f5a623]/20"
                        : "border-white/8 bg-white/4 text-[#fff5de]/78 hover:border-[#f5a623]/18 hover:bg-white/6",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border transition",
                        joinWithMicOff
                          ? "border-[#f5a623]/25 bg-[#f5a623]/12 text-[#f5a623]"
                          : "border-white/8 bg-black/15 text-[#f5a623]/75 group-hover:bg-black/10",
                      ].join(" ")}
                    >
                      {joinWithMicOff ? (
                        <MicOff className="size-4" />
                      ) : (
                        <Mic className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-tight text-[#fff5de]">
                        Join muted
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-[#c8a870]/65">
                        Helpful when a recording is already live and you join
                        late.
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#f5a623]/12 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5a623]/60">
                      Mic test
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#c8a870]/60">
                      {micMonitorEnabled
                        ? "Listen to your own voice and watch the input level move in real time."
                        : "Press Listen to test your mic before you continue."}
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
                    className={[
                      "h-full rounded-full transition-[width,background-color] duration-150",
                      micMonitorEnabled
                        ? "bg-linear-to-r from-[#ffcf6b] via-[#f5a623] to-[#d98a10]"
                        : "bg-[#5d5547]",
                    ].join(" ")}
                    style={{
                      width: micMonitorEnabled
                        ? `${Math.max(8, micLevel)}%`
                        : "100%",
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#b49650]/55">
                  <span>
                    {micMonitorEnabled ? "Input level" : "Press Listen to test"}
                  </span>
                  <span>{micMonitorEnabled ? `${micLevel}%` : "Inactive"}</span>
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

              <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
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
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-[#0f0d0a] to-transparent" />
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
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#c8a870]/70">
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
