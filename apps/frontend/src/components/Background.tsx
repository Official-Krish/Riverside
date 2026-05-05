export default function WeaveBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 bg-[#0a0a0a] overflow-hidden">

      {/* Radial amber glow — top center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-5%,rgba(245,166,35,0.18)_0%,transparent_70%)]" />

      {/* Secondary amber glow — bottom right */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_90%_110%,rgba(245,166,35,0.09)_0%,transparent_70%)]" />

      {/* Perspective grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Amber horizontal streak */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{
          top: "38%",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(245,166,35,0.06) 30%, rgba(245,166,35,0.12) 50%, rgba(245,166,35,0.06) 70%, transparent 100%)",
        }}
      />
    </div>
  );
}