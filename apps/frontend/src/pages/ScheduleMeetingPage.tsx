import { useMutation } from "@tanstack/react-query";
import {
  CalendarPlus,
  LoaderCircle,
  Mail,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { circOut, circIn } from "framer-motion";
import { format } from "date-fns";
import type { ScheduleMeetingResponse } from "@repo/types/api";
import { DatePickerTime } from "@/components/ui/TimePicker";
import { http } from "@/https";
import { getHttpErrorMessage } from "@/lib/httpError";
import { Checkbox } from "@/components/ui/checkbox";
import { type NotificationType } from "@/components/ScheduleMeeting/utils";
import { NotificationSelector } from "@/components/ScheduleMeeting/NotificationSelector";

const fadeSlide = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: circOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: circIn } },
};

const suggestedTimes = [
  { label: "09:00 AM", hours: 9, minutes: 0 },
  { label: "11:00 AM", hours: 11, minutes: 0 },
  { label: "02:00 PM", hours: 14, minutes: 0 },
  { label: "04:00 PM", hours: 16, minutes: 0 },
] as const;

export function ScheduleMeetingPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePreset, setRecurrencePreset] = useState<
    "daily" | "weekly" | "monthly" | "custom"
  >("weekly");
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [notificationType, setNotificationType] =
    useState<NotificationType | null>(null);
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");

  const normalizedInvite = useMemo(
    () => inviteEmail.trim().toLowerCase(),
    [inviteEmail],
  );

  const addInvite = () => {
    if (
      !normalizedInvite ||
      !normalizedInvite.includes("@") ||
      invites.includes(normalizedInvite)
    ) {
      return;
    }

    setInvites((current) => [...current, normalizedInvite]);
    setInviteEmail("");
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!startAt) throw new Error("Choose a start date and time.");

      const body: Record<string, unknown> = {
        title,
        description: description || undefined,
        startTime: startAt.toISOString(),
        isRecurring,
        recurrenceRule:
          isRecurring && recurrencePreset === "custom"
            ? recurrenceRule.trim() || undefined
            : isRecurring
              ? recurrencePreset
              : undefined,
        invitedParticipants: invites,
        notificationType: notificationType ?? undefined,
      };

      if (notificationType === "SLACK") {
        body.slackBotToken = slackBotToken;
        body.slackUserId = slackUserId;
      }
      if (notificationType === "DISCORD") {
        body.discordWebhookUrl = discordWebhookUrl;
      }

      const response = await http.post<ScheduleMeetingResponse>(
        "/meeting/create/schedule",
        body,
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Meeting scheduled");
      navigate("/dashboard?section=upcoming");
    },
    onError: (error) => {
      toast.error(
        getHttpErrorMessage(error, "Could not schedule the meeting."),
      );
    },
  });

  const selectedTimeLabel = startAt ? format(startAt, "p") : "09:00 AM";
  const selectedDateLabel = startAt
    ? format(startAt, "EEEE, MMMM d")
    : "Select a date";
  const notificationLabel =
    notificationType === "GMAIL"
      ? "Email"
      : notificationType === "SLACK"
        ? "Slack"
        : notificationType === "DISCORD"
          ? "Discord"
          : "None";
  const recurringLabel = isRecurring
    ? recurrencePreset === "custom"
      ? recurrenceRule.trim() || "Custom"
      : recurrencePreset.charAt(0).toUpperCase() + recurrencePreset.slice(1)
    : "Does not repeat";

  const summaryRows = [
    { label: "When", value: `${selectedDateLabel} · ${selectedTimeLabel}` },
    {
      label: "Participants",
      value:
        invites.length > 0 ? `${invites.length} invited` : "No invitees yet",
    },
    { label: "Notifications", value: notificationLabel },
  ];

  return (
    <div className="min-h-[calc(100vh-76px)] bg-[#0a0908] px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-6 flex items-start justify-between gap-4"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-3">
            <h1 className="max-w-3xl text-[44px] font-black leading-[1.02] tracking-tight text-[#fff5de]">
              Plan the room before anyone joins.
            </h1>
            <p className="max-w-2xl text-[13px] leading-6 text-[#b49650]/65">
              Create the room, choose when it starts, and keep everyone informed
              with the right notification channel.
            </p>
          </div>
        </motion.div>

        <motion.div
          className="rounded-3xl border border-[#f5a623]/10 bg-[#0f0d0a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06 }}
        >
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              scheduleMutation.mutate();
            }}
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
              <div className="space-y-6">
                <section className="space-y-4 rounded-3xl bg-black/12 p-0">
                  <div className="space-y-2">
                    <p className="inline-flex w-fit items-center rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5d08d]">
                      1. Meeting details
                    </p>
                    <p className="text-sm leading-6 text-[#b49650]/58">
                      Add the title and description participants will see.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[14px] font-medium text-[#fff5de]/88">
                      Title
                    </p>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Weekly product sync"
                      className="h-14 w-full rounded-xl border border-white/12 bg-white/4 px-4 text-[15px] text-[#fff5de] outline-none transition placeholder:text-[#b49650]/55 focus:border-[#f5a623]/40 focus:ring-2 focus:ring-[#f5a623]/15"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[14px] font-medium text-[#fff5de]/88">
                        Description
                      </p>
                      <span className="text-[11px] text-[#b49650]/45">
                        Optional · visible to all participants
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Share agenda or context for attendees"
                        rows={3}
                        maxLength={280}
                        className="w-full rounded-xl border border-white/12 bg-white/4 px-4 py-3 pb-7 text-[15px] text-[#fff5de] outline-none transition placeholder:text-[#b49650]/55 focus:border-[#f5a623]/40 focus:ring-2 focus:ring-[#f5a623]/15"
                      />
                      <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-[#b49650]/45">
                        {description.length}/280
                      </span>
                    </div>
                  </div>
                </section>

                <div className="h-px bg-white/8" />

                <section className="space-y-4 rounded-3xl bg-black/12 p-0">
                  <div className="space-y-2">
                    <p className="inline-flex w-fit items-center rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5d08d]">
                      2. Schedule
                    </p>
                    <p className="text-sm leading-6 text-[#b49650]/58">
                      Pick the best day and time, then choose whether it
                      repeats.
                    </p>
                  </div>

                  <DatePickerTime value={startAt} onChange={setStartAt} />

                  <div className="rounded-2xl border border-[#f5a623]/10 bg-black/18 p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5a623]/55">
                      <Sparkles className="size-3.5" />
                      Smart suggestions
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {suggestedTimes.map((slot) => (
                        <button
                          key={slot.label}
                          type="button"
                          onClick={() => {
                            const base = startAt
                              ? new Date(startAt)
                              : new Date();
                            base.setHours(slot.hours, slot.minutes, 0, 0);
                            setStartAt(base);
                          }}
                          className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[12px] font-medium text-[#fff5de]/82 transition hover:border-[#f5a623]/24 hover:bg-[#f5a623]/8"
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] text-[#b49650]/55">
                      Most attendees are available around 2:00 PM.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/18 p-4">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <p className="text-[14px] font-medium text-[#fff5de]">
                          Repeat
                        </p>
                        <p className="mt-1 text-[11px] text-[#b49650]/55">
                          Let this meeting repeat on a schedule.
                        </p>
                      </div>
                      <Checkbox
                        checked={isRecurring}
                        onCheckedChange={(checked: boolean | "indeterminate") =>
                          setIsRecurring(checked === true)
                        }
                        className="size-5 rounded border-white/20 bg-white/10"
                      />
                    </label>
                    <AnimatePresence>
                      {isRecurring && (
                        <motion.div
                          variants={fadeSlide}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          className="mt-4"
                        >
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              ["daily", "Daily"],
                              ["weekly", "Weekly"],
                              ["monthly", "Monthly"],
                              ["custom", "Custom"],
                            ].map(([value, label]) => {
                              const active = recurrencePreset === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() =>
                                    setRecurrencePreset(
                                      value as typeof recurrencePreset,
                                    )
                                  }
                                  className={[
                                    "rounded-xl border px-3 py-2 text-[12px] font-medium transition cursor-pointer",
                                    active
                                      ? "border-[#f5a623]/30 bg-[#f5a623]/12 text-[#fff5de]"
                                      : "border-white/10 bg-white/4 text-[#fff5de]/70 hover:border-[#f5a623]/18 hover:bg-[#f5a623]/6",
                                  ].join(" ")}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          {recurrencePreset === "custom" ? (
                            <input
                              value={recurrenceRule}
                              onChange={(event) =>
                                setRecurrenceRule(event.target.value)
                              }
                              placeholder="Every Friday at 10 AM"
                              className="mt-3 h-11 w-full rounded-xl border border-white/12 bg-white/4 px-4 text-sm text-[#fff5de] outline-none transition placeholder:text-[#b49650]/55 focus:border-[#f5a623]/40 focus:ring-2 focus:ring-[#f5a623]/15"
                            />
                          ) : (
                            <p className="mt-3 text-[11px] text-[#b49650]/55">
                              {recurrencePreset === "weekly"
                                ? "Repeats every week on the selected day."
                                : recurrencePreset === "daily"
                                  ? "Repeats every day at the selected time."
                                  : "Repeats every month on the selected date."}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                <div className="h-px bg-white/8" />

                <section className="space-y-4 rounded-3xl bg-black/12 p-0">
                  <div className="space-y-2">
                    <p className="inline-flex w-fit items-center rounded-full border border-[#f5a623]/14 bg-[#f5a623]/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5d08d]">
                      3. Invite & notify
                    </p>
                    <p className="text-sm leading-6 text-[#b49650]/58">
                      Add participants and choose how they get updates.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/18 p-4">
                    <p className="text-[14px] font-medium text-[#fff5de]/88">
                      Participants
                    </p>

                    <div className="mt-3 flex gap-2">
                      <div className="relative flex-1">
                        <input
                          value={inviteEmail}
                          onChange={(event) =>
                            setInviteEmail(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addInvite();
                            }
                          }}
                          placeholder="participant@email.com"
                          className="h-11 w-full rounded-xl border border-white/12 bg-white/4 px-4 pr-10 text-sm text-[#fff5de] outline-none transition placeholder:text-[#b49650]/55 focus:border-[#f5a623]/40 focus:ring-2 focus:ring-[#f5a623]/15"
                        />
                        <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#b49650]/60" />
                      </div>
                      <button
                        type="button"
                        onClick={addInvite}
                        className="inline-flex size-11 items-center justify-center rounded-xl border border-white/12 bg-white/4 text-[#fff5de] transition hover:border-[#f5a623]/24 hover:bg-[#f5a623]/10"
                      >
                        <UserPlus className="size-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <AnimatePresence>
                        {invites.length === 0 ? (
                          <div className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/8 bg-black/14 px-3 py-3 text-sm text-[#b49650]/60">
                            <UserPlus className="size-4 text-[#f5a623]/55" />
                            <span>Add teammates above.</span>
                          </div>
                        ) : (
                          invites.map((email) => (
                            <motion.span
                              key={email}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.15 }}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-[#fff5de]"
                            >
                              {email}
                              <button
                                type="button"
                                onClick={() =>
                                  setInvites((current) =>
                                    current.filter((item) => item !== email),
                                  )
                                }
                                className="text-[#b49650]/70 transition hover:text-[#fff5de]"
                              >
                                <X className="size-3" />
                              </button>
                            </motion.span>
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <NotificationSelector
                    notificationType={notificationType}
                    setNotificationType={setNotificationType}
                    slackBotToken={slackBotToken}
                    setSlackBotToken={setSlackBotToken}
                    slackUserId={slackUserId}
                    setSlackUserId={setSlackUserId}
                    discordWebhookUrl={discordWebhookUrl}
                    setDiscordWebhookUrl={setDiscordWebhookUrl}
                  />
                </section>
              </div>

              <aside className="rounded-3xl border border-white/8 bg-black/20 p-5 xl:sticky xl:top-24 xl:self-start">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5a623]/55">
                    Meeting preview
                  </p>
                  <h2 className="text-[28px] font-black leading-tight tracking-tight text-[#fff5de]">
                    {title.trim() || "Weekly Product Sync"}
                  </h2>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                      When
                    </p>
                    <p className="mt-1 text-[15px] font-semibold text-[#fff5de]">
                      {selectedDateLabel}
                    </p>
                    <p className="text-[14px] text-[#fff5de]/78">
                      {selectedTimeLabel}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                        Participants
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[#fff5de]">
                        {invites.length > 0
                          ? `${invites.length} invited`
                          : "No invitees yet"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                        Notifications
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[#fff5de]">
                        {notificationLabel}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                        Recurring
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[#fff5de]">
                        {recurringLabel}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                        Visibility
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-[#fff5de]">
                        Upcoming meetings
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#f5a623]/12 bg-[#f5a623]/6 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f5a623]/60">
                      Meeting behavior
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-[#fff5de]/78">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-green-400/80" />
                        Appears in dashboard
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#f5a623]/80" />
                        Participants receive invites
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#7db6ff]/80" />
                        Host can start anytime
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="space-y-3 rounded-2xl border-t border-white/8 pt-5">
              <div className="grid gap-2 rounded-2xl border border-white/8 bg-black/18 p-4 sm:grid-cols-3">
                {summaryRows.map((item) => (
                  <div key={item.label}>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#b49650]/55">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#fff5de]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <motion.button
                type="submit"
                disabled={
                  scheduleMutation.isPending || !title.trim() || !startAt
                }
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-5 text-sm font-extrabold text-[#1b1100] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scheduleMutation.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                Schedule Meeting
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
