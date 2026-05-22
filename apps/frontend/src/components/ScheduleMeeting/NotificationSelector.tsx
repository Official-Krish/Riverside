import { Bell, CheckCircle2, Mail, Webhook, AtSign } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { circOut, circIn } from "framer-motion";
import { NOTIFICATION_OPTIONS, type NotificationSelectorProps } from "./utils";

const fadeSlide = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: circOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: circIn } },
};

export function NotificationSelector({
  notificationType,
  setNotificationType,
  slackBotToken,
  setSlackBotToken,
  slackUserId,
  setSlackUserId,
  discordWebhookUrl,
  setDiscordWebhookUrl,
}: NotificationSelectorProps) {
  const helperText =
    notificationType === "GMAIL"
      ? "Email invitations will be sent automatically."
      : notificationType === "SLACK"
        ? "Slack DM details are required below."
        : notificationType === "DISCORD"
          ? "Discord webhook details are required below."
          : "No external notification. Participants will still see the meeting in-app.";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="size-3.5 text-[#f5a623]/70" />
        <p className="text-[12px] font-medium text-[#c8a870]/70">
          Notify participants via
        </p>
      </div>

      {/* Channel pills */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NOTIFICATION_OPTIONS.map((opt) => {
          const isSelected = notificationType === opt.id;
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => setNotificationType(opt.id)}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all duration-200 cursor-pointer
                ${
                  isSelected
                    ? "border-[#f5a623]/50 bg-[#f5a623]/12 text-[#ffd166] shadow-[0_0_0_1px_rgba(245,166,35,0.12)]"
                    : "border-white/10 bg-white/4 text-[#fff5de]/60 hover:border-white/20 hover:text-[#fff5de]/90"
                }`}
            >
              <span
                className={isSelected ? "text-[#f5a623]" : "text-[#b49650]/60"}
              >
                {opt.icon}
              </span>
              {opt.label}
              {isSelected && <CheckCircle2 className="size-3 text-[#f5a623]" />}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] leading-5 text-[#b49650]/60">{helperText}</p>

      {/* Credentials panel */}
      <AnimatePresence mode="wait">
        {notificationType === "GMAIL" && (
          <motion.div
            key="gmail"
            variants={fadeSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 text-[#ea4335]" />
              <p className="text-sm text-[#fff5de]/78">
                Email invitations will be sent automatically.
              </p>
            </div>
          </motion.div>
        )}

        {notificationType === "SLACK" && (
          <motion.div
            key="slack"
            variants={fadeSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            className="rounded-2xl border border-white/8 bg-white/4 p-4 space-y-3"
          >
            <div className="space-y-2.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#c8a870]/70">
                  Bot Token
                </label>
                <input
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-..."
                  className="h-10 w-full rounded-xl border border-white/12 bg-black/20 px-3 font-mono text-xs text-[#fff5de] outline-none transition focus:border-[#f5a623]/35 focus:ring-2 focus:ring-[#f5a623]/12"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#c8a870]/70">
                  Slack User ID
                </label>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#b49650]/40" />
                  <input
                    value={slackUserId}
                    onChange={(e) => setSlackUserId(e.target.value)}
                    placeholder="U0123456789"
                    className="h-10 w-full rounded-xl border border-white/12 bg-black/20 pl-8 pr-3 font-mono text-xs text-[#fff5de] outline-none transition focus:border-[#f5a623]/35 focus:ring-2 focus:ring-[#f5a623]/12"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {notificationType === "DISCORD" && (
          <motion.div
            key="discord"
            variants={fadeSlide}
            initial="hidden"
            animate="show"
            exit="exit"
            className="rounded-2xl border border-white/8 bg-white/4 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Webhook className="size-3.5 text-[#5865f2]" />
              <p className="text-sm text-[#fff5de]/78">
                Paste a Discord channel webhook URL below.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#c8a870]/70">
                Webhook URL
              </label>
              <input
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-10 w-full rounded-xl border border-white/12 bg-black/20 px-3 font-mono text-xs text-[#fff5de] outline-none transition focus:border-[#f5a623]/35 focus:ring-2 focus:ring-[#f5a623]/12"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
