import { useCallback } from "react";
import {
  type TextOverlayStyle,
  type TextAlignment,
  type TextTransform,
  type TextGradient,
  type BackgroundStyle,
  type AnimationType,
  type AnimationEasing,
  DEFAULT_TEXT_OVERLAY_STYLE,
  AVAILABLE_FONTS,
} from "./types";
import { ANIMATION_PRESETS } from "./presets";

interface TextStyleControlsProps {
  style: Partial<TextOverlayStyle>;
  onStyleChange: (updates: Partial<TextOverlayStyle>) => void;
  animation?: {
    type: AnimationType;
    durationMs: number;
    delayMs: number;
    easing: AnimationEasing;
    direction?: "in" | "out" | "both";
  };
  onAnimationChange?: (animation: {
    type: AnimationType;
    durationMs: number;
    delayMs: number;
    easing: AnimationEasing;
    direction?: "in" | "out" | "both";
  }) => void;
}

const Divider = () => <div className="h-4 w-px bg-[#f5a623]/20" />;

const ControlGroup = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="flex flex-col gap-1">
    {label && <span className="text-[9px] text-[#8d7850] uppercase tracking-wider">{label}</span>}
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

const ToggleButton = ({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`rounded px-2 py-0.5 text-xs transition-colors ${
      active
        ? "bg-[#f5a623]/30 text-[#f5a623]"
        : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#fff5de]"
    }`}
  >
    {children}
  </button>
);

export function TextStyleControls({
  style,
  onStyleChange,
  animation,
  onAnimationChange,
}: TextStyleControlsProps) {
  const applyStyleUpdate = useCallback(
    (updates: Partial<TextOverlayStyle>) => {
      onStyleChange({ ...style, ...updates });
    },
    [onStyleChange, style]
  );

  const handleAnimationTypeChange = useCallback(
    (type: AnimationType) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, type });
      }
    },
    [onAnimationChange, animation]
  );

  const handleAnimationDurationChange = useCallback(
    (durationMs: number) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, durationMs });
      }
    },
    [onAnimationChange, animation]
  );

  const handleAnimationDelayChange = useCallback(
    (delayMs: number) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, delayMs });
      }
    },
    [onAnimationChange, animation]
  );

  const toggleTextTransform = useCallback(
    (transform: TextTransform) => {
      applyStyleUpdate({
        textTransform: style.textTransform === transform ? "none" : transform,
      });
    },
    [applyStyleUpdate, style.textTransform]
  );

  const toggleTextAlign = useCallback(
    (align: TextAlignment) => {
      applyStyleUpdate({ textAlign: align });
    },
    [applyStyleUpdate]
  );

  const toggleTextShadow = useCallback(() => {
    applyStyleUpdate({
      textShadow: style.textShadow ? false : { color: "#000000", blur: 4, x: 2, y: 2, opacity: 0.6 },
    });
  }, [applyStyleUpdate, style.textShadow]);

  const updateGradient = useCallback(
    (updates: Partial<TextGradient>) => {
      applyStyleUpdate({
        gradient: {
          enabled: true,
          color1: "#ffffff",
          color2: "#000000",
          direction: 90,
          ...style.gradient,
          ...updates,
        },
      });
    },
    [applyStyleUpdate, style.gradient]
  );

  const toggleGradient = useCallback(() => {
    if (style.gradient?.enabled) {
      applyStyleUpdate({ gradient: { ...style.gradient, enabled: false } });
    } else {
      applyStyleUpdate({
        gradient: {
          enabled: true,
          color1: style.color || "#ffffff",
          color2: "#000000",
          direction: 90,
        },
      });
    }
  }, [applyStyleUpdate, style.gradient, style.color]);

  const updateBackground = useCallback(
    (updates: Partial<BackgroundStyle>) => {
      applyStyleUpdate({
        background: {
          color: "#000000",
          opacity: 0,
          radius: 6,
          paddingX: 8,
          paddingY: 4,
          ...style.background,
          ...updates,
        },
      });
    },
    [applyStyleUpdate, style.background]
  );

  const toggleBackground = useCallback(() => {
    if ((style.background?.opacity ?? 0) > 0) {
      applyStyleUpdate({ background: { ...style.background!, opacity: 0 } });
    } else {
      applyStyleUpdate({ background: { ...DEFAULT_TEXT_OVERLAY_STYLE.background, opacity: 0.7 } });
    }
  }, [applyStyleUpdate, style.background]);

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-black/80 rounded-lg border border-[#f5a623]/20">
      {/* Text Formatting */}
      <ControlGroup label="Style">
        <ToggleButton
          active={style.fontWeight === "bold"}
          onClick={() => applyStyleUpdate({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}
        >
          B
        </ToggleButton>
        <ToggleButton
          active={style.fontStyle === "italic"}
          onClick={() => applyStyleUpdate({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}
        >
          I
        </ToggleButton>
        <ToggleButton active={!!style.underline} onClick={() => applyStyleUpdate({ underline: !style.underline })} title="Underline">
          U
        </ToggleButton>
        <ToggleButton active={!!style.strikeThrough} onClick={() => applyStyleUpdate({ strikeThrough: !style.strikeThrough })} title="Strike">
          S
        </ToggleButton>
      </ControlGroup>

      <Divider />

      {/* Text Transform */}
      <ControlGroup label="Case">
        <ToggleButton active={style.textTransform === "uppercase"} onClick={() => toggleTextTransform("uppercase")}>
          AA
        </ToggleButton>
        <ToggleButton active={style.textTransform === "lowercase"} onClick={() => toggleTextTransform("lowercase")}>
          aa
        </ToggleButton>
        <ToggleButton active={style.textTransform === "capitalize"} onClick={() => toggleTextTransform("capitalize")}>
          Aa
        </ToggleButton>
      </ControlGroup>

      <Divider />

      {/* Alignment */}
      <ControlGroup label="Align">
        {(["left", "center", "right", "justify"] as TextAlignment[]).map((align) => (
          <ToggleButton key={align} active={style.textAlign === align} onClick={() => toggleTextAlign(align)}>
            {align === "left" && "⇤"}
            {align === "center" && "⇥"}
            {align === "right" && "⇥"}
            {align === "justify" && "☰"}
          </ToggleButton>
        ))}
      </ControlGroup>

      <Divider />

      {/* Font */}
      <ControlGroup label="Font">
        <select
          value={style.fontFamily || "Inter, system-ui, sans-serif"}
          onChange={(e) => applyStyleUpdate({ fontFamily: e.target.value })}
          className="rounded border border-[#f5a623]/20 bg-black/60 px-2 py-0.5 text-[11px] cursor-pointer min-w-[100px]"
        >
          {AVAILABLE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.name}
            </option>
          ))}
        </select>
      </ControlGroup>

      <Divider />

      {/* Colors */}
      <ControlGroup label="Fill">
        <input
          type="color"
          value={style.color || "#ffffff"}
          onChange={(e) => applyStyleUpdate({ color: e.target.value })}
          className="h-6 w-7 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
          title="Text color"
        />
        <button
          onClick={toggleGradient}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            style.gradient?.enabled ? "bg-gradient/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#fff5de]"
          }`}
          title="Gradient"
        >
          G
        </button>
        {style.gradient?.enabled && (
          <>
            <input
              type="color"
              value={style.gradient.color1 || "#ffffff"}
              onChange={(e) => updateGradient({ color1: e.target.value })}
              className="h-5 w-6 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
              title="Gradient start"
            />
            <input
              type="color"
              value={style.gradient.color2 || "#000000"}
              onChange={(e) => updateGradient({ color2: e.target.value })}
              className="h-5 w-6 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
              title="Gradient end"
            />
          </>
        )}
      </ControlGroup>

      <Divider />

      {/* Font Size */}
      <ControlGroup label="Size">
        <input
          type="range"
          min={8}
          max={120}
          value={style.fontSize || 24}
          onChange={(e) => applyStyleUpdate({ fontSize: Number(e.target.value) })}
          className="w-20 accent-[#f5a623]"
        />
        <span className="text-[10px] text-[#8d7850] w-8 text-center">{style.fontSize || 24}</span>
      </ControlGroup>

      <Divider />

      {/* Stroke */}
      <ControlGroup label="Stroke">
        <input
          type="color"
          value={style.strokeColor || "#000000"}
          onChange={(e) => applyStyleUpdate({ strokeColor: e.target.value })}
          className="h-6 w-7 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
        />
        <input
          type="range"
          min={0}
          max={8}
          value={style.strokeWidth || 0}
          onChange={(e) => applyStyleUpdate({ strokeWidth: Number(e.target.value) })}
          className="w-16 accent-[#f5a623]"
        />
      </ControlGroup>

      <Divider />

      {/* Shadow */}
      <ControlGroup label="Shadow">
        <button
          onClick={toggleTextShadow}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            style.textShadow ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#fff5de]"
          }`}
          title="Text Shadow"
        >
          T
        </button>
      </ControlGroup>

      <Divider />

      {/* Background */}
      <ControlGroup label="BG">
        <button
          onClick={toggleBackground}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            (style.background?.opacity ?? 0) > 0 ? "bg-[#f5a623]/30 text-[#f5a623]" : "bg-[#f5a623]/10 hover:bg-[#f5a623]/20 text-[#fff5de]"
          }`}
          title="Background"
        >
          ▢
        </button>
        {(style.background?.opacity ?? 0) > 0 && (
          <>
            <input
              type="color"
              value={style.background?.color || "#000000"}
              onChange={(e) => updateBackground({ color: e.target.value })}
              className="h-5 w-6 rounded border border-[#f5a623]/20 bg-transparent p-0 cursor-pointer"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={(style.background?.opacity ?? 0) * 100}
              onChange={(e) => updateBackground({ opacity: Number(e.target.value) / 100 })}
              className="w-12 accent-[#f5a623]"
            />
          </>
        )}
      </ControlGroup>

      <Divider />

      {/* Spacing */}
      <ControlGroup label="Spacing">
        <input
          type="range"
          min={-5}
          max={20}
          step={0.5}
          value={style.letterSpacing || 0}
          onChange={(e) => applyStyleUpdate({ letterSpacing: Number(e.target.value) })}
          className="w-14 accent-[#f5a623]"
          title="Letter spacing"
        />
        <input
          type="range"
          min={0.8}
          max={3}
          step={0.1}
          value={style.lineHeight || 1.2}
          onChange={(e) => applyStyleUpdate({ lineHeight: Number(e.target.value) })}
          className="w-14 accent-[#f5a623]"
          title="Line height"
        />
      </ControlGroup>

      <Divider />

      {/* Animation */}
      {onAnimationChange && (
        <ControlGroup label="Animate">
          <select
            value={animation?.type || "none"}
            onChange={(e) => handleAnimationTypeChange(e.target.value as AnimationType)}
            className="rounded border border-[#f5a623]/20 bg-black/60 px-2 py-0.5 text-[11px] cursor-pointer"
          >
            {ANIMATION_PRESETS.map((preset) => (
              <option key={preset.type} value={preset.type}>
                {preset.icon} {preset.name}
              </option>
            ))}
          </select>
          {animation && animation.type !== "none" && (
            <>
              <input
                type="range"
                min={100}
                max={3000}
                step={100}
                value={animation.durationMs}
                onChange={(e) => handleAnimationDurationChange(Number(e.target.value))}
                className="w-16 accent-[#f5a623]"
                title="Duration"
              />
              <input
                type="range"
                min={0}
                max={2000}
                step={100}
                value={animation.delayMs}
                onChange={(e) => handleAnimationDelayChange(Number(e.target.value))}
                className="w-14 accent-[#f5a623]"
                title="Delay"
              />
            </>
          )}
        </ControlGroup>
      )}
    </div>
  );
}

export default TextStyleControls;