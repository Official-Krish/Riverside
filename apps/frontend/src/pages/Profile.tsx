import { Billing } from "@/components/Profile/Billing";
import { Integerations } from "@/components/Profile/Integerations";
import { Meetings } from "@/components/Profile/Meetings";
import { Overview } from "@/components/Profile/Overview";
import { ProfileCard } from "@/components/Profile/ProfileCard";
import type { User } from "@/components/Profile/types";
import { useAuth } from "@/hooks/useAuth";
import { http } from "@/https";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "motion/react";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "meetings" | "billing" | "integrations"
  >("overview");
  const { isAuthenticated } = useAuth();
  const dark = true;

  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await http.get<{ user: User }>("/user/profile");
      return response.data.user;
    },
    enabled: isAuthenticated,
  });

  const user: User = userQuery.data ?? {
    name: "Error fetching user",
    email: "Error fetching email",
    avatarUrl: null,
    googleId: null,
    githubUsername: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hostedMeetings: [],
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "meetings", label: "Meetings" },
    { id: "billing", label: "Billing" },
    { id: "integrations", label: "Integrations" },
  ] as const;

  return (
    <motion.div
      className={`relative min-h-screen overflow-hidden px-4 pb-16 pt-10 transition-colors duration-300 ${
        dark ? "bg-[#090909]" : "bg-zinc-100"
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.35 }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.14),transparent_58%)]" />
        <div className="absolute inset-x-0 top-24 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <ProfileCard user={user} dark={dark} />

            {/* Stats grid + Upgrade card */}
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 rounded-[20px] border border-white/10 bg-white/[0.02] p-3">
                {(() => {
                  const meetingsHosted = user.hostedMeetings.length;
                  const participantsTotal = user.hostedMeetings.reduce(
                    (s, m) => s + (m.participants?.length || 0),
                    0,
                  );
                  const hoursRecorded = 0; // placeholder — implement actual metric when available
                  const encryption = "AES";
                  return [
                    { label: "Meetings hosted", value: meetingsHosted },
                    { label: "Participants total", value: participantsTotal },
                    { label: "Hours recorded", value: hoursRecorded },
                    { label: "Encryption", value: encryption },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col gap-1 rounded-[12px] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] p-3 text-sm"
                    >
                      <div className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        {label}
                      </div>
                      <div className="text-lg font-semibold text-white">
                        {value}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(25,24,24,0.98),rgba(12,12,12,0.92))] p-5">
                <div className="text-sm font-semibold text-amber-200">
                  Unlock Pro
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  4K export, unlimited recordings, custom rooms, and priority
                  support.
                </div>
                <button className="mt-4 w-full rounded-xl bg-[linear-gradient(135deg,#ffd166,#f5a623)] px-4 py-2 text-sm font-semibold text-black">
                  Upgrade now
                </button>
              </div>
            </div>
          </div>

          <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(12,12,12,0.94))] p-4 shadow-[0_18px_80px_rgba(0,0,0,0.33)]">
            <div className="mb-4 rounded-[22px] border border-white/8 bg-black/25 p-1.5">
              <div className="grid gap-1 sm:grid-cols-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative rounded-2xl px-4 py-3 text-center text-sm font-medium cursor-pointer transition-all duration-200 ${
                      activeTab === tab.id
                        ? "text-white"
                        : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                    }`}
                  >
                    {activeTab === tab.id ? (
                      <motion.span
                        layoutId="profile-tab-pill"
                        className="absolute inset-0 rounded-2xl border border-amber-400/20 bg-[linear-gradient(180deg,rgba(245,166,35,0.16),rgba(245,166,35,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(245,166,35,0.08)]"
                        transition={{
                          type: "spring",
                          stiffness: 320,
                          damping: 28,
                        }}
                      />
                    ) : null}
                    <span className="relative z-10 flex items-center justify-between gap-3">
                      <span
                        className={`text-[10px] text-center uppercase tracking-[0.22em] w-full ${activeTab === tab.id ? "text-amber-200/85" : "text-zinc-600"}`}
                      >
                        {tab.label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "overview" && (
              <Overview user={user} setActiveTab={setActiveTab} dark={dark} />
            )}

            {activeTab === "meetings" && (
              <Meetings meetings={user.hostedMeetings} dark={dark} />
            )}

            {activeTab === "billing" && <Billing dark={dark} />}

            {activeTab === "integrations" && (
              <Integerations
                dark={dark}
                googleId={user.googleId}
                githubUsername={user.githubUsername}
              />
            )}
          </section>
        </div>
      </div>
    </motion.div>
  );
}
