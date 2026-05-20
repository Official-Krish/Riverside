import { motion } from "motion/react";

function EncryptionPipelineDiagram() {
  const nodes = [
    { label: "Raw Stream", x: 60 },
    { label: "Segment", x: 230 },
    { label: ".ts Chunk", x: 400 },
    { label: "HTTPS", x: 570 },
    { label: "CDN", x: 740, highlight: true },
  ];

  return (
    <svg
      viewBox="0 0 960 320"
      className="w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          @keyframes flowDash {
            to { stroke-dashoffset: -20; }
          }
          .flow-line {
            stroke-dasharray: 5, 6;
            animation: flowDash 1.4s linear infinite;
          }
          .flow-line-2 { animation-delay: 0.28s; }
          .flow-line-3 { animation-delay: 0.56s; }
          .flow-line-4 { animation-delay: 0.84s; }
          @keyframes cloudPulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 0.6; }
          }
          .cloud-group { animation: cloudPulse 3s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* YOUR DEVICE ONLY label */}
      <text
        x="480"
        y="28"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="rgba(245,166,35,0.85)"
        letterSpacing="3"
      >
        YOUR DEVICE ONLY
      </text>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <g key={i}>
          <rect
            x={node.x}
            y="55"
            width="150"
            height="52"
            rx="26"
            fill={
              node.highlight ? "rgba(245,166,35,0.1)" : "rgba(255,255,255,0.05)"
            }
            stroke={
              node.highlight ? "rgba(245,166,35,0.5)" : "rgba(255,255,255,0.12)"
            }
            strokeWidth="1.5"
          />
          <text
            x={node.x + 75}
            y="87"
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill={
              node.highlight ? "rgba(245,166,35,0.9)" : "rgba(255,255,255,0.8)"
            }
            fontFamily="system-ui"
          >
            {node.label}
          </text>
        </g>
      ))}

      {/* Connecting flow lines between nodes */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={nodes[i].x + 150}
          y1="81"
          x2={nodes[i + 1].x}
          y2="81"
          stroke="#F5A623"
          strokeWidth="2"
          className={`flow-line flow-line-${i + 1}`}
        />
      ))}

      {/* Vertical drop line from Local Storage down to cloud */}
      <line
        x1="815"
        y1="107"
        x2="815"
        y2="185"
        stroke="rgba(245,166,35,0.4)"
        strokeWidth="1.5"
        strokeDasharray="4,5"
      />
      {/* Arrowhead */}
      <polygon points="815,192 809,180 821,180" fill="rgba(245,166,35,0.5)" />

      {/* Cloud group — crossed out, muted */}
      <g className="cloud-group">
        <path
          d="M775 235 C775 223 784 213 796 213
             C799 201 811 193 826 193
             C845 193 861 206 861 222
             C870 222 878 230 878 240
             C878 255 868 267 854 267
             L786 267 C769 267 757 255 757 240
             C757 231 765 223 775 235 Z"
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
        />
        {/* Bold strikethrough */}
        <line
          x1="748"
          y1="230"
          x2="888"
          y2="260"
          stroke="rgba(255,80,80,0.5)"
          strokeWidth="2"
        />
        <text
          x="818"
          y="290"
          textAnchor="middle"
          fontSize="11"
          fontWeight="500"
          fill="rgba(255,255,255,0.35)"
          fontFamily="system-ui"
          letterSpacing="1"
        >
          NEVER REACHES HERE
        </text>
      </g>
    </svg>
  );
}

export function HLSPrivacySection() {
  return (
    <section className="border-b border-neutral-800 px-6 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-16 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {/* Left: Pipeline Diagram */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <EncryptionPipelineDiagram />
          </motion.div>

          {/* Right: Content */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            {/* Label */}
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.28em] mb-2"
              style={{ color: "rgba(245,166,35,0.75)" }}
            >
              Privacy by Design
            </p>

            {/* Headline */}
            <h2 className="font-syne text-3xl font-bold leading-tight text-foreground sm:text-4xl mb-8">
              Your content.
              <br />
              Secure by default.
            </h2>

            {/* Specs Grid */}
            <div className="mb-8 grid grid-cols-3 gap-1 border-l border-r border-border/20">
              {/* Stat 1 */}
              <div className="border-r border-border/20 px-4 py-4">
                <p className="text-sm font-bold text-[#F5A623]">End-to-End</p>
                <p className="text-xs leading-relaxed text-muted-foreground/70">
                  Client-side AES-128 encryption
                </p>
              </div>

              {/* Stat 2 */}
              <div className="border-r border-border/20 px-4 py-4">
                <p className="text-sm font-bold text-[#F5A623] mb-1">
                  HTTPS Secure
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground/70">
                  Military-grade TLS 1.3
                </p>
              </div>

              {/* Stat 3 */}
              <div className="px-4 py-4">
                <p className="text-sm font-bold text-[#F5A623] mb-1">
                  Zero-Knowledge
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground/70">
                  Weave cannot access raw footage
                </p>
              </div>
            </div>

            {/* Bottom line */}
            <p className="text-xs leading-relaxed text-muted-foreground/50">
              Currently: HTTPS transport with zero-knowledge architecture.
              Roadmap: Client-side AES-128 before CDN upload for
              encrypted-at-rest protection.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
