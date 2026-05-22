import { Link, NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { HoverArrowButton } from "./ui/hover-arrow-button";
import { ProfileDropdown } from "./Profile-dropdown";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

const authenticatedNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", end: true },
  { to: "/meetingSetup", label: "New Meeting" },
  { to: "/meeting/schedule", label: "Schedule" },
];

const guestNavItems: NavItem[] = [
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
];

type AppbarProps = {
  isLiveMeeting: boolean;
  theme: "light" | "dark";
  toggleTheme: () => void;
  isAuthenticated: boolean;
  name?: string | null;
  signOut: () => void;
};

export function Appbar({
  isLiveMeeting,
  theme,
  toggleTheme,
  isAuthenticated,
  name,
  signOut,
}: AppbarProps) {
  const navItems = isAuthenticated ? authenticatedNavItems : guestNavItems;

  return (
    <motion.header
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={[
        isLiveMeeting
          ? "relative"
          : "sticky top-0 border-b border-white/6 bg-background/20 backdrop-blur-xl",
        "z-50 w-full px-6 lg:px-8",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between py-3.5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="Weave logo"
            className="h-9 w-auto"
          />
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-4 md:gap-5">
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                className={({ isActive }) =>
                  [
                    "relative py-1 text-sm font-medium tracking-wide transition-colors duration-200 after:absolute after:bottom-[-0.45rem] after:left-0 after:h-px after:w-full after:origin-left after:rounded-full after:bg-[#f5a623] after:transition-transform after:duration-200 after:content-['']",
                    isActive
                      ? "text-white after:scale-x-100"
                      : "text-white/60 after:scale-x-0 hover:text-white/90 hover:after:scale-x-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {isAuthenticated ? (
            <Link
              to="/pricing"
              className="hidden rounded-full border border-[#f5a623]/35 px-4 py-2 text-[12.5px] font-semibold text-[#f5c050] transition-colors duration-200 hover:bg-[#f5a623] hover:text-[#0b0b0d] md:inline-flex"
            >
              Upgrade
            </Link>
          ) : (
            <HoverArrowButton href="/signup" label="Try for free" />
          )}

          {isAuthenticated ? (
            <ProfileDropdown
              name={name}
              theme={theme}
              toggleTheme={toggleTheme}
              signOut={signOut}
            />
          ) : null}
        </div>
      </div>
    </motion.header>
  );
}
