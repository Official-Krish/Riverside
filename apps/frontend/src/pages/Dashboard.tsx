import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { GetAllMeetingsResponse, JoinMeetingResponse } from "@repo/types/api";
import { toast } from "sonner";
import { CalendarDays, LayoutDashboard, Sparkles, Video } from "lucide-react";
import { Meetings } from "../components/dashboard/Meetings";
import { RecordingsPage } from "../components/dashboard/RecordingsPage";
import { useAuth } from "../hooks/useAuth";
import { http } from "../https";
import { getHttpErrorMessage } from "../lib/httpError";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Overview } from "@/components/dashboard/Overview";
import { Topbar } from "@/components/dashboard/Topbar";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { buildMeetingLivePath } from "@/lib/meeting";

type ThemeMode = "light" | "dark";
type DashboardSection = "overview" | "meetings" | "recordings" | "upcoming";

const sectionOptions: Array<{
  id: DashboardSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "meetings", label: "Meetings", icon: Video },
  { id: "upcoming", label: "Upcoming", icon: CalendarDays },
  { id: "recordings", label: "Recordings", icon: Sparkles },
];

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("weave-theme");
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, name, signOut } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const section = searchParams.get("section") || "overview";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("weave-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  const meetingsQuery = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const response = await http.get<GetAllMeetingsResponse>("/meeting/getAll");
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const joinScheduledMeetingMutation = useMutation({
    mutationFn: async ({
      scheduleId,
      devices,
    }: {
      scheduleId: string;
      devices: { micId?: string; cameraId?: string };
    }) => {
      const response = await http.post<JoinMeetingResponse | { message: string }>(`/meeting/join/${scheduleId}`, {});
      return {
        status: response.status,
        data: response.data,
        devices,
      };
    },
    onSuccess: ({ status, data, devices }) => {
      if (status === 201 || !("roomId" in data)) {
        toast.message("Waiting for host to start the meeting");
        return;
      }

      navigate(
        buildMeetingLivePath({
          roomId: data.roomId,
          name: name || "Guest",
          role: data.isHost ? "host" : "guest",
          recordingState: data.recordingState === "RECORDING",
          micId: devices.micId,
          cameraId: devices.cameraId,
        })
      );
    },
    onError: (error) => {
      toast.error(getHttpErrorMessage(error, "Could not join the scheduled meeting."));
    },
  });

  const meetings = meetingsQuery?.data?.meetings ?? [];
  const schedules = meetingsQuery?.data?.schedules ?? [];
  const liveMeetings = meetings.filter((meeting) => !meeting.isEnded);

  const setSection = (nextSection: DashboardSection) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextSection === "overview") {
      nextParams.delete("section");
    } else {
      nextParams.set("section", nextSection);
    }

    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[#0a0908] border-b border-[#f5a623]/10">
      <Sidebar
        section={section}
        setSection={setSection}
        liveMeetings={liveMeetings}
        upcomingMeetingsCount={schedules.length}
        name={name ?? "User"}
        theme={theme}
        toggleTheme={toggleTheme}
        signOut={signOut}
      />

      <main className="flex flex-1 flex-col gap-5 overflow-auto p-4 sm:p-6 lg:p-7">
        <Topbar
          name={name}
          liveMeetings={liveMeetings}
          meetings={meetings}
          schedules={schedules}
        />

        <div className="lg:hidden">
          <nav
            aria-label="Dashboard sections"
            className="flex gap-2 overflow-x-auto pb-1"
          >
            {sectionOptions.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  section === id
                    ? "border-[#f5a623]/25 bg-[#f5a623]/12 text-[#f5c86a]"
                    : "border-white/8 bg-white/4 text-[#fff5de]/68",
                ].join(" ")}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <AnimatePresence mode="wait">
          {section === "overview" ? (
            <Overview
              meetings={meetings}
              schedules={schedules}
              setSection={setSection}
              joiningScheduleId={joinScheduledMeetingMutation.variables?.scheduleId ?? null}
              onJoinSchedule={async (scheduleId, devices) => {
                await joinScheduledMeetingMutation.mutateAsync({ scheduleId, devices });
              }}
              onScheduleMeeting={() => navigate("/meeting/schedule")}
            />
          ) : section === "meetings" ? (
            <motion.div
              key="meetings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <Meetings
                meetings={meetings}
                isLoading={meetingsQuery.isLoading}
                isError={meetingsQuery.isError}
                errorMessage={getHttpErrorMessage(meetingsQuery.error, "Could not load meetings.")}
                onOpenMeeting={(meetingId) => navigate(`/meeting/live/${meetingId}`)}
                onOpenRecording={(recordingId) => navigate(`/recordings/${recordingId}`)}
              />
            </motion.div>
          ) : section === "upcoming" ? (
            <motion.div
              key="upcoming"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <UpcomingMeetings
                schedules={schedules}
                isLoading={meetingsQuery.isLoading}
                isError={meetingsQuery.isError}
                errorMessage={getHttpErrorMessage(meetingsQuery.error, "Could not load scheduled meetings.")}
                joiningScheduleId={joinScheduledMeetingMutation.variables?.scheduleId ?? null}
                onJoinSchedule={async (scheduleId, devices) => {
                  await joinScheduledMeetingMutation.mutateAsync({ scheduleId, devices });
                }}
                onScheduleMeeting={() => navigate("/meeting/schedule")}
              />
            </motion.div>
          ) : (
            <motion.div
              key="recordings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <RecordingsPage
                meetings={meetings}
                isLoading={meetingsQuery.isLoading}
                isError={meetingsQuery.isError}
                error={meetingsQuery.error}
                onOpenRecording={(recordingId) => navigate(`/recordings/${recordingId}`)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
