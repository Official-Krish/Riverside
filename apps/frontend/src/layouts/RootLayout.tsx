import { motion } from "motion/react";
import { Outlet, useLocation } from "react-router-dom";
import { Appbar } from "../components/Appbar";
import { Footer } from "../components/Footer";
import { GlobalBackground } from "../components/GlobalBackground";
import { useAuth } from "../hooks/useAuth";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  return "dark";
}

export function RootLayout() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const location = useLocation();
  const { isAuthenticated, name, signOut } = useAuth();
  const isLiveMeeting = location.pathname.startsWith("/meeting/live/");
  const isLanding = location.pathname === "/";
  const isDashboard = location.pathname === "/dashboard";

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    window.localStorage.setItem("weave-theme", "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme("dark");
  };

  return (
    <div className="relative min-h-screen">
      <GlobalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {isDashboard || isLiveMeeting ? null : (
          <Appbar
            isLiveMeeting={isLiveMeeting}
            isLanding={isLanding}
            theme={theme}
            toggleTheme={toggleTheme}
            isAuthenticated={isAuthenticated}
            name={name}
            signOut={signOut}
          />
        )}

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          className="flex-1"
        >
          <Outlet />
        </motion.main>

        {!isLiveMeeting ? <Footer isLanding={true} /> : null}
      </div>
    </div>
  );
}
