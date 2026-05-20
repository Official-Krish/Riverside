import { useCallback, useState } from "react";
import { editorApi } from "../api";
import type { EditorProject, ExportJob, Track, Overlay } from "../types";

export function useExport(
  project: EditorProject | null,
  tracks: Track[],
  overlays: Overlay[],
  durationMs: number,
) {
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleExport = useCallback(async () => {
    if (!project) return;
    try {
      // Force-save the latest project state before triggering the export.
      // The autosave uses a 1 s debounce, so if the user splits a clip and
      // immediately clicks Export, the worker would read stale (pre-split)
      // data from the database.  Saving here guarantees consistency.
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
    } catch (error) {
      console.error("Failed to start export:", error);
    }
  }, [project, tracks, overlays, durationMs]);

  return { exportJob, showExportDialog, setShowExportDialog, handleExport };
}
