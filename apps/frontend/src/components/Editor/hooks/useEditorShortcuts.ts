import { useEffect } from "react";
import type { Overlay, PresetType } from "../types";

const PRESET_SHORTCUTS: Record<string, PresetType> = {
  "1": "zoom-pop",
  "2": "shake",
  "3": "glitch",
  "4": "cinematic-bars",
  "5": "vhs",
  "6": "chromakey",
  "i": "intro-template",
  "m": "meme-format",
  "p": "podcast-layout",
  "g": "gaming-edit",
};

export function useEditorShortcuts(
  overlays: Overlay[],
  selectedOverlayId: string | null,
  editingOverlayId: string | null,
  handleDeleteOverlay: (id: string) => void,
  handleUpdateOverlay: (id: string, updates: Partial<Overlay>) => void,
  handleAddOverlay: (overlay: Overlay) => void,
  handleUndo: () => void,
  handleRedo: () => void,
  setTimelineZoom: (zoom: number | ((prev: number) => number)) => void,
  onApplyPreset?: (preset: PresetType | null) => void
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isTypingTarget || editingOverlayId) return;
      if (!selectedOverlayId) return;

      const overlay = overlays.find((o) => o.id === selectedOverlayId);
      if (!overlay) return;

      const moveStep = e.shiftKey ? 10 : 2;

      // DELETE
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteOverlay(selectedOverlayId);
        return;
      }

      // ARROW KEYS
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowUp") dy = -moveStep;
      if (e.key === "ArrowDown") dy = moveStep;
      if (e.key === "ArrowLeft") dx = -moveStep;
      if (e.key === "ArrowRight") dx = moveStep;

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();

        handleUpdateOverlay(selectedOverlayId, {
          transform: {
            x: overlay.transform.x + dx,
            y: overlay.transform.y + dy,
          },
        });
      }

      // DUPLICATE (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();

        handleAddOverlay({
          ...overlay,
          id: crypto.randomUUID(),
          transform: {
            x: overlay.transform.x + 20,
            y: overlay.transform.y + 20,
          },
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedOverlayId,
    overlays,
    editingOverlayId,
    handleDeleteOverlay,
    handleUpdateOverlay,
    handleAddOverlay,
  ]);

  useEffect(() => {
    const onZoomHotkeys = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (isMeta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isMeta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== "+" && e.key !== "=" && e.key !== "-" && e.key !== "_") return;
      e.preventDefault();
      setTimelineZoom((prev) => {
        if (e.key === "+" || e.key === "=") return Math.min(6, +(prev + 0.25).toFixed(2));
        return Math.max(0.5, +(prev - 0.25).toFixed(2));
      });
    };

    window.addEventListener("keydown", onZoomHotkeys);
    return () => window.removeEventListener("keydown", onZoomHotkeys);
  }, [handleRedo, handleUndo, setTimelineZoom]);

  useEffect(() => {
    if (!onApplyPreset) return;

    const onPresetHotkeys = (e: KeyboardEvent) => {
      const isMeta = e.ctrlKey || e.metaKey;
      if (!isMeta) return;

      const key = e.key.toLowerCase();

      if (PRESET_SHORTCUTS[key]) {
        e.preventDefault();
        onApplyPreset(PRESET_SHORTCUTS[key]);
        return;
      }

      if (key === "0") {
        e.preventDefault();
        onApplyPreset(null);
        return;
      }
    };

    window.addEventListener("keydown", onPresetHotkeys);
    return () => window.removeEventListener("keydown", onPresetHotkeys);
  }, [onApplyPreset]);
}
