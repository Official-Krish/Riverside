import {
  useSignup,
  useGoogleAuth,
} from "../components/Authentication/useAuthMutations";
import { LoaderCircle, ArrowRight, Lock, Mail, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FeatureIcon,
  Field,
  PasswordInput,
} from "@/components/Authentication/icons";
import { FaGoogle } from "react-icons/fa";

export function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length > 0;

  const signupMutation = useSignup(setErrorMessage);
  const { startGoogleLogin } = useGoogleAuth(setErrorMessage);

  return (
    <section className="relative min-h-[calc(100vh-76px)] overflow-hidden px-6 py-10 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1fr_1.1fr]">
        {/* Form card */}
        <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          {/* Wordmark */}
          <div className="mb-6 flex items-center gap-2.5">
            <img src="/logo-navbar.svg" alt="Weave" className="h-6 w-auto" />
          </div>

          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#fff5de]">
            Create your account
          </h1>
          <p className="mt-1.5 mb-6 text-[13px] text-[#c8b880]/55">
            Free forever. No credit card needed.
          </p>

          <div className="space-y-3.5">
            <Field label="Full name" icon={<User className="size-3.5" />}>
              <input
                type="text"
                placeholder="Alex Johnson"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-white/8 bg-white/4 py-2.5 pl-9 pr-4 text-sm text-[#fff5de] outline-none placeholder:text-[#c8b880]/35 transition focus:border-[#f5a623]/40 focus:bg-[#f5a623]/[0.03] focus:ring-0"
              />
            </Field>

            <Field label="Work email" icon={<Mail className="size-3.5" />}>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/8 bg-white/4 py-2.5 pl-9 pr-4 text-sm text-[#fff5de] outline-none placeholder:text-[#c8b880]/35 transition focus:border-[#f5a623]/40 focus:bg-[#f5a623]/[0.03]"
              />
            </Field>

            <Field label="Password" icon={<Lock className="size-3.5" />}>
              <PasswordInput
                placeholder="Min. 8 characters (Should contain A-Z, a-z, 0-9, and special characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                signupMutation.mutate({ name, email, password });
              }}
              disabled={signupMutation.isPending || !canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-[#ffcf6b] via-[#f5a623] to-[#d98a10] py-3 text-sm font-extrabold text-[#1b1100] shadow-[0_4px_20px_rgba(245,166,35,0.25)] transition hover:opacity-92 hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none cursor-pointer"
            >
              {signupMutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Create account
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/8" />
              <span className="text-[11px] text-white/30">
                or continue with
              </span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            {/* Google OAuth */}
            <button
              onClick={() => {
                startGoogleLogin();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/8 bg-white/4 py-3 text-sm font-semibold text-[#fff5de] shadow-sm transition hover:bg-white/6 active:bg-white/10 cursor-pointer"
              onError={() =>
                toast.error("Google authentication failed. Please try again.")
              }
            >
              <FaGoogle />
              Continue with Google
            </button>

            {errorMessage && (
              <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {errorMessage}
              </p>
            )}

            <p className="text-center text-xs text-[#c8b880]/50">
              Already have an account?{" "}
              <Link
                to="/signin"
                className="font-bold text-[#f5a623] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Promo card */}
        <div className="rounded-3xl border border-[#f5a623]/12 bg-gradient-to-br from-[#100e08] to-[#13100a] p-8 sm:p-10 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#f5a623]/65">
            Start free · No card required
          </p>
          <h2 className="mt-3 font-syne text-[28px] font-black leading-tight tracking-tight text-[#fff5de] sm:text-[34px]">
            Record beautifully,
            <br />
            from day one.
          </h2>
          <p className="mt-4 text-[13px] leading-relaxed text-[#c8b080]/70">
            Join teams who rely on Weave for interviews, podcasts, and remote
            sessions where quality cannot fail.
          </p>

          <div className="mt-7 space-y-2.5">
            {[
              {
                icon: "shield",
                title: "AES-128 encrypted by default",
                sub: "Your recordings never leave unencrypted",
              },
              {
                icon: "clock",
                title: "100% local quality recording",
                sub: "Network issues never touch your audio",
              },
              {
                icon: "download",
                title: "One-click merge and export",
                sub: "4K video · WAV audio · MP4 delivery",
              },
            ].map(({ icon, title, sub }) => (
              <div
                key={title}
                className="flex items-center gap-3 rounded-2xl border border-[#f5a623]/10 bg-black/20 px-4 py-3"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[#f5a623]/12 flex-shrink-0">
                  <FeatureIcon name={icon} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#fff5de]/85">
                    {title}
                  </p>
                  <p className="text-[11px] text-[#c8a870]/50">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Social proof */}
          <div className="mt-auto flex items-center gap-3 border-t border-[#f5a623]/8 pt-6 mt-7">
            <div className="flex">
              {["A", "M", "J", "S"].map((l, i) => (
                <span
                  key={l}
                  className="inline-flex size-7 items-center justify-center rounded-full border-2 border-[#13100a] bg-gradient-to-br from-[#ffcf6b] to-[#f5a623] text-[10px] font-extrabold text-[#1b1100]"
                  style={{ marginLeft: i === 0 ? 0 : -6 }}
                >
                  {l}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-[#c8a870]/60">
              <span className="font-bold text-[#f5a623]/80">2,400+</span> teams
              recording with Weave
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
