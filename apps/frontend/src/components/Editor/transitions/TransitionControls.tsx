/**
 * Transition Controls Component
 * Properties panel for configuring selected transition
 */

/* eslint-disable */
import { useEffect, useState } from "react";
import type {
  Transition,
  TransitionEasing,
  TransitionDirection,
} from "./types";
import {
  DEFAULT_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  MAX_TRANSITION_DURATION,
  getTransitionDefinition,
} from "./types";
import { cn } from "@/lib/utils";

interface TransitionControlsProps {
  transition: Transition | null;
  onUpdate: (updates: Partial<Transition>) => void;
  onDelete?: () => void;
  onClose?: () => void;
  onBackToList?: () => void;
}

export function TransitionControls({
  transition,
  onUpdate,
  onDelete,
  onClose,
  onBackToList,
}: TransitionControlsProps) {
  const [localDuration, setLocalDuration] = useState(
    transition?.durationMs || DEFAULT_TRANSITION_DURATION,
  );

  useEffect(() => {
    setLocalDuration(transition?.durationMs || DEFAULT_TRANSITION_DURATION);
  }, [transition?.durationMs]);

  if (!transition) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-3xl text-[#8d7850]">◫</div>
        <p className="text-sm font-medium text-[#bfa873]">
          No Transition Selected
        </p>
        <p className="mt-1 text-xs text-[#8d7850]">
          Select a transition from the timeline to configure its properties
        </p>
      </div>
    );
  }

  const def = getTransitionDefinition(transition.type);

  return (
    <div className="flex h-full flex-col bg-[#0a0a08] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[#f5a623]/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#fff5de]">
              {def?.name || transition.type}
            </h3>
            <p className="text-[10px] text-[#8d7850] capitalize">
              {transition.category} • {transition.position}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onBackToList && (
              <button
                onClick={onBackToList}
                className="rounded p-1.5 text-[#f5a623] transition-colors hover:bg-[#f5a623]/10"
                title="Back to transition list"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded p-1.5 text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
                title="Delete transition"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="rounded p-1.5 text-[#8d7850] transition-colors hover:bg-[#f5a623]/10 hover:text-[#f5a623]"
                title="Close controls"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Duration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#bfa873]">
              Duration
            </label>
            <span className="text-xs font-mono text-[#f5a623]">
              {localDuration}ms
            </span>
          </div>
          <input
            type="range"
            min={MIN_TRANSITION_DURATION}
            max={MAX_TRANSITION_DURATION}
            step={50}
            value={localDuration}
            onChange={(e) => setLocalDuration(Number(e.target.value))}
            onBlur={() => onUpdate({ durationMs: localDuration })}
            className="h-1.5 w-full accent-[#f5a623]"
          />
          <div className="flex justify-between text-[10px] text-[#8d7850]">
            <span>{MIN_TRANSITION_DURATION}ms</span>
            <span>{MAX_TRANSITION_DURATION}ms</span>
          </div>
        </div>

        {/* Easing */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#bfa873]">Easing</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                "linear",
                "ease-in",
                "ease-out",
                "ease-in-out",
              ] as TransitionEasing[]
            ).map((easing) => (
              <button
                key={easing}
                onClick={() => onUpdate({ easing })}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-xs transition-colors",
                  transition.easing === easing
                    ? "border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]"
                    : "border-[#f5a623]/20 bg-[#1a1a16] text-[#8d7850] hover:border-[#f5a623]/40",
                )}
              >
                {easing.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          {/* Easing preview */}
          <div className="mt-2 h-16 rounded-md border border-[#f5a623]/20 bg-[#1a1a16] p-2">
            <EasingPreview easing={transition.easing} />
          </div>
        </div>

        {/* Direction (for directional transitions) */}
        {def && ["slide", "wipe", "push", "special"].includes(def.category) && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#bfa873]">
              Direction
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  "top-left",
                  "top",
                  "top-right",
                  "left",
                  "center",
                  "right",
                  "bottom-left",
                  "bottom",
                  "bottom-right",
                ] as TransitionDirection[]
              ).map((dir) => (
                <button
                  key={dir}
                  onClick={() => onUpdate({ direction: dir })}
                  disabled={!isValidDirection(transition.type, dir)}
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-[10px] transition-colors disabled:opacity-30",
                    transition.direction === dir
                      ? "border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623]"
                      : "border-[#f5a623]/20 bg-[#1a1a16] text-[#8d7850] hover:border-[#f5a623]/40",
                  )}
                >
                  {dir.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reverse toggle for applicable transitions */}
        {[
          "slide-left",
          "slide-right",
          "slide-up",
          "slide-down",
          "wipe-left",
          "wipe-right",
          "wipe-top",
          "wipe-bottom",
        ].includes(transition.type) && (
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#bfa873]">
              Reverse
            </label>
            <button
              onClick={() => onUpdate({ reverse: !transition.reverse })}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                transition.reverse ? "bg-[#f5a623]" : "bg-[#1a1a16]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  transition.reverse ? "left-4" : "left-0.5",
                )}
              />
            </button>
          </div>
        )}

        {/* Border options for slide transitions */}
        {[
          "slide-left",
          "slide-right",
          "slide-up",
          "slide-down",
          "push-left",
          "push-right",
          "push-up",
          "push-down",
        ].includes(transition.type) && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-[#bfa873]">
                Border Width
              </label>
              <input
                type="range"
                min={0}
                max={20}
                value={transition.borderWidth || 0}
                onChange={(e) =>
                  onUpdate({ borderWidth: Number(e.target.value) })
                }
                className="h-1.5 w-full accent-[#f5a623]"
              />
              <div className="text-right text-xs font-mono text-[#f5a623]">
                {transition.borderWidth || 0}px
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#bfa873]">
                Border Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={transition.borderColor || "#ffffff"}
                  onChange={(e) => onUpdate({ borderColor: e.target.value })}
                  className="h-8 w-12 rounded border border-[#f5a623]/20 bg-[#1a1a16] p-0.5"
                />
                <span className="flex-1 text-xs font-mono text-[#8d7850]">
                  {transition.borderColor || "#ffffff"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info footer */}
      <div className="border-t border-[#f5a623]/10 px-4 py-3">
        <p className="text-[10px] text-[#8d7850]">
          {def?.name} transition • {transition.category} category
        </p>
      </div>
    </div>
  );
}

// Easing Preview Component

function EasingPreview({ easing }: { easing: TransitionEasing }) {
  const getPath = () => {
    switch (easing) {
      case "linear":
        return "M0,60 L60,0";
      case "ease-in":
        return "M0,60 Q30,60 60,0";
      case "ease-out":
        return "M0,60 Q30,0 60,0";
      case "ease-in-out":
        return "M0,60 Q15,60 30,30 Q45,0 60,0";
      default:
        return "M0,60 L60,0";
    }
  };

  return (
    <svg viewBox="0 0 60 60" className="h-full w-full">
      <defs>
        <linearGradient id="easingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f5a623" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f5a623" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="60" height="60" fill="none" />
      <line x1="0" y1="60" x2="60" y2="60" stroke="#374151" strokeWidth="1" />
      <line x1="0" y1="60" x2="0" y2="0" stroke="#374151" strokeWidth="1" />
      <path
        d={getPath()}
        fill="none"
        stroke="url(#easingGradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Animate a dot along the path */}
      <circle r="3" fill="#f5a623">
        <animateMotion dur="2s" repeatCount="indefinite" path={getPath()} />
      </circle>
    </svg>
  );
}

function isValidDirection(type: string, dir: string): boolean {
  const validDirections: Record<string, string[]> = {
    "slide-left": ["left", "right"],
    "slide-right": ["left", "right"],
    "slide-up": ["top", "bottom"],
    "slide-down": ["top", "bottom"],
    "push-left": ["left", "right"],
    "push-right": ["left", "right"],
    "push-up": ["top", "bottom"],
    "push-down": ["top", "bottom"],
    "wipe-left": ["left", "right"],
    "wipe-right": ["left", "right"],
    "wipe-top": ["top", "bottom"],
    "wipe-bottom": ["top", "bottom"],
  };

  const dirs = validDirections[type] || [];
  return dirs.includes(dir);
}
