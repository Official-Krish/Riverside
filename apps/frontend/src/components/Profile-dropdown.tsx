import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Sparkles,
  UserPen,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import type { UserProfileResponse } from "@repo/types/api";
import { http } from "../https";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Notification } from "./Notification/types";
import { notificationsQueryKey } from "./Notification/useNotifications";

type ProfileDropdownProps = {
  name?: string | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
  signOut: () => void;
  menuDirection?: "up" | "down";
  variant?: "compact" | "sidebar";
};

export function ProfileDropdown({
  name,
  theme,
  toggleTheme: _toggleTheme,
  signOut,
  menuDirection = "down",
  variant = "compact",
}: ProfileDropdownProps) {
  void _toggleTheme;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await http.get<UserProfileResponse>("/user/me");
      return response.data.user;
    },
    staleTime: 5 * 60 * 1000,
  });

  const queryClient = useQueryClient();
  const cachedNotifs = queryClient.getQueryData<Notification[]>(
    notificationsQueryKey,
  );
  const unreadCount = cachedNotifs?.filter((n) => !n.isRead).length ?? 0;

  const displayName =
    profileQuery.data?.name?.trim() || name?.trim() || "Weave User";
  const displayEmail = profileQuery.data?.email?.trim() || "";
  const displayAvatarUrl = profileQuery.data?.avatarUrl ?? null;
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={[
          variant === "sidebar"
            ? "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition cursor-pointer"
            : "inline-flex items-center gap-3 rounded-full border px-3 py-2 text-left transition cursor-pointer",
          theme === "dark"
            ? "border-white/12 bg-black/50 hover:border-white/20"
            : "border-[#b47800]/20 bg-[#fffdf7] shadow-sm hover:border-[#b47800]/35",
        ].join(" ")}
      >
        <div
          className={
            variant === "sidebar"
              ? "flex min-w-0 items-center gap-3"
              : "order-1 flex min-w-0 flex-col items-start"
          }
        >
          {variant === "sidebar" ? (
            <Avatar initial={initial} avatarUrl={displayAvatarUrl} size="sm" />
          ) : null}
          {variant === "sidebar" ? (
            <span className="hidden min-w-0 md:flex md:flex-col">
              <span
                className={[
                  "truncate text-sm font-bold leading-none",
                  theme === "dark" ? "text-[#fff5de]" : "text-[#1a1200]",
                ].join(" ")}
              >
                {displayName}
              </span>
              <span
                className={[
                  "mt-1 text-[11px]",
                  theme === "dark" ? "text-white/45" : "text-[#785a00]/60",
                ].join(" ")}
              >
                Free plan
              </span>
            </span>
          ) : (
            <>
              <span
                className={[
                  "truncate text-[13px] font-semibold leading-none",
                  theme === "dark" ? "text-[#fff5de]" : "text-[#1a1200]",
                ].join(" ")}
              >
                {firstName}
              </span>
              <span
                className={[
                  "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                  theme === "dark"
                    ? "border border-[#f5a623]/18 bg-[#f5a623]/10 text-[#f5a623]/85"
                    : "border border-[#b47800]/20 bg-[#f5a623]/10 text-[#7a4d00]",
                ].join(" ")}
              >
                <span className="size-1.5 rounded-full bg-[#f5a623]" />
                Free plan
              </span>
            </>
          )}
        </div>

        {variant !== "sidebar" ? (
          <Avatar initial={initial} avatarUrl={displayAvatarUrl} size="sm" />
        ) : null}

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={
            variant === "sidebar"
              ? "ml-3 inline-flex shrink-0"
              : "inline-flex shrink-0"
          }
        >
          <ChevronDown
            className={[
              "size-3",
              theme === "dark" ? "text-white/50" : "text-[#785a00]/50",
            ].join(" ")}
          />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className={[
              "absolute z-60 overflow-hidden rounded-[18px]",
              variant === "sidebar" ? "left-0 right-0 w-full" : "right-0 w-66",
              menuDirection === "up" ? "bottom-full mb-2" : "top-full mt-2",
              theme === "dark"
                ? "border border-[#f5a623]/12 bg-[#100e09]"
                : "border border-[#b47800]/18 bg-[#fffdf7]",
            ].join(" ")}
          >
            <div
              className={[
                "px-4 py-3.5",
                theme === "dark"
                  ? "border-b border-[#f5a623]/10"
                  : "border-b border-[#b47800]/12",
              ].join(" ")}
            >
              <div className="flex items-center gap-2.5">
                <Avatar
                  initial={initial}
                  avatarUrl={displayAvatarUrl}
                  size="md"
                />
                <div>
                  <p
                    className={[
                      "text-[15px] font-bold leading-tight",
                      theme === "dark" ? "text-[#fff5de]" : "text-[#1a1200]",
                    ].join(" ")}
                  >
                    {displayName}
                  </p>
                  <p
                    className={[
                      "mt-0.5 truncate text-[11px]",
                      theme === "dark"
                        ? "text-[#c8a870]/60"
                        : "text-[#785a00]/55",
                    ].join(" ")}
                  >
                    {profileQuery.isLoading ? "Loading…" : displayEmail}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-0.5 p-2">
              <MenuButton
                theme={theme}
                label="Edit profile"
                onClick={() => navigate("/profile")}
                icon={<UserPen className="size-3.5 cursor-pointer" />}
                shortcut="E"
              />
              <div className="relative">
                <MenuButton
                  theme={theme}
                  label="Notifications"
                  onClick={() => navigate("/notifications")}
                  icon={<Bell className="size-3.5 cursor-pointer" />}
                  shortcut="W"
                />
                {unreadCount > 0 && (
                  <span className="absolute right-10 top-1/2 flex h-4.5 min-w-4.5 -translate-y-1/2 items-center justify-center rounded-full bg-[#f5a623] px-1 text-[10px] font-bold leading-none text-black">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <MenuButton
                theme={theme}
                label="Theme (Coming soon)"
                icon={<Moon className="size-3.5" />}
                onClick={() =>
                  toast(
                    "Theme switching is coming soon! Stay tuned for updates.",
                  )
                }
              />
              <button
                type="button"
                className={[
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition cursor-pointer",
                  theme === "dark"
                    ? "border border-[#f5a623]/14 bg-[#f5a623]/8 hover:bg-[#f5a623]/13"
                    : "border border-[#b47800]/2 bg-[#f5a623]/10 hover:bg-[#f5a623]/16",
                ].join(" ")}
                onClick={() => navigate("/pricing")}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-[#ffcf6b] to-[#f5a623]">
                  <Sparkles className="size-3.5 text-[#1b1100]" />
                </span>
                <div>
                  <p
                    className={[
                      "text-[13px] font-bold",
                      theme === "dark" ? "text-[#f5c050]" : "text-[#7a4d00]",
                    ].join(" ")}
                  >
                    Upgrade to Pro
                  </p>
                  <p
                    className={[
                      "text-[11px]",
                      theme === "dark"
                        ? "text-[#c8a060]/60"
                        : "text-[#785a00]/50",
                    ].join(" ")}
                  >
                    Unlock all features
                  </p>
                </div>
              </button>
            </div>

            <div
              className={[
                "p-2",
                theme === "dark"
                  ? "border-t border-[#f5a623]/8"
                  : "border-t border-[#b47800]/10",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={signOut}
                className={[
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition cursor-pointer",
                  theme === "dark"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-red-500/7",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex size-8 items-center justify-center rounded-lg shrink-0",
                    theme === "dark" ? "bg-red-500/10" : "bg-red-500/7",
                  ].join(" ")}
                >
                  <LogOut
                    className={[
                      "size-3.5",
                      theme === "dark" ? "text-red-400/70" : "text-red-700/70",
                    ].join(" ")}
                  />
                </span>
                <span
                  className={[
                    "text-[13px] font-medium",
                    theme === "dark" ? "text-red-400/80" : "text-red-700/80",
                  ].join(" ")}
                >
                  Log out
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({
  initial,
  avatarUrl,
  size,
}: {
  initial: string;
  avatarUrl?: string | null;
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? "size-8 text-sm" : "size-10 text-base";

  if (avatarUrl) {
    return (
      <span
        className={`inline-flex ${dim} shrink-0 overflow-hidden rounded-full ${dim}`}
      >
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#ffcf6b] to-[#f5a623] font-extrabold text-[#1b1100]`}
    >
      {initial}
    </span>
  );
}

type MenuButtonProps = {
  label: string;
  icon: ReactNode;
  shortcut?: string;
  onClick?: () => void;
  theme: "light" | "dark";
};

function MenuButton({
  label,
  icon,
  shortcut,
  onClick,
  theme,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
        theme === "dark" ? "hover:bg-[#f5a623]/7" : "hover:bg-[#b47800]/7",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          theme === "dark" ? "bg-white/6" : "bg-black/4",
        ].join(" ")}
      >
        <span
          className={theme === "dark" ? "text-[#f5c878]/85" : "text-[#96670a]"}
        >
          {icon}
        </span>
      </span>
      <span
        className={[
          "flex-1 text-[13px] font-medium",
          theme === "dark" ? "text-[#fff5de]/90" : "text-[#2a1e00]",
        ].join(" ")}
      >
        {label}
      </span>
      {shortcut && (
        <span
          className={[
            "rounded-md px-2 py-0.5 text-[10px] font-semibold",
            theme === "dark"
              ? "border border-white/10 bg-white/6 text-white/35"
              : "border border-black/10 bg-black/5 text-black/35",
          ].join(" ")}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}
