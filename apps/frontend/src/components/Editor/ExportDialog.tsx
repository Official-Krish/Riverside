import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ExportJob } from "./types";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Download,
  Bell,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  LayoutDashboard,
} from "lucide-react";

interface ExportDialogProps {
  job: ExportJob;
  exportProgress: number;
  exportStatus: ExportJob["status"];
  exportEtaMs?: number | null;
  onClose: () => void;
  onCompleted?: () => void;
  onFailed?: () => void;
  onRetry?: () => void;
  notifyOnComplete?: boolean;
  onNotifyChange?: (checked: boolean) => void;
}

const EXPORT_STEPS = [
  { label: "Encoding clips", range: [0, 20] },
  { label: "Applying transitions", range: [20, 40] },
  { label: "Processing overlays", range: [40, 55] },
  { label: "Mixing audio tracks", range: [55, 70] },
  { label: "Finalizing video", range: [70, 85] },
  { label: "Saving and promoting", range: [85, 100] },
];

export function ExportDialog({
  job,
  exportProgress,
  exportStatus,
  exportEtaMs,
  onClose,
  onCompleted,
  onFailed,
  onRetry,
  notifyOnComplete = true,
  onNotifyChange,
}: ExportDialogProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const prevStatusRef = useRef(exportStatus);
  const [remainingText, setRemainingText] = useState<string | null>(null);
  const etaRef = useRef({ value: 0, timestamp: 0 });

  useEffect(() => {
    if (exportEtaMs == null) {
      etaRef.current = { value: 0, timestamp: 0 };
      return;
    }
    etaRef.current = { value: exportEtaMs, timestamp: Date.now() };
  }, [exportEtaMs]);

  useEffect(() => {
    const tick = () => {
      const { value, timestamp } = etaRef.current;
      if (!value || exportStatus !== "PROCESSING") {
        setRemainingText(null);
        return;
      }

      const elapsed = Date.now() - timestamp;
      const remaining = Math.max(0, value - elapsed);
      const mins = Math.ceil(remaining / 60000);

      if (mins >= 2) {
        setRemainingText(`About ${mins} minutes remaining`);
      } else if (mins === 1) {
        setRemainingText("About 1 minute remaining");
      } else {
        const secs = Math.ceil(remaining / 1000);
        if (secs > 10) setRemainingText("Less than a minute remaining");
        else if (secs > 0) setRemainingText("Almost done...");
        else setRemainingText(null);
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [exportStatus, exportEtaMs]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = exportStatus;

    if (exportStatus === "DONE" && prev !== "DONE") {
      onCompleted?.();
      return;
    }

    if (exportStatus === "FAILED" && prev !== "FAILED") {
      onFailed?.();
      return;
    }
  }, [exportStatus, onCompleted, onFailed]);

  const isInProgress =
    exportStatus === "QUEUED" || exportStatus === "PROCESSING";
  const statusLabel =
    exportStatus === "QUEUED"
      ? "Waiting for a render slot"
      : "Rendering and assembling your export";

  const currentStepIndex = isInProgress
    ? EXPORT_STEPS.findIndex(
        (s) => exportProgress >= s.range[0] && exportProgress < s.range[1],
      )
    : -1;

  const handleDownload = () => {
    if (job.outputUrl) {
      window.open(job.outputUrl, "_blank");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="border-[#f5a623]/20 bg-[#0a0a08] text-[#fff5de] sm:max-w-lg pt-6 shadow-[0_24px_120px_rgba(0,0,0,0.55)]"
      >
        <DialogHeader className="gap-0.5">
          <DialogTitle className="text-base font-semibold">
            Exporting Video
          </DialogTitle>
          <p className="text-xs text-white/40">
            {isInProgress
              ? (remainingText ??
                "This can continue in the background while you keep working.")
              : "We’ll keep you posted if the export is still running."}
          </p>
        </DialogHeader>

        <div className="pt-4 space-y-5">
          {/* ── In progress: progress bar + steps + notify + close ── */}
          {isInProgress && (
            <>
              <div className="rounded-2xl border border-white/[0.07] bg-white/2.5 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
                      Current status
                    </p>
                    <p className="mt-1 text-sm text-white/80">{statusLabel}</p>
                  </div>
                  <div className="rounded-full border border-[#f5a623]/20 bg-[#f5a623]/10 px-3 py-1 text-xs font-semibold text-[#f5a623]">
                    {exportProgress}%
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="rounded-full border border-white/10 bg-white/3 px-2.5 py-1 text-white/55">
                    {exportStatus === "QUEUED" ? "Queued" : "Processing"}
                  </span>
                  {remainingText && (
                    <span className="rounded-full border border-[#f5a623]/20 bg-[#f5a623]/10 px-2.5 py-1 text-[#f5a623]">
                      {remainingText}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/4">
                  <div
                    className="relative h-full rounded-full bg-[#f5a623] transition-all duration-500 overflow-hidden"
                    style={{ width: `${exportProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)] animate-shimmer" />
                  </div>
                </div>
                <span className="pointer-events-none absolute -top-4.5 left-1 text-xs font-mono text-[#f5a623]">
                  {exportProgress}%
                </span>
              </div>

              {/* Step list */}
              <div className="-mx-1 space-y-0">
                {EXPORT_STEPS.map((step, i) => {
                  const isCompleted = exportProgress >= step.range[1];
                  const isCurrent = i === currentStepIndex;
                  return (
                    <div
                      key={step.label}
                      className={`flex items-center gap-3 py-1.75 ${
                        isCurrent
                          ? "border-l-2 border-[#f5a623] bg-[rgba(255,160,0,0.06)] -ml-px pl-3 pr-3 rounded-r-lg"
                          : "pl-4.5 pr-3"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.25 w-3.25 shrink-0 text-[#22c55e]/60" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3.75 w-3.75 shrink-0 animate-spin text-[#f5a623]" />
                      ) : (
                        <span className="h-3.25 w-3.25 shrink-0 rounded-full border border-white/25" />
                      )}
                      <span
                        className={
                          isCompleted
                            ? "text-xs text-white/45"
                            : isCurrent
                              ? "text-sm font-bold text-[#f5a623]"
                              : "text-xs text-white/35"
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Notification toggle card */}
              <div className="rounded-2xl border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-white/45" />
                    <span className="text-sm text-white/75">
                      Notify me when ready
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyOnComplete}
                    onClick={() => onNotifyChange?.(!notifyOnComplete)}
                    className={`relative inline-flex h-5 w-9.5 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      notifyOnComplete ? "bg-[#f5a623]" : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        notifyOnComplete
                          ? "translate-x-5.25"
                          : "translate-x-0.75"
                      }`}
                    />
                  </button>
                </div>
                <p className="mt-1 text-xs text-white/35">
                  Close this dialog and we’ll keep tracking the export for you.
                </p>
              </div>

              {/* Footer close button */}
              <div className="pt-1 flex justify-center">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="h-10 cursor-pointer border-white/10 px-5 text-sm text-white/55 hover:bg-white/5 hover:text-white/80"
                >
                  Minimize to background
                </Button>
              </div>
            </>
          )}

          {/* ── Done state ── */}
          {exportStatus === "DONE" && (
            <div className="space-y-4 pt-1">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e]/10">
                  <CheckCircle2 className="h-7 w-7 text-[#22c55e]" />
                </div>
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium text-white/85">
                  Your video is ready to download.
                </p>
                <p className="text-xs text-white/45">
                  You can download it now or jump back to the dashboard.
                </p>
              </div>
              <Button
                onClick={handleDownload}
                className="w-full bg-[#f5a623] text-[#0a0a08] hover:bg-[#f5a623]/90 cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/dashboard";
                  }}
                  className="flex-1 border-[#f5a623]/20 text-[#f5a623] hover:bg-[#f5a623]/10 cursor-pointer"
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  View in Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* ── Failed state ── */}
          {exportStatus === "FAILED" && (
            <div className="space-y-3 pt-1">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444]/10">
                  <XCircle className="h-7 w-7 text-[#ef4444]" />
                </div>
              </div>
              <p className="text-center text-sm text-[#ef4444]">
                {job.error ?? "An unexpected error occurred during export."}
              </p>

              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="flex items-center justify-center gap-1 w-full text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                {showErrorDetails ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {showErrorDetails
                  ? "Hide technical details"
                  : "What went wrong?"}
              </button>

              {showErrorDetails && (
                <div className="rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/5 p-3">
                  <pre className="text-xs text-white/50 font-mono whitespace-pre-wrap break-all">
                    {job.error
                      ? (() => {
                          try {
                            const parsed = JSON.parse(job.error);
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return job.error;
                          }
                        })()
                      : "No additional error information available."}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    className="flex-1 bg-[#f5a623] text-[#0a0a08] hover:bg-[#f5a623]/90 cursor-pointer"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={onClose}
                  className={`${
                    onRetry ? "flex-1" : "w-full"
                  } border-[#f5a623]/20 text-[#f5a623] hover:bg-[#f5a623]/10 cursor-pointer`}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
