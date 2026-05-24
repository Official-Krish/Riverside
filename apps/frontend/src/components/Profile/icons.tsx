import { BACKEND_URL } from "@/lib/config";
import type { Meeting } from "./types";
import { useGoogleAuth } from "../Authentication/useAuthMutations";
import { useAuth } from "@/hooks/useAuth";

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "host" | "guest";
}) {
  const styles = {
    default: "border border-amber-400/20 bg-amber-400/10 text-amber-200",
    host: "border border-amber-400/24 bg-amber-400/12 text-amber-200",
    guest: "border border-white/10 bg-white/[0.04] text-zinc-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function MeetingRow({
  meeting,
  dark,
}: {
  meeting: Meeting;
  dark: boolean;
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-all ${
        dark
          ? "border-white/8 bg-black/20 hover:-translate-y-0.5 hover:border-amber-400/20 hover:bg-white/[0.04]"
          : "bg-white border-zinc-200 hover:border-amber-400/40 hover:bg-zinc-50"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${meeting.isHost ? "bg-amber-400/16 text-amber-200" : "bg-white/[0.04] text-zinc-300"}`}
        >
          <svg
            width="18"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="4"
              width="14"
              height="12"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="currentColor"
              opacity="0.08"
            />
            <path d="M20 7l-4 2v-4l4 2z" fill="currentColor" />
          </svg>
        </div>
        <div className="min-w-0">
          <div
            className={`text-sm font-semibold truncate ${dark ? "text-white" : "text-zinc-900"}`}
          >
            {meeting.roomName}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div
          className={`flex items-center gap-2 text-sm ${dark ? "text-zinc-400" : "text-zinc-500"}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="text-zinc-400"
          >
            <path
              d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <circle
              cx="9"
              cy="7"
              r="4"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          <span className="font-medium">{meeting.participants.length}</span>
        </div>
        <Badge variant={meeting.isHost ? "host" : "guest"}>
          {meeting.isHost ? "Host" : "Guest"}
        </Badge>
      </div>
    </div>
  );
}

export function ComingSoonCard({
  icon,
  title,
  description,
  dark,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  dark: boolean;
}) {
  return (
    <div
      className={`flex gap-2 rounded-[22px] border p-5 transition-all ${
        dark
          ? "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.05]"
          : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${dark ? "bg-white/[0.05] text-amber-200" : "bg-zinc-200 text-zinc-500"}`}
      >
        {icon}
      </div>
      <div>
        <div
          className={`text-sm font-semibold flex items-center gap-2 ${dark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          {title}
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${dark ? "bg-white/[0.05] text-zinc-500" : "bg-zinc-200 text-zinc-400"}`}
          >
            Soon
          </span>
        </div>
        <div
          className={`text-xs mt-0.5 ${dark ? "text-zinc-600" : "text-zinc-400"}`}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

export const IntegerationCard = ({
  id,
  icon,
  title,
  description,
  dark,
  connected,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  dark: boolean;
  connected?: boolean | null;
}) => {
  const { token } = useAuth();
  console.log("Auth token in IntegerationCard:", token);
  const { startGoogleLogin } = useGoogleAuth(() => {});
  return (
    <div
      className={`flex gap-2 rounded-[22px] border p-5 transition-all ${
        dark
          ? "border-white/8 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/12 hover:bg-white/[0.05]"
          : "border-zinc-200 bg-zinc-50 hover:border-zinc-300"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${dark ? "bg-white/[0.05] text-amber-200" : "bg-zinc-200 text-zinc-500"}`}
      >
        {icon}
      </div>
      <div>
        <div
          className={`text-sm font-semibold flex items-center gap-2 ${dark ? "text-zinc-300" : "text-zinc-700"}`}
        >
          {title}
          {connected && connected != null && (
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.2em] ${dark ? "bg-green-500/20 text-green-400" : "bg-green-200 text-green-600"}`}
            >
              Connected
            </span>
          )}
        </div>
        <div
          className={`text-xs mt-0.5 ${dark ? "text-zinc-600" : "text-zinc-400"}`}
        >
          {description}
        </div>
        {!connected && connected != null && (
          <button
            className={`mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold transition-all ${
              dark
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100 hover:border-amber-300/30 hover:bg-amber-400/14"
                : "text-amber-600 hover:text-amber-500 "
            }`}
            onClick={() => {
              if (id === "google-calendar-integration") {
                startGoogleLogin();
              } else if (id === "github-integration") {
                window.location.href = `${BACKEND_URL}/github?token=${token}`;
              }
            }}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
};
