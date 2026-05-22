import { useCallback, useState } from "react";
import { editorApi } from "../api";
import type { EditorProject, ExportJob, Track, Overlay } from "../types";
import { handleApiError } from "@/lib/errorHandler";

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

      if (notifyOnComplete) {
        localStorage.setItem("pendingExportJobId", job.id);
        localStorage.setItem("pendingExportProjectId", project.id);
      }
    } catch (error) {
      handleApiError(error, "Failed to start export");
    }
  }, [project, tracks, overlays, durationMs, notifyOnComplete]);

  const handleExportComplete = useCallback(() => {
    setIsExporting(false);
    setExportProgress(100);
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

  const handleExportFailed = useCallback(() => {
    setIsExporting(false);
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

  const updateExportProgress = useCallback((progress: number) => {
    setExportProgress(progress);
  }, []);

  const resetExport = useCallback(() => {
    setExportJob(null);
    setShowExportDialog(false);
    setIsExporting(false);
    setExportProgress(0);
    localStorage.removeItem("pendingExportJobId");
    localStorage.removeItem("pendingExportProjectId");
  }, []);

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
    exportProgress,
    notifyOnComplete,
    setNotifyOnComplete,
  };
}
