/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { editorApi } from "./api";
import type { ExportJob } from "./types";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Download,
  Film,
  Bell,
  X,
} from "lucide-react";

interface ExportDialogProps {
  job: ExportJob;
  onClose: () => void;
  onCompleted?: () => void;
  onFailed?: () => void;
  notifyOnComplete?: boolean;
  onNotifyChange?: (checked: boolean) => void;
}

export function ExportDialog({
  job,
  onClose,
  onCompleted,
  onFailed,
  notifyOnComplete = true,
  onNotifyChange,
}: ExportDialogProps) {
  const [status, setStatus] = useState(job.status);
  const [progress, setProgress] = useState(job.progress ?? 0);
  const [exportJob, setExportJob] = useState<ExportJob>(job);
  const completionNotifiedRef = useRef(false);

  useEffect(() => {
    setStatus(job.status);
    setProgress(job.progress ?? 0);
    setExportJob(job);
  }, [job]);

  useEffect(() => {
    if (status !== "QUEUED" && status !== "PROCESSING") return;

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await editorApi.getExportStatus(exportJob.id);
        setExportJob(updatedJob);
        setStatus(updatedJob.status);
        setProgress(updatedJob.progress ?? 0);
      } catch (error) {
        console.error("Failed to poll export status:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [status, exportJob.id]);

  useEffect(() => {
    if (status === "DONE" && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onCompleted?.();
      return;
    }

    if (status === "FAILED" && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onFailed?.();
      return;
    }

    if (status !== "DONE" && status !== "FAILED") {
      completionNotifiedRef.current = false;
    }
  }, [status, onCompleted, onFailed]);

  const getStatusConfig = () => {
    switch (status) {
      case "QUEUED":
        return {
          icon: <Loader2 className="h-6 w-6 animate-spin text-[#f5a623]" />,
          title: "Export Queued",
          description: "Your export is waiting to be processed...",
          color: "text-[#f5a623]",
        };
      case "PROCESSING":
        return {
          icon: <Loader2 className="h-6 w-6 animate-spin text-[#f5a623]" />,
          title: "Exporting Video",
          description: `Processing your video... ${progress}%`,
          color: "text-[#f5a623]",
        };
      case "DONE":
        return {
          icon: <CheckCircle2 className="h-6 w-6 text-[#22c55e]" />,
          title: "Export Complete!",
          description: "Your video is ready to download.",
          color: "text-[#22c55e]",
        };
      case "FAILED":
        return {
          icon: <XCircle className="h-6 w-6 text-[#ef4444]" />,
          title: "Export Failed",
          description: job.error ?? "Something went wrong during export.",
          color: "text-[#ef4444]",
        };
      default:
        return {
          icon: <Film className="h-6 w-6 text-[#8d7850]" />,
          title: "Unknown Status",
          description: "Please refresh and try again.",
          color: "text-[#8d7850]",
        };
    }
  };

  const config = getStatusConfig();

  const handleDownload = () => {
    if (exportJob.outputUrl) {
      window.open(exportJob.outputUrl, "_blank");
    }
  };

  const isInProgress = status === "QUEUED" || status === "PROCESSING";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="border-[#f5a623]/20 bg-[#0a0a08] text-[#fff5de] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-[#bfa873]">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5a623]/10">
              {config.icon}
            </div>
          </div>

          {/* Progress bar */}
          {isInProgress && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2 bg-[#f5a623]/10" />
              <p className="text-center text-xs font-mono text-[#8d7850]">
                {progress}% complete
              </p>
            </div>
          )}

          {/* Notify me checkbox — only show while in progress */}
          {isInProgress && (
            <label className="flex items-start gap-3 rounded-lg border border-[#f5a623]/10 bg-[#f5a623]/5 px-3 py-2.5 cursor-pointer group">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#f5a623]/30 group-hover:border-[#f5a623]/60 transition-colors bg-[#0a0a08]">
                {notifyOnComplete && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="h-3 w-3 text-[#f5a623]"
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={notifyOnComplete}
                onChange={(e) => onNotifyChange?.(e.target.checked)}
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[#fff5de] flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-[#f5a623]" />
                  Notify me when export is ready
                </span>
                <span className="text-xs text-[#8d7850]">
                  We'll send you an in-app notification and you can close this
                  dialog.
                </span>
              </div>
            </label>
          )}

          {/* Action buttons */}
          {status === "DONE" && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDownload}
                className="flex-1 bg-[#f5a623] text-[#0a0a08] hover:bg-[#f5a623]/90"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-[#f5a623]/20 text-[#f5a623] hover:bg-[#f5a623]/10"
              >
                Close
              </Button>
            </div>
          )}

          {status === "FAILED" && (
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-[#f5a623]/20 text-[#f5a623] hover:bg-[#f5a623]/10"
            >
              Close
            </Button>
          )}

          {/* Dismiss button — only when notify is enabled and in progress */}
          {isInProgress && notifyOnComplete && (
            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-[#8d7850] hover:text-[#fff5de] hover:bg-[#f5a623]/5"
            >
              <X className="mr-2 h-4 w-4" />
              Close — we'll notify you when it's ready
            </Button>
          )}

          {isInProgress && !notifyOnComplete && (
            <p className="text-center text-xs text-[#8d7850]">
              This may take a few minutes depending on video length.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
