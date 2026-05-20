import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

type Format = {
  id: string;
  label: string;
  tag: string;
  bitrate: string;
  useCase: string;
  fileSize: string;
};

const formats: Format[] = [
  {
    id: "4k",
    label: "4K ProRes",
    tag: "LOSSLESS",
    bitrate: "500–800 Mbps",
    useCase: "Professional post-production",
    fileSize: "~180 GB/hr",
  },
  {
    id: "1080p",
    label: "1080p H.264",
    tag: "STANDARD",
    bitrate: "8–15 Mbps",
    useCase: "Web delivery & sharing",
    fileSize: "~4.5 GB/hr",
  },
  {
    id: "720p",
    label: "720p Compressed",
    tag: "LIGHT",
    bitrate: "2–5 Mbps",
    useCase: "Mobile & remote viewing",
    fileSize: "~1.5 GB/hr",
  },
  {
    id: "audio",
    label: "Audio WAV/FLAC",
    tag: "PODCAST",
    bitrate: "256–1411 kbps",
    useCase: "Podcast & audio extraction",
    fileSize: "~120 MB/hr",
  },
];

export function QualityFormatsSection() {
  const [selected, setSelected] = useState("4k");
  const active = formats.find((f) => f.id === selected)!;

  return (
    <section className="px-6 py-28 sm:px-8 border-b border-neutral-800">
      <div className="mx-auto max-w-6xl">
        {/* Section label */}
        <p className="text-xs font-semibold tracking-[0.25em] text-[#F5A623]/70 uppercase mb-4">
          Export Formats
        </p>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-16 max-w-xl leading-tight">
          Export exactly
          <br />
          what you need.
        </h2>

        {/* Format tab row */}
        <div className="grid grid-cols-4 border-b border-white/10">
          {formats.map((f) => {
            const isActive = f.id === selected;
            const isComingSoon = f.id === "4k";
            return (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                className="relative pb-4 text-left group transition-colors duration-200"
              >
                {/* Active underline */}
                {isActive && (
                  <motion.div
                    layoutId="format-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F5A623]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  />
                )}
                <span
                  className={`block text-[10px] font-bold tracking-[0.2em] uppercase mb-1.5 transition-colors ${
                    isActive
                      ? "text-[#F5A623]"
                      : "text-white/25 group-hover:text-white/40"
                  }`}
                >
                  {f.tag}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`block text-base font-semibold transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-white/40 group-hover:text-white/60"
                    }`}
                  >
                    {f.label}
                  </span>
                  {isComingSoon && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#F5A623]/15 text-[#F5A623] rounded">
                      COMING SOON
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Spec sheet */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-12 grid grid-cols-3 divide-x divide-white/8"
          >
            {/* Bitrate */}
            <div className="pr-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">
                Bitrate
              </p>
              <p className="font-mono text-4xl font-bold text-white leading-none tracking-tight">
                {active.bitrate}
              </p>
            </div>

            {/* File Size */}
            <div className="px-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">
                File Size · 1 hour
              </p>
              <p className="font-mono text-4xl font-bold text-white leading-none tracking-tight">
                {active.fileSize}
              </p>
            </div>

            {/* Best For */}
            <div className="pl-10">
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-3">
                Best For
              </p>
              <p className="text-4xl font-bold text-[#F5A623] leading-tight tracking-tight">
                {active.useCase}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bottom note */}
        <p className="mt-12 text-xs text-white/20 tracking-wide">
          All formats export from the locally captured source — no re-encoding
          from a compressed stream.
          {active.id === "4k" && (
            <span className="block text-[#F5A623] mt-2">
              ✓ 4K ProRes coming Q3 2026
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
