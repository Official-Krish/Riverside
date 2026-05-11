import { useEffect, useRef, useState } from "react";
import type { Overlay } from "./types";
import { X, Check } from "lucide-react";

type SnapGuideKind = "edge" | "center" | "distribution";

type SnapGuide = {
  position: number;
  label: string;
  kind: SnapGuideKind;
};

type OverlayBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Axis = "x" | "y";

type SnapCandidate = {
  position: number;
  guide: SnapGuide;
};

interface OverlayLayerProps {
  overlays: Overlay[];
  timelineTime: number;
  containerSize: { width: number; height: number };
  stageWidth: number;
  stageHeight: number;
  selectedOverlayId: string | null;
  setSelectedOverlayId: (id: string | null) => void;
  editingOverlayId: string | null;
  setEditingOverlayId: (id: string | null) => void;
  editText: string;
  setEditText: (text: string) => void;
  handleUpdateOverlay: (id: string, updates: Partial<Overlay>) => void;
  handleDeleteOverlay: (id: string) => void;
  handleStartTextEdit: (overlay: Overlay) => void;
  handleCommitTextEdit: () => void;
  isPlaying: boolean;
}

export function OverlayLayer({
  overlays,
  timelineTime,
  containerSize,
  stageWidth,
  stageHeight,
  selectedOverlayId,
  setSelectedOverlayId,
  editingOverlayId,
  setEditingOverlayId,
  editText,
  setEditText,
  handleUpdateOverlay,
  handleDeleteOverlay,
  handleStartTextEdit,
  handleCommitTextEdit,
  isPlaying,
}: OverlayLayerProps) {
  const overlayEditContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeGuides, setActiveGuides] = useState<{ x: SnapGuide | null; y: SnapGuide | null }>({ x: null, y: null });

  const SNAP_THRESHOLD_PX = 8;
  const DISTRIBUTION_THRESHOLD_PX = 14;

  const visibleOverlays = overlays.filter(
    (o) => timelineTime >= o.timelineStartMs && timelineTime <= o.timelineStartMs + o.durationMs
  );

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  const estimateOverlayBounds = (overlay: Overlay): OverlayBounds => {
    const fontSize = overlay.style?.fontSize || 24;
    const lineHeight = overlay.style?.lineHeight || 1.2;
    const maxWidth = overlay.style?.maxWidth || 320;
    const lines = (overlay.content.text || "").split("\n");
    const approxCharWidth = fontSize * 0.58;
    const estimatedWidth = Math.min(
      maxWidth,
      Math.max(40, ...lines.map((line) => line.length * approxCharWidth), fontSize * 2)
    );
    const estimatedHeight = Math.max(fontSize * lineHeight + 8, lines.length * fontSize * lineHeight + 8);

    return {
      x: overlay.transform.x,
      y: overlay.transform.y,
      width: estimatedWidth,
      height: estimatedHeight,
    };
  };

  const getOverlayBounds = (overlay: Overlay, scaleX: number, scaleY: number): OverlayBounds => {
    const element = overlayRefs.current[overlay.id];
    const container = overlayEditContainerRef.current;

    if (element && container) {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      return {
        x: (rect.left - containerRect.left) / scaleX,
        y: (rect.top - containerRect.top) / scaleY,
        width: rect.width / scaleX,
        height: rect.height / scaleY,
      };
    }

    return estimateOverlayBounds(overlay);
  };

  const buildAxisCandidates = (
    axis: Axis,
    size: number,
    stageSize: number,
    otherBounds: OverlayBounds[]
  ): SnapCandidate[] => {
    const candidates: SnapCandidate[] = [];

    const lineTargets = [
      { position: 0, label: axis === "x" ? "Left edge" : "Top edge", kind: "edge" as const },
      { position: stageSize / 2, label: axis === "x" ? "Center" : "Middle", kind: "center" as const },
      { position: stageSize, label: axis === "x" ? "Right edge" : "Bottom edge", kind: "edge" as const },
    ];

    for (const target of lineTargets) {
      const candidatePosition =
        target.kind === "center" ? target.position - size / 2 : target.position - (target.position === stageSize ? size : 0);

      candidates.push({
        position: candidatePosition,
        guide: {
          position: target.position,
          label: target.label,
          kind: target.kind,
        },
      });
    }

    for (const other of otherBounds) {
      const otherSize = axis === "x" ? other.width : other.height;
      const otherStart = axis === "x" ? other.x : other.y;
      const otherCenter = otherStart + otherSize / 2;
      const otherEnd = otherStart + otherSize;

      const positions = [
        {
          position: otherStart,
          guidePosition: otherStart,
          label: axis === "x" ? "Align left" : "Align top",
          kind: "edge" as const,
        },
        {
          position: otherCenter - size / 2,
          guidePosition: otherCenter,
          label: axis === "x" ? "Center align" : "Middle align",
          kind: "center" as const,
        },
        {
          position: otherEnd - size,
          guidePosition: otherEnd,
          label: axis === "x" ? "Align right" : "Align bottom",
          kind: "edge" as const,
        },
      ];

      for (const candidate of positions) {
        candidates.push({
          position: candidate.position,
          guide: {
            position: candidate.guidePosition,
            label: candidate.label,
            kind: candidate.kind,
          },
        });
      }
    }

    const sorted = [...otherBounds].sort((a, b) => (axis === "x" ? a.x - b.x : a.y - b.y));
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const first = sorted[i];
      const second = sorted[i + 1];
      const firstEnd = axis === "x" ? first.x + first.width : first.y + first.height;
      const secondStart = axis === "x" ? second.x : second.y;
      const gap = secondStart - firstEnd - size;

      if (gap > 0) {
        const candidatePosition = firstEnd + gap / 2;
        candidates.push({
          position: candidatePosition,
          guide: {
            position: candidatePosition,
            label: "Equal spacing",
            kind: "distribution",
          },
        });
      }
    }

    return candidates;
  };

  const snapAxis = (value: number, candidates: SnapCandidate[], threshold: number) => {
    let snappedValue = value;
    let activeGuide: SnapGuide | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const distance = Math.abs(candidate.position - value);
      if (distance < closestDistance) {
        closestDistance = distance;
        snappedValue = candidate.position;
        activeGuide = candidate.guide;
      }
    }

    if (closestDistance > threshold) {
      return { value, guide: null as SnapGuide | null };
    }

    return { value: snappedValue, guide: activeGuide };
  };

  const snapMove = (
    proposedX: number,
    proposedY: number,
    movingBounds: OverlayBounds,
    otherBounds: OverlayBounds[]
  ) => {
    const xCandidates = buildAxisCandidates("x", movingBounds.width, stageWidth, otherBounds);
    const yCandidates = buildAxisCandidates("y", movingBounds.height, stageHeight, otherBounds);

    const snappedX = snapAxis(proposedX, xCandidates, SNAP_THRESHOLD_PX);
    const snappedY = snapAxis(proposedY, yCandidates, SNAP_THRESHOLD_PX);

    return {
      x: clamp(snappedX.value, 0, Math.max(0, stageWidth - movingBounds.width)),
      y: clamp(snappedY.value, 0, Math.max(0, stageHeight - movingBounds.height)),
      guideX: snappedX.guide,
      guideY: snappedY.guide,
    };
  };

  const snapResizeWidth = (proposedWidth: number, leftEdge: number, otherBounds: OverlayBounds[]) => {
    const widthCandidates = buildAxisCandidates("x", 0, stageWidth, otherBounds).map((candidate) => ({
      position: candidate.guide.position,
      guide: candidate.guide,
    }));

    let snappedWidth = proposedWidth;
    let closestDistance = Number.POSITIVE_INFINITY;
    let activeGuide: SnapGuide | null = null;
    const rightEdge = leftEdge + proposedWidth;

    for (const candidate of widthCandidates) {
      const distance = Math.abs(candidate.position - rightEdge);
      if (distance < closestDistance) {
        closestDistance = distance;
        snappedWidth = Math.max(80, candidate.position - leftEdge);
        activeGuide = candidate.guide;
      }
    }

    if (closestDistance > DISTRIBUTION_THRESHOLD_PX) {
      return { width: proposedWidth, guide: null as SnapGuide | null };
    }

    return { width: snappedWidth, guide: activeGuide };
  };

  useEffect(() => {
    if (!selectedOverlayId || editingOverlayId) return;
    const selected = overlays.find((o) => o.id === selectedOverlayId);
    if (!selected) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;

        handleUpdateOverlay(selected.id!, {
          transform: {
            ...selected.transform,
            x: Math.max(0, Math.min(stageWidth, selected.transform.x + dx)),
            y: Math.max(0, Math.min(stageHeight, selected.transform.y + dy)),
          },
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedOverlayId, editingOverlayId, overlays, handleUpdateOverlay, stageWidth, stageHeight]);

  return (
    <div ref={overlayEditContainerRef} className="absolute inset-0 pointer-events-none z-30">
      {/* Overlay position indicators (visible overlays as draggable chips) */}
      {visibleOverlays.map((overlay) => {
          if (!overlay.id) return null;
          const scaleX = containerSize.width / stageWidth;
          const scaleY = containerSize.height / stageHeight;
          const isSelected = selectedOverlayId === overlay.id;
          const overlayBounds = getOverlayBounds(overlay, scaleX, scaleY);

          return (
            <div
              key={overlay.id}
              ref={(el) => {
                overlayRefs.current[overlay.id] = el;
              }}
              className={`absolute pointer-events-auto cursor-move select-none transition-all duration-100
                ${isSelected
                  ? "ring-2 ring-[#f5a623] ring-offset-1 ring-offset-transparent rounded"
                  : "hover:ring-1 hover:ring-[#f5a623]/40 rounded"
                }`}
              style={{
                left: overlay.transform.x * scaleX,
                top: overlay.transform.y * scaleY,
                fontSize: (overlay.style?.fontSize || 24) * scaleX,
                fontFamily: overlay.style?.fontFamily || "Inter, system-ui, sans-serif",
                fontWeight: overlay.style?.fontWeight || "normal",
                fontStyle: overlay.style?.fontStyle || "normal",
                color: overlay.style?.color || "#fff5de",
                minWidth: 40 * scaleX,
                minHeight: 20 * scaleY,
                padding: "2px 4px",
                maxWidth: overlay.style?.maxWidth ? overlay.style.maxWidth * scaleX : undefined,
                lineHeight: overlay.style?.lineHeight || 1.2,
                letterSpacing: overlay.style?.letterSpacing || 0,
                background: editingOverlayId === overlay.id ? "transparent" : (isSelected ? "rgba(245,166,35,0.1)" : "rgba(0,0,0,0.2)"),
                border: isSelected ? "1px solid rgba(245,166,35,0.45)" : "1px dashed rgba(245,166,35,0.2)",
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                direction: overlay.style?.direction || "ltr",
                unicodeBidi: "plaintext",
                // Hide interactive DOM overlays while the video is playing to avoid
                // duplicate rendering (canvas already draws overlays during playback).
                // Keep the overlay interactive when editing.
                opacity: editingOverlayId === overlay.id ? 0 : (isPlaying ? 0 : 1),
                visibility: editingOverlayId === overlay.id ? "hidden" : (isPlaying ? "hidden" : "visible"),
                pointerEvents: editingOverlayId === overlay.id ? "none" : (isPlaying ? "none" : "auto"),
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOverlayId(overlay.id!);
              }}
              onDoubleClick={() => handleStartTextEdit(overlay)}
              onMouseDown={(e) => {
                if (editingOverlayId) return;
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const origX = overlay.transform.x;
                const origY = overlay.transform.y;
                const movingBounds = overlayBounds;
                const otherBounds = visibleOverlays
                  .filter((o) => o.id !== overlay.id)
                  .map((o) => getOverlayBounds(o, scaleX, scaleY));

                const handleMove = (moveE: MouseEvent) => {
                  const dx = (moveE.clientX - startX) / scaleX;
                  const dy = (moveE.clientY - startY) / scaleY;

                  // base coordinates
                  const unclampedX = origX + dx;
                  const unclampedY = origY + dy;

                  const snapped = snapMove(unclampedX, unclampedY, movingBounds, otherBounds);

                  setActiveGuides({ x: snapped.guideX, y: snapped.guideY });

                  handleUpdateOverlay(overlay.id!, {
                    transform: {
                      ...overlay.transform,
                      x: snapped.x,
                      y: snapped.y,
                    },
                  });
                };

                const handleUp = () => {
                  window.removeEventListener("mousemove", handleMove);
                  window.removeEventListener("mouseup", handleUp);
                  setActiveGuides({ x: null, y: null });
                };

                window.addEventListener("mousemove", handleMove);
                window.addEventListener("mouseup", handleUp);
              }}
            >
              {/* Live preview text - hide when editing */}
              {!editingOverlayId && (
                <span
                  style={{
                    whiteSpace: "pre-wrap",
                    direction: overlay.style?.direction || "ltr",
                    textShadow: overlay.style?.textShadow ? "0 1px 3px rgba(0,0,0,0.65)" : undefined,
                    WebkitTextStroke:
                      overlay.style?.strokeWidth && overlay.style?.strokeWidth > 0
                        ? `${Math.max(0.5, overlay.style.strokeWidth * 0.4)}px ${overlay.style.strokeColor || "#000"}`
                        : undefined,
                  }}
                >
                  {overlay.content.text}
                </span>
              )}

              {/* Width resize handle for quick wrapping */}
              {isSelected && !editingOverlayId && (
                <div
                  className="group/resize-x absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 cursor-ew-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const startX = e.clientX;
                    const initialWidth = overlay.style?.maxWidth || 320;
                      const otherBounds = visibleOverlays
                        .filter((o) => o.id !== overlay.id)
                        .map((o) => getOverlayBounds(o, scaleX, scaleY));

                    const onMove = (moveE: MouseEvent) => {
                      const delta = (moveE.clientX - startX) / scaleX;
                      const raw = Math.max(80, Math.min(1200, Math.round(initialWidth + delta)));
                        const snapped = snapResizeWidth(raw, overlay.transform.x, otherBounds);
                        const next = snapped.width;
                        setActiveGuides({ x: snapped.guide, y: null });
                      handleUpdateOverlay(overlay.id!, {
                        style: {
                          ...overlay.style,
                          maxWidth: next,
                        },
                      });
                    };

                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                      setActiveGuides({ x: null, y: null });
                    };

                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                  title="Drag to resize text width"
                >
                  <div className="absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#f5a623] bg-[#0d0d0b] shadow" />
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-black/90 px-2 py-1 text-[10px] text-[#fff5de] opacity-0 transition-opacity group-hover/resize-x:opacity-100">
                    Resize width
                  </div>
                </div>
              )}

              {/* Corner handle: resize width + font-size together */}
              {isSelected && !editingOverlayId && (
                <div
                  className="group/resize-corner absolute -right-3 -bottom-3 h-6 w-6 cursor-nwse-resize"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const initialWidth = overlay.style?.maxWidth || 320;
                    const initialSize = overlay.style?.fontSize || 24;
                      const otherBounds = visibleOverlays
                        .filter((o) => o.id !== overlay.id)
                        .map((o) => getOverlayBounds(o, scaleX, scaleY));

                    const onMove = (moveE: MouseEvent) => {
                      const deltaW = (moveE.clientX - startX) / scaleX;
                      const deltaS = (moveE.clientY - startY) / scaleY;
                      const rawWidth = Math.max(80, Math.min(1200, Math.round(initialWidth + deltaW)));
                        const nextWidth = snapResizeWidth(rawWidth, overlay.transform.x, otherBounds).width;
                      const nextSize = Math.max(12, Math.min(140, Math.round(initialSize + deltaS * 0.2)));
                      handleUpdateOverlay(overlay.id!, {
                        style: {
                          ...overlay.style,
                          maxWidth: nextWidth,
                          fontSize: nextSize,
                        },
                      });
                    };

                    const onUp = () => {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                      setActiveGuides({ x: null, y: null });
                    };

                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                  title="Drag to resize box and text"
                >
                  <div className="absolute right-1 bottom-1 h-4 w-4 rounded-sm border border-[#f5a623] bg-[#0d0d0b] shadow" />
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-black/90 px-2 py-1 text-[10px] text-[#fff5de] opacity-0 transition-opacity group-hover/resize-corner:opacity-100">
                    Resize + Scale
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* Alignment guides while dragging */}
      {(activeGuides.x !== null || activeGuides.y !== null) && (
        <>
          {activeGuides.x !== null && (
            <div
              className={`absolute top-0 bottom-0 z-40 pointer-events-none ${activeGuides.x.kind === "distribution" ? "border-l-2 border-dotted border-[#f5a623]/95" : "border-l border-dashed border-[#22d3ee]/90"}`}
              style={{ left: activeGuides.x.position * (containerSize.width / stageWidth) }}
            >
              <div
                className={`absolute top-2 rounded px-1.5 py-0.5 text-[10px] font-medium shadow ${activeGuides.x.kind === "distribution" ? "bg-[#f5a623] text-black" : "bg-[#22d3ee] text-black"}`}
                style={{ left: 8 }}
              >
                {activeGuides.x.label}
              </div>
            </div>
          )}
          {activeGuides.y !== null && (
            <div
              className={`absolute left-0 right-0 z-40 pointer-events-none ${activeGuides.y.kind === "distribution" ? "border-t-2 border-dotted border-[#f5a623]/95" : "border-t border-dashed border-[#22d3ee]/90"}`}
              style={{ top: activeGuides.y.position * (containerSize.height / stageHeight) }}
            >
              <div
                className={`absolute left-2 rounded px-1.5 py-0.5 text-[10px] font-medium shadow ${activeGuides.y.kind === "distribution" ? "bg-[#f5a623] text-black" : "bg-[#22d3ee] text-black"}`}
                style={{ top: 8 }}
              >
                {activeGuides.y.label}
              </div>
            </div>
          )}
        </>
      )}

      {/* Inline text editing input (contentEditable for richer UX) */}
      {editingOverlayId && (() => {
        const overlay = overlays.find(o => o.id === editingOverlayId);
        if (!overlay) return null;

        const scaleX = containerSize.width / stageWidth;
        const scaleY = containerSize.height / stageHeight;

        const applyStyleUpdate = (updates: Partial<NonNullable<Overlay["style"]>>) =>
          handleUpdateOverlay(overlay.id!, { style: { ...overlay.style, ...updates } });

        return (
          <>
            <div
              className="fixed inset-0 z-50 pointer-events-auto"
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleCommitTextEdit();
              }}
            />

            {/* Rich inline toolbar */}
            <div
              className="absolute z-60 pointer-events-auto flex items-center gap-2 rounded-lg border border-[#f5a623]/20 bg-black/85 px-3 py-1.5 text-xs text-[#fff5de] shadow-xl "
              style={{
                left: "50%",
                transform: "translateX(-50%)",
                top: 8,
                zIndex: 100,
              }}
            >
              <button
                className={`rounded px-2 py-0.5 font-bold transition-colors ${overlay.style?.fontWeight === "bold" ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
                onClick={() => applyStyleUpdate({ fontWeight: overlay.style?.fontWeight === "bold" ? "normal" : "bold" })}
              >
                B
              </button>
              <button
                className={`rounded px-2 py-0.5 italic transition-colors ${overlay.style?.fontStyle === "italic" ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
                onClick={() => applyStyleUpdate({ fontStyle: overlay.style?.fontStyle === "italic" ? "normal" : "italic" })}
              >
                I
              </button>
              <button
                className={`rounded px-2 py-0.5 transition-colors ${overlay.style?.underline ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
                onClick={() => applyStyleUpdate({ underline: !overlay.style?.underline })}
                title="Underline"
              >
                U
              </button>
              <button
                className={`rounded px-2 py-0.5 transition-colors ${overlay.style?.strikeThrough ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
                onClick={() => applyStyleUpdate({ strikeThrough: !overlay.style?.strikeThrough })}
                title="Strike"
              >
                S
              </button>

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <select
                value={overlay.style?.direction || "ltr"}
                onChange={(e) => applyStyleUpdate({ direction: e.target.value as "ltr" | "rtl" })}
                className="rounded border border-[#f5a623]/20 bg-black/60 px-2 py-0.5 text-[11px] cursor-pointer"
                title="Text direction"
              >
                <option value="ltr">LTR</option>
                <option value="rtl">RTL</option>
              </select>

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <select
                value={overlay.style?.fontFamily || "Inter, system-ui, sans-serif"}
                onChange={(e) => applyStyleUpdate({ fontFamily: e.target.value })}
                className="rounded border border-[#f5a623]/20 bg-black/60 px-2 py-0.5 text-[11px] cursor-pointer"
                title="Font family"
              >
                <option value="Inter, system-ui, sans-serif">Inter</option>
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="Courier New, monospace">Courier</option>
              </select>

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <input
                type="color"
                value={overlay.style?.color || "#ffffff"}
                onChange={(e) => applyStyleUpdate({ color: e.target.value })}
                className="h-6 w-7 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
                title="Text color"
              />

              <input
                type="range"
                min={12}
                max={96}
                value={overlay.style?.fontSize || 24}
                onChange={(e) => applyStyleUpdate({ fontSize: Number(e.target.value) })}
                className="w-20 accent-[#f5a623]"
                title="Font size"
              />
              <span className="text-[10px] text-[#8d7850] w-6 text-center">{overlay.style?.fontSize || 24}</span>

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <input
                type="color"
                value={overlay.style?.strokeColor || "#000000"}
                onChange={(e) => applyStyleUpdate({ strokeColor: e.target.value })}
                className="h-6 w-7 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
                title="Stroke color"
              />
              <input
                type="range"
                min={0}
                max={8}
                value={overlay.style?.strokeWidth || 0}
                onChange={(e) => applyStyleUpdate({ strokeWidth: Number(e.target.value) })}
                className="w-20 accent-[#f5a623]"
                title="Stroke width"
              />

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <input
                type="range"
                min={80}
                max={1000}
                step={10}
                value={overlay.style?.maxWidth || 320}
                onChange={(e) => applyStyleUpdate({ maxWidth: Number(e.target.value) })}
                className="w-20 accent-[#f5a623]"
                title="Wrap width"
              />
              <span className="w-10 text-[10px] text-[#8d7850] text-right">{overlay.style?.maxWidth || 320}</span>

              <input
                type="range"
                min={0.8}
                max={2.4}
                step={0.05}
                value={overlay.style?.lineHeight || 1.2}
                onChange={(e) => applyStyleUpdate({ lineHeight: Number(e.target.value) })}
                className="w-16 accent-[#f5a623]"
                title="Line height"
              />
              <span className="w-8 text-[10px] text-[#8d7850] text-right">{(overlay.style?.lineHeight || 1.2).toFixed(2)}</span>

              <div className="h-4 w-px bg-[#f5a623]/20" />

              <button
                className="rounded px-1.5 py-0.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                onClick={() => setEditingOverlayId(null)}
                title="Done editing"
              >
                Done
              </button>
            </div>

            {/* Textarea for editing */}
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditingOverlayId(null);
                }
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleCommitTextEdit();
                }
                if (e.key === "Backspace" && editText === "") {
                  handleDeleteOverlay(overlay.id!);
                }
              }}
              onBlur={() => handleCommitTextEdit()}
              className="pointer-events-auto resize-none rounded px-2 py-1"
              autoFocus
              placeholder="Type text..."
              style={{
                position: "absolute",
                left: overlay.transform.x * scaleX,
                top: overlay.transform.y * scaleY,
                fontSize: (overlay.style?.fontSize || 24) * scaleX,
                fontFamily: overlay.style?.fontFamily || "Inter, system-ui, sans-serif",
                color: overlay.style?.color || "#ffffff",
                background: "rgba(0,0,0,0.8)",
                border: "2px solid #f5a623",
                borderRadius: overlay.style?.backgroundRadius || 6,
                padding: "6px 10px",
                outline: "none",
                minWidth: 120,
                zIndex: 61,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                direction: overlay.style?.direction || "ltr",
                unicodeBidi: "plaintext",
                width: (overlay.style?.maxWidth || 320) * scaleX,
                minHeight: "1.5em",
              }}
            />
          </>
        );
      })()}

      {/* Selected overlay style toolbar - fixed at top center */}
      {selectedOverlayId && !editingOverlayId && !isPlaying && (() => {
        const overlay = overlays.find(o => o.id === selectedOverlayId);
        if (!overlay) return null;

        return (
          <div
            className="absolute z-50 pointer-events-auto flex items-center gap-2 rounded-lg border border-[#f5a623]/30 bg-black/80 px-3 py-1.5 text-xs text-[#fff5de] shadow-xl "
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              top: 8,
            }}
          >
            <button
              className={`rounded px-2 py-0.5 font-bold transition-colors ${overlay.style?.fontWeight === "bold" ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
              onClick={() =>
                handleUpdateOverlay(overlay.id!, {
                  style: {
                    ...overlay.style,
                    fontWeight: overlay.style?.fontWeight === "bold" ? "normal" : "bold",
                  },
                })
              }
            >
              B
            </button>
            <button
              className={`rounded px-2 py-0.5 italic transition-colors ${overlay.style?.fontStyle === "italic" ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20"}`}
              onClick={() =>
                handleUpdateOverlay(overlay.id!, {
                  style: {
                    ...overlay.style,
                    fontStyle: overlay.style?.fontStyle === "italic" ? "normal" : "italic",
                  },
                })
              }
            >
              I
            </button>
            <div className="h-4 w-px bg-[#f5a623]/20" />
            <input
              type="color"
              value={overlay.style?.color || "#ffffff"}
              onChange={(e) =>
                handleUpdateOverlay(overlay.id!, {
                  style: { ...overlay.style, color: e.target.value },
                })
              }
              className="h-6 w-7 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
              title="Text color"
            />
            <div className="h-4 w-px bg-[#f5a623]/20" />
            <input
              type="range"
              min={12}
              max={96}
              value={overlay.style?.fontSize || 24}
              onChange={(e) =>
                handleUpdateOverlay(overlay.id!, {
                  style: { ...overlay.style, fontSize: Number(e.target.value) },
                })
              }
              className="w-20 accent-[#f5a623]"
              title="Font size"
            />
            <span className="text-[10px] text-[#8d7850] w-6 text-center">{overlay.style?.fontSize || 24}</span>
            <div className="h-4 w-px bg-[#f5a623]/20" />
            <select
              value={overlay.style?.textAlign || "left"}
              onChange={(e) =>
                handleUpdateOverlay(overlay.id!, {
                  style: {
                    ...overlay.style,
                    textAlign: e.target.value as "left" | "center" | "right",
                  },
                })
              }
              className="rounded border border-[#f5a623]/20 bg-black/60 px-1.5 py-0.5 text-[11px] cursor-pointer"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
            <div className="h-4 w-px bg-[#f5a623]/20" />
            <input
              type="range"
              min={80}
              max={1000}
              step={10}
              value={overlay.style?.maxWidth || 320}
              onChange={(e) =>
                handleUpdateOverlay(overlay.id!, {
                  style: {
                    ...overlay.style,
                    maxWidth: Number(e.target.value),
                  },
                })
              }
              className="w-20 accent-[#f5a623]"
              title="Wrap width"
            />
            <span className="text-[10px] text-[#8d7850] w-9 text-right">{overlay.style?.maxWidth || 320}</span>
            <input
              type="range"
              min={0.8}
              max={2.4}
              step={0.05}
              value={overlay.style?.lineHeight || 1.2}
              onChange={(e) =>
                handleUpdateOverlay(overlay.id!, {
                  style: {
                    ...overlay.style,
                    lineHeight: Number(e.target.value),
                  },
                })
              }
              className="w-16 accent-[#f5a623]"
              title="Line height"
            />
            <span className="text-[10px] text-[#8d7850] w-8 text-right">{(overlay.style?.lineHeight || 1.2).toFixed(2)}</span>
            <div className="h-4 w-px bg-[#f5a623]/20" />
            <button
              className="rounded px-1.5 py-0.5 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
              onClick={() => setSelectedOverlayId(null)}
              title="Deselect overlay"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              className="rounded px-1.5 py-0.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
              onClick={() => handleDeleteOverlay(overlay.id!)}
              title="Delete overlay"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })()}
    </div>
  );
}
