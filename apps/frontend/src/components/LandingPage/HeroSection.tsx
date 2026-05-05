import { motion } from "motion/react";
import { useEffect, useState } from "react";
import WeaveBackground from "../Background";

function LiveWaveform({ color, speed = 1, height = 40, bars: barCount = 48 }: {
  color: string; speed?: number; height?: number; bars?: number;
}) {
  const [bars] = useState(() =>
    Array.from({ length: barCount }, () => 20 + Math.random() * 80)
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 80 / speed);
    return () => clearInterval(id);
  }, [speed]);

  return (
    <div className="flex items-center gap-0.5" style={{ height }}>
      {bars.map((base, i) => {
        const v = Math.sin((tick + i) * 0.4) * 30 + Math.sin((tick + i) * 0.13) * 20;
        const h = Math.max(8, Math.min(100, base + v));
        return (
          <div key={i} className="rounded-full transition-all duration-75 shrink-0" style={{
            width: 3, height: `${h}%`, background: color,
            opacity: 0.35 + (h / 100) * 0.65,
          }} />
        );
      })}
    </div>
  );
}

const tracks = [
  { name: "Alex", role: "Host · Berlin",    color: "#F5A623", speed: 1.0 },
  { name: "Sarah", role: "Guest · NYC",     color: "#60a5fa", speed: 1.3 },
  { name: "Ryo",  role: "Guest · Tokyo",    color: "#34d399", speed: 0.85 },
];

export function HeroSection() {
  return (
    <section className="relative isolate min-h-screen flex flex-col px-6 sm:px-10 lg:px-16 pt-20 pb-12 border-b border-neutral-800">
      <WeaveBackground />

      <div className="relative z-10 mx-auto w-full max-w-6xl flex flex-col flex-1">

        {/* ── HEADLINE — full width, centered, large ── */}
        <div className="flex-1 flex flex-col items-center justify-center text-center pt-8 pb-10">

          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-10"
            style={{
              background: "rgba(245,166,35,0.07)",
              border: "1px solid rgba(245,166,35,0.18)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-bold tracking-[0.22em] uppercase"
              style={{ color: "rgba(245,166,35,0.75)" }}>
              Network-proof recording
            </span>
          </motion.div>

          {/* Headline — 3 lines, each staggered in */}
          <div className="overflow-hidden">
            {[
              { text: "Record beautifully,", delay: 0.08 },
              { text: "even when the", delay: 0.16 },
              { text: "connection is not.", delay: 0.24, amber: true },
            ].map((line, i) => (
              <motion.div key={i} className="overflow-hidden"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: line.delay, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1
                  className="block text-[clamp(3rem,7vw,5.5rem)] font-black tracking-[-0.03em] leading-none"
                  style={{ color: line.amber ? "#F5A623" : "white" }}
                >
                  {line.text}
                </h1>
              </motion.div>
            ))}
          </div>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-7 text-base sm:text-lg leading-7 max-w-lg mx-auto"
            style={{ color: "rgba(255,255,255,0.32)" }}
          >
            Every participant records locally at full quality.
            Weave merges all tracks automatically —
            the network never touches your source.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-9 flex items-center gap-5 justify-center flex-wrap"
          >
            <a href="/signup"
              className="group relative overflow-hidden rounded-full px-8 py-3.5 text-sm font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "#F5A623", color: "#0c0c0e" }}
            >
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }} />
              <span className="relative">Start for free</span>
            </a>
            <a href="/features"
              className="flex items-center gap-2 text-sm font-semibold transition-all group"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Watch demo
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="mt-10 flex items-center justify-center gap-8 pt-8"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            {[
              { value: "100%", label: "Local quality" },
              { value: "AES-128", label: "Encryption" },
              { value: "4K", label: "Max export" },
              { value: "0ms", label: "Network delay" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-lg font-black text-white">{stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── LIVE SESSION PANEL — full width below headline ── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="w-px h-3.5 bg-white/10 ml-1" />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                <span className="text-[11px] font-mono font-bold tracking-widest"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  REC · 00:04:32
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/20 font-mono">3 participants</span>
              <div className="rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.18em] uppercase"
                style={{
                  background: "rgba(245,166,35,0.1)",
                  border: "1px solid rgba(245,166,35,0.2)",
                  color: "#F5A623",
                }}>
                ENCRYPTED
              </div>
            </div>
          </div>

          {/* Track grid — 3 columns */}
          <div className="grid grid-cols-3 divide-x"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {tracks.map((track, i) => (
              <motion.div
                key={track.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                className="px-6 py-5"
                style={{ borderRight: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "" }}
              >
                {/* Track header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{
                        background: `${track.color}15`,
                        border: `1px solid ${track.color}30`,
                        color: track.color,
                      }}>
                      {track.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white/80 leading-none">{track.name}</p>
                      <p className="text-[10px] mt-0.5 leading-none" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {track.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] font-bold tracking-wide"
                      style={{ color: "rgba(255,255,255,0.2)" }}>LOCAL</span>
                  </div>
                </div>

                {/* Waveform */}
                <div className="rounded-xl px-3 py-2"
                  style={{
                    background: `${track.color}07`,
                    border: `1px solid ${track.color}15`,
                  }}>
                  <LiveWaveform color={track.color} speed={track.speed} height={44} bars={52} />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Merge row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.1 }}
            className="px-6 py-5"
          >
            <div className="flex items-center gap-4">
              {/* Label */}
              <div className="shrink-0 flex items-center gap-2">
                <div className="flex flex-col gap-0.75">
                  {tracks.map((t) => (
                    <div key={t.name} className="w-3 h-0.75 rounded-full"
                      style={{ background: t.color, opacity: 0.6 }} />
                  ))}
                </div>
                <svg className="w-4 h-4 text-white/20" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Master waveform — full remaining width */}
              <div className="flex-1 rounded-2xl px-4 py-3"
                style={{
                  background: "rgba(245,166,35,0.05)",
                  border: "1px solid rgba(245,166,35,0.12)",
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase"
                    style={{ color: "rgba(245,166,35,0.75)" }}>
                    Master Track — Auto Merged
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
                    4K ProRes · Lossless
                  </span>
                </div>
                <LiveWaveform color="#F5A623" speed={0.55} height={52} bars={96} />
              </div>
            </div>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}