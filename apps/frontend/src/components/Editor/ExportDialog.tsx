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
import { CheckCircle2, Loader2, XCircle, Download, Film } from "lucide-react";

interface ExportDialogProps {
  job: ExportJob;
  onClose: () => void;
  onCompleted?: () => void;
}

export function ExportDialog({ job, onClose, onCompleted }: ExportDialogProps) {
  const [status, setStatus] = useState(job.status);
  const [progress, setProgress] = useState(job.progress ?? 0);
  const [exportJob, setExportJob] = useState<ExportJob>(job);
  const completionNotifiedRef = useRef(false);

  useEffect(() => {
    setStatus(job.status);
    setProgress(job.progress ?? 0);
    setExportJob(job);
  }, [job]);

  // Poll for status updates
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

    if (status !== "DONE") {
      completionNotifiedRef.current = false;
    }
  }, [status, onCompleted]);

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
          {(status === "QUEUED" || status === "PROCESSING") && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2 bg-[#f5a623]/10" />
              <p className="text-center text-xs font-mono text-[#8d7850]">
                {progress}% complete
              </p>
            </div>
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

          {(status === "QUEUED" || status === "PROCESSING") && (
            <p className="text-center text-xs text-[#8d7850]">
              This may take a few minutes depending on video length.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
