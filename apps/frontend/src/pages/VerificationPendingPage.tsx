/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Mail, ArrowRight, Loader } from "lucide-react";
import { toast } from "sonner";
import {
  useResendVerificationEmail,
  useVerifyEmail,
} from "../components/Authentication/useAuthMutations";

export function VerificationPendingPage() {
  const [searchParams] = useSearchParams();
  const [email] = useState(() => searchParams.get("email") ?? "");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resendTimeout, setResendTimeout] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendMutation = useResendVerificationEmail();
  const verifyMutation = useVerifyEmail();

  // Handle resend timeout countdown
  useEffect(() => {
    if (resendTimeout > 0) {
      const timer = setTimeout(() => setResendTimeout(resendTimeout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimeout]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Take only last character
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join("");

    if (fullCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    if (!email) {
      toast.error("Email not found");
      return;
    }

    try {
      await verifyMutation.mutateAsync({ email, code: fullCode });
      toast.success("Email verified successfully!");
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message || "Invalid verification code";
      toast.error(errorMsg);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error("Email not found");
      return;
    }

    try {
      await resendMutation.mutateAsync(email);
      toast.success("Verification code sent! Check your inbox.");
      setResendTimeout(60); // 60 second cooldown
      setCode(["", "", "", "", "", ""]); // Clear code input
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Failed to resend code";
      toast.error(errorMsg);
    }
  };

  const canResend = resendTimeout === 0 && !resendMutation.isPending;
  const codeComplete = code.every((digit) => digit !== "");

  return (
    <section className="relative min-h-[calc(100vh-76px)] overflow-hidden px-6 py-10 sm:px-8 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-white/8 bg-white/3 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        {/* Logo */}
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/logo-navbar.svg" alt="Weave" className="h-6 w-auto" />
        </div>

        {/* Illustration */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-[#f5a623]/12 p-6">
            <Mail className="size-8 text-[#f5a623]" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#fff5de]">
            Verify your email
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-[#c8b880]/55">
            We've sent a 6-digit code to <br />
            <span className="font-semibold text-[#fff5de]">{email}</span>
          </p>

          {/* Code Input */}
          <div className="mt-8">
            <label className="block text-xs font-semibold text-[#c8b880] mb-3">
              Enter verification code
            </label>
            <div className="flex gap-2 justify-center mb-6">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-12 text-center text-lg font-bold rounded-xl border border-white/8 bg-white/4 text-[#fff5de] outline-none placeholder:text-[#c8b880]/35 transition focus:border-[#f5a623]/40 focus:bg-[#f5a623]/3"
                  placeholder="0"
                />
              ))}
            </div>

            <button
              onClick={handleVerify}
              disabled={!codeComplete || verifyMutation.isPending}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-extrabold shadow-[0_4px_20px_rgba(245,166,35,0.25)] transition ${
                codeComplete && !verifyMutation.isPending
                  ? "bg-linear-to-r from-[#ffcf6b] via-[#f5a623] to-[#d98a10] text-[#1b1100] hover:opacity-92 active:scale-[0.98] cursor-pointer"
                  : "bg-linear-to-r from-[#ffcf6b]/50 via-[#f5a623]/50 to-[#d98a10]/50 text-[#1b1100]/50 cursor-not-allowed"
              }`}
            >
              {verifyMutation.isPending ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Verify email
            </button>
          </div>

          {/* Resend Section */}
          <div className="mt-8 space-y-3 border-t border-white/8 pt-8">
            <p className="text-[12px] text-[#c8b880]/60">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResend}
              disabled={!canResend}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition ${
                canResend
                  ? "border border-white/8 bg-white/4 text-[#fff5de] hover:bg-white/6 active:bg-white/10 cursor-pointer"
                  : "border border-white/12 bg-white/2 text-[#c8b880]/50 cursor-not-allowed"
              }`}
            >
              {resendMutation.isPending ? (
                <Loader className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {resendTimeout > 0
                ? `Resend in ${resendTimeout}s`
                : "Resend code"}
            </button>
          </div>

          <p className="mt-6 text-xs text-[#c8b880]/50">
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
    </section>
  );
}
