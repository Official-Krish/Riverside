import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorApi } from "../api";
import type { EditorProject, ExportJob, Track, Overlay } from "../types";
import { handleApiError } from "@/lib/errorHandler";
import { useExportStream } from "./useExportStream";

export function useExport(
  project: EditorProject | null,
  tracks: Track[],
  overlays: Overlay[],
  durationMs: number,
) {
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [localExportEtaMs, setLocalExportEtaMs] = useState<number | null>(null);
  const [streamExportEtaMs, setStreamExportEtaMs] = useState<number | null>(
    null,
  );

  const exportStartedAtRef = useRef<number | null>(null);
  const durationMsRef = useRef(durationMs);
  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  const handleExportComplete = useCallback(() => {
    setIsExporting(false);
    setExportProgress(100);
    setExportStatus("DONE");
    setLocalExportEtaMs(null);
    setStreamExportEtaMs(null);
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

  const handleExportFailed = useCallback(() => {
    setIsExporting(false);
    setExportStatus("FAILED");
    setLocalExportEtaMs(null);
    setStreamExportEtaMs(null);
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

  const updateExportProgress = useCallback((progress: number) => {
    const now = Date.now();
    if (!exportStartedAtRef.current) exportStartedAtRef.current = now;
    setExportProgress(progress);

    const startedAt = exportStartedAtRef.current;
    if (startedAt && progress > 5) {
      const elapsed = now - startedAt;
      const refined = Math.round((elapsed / progress) * (100 - progress));
      setLocalExportEtaMs(Math.max(5000, refined));
    } else if (durationMsRef.current > 0) {
      setLocalExportEtaMs(Math.round(durationMsRef.current * 1.5));
    }
  }, []);

  const exportStreamHandlers = useMemo(
    () => ({
      onProgress: updateExportProgress,
      onStatus: setExportStatus,
      onEta: setStreamExportEtaMs,
      onComplete: handleExportComplete,
      onFailed: handleExportFailed,
    }),
    [handleExportComplete, handleExportFailed, updateExportProgress],
  );

  useExportStream(
    isExporting ? (exportJob?.id ?? null) : null,
    exportStreamHandlers,
  );

  const handleExport = useCallback(async () => {
    if (!project) return;
    try {
      await editorApi.saveProject(project.id, {
        tracks,
        overlays,
        durationMs,
        fps: project.fps ?? 30,
        width: project.width ?? 1920,
        height: project.height ?? 1080,
      });

      const job = await editorApi.exportProject(project.id);
      setExportJob(job);
      setShowExportDialog(true);
      setIsExporting(true);
      setExportProgress(0);
      setExportStatus("QUEUED");
      setLocalExportEtaMs(durationMs > 0 ? Math.round(durationMs * 1.5) : null);
      setStreamExportEtaMs(null);
      exportStartedAtRef.current = null;

      if (notifyOnComplete) {
        localStorage.setItem("pendingExportJobId", job.id);
        localStorage.setItem("pendingExportProjectId", project.id);
      }
    } catch (error) {
      handleApiError(error, "Failed to start export");
    }
  }, [project, tracks, overlays, durationMs, notifyOnComplete]);

  const resetExport = useCallback(() => {
    setExportJob(null);
    setShowExportDialog(false);
    setIsExporting(false);
    setExportProgress(0);
    setExportStatus(null);
    setLocalExportEtaMs(null);
    setStreamExportEtaMs(null);
    exportStartedAtRef.current = null;
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

  const exportEtaMs = streamExportEtaMs ?? localExportEtaMs;

  return {
    exportJob,
    showExportDialog,
    setShowExportDialog,
    handleExport,
    handleExportComplete,
    handleExportFailed,
    updateExportProgress,
    resetExport,
    isExporting,
    setIsExporting,
    exportProgress,
    exportStatus,
    exportEtaMs,
    notifyOnComplete,
    setNotifyOnComplete,
  };
}
