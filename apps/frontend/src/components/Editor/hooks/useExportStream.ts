import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { BACKEND_URL } from "@/lib/config";
import { getStoredToken } from "@/lib/auth";
import type { ExportJob } from "../types";

type ExportStreamHandlers = {
  onProgress?: (progress: number) => void;
  onStatus?: (status: string | null) => void;
  onEta?: (etaMs: number | null) => void;
  onComplete?: () => void;
  onFailed?: () => void;
};

interface StreamEvent {
  type: "status" | "update" | "error";
  job?: ExportJob;
  message?: string;
  etaMs?: number;
}

class StreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamError";
  }
}

export function useExportStream(
  jobId: string | null,
  handlers: ExportStreamHandlers = {},
) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [etaMs, setEtaMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!jobId) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const startStream = async () => {
        setProgress(0);
        setStatus(null);
        setError(null);

        const token = getStoredToken();
        if (!token) {
          setError("Not authenticated");
          handlers.onFailed?.();
          return;
        }

        const abort = new AbortController();
        abortRef.current = abort;

        try {
          await fetchEventSource(
            `${BACKEND_URL}/editor/exports/${jobId}/stream`,
            {
              method: "GET",
              headers: { Authorization: `Bearer ${token}` },
              signal: abort.signal,
              onmessage(ev) {
                try {
                  const data: StreamEvent = JSON.parse(ev.data);

                  if (data.type === "error") {
                    setError(data.message || "Stream error");
                    handlers.onFailed?.();
                    abort.abort();
                    return;
                  }

                  if (data.etaMs !== undefined) {
                    setEtaMs(data.etaMs);
                    handlers.onEta?.(data.etaMs);
                  }

                  if (data.job) {
                    const nextProgress = data.job.progress ?? 0;
                    const nextStatus = data.job.status;

                    setProgress(nextProgress);
                    setStatus(nextStatus);
                    handlers.onProgress?.(nextProgress);
                    handlers.onStatus?.(nextStatus);

                    if (nextStatus === "DONE") {
                      handlers.onComplete?.();
                      abort.abort();
                    } else if (nextStatus === "FAILED") {
                      handlers.onFailed?.();
                      abort.abort();
                    }
                  }
                } catch {
                  setError("Failed to parse stream data");
                  handlers.onFailed?.();
                  abort.abort();
                }
              },
              onerror(err) {
                setError(
                  err instanceof StreamError ? err.message : "Connection lost",
                );
                handlers.onFailed?.();
                abort.abort();
                throw err;
              },
            },
          );
        } catch {
          if (!abort.signal.aborted) {
            setError("Connection failed");
            handlers.onFailed?.();
          }
        }
      };

      void startStream();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [jobId, handlers]);

  return {
    progress: jobId ? progress : 0,
    status: jobId ? status : null,
    error: jobId ? error : null,
    etaMs: jobId ? etaMs : null,
  };
}
