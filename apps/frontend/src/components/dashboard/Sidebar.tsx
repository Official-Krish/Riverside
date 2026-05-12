import { Link } from "react-router-dom";
import { CalendarDays, Sparkles, Users, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileDropdown } from "../Profile-dropdown";
import { MdDashboard } from "react-icons/md";

type SidebarProps = {
    section: string;
    setSection: (section: "overview" | "meetings" | "recordings" | "upcoming") => void;
    liveMeetings: unknown[];
    upcomingMeetingsCount: number;
    name: string;
    theme: "light" | "dark";
    toggleTheme: () => void;
    signOut: () => void;
};

export function Sidebar({
    section,
    setSection,
    liveMeetings,
    upcomingMeetingsCount,
    name,
    theme,
    toggleTheme,
    signOut,
}: SidebarProps) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.aside
            initial={false}
            animate={{ width: expanded ? 224 : 72 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onHoverStart={() => setExpanded(true)}
            onHoverEnd={() => setExpanded(false)}
            className="hidden lg:flex flex-col border-r border-white/7 bg-[#0C0C0E]"
        >
            <div className="flex flex-col items-center py-4 gap-1.5">
                <AnimatePresence mode="wait">
                    {!expanded ? (
                        <motion.div
                            key="logo-collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => navigate("/")}
                            title="Weave"
                        >
                            <img src="/icon-512.svg" alt="Weave" className="h-7 w-auto" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="logo-expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="w-full px-2"
                        >
                            <Link to="/" className="flex items-center gap-2 cursor-pointer">
                                <img
                                    src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
                                    alt="Weave"
                                    className="h-7 w-auto"
                                />
                            </Link>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex-1 flex flex-col items-center py-4 gap-1.5 overflow-hidden">
                <RailIcon
                    icon={<MdDashboard size={17} />}
                    label="Dashboard"
                    active={section === "overview"}
                    onClick={() => setSection("overview")}
                    expanded={expanded}
                />
                <RailIcon
                    icon={<Video size={17} />}
                    label="Meetings"
                    active={section === "meetings"}
                    badge={liveMeetings.length || undefined}
                    onClick={() => setSection("meetings")}
                    expanded={expanded}
                />
                <RailIcon
                    icon={<CalendarDays size={17} />}
                    label="Upcoming"
                    active={section === "upcoming"}
                    badge={upcomingMeetingsCount || undefined}
                    onClick={() => setSection("upcoming")}
                    expanded={expanded}
                />
                <RailIcon
                    icon={<Sparkles size={17} />}
                    label="Recordings"
                    active={section === "recordings"}
                    onClick={() => setSection("recordings")}
                    expanded={expanded}
                />

                <motion.div
                    className="my-3 h-px bg-white/7"
                    animate={{ width: expanded ? "calc(100% - 16px)" : 16 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                />

                <RailIcon
                    icon={<Users size={17} />}
                    label="Team"
                    onClick={() => {}}
                    expanded={expanded}
                />
            </div>

            <div className="flex flex-col items-center py-4 border-t border-white/7">
                <AnimatePresence mode="wait">
                    {!expanded ? (
                        <motion.div
                            key="profile-collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="size-8 rounded-full bg-[#f5a623] flex items-center justify-center text-[12px] font-bold text-[#0C0C0E] cursor-pointer"
                            title={name}
                        >
                            {name.charAt(0).toUpperCase()}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="profile-expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="w-full px-3 py-1"
                        >
                            <ProfileDropdown
                                name={name}
                                theme={theme}
                                toggleTheme={toggleTheme}
                                signOut={signOut}
                                menuDirection="up"
                                variant="sidebar"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.aside>
    );
}

function RailIcon({
    icon,
    label,
    active,
    badge,
    onClick,
    expanded,
}: {
    icon: ReactNode;
    label: string;
    active?: boolean;
    badge?: number;
    onClick?: () => void;
    expanded?: boolean;
}) {
    return (
        // FIX 1: Added `relative` so the collapsed badge dot is positioned correctly
        <motion.button
            type="button"
            onClick={onClick}
            layout
            className={[
                "relative flex items-center gap-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-150",
                // FIX 2: When collapsed, center the icon; when expanded, left-align content
                expanded ? "px-2.5" : "justify-center",
                active
                    ? "text-[#f5a623] bg-[#f5a623]/12 font-medium"
                    : "text-white/25 hover:text-white/70 hover:bg-white/5",
            ].join(" ")}
            style={{ width: "calc(100% - 16px)" }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
        >
            {/* FIX 3: Removed fixed size wrapper so icon stays centred naturally */}
            <span className="shrink-0 flex items-center justify-center">{icon}</span>

            <AnimatePresence>
                {expanded && (
                    <motion.span
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="text-[13px] font-medium whitespace-nowrap overflow-hidden"
                    >
                        {label}
                    </motion.span>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {expanded && badge != null && badge > 0 && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="ml-auto rounded-full bg-[#f5a623]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#f5a623]"
                    >
                        {badge}
                    </motion.span>
                )}
            </AnimatePresence>

            {/* FIX 4: Corrected badge dot position — top-0 right-0 inside relative button */}
            {!expanded && badge != null && badge > 0 && (
                <motion.span
                    className="absolute top-1 right-1 size-1.5 bg-[#f5a623] rounded-full"
                    layoutId={`badge-${label}`}
                />
            )}
        </motion.button>
    );
}