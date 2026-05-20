import { motion } from "motion/react";

type FooterLink = {
  label: string;
  href: string;
};

const footerLinks: {
  product: FooterLink[];
  company: FooterLink[];
  social: FooterLink[];
} = {
  product: [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Security", href: "/security" },
    { label: "Changelog", href: "/changelog" },
  ],
  company: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Support", href: "/support" },
    { label: "Blog", href: "/blog" },
  ],
  social: [
    { label: "GitHub", href: "https://github.com/Official-Krish/Weave" },
    { label: "LinkedIn", href: "#linkedin" },
  ],
};

export function Footer({ isLanding = false }: { isLanding?: boolean }) {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mx-auto mt-4 w-full max-w-7xl px-6 pb-6 pt-8 sm:px-8"
    >
      <div
        className={[
          "rounded-2xl p-8 sm:p-9",
          isLanding
            ? "border border-[#f5a623]/7 bg-linear-to-br from-[#0e0d0b] to-[#11100d]"
            : "border border-border/40 bg-background",
        ].join(" ")}
      >
        {/* Top divider */}
        <div
          className={[
            "mb-8 h-px",
            isLanding ? "bg-[#f5a623]/10" : "bg-border/40",
          ].join(" ")}
        />

        {/* Main grid */}
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr] md:items-start">
          {/* Brand col */}
          <div>
            <p
              className={[
                "text-[10px] font-semibold uppercase tracking-[0.22em]",
                isLanding ? "text-[#f5a623]/45" : "text-muted-foreground",
              ].join(" ")}
            >
              Recorded locally. Delivered clean.
            </p>
            <p
              className={[
                "mt-2 font-syne text-[28px] font-extrabold leading-none tracking-tight",
                isLanding ? "text-[#fff5de]" : "text-foreground",
              ].join(" ")}
            >
              Weave
            </p>
            <p
              className={[
                "mt-3 max-w-70 text-[13px] leading-relaxed",
                isLanding ? "text-[#a89880]" : "text-muted-foreground",
              ].join(" ")}
            >
              Built for interviews, podcasts, and remote sessions where quality
              and privacy cannot fail.
            </p>
            {isLanding && (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#f5a623]/12 bg-[#f5a623]/4 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f5a623]/70" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#f5a623]/55">
                  AES-128 encrypted
                </span>
              </div>
            )}
          </div>

          {/* Product col */}
          <div>
            <p
              className={[
                "text-[10px] font-semibold uppercase tracking-[0.2em]",
                isLanding ? "text-[#f5a623]/50" : "text-muted-foreground",
              ].join(" ")}
            >
              Product
            </p>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {footerLinks.product.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={[
                    "text-[13px] transition-colors",
                    isLanding
                      ? "text-[#c4b49a] hover:text-[#fff5de]"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Company col */}
          <div>
            <p
              className={[
                "text-[10px] font-semibold uppercase tracking-[0.2em]",
                isLanding ? "text-[#f5a623]/50" : "text-muted-foreground",
              ].join(" ")}
            >
              Company
            </p>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {footerLinks.company.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={[
                    "text-[13px] transition-colors",
                    isLanding
                      ? "text-[#c4b49a] hover:text-[#fff5de]"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div
          className={[
            "mt-8 h-px",
            isLanding ? "bg-[#f5a623]/5" : "bg-border/40",
          ].join(" ")}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            className={[
              "space-y-1 text-xs",
              isLanding ? "text-[#6b5c45]" : "text-muted-foreground",
            ].join(" ")}
          >
            <p>© 2026 Weave. All rights reserved.</p>
            <p
              className={
                isLanding ? "text-[#8a7a62]" : "text-muted-foreground/90"
              }
            >
              Crafted and Engineered with{" "}
              <span className="align-middle">❤️</span> by Krish Anand
            </p>
          </div>
          <div className="flex items-center gap-5">
            {footerLinks.social.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={[
                  "text-xs transition-colors",
                  isLanding
                    ? "text-[#8a7a62] hover:text-[#fff5de]"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
