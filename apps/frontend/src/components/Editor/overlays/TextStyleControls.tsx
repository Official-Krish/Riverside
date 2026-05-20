import { useCallback, useState } from "react";
import {
  type TextOverlayStyle,
  type TextAlignment,
  type TextTransform,
  type AnimationType,
  type AnimationEasing,
  AVAILABLE_FONTS,
} from "./types";
/* eslint-disable @typescript-eslint/no-explicit-any */

interface TextStyleControlsProps {
  style: Partial<TextOverlayStyle>;
  onStyleChange: (updates: Partial<TextOverlayStyle>) => void;
  animation?: {
    type: AnimationType;
    exitType?: AnimationType;
    durationMs: number;
    delayMs: number;
    easing: AnimationEasing;
    direction?: "in" | "out" | "both";
  };
  onAnimationChange?: (animation: {
    type: AnimationType;
    exitType?: AnimationType;
    durationMs: number;
    delayMs: number;
    easing: AnimationEasing;
    direction?: "in" | "out" | "both";
  }) => void;
}

type TabId = "type" | "style" | "bg" | "anim";

const TABS: { id: TabId; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "style", label: "Style" },
  { id: "bg", label: "BG" },
  { id: "anim", label: "Animate" },
];

const QUICK_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Amber", value: "#f5a623" },
  { name: "Red", value: "#ff5c5c" },
  { name: "Sky", value: "#4fc3f7" },
  { name: "Green", value: "#66bb6a" },
  { name: "Black", value: "#1a1a1a" },
];

const BG_COLORS = [
  { name: "Dark", value: "#1a1a1a" },
  { name: "Amber", value: "#f5a623" },
  { name: "White", value: "#ffffff" },
  { name: "Red", value: "#ff5c5c" },
  { name: "Sky", value: "#4fc3f7" },
];

const TEXT_PRESETS = [
  { name: "Custom", style: {} },
  { name: "Caption", style: { fontSize: 14 } },
  { name: "Title", style: { fontSize: 48, fontWeight: "bold" as const } },
  { name: "Lower 3rd", style: { fontSize: 24 } },
];

const ENTRY_ANIMATIONS = [
  {
    type: "slide-right",
    icon: "→",
    name: "Slide",
    disabled: true,
    tooltip: "Coming Soon",
  },
  { type: "fade-in", icon: "◉", name: "Fade", disabled: false },
  {
    type: "typewriter",
    icon: "▮",
    name: "Typewriter",
    disabled: true,
    tooltip: "Coming Soon",
  },
  {
    type: "bounce",
    icon: "⦿",
    name: "Bounce",
    disabled: true,
    tooltip: "Coming Soon",
  },
  {
    type: "scale-in",
    icon: "⊕",
    name: "Scale",
    disabled: true,
    tooltip: "Coming Soon",
  },
  { type: "none", icon: "—", name: "None", disabled: false },
];

const EXIT_ANIMATIONS = [
  {
    type: "slide-left",
    icon: "←",
    name: "Slide",
    disabled: true,
    tooltip: "Coming Soon",
  },
  { type: "fade-out", icon: "◎", name: "Fade", disabled: false },
  { type: "none", icon: "—", name: "None", disabled: false },
];

const Divider = () => <div className="h-px bg-[#252525]" />;

const MiniLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] text-[#555] uppercase tracking-wider font-semibold">
    {children}
  </span>
);

const SliderRow = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  format = (v: number) => String(v),
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) => (
  <div className="flex items-center gap-2">
    {label && <MiniLabel>{label}</MiniLabel>}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="flex-1 h-1.5 accent-[#f5a623] cursor-pointer"
    />
    <span className="text-[11px] text-[#888] min-w-[32px] text-right">
      {format(value)}
    </span>
  </div>
);

const Toggle = ({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-[30px] h-[17px] rounded-full cursor-pointer relative transition-colors ${
      active ? "bg-[#f5a623]" : "bg-[#333]"
    }`}
  >
    <span
      className={`absolute top-[2px] w-[13px] h-[13px] bg-white rounded-full transition-left ${
        active ? "left-[15px]" : "left-[2px]"
      }`}
    />
  </button>
);

const ColorDot = ({
  color,
  selected,
  onClick,
  border,
}: {
  color: string;
  selected?: boolean;
  onClick: () => void;
  border?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-[22px] h-[22px] rounded-full cursor-pointer border-2 transition-transform hover:scale-115 ${
      selected ? "border-[#f5a623]" : "border-transparent"
    } ${border ? "border-[#444]" : ""}`}
    style={{ backgroundColor: color }}
  />
);

const PresetChip = ({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-[10px] font-semibold cursor-pointer border transition-colors whitespace-nowrap ${
      active
        ? "bg-[#f5a623] text-[#1a1a1a] border-[#f5a623]"
        : "bg-[#111] text-[#888] border-[#333] hover:border-[#f5a623] hover:text-[#f5a623]"
    }`}
  >
    {name}
  </button>
);

const BgOption = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium text-center transition-colors ${
      active ? "bg-[#f5a623] text-[#1a1a1a]" : "bg-transparent text-[#555]"
    }`}
  >
    {label}
  </button>
);

const AnimButton = ({
  icon,
  name,
  active,
  onClick,
  disabled,
  tooltip,
}: {
  icon: string;
  name: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}) => (
  <div className="relative group">
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-md text-[10px] cursor-pointer text-center font-medium transition-colors flex flex-col items-center gap-1 ${
        active
          ? "bg-[#f5a6231a] border border-[#f5a623] text-[#f5a623]"
          : disabled
            ? "bg-[#0a0a0a] border border-[#222] text-[#333] cursor-not-allowed opacity-50"
            : "bg-[#111] border border-[#2a2a2a] text-[#666] hover:border-[#f5a623] hover:text-[#f5a623]"
      }`}
    >
      <span className="text-[15px]">{icon}</span>
      {name}
    </button>
    {disabled && tooltip && (
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] text-[#f5a623] text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {tooltip}
      </div>
    )}
  </div>
);

export function TextStyleControls({
  style,
  onStyleChange,
  animation,
  onAnimationChange,
}: TextStyleControlsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("type");

  const applyStyleUpdate = useCallback(
    (updates: Partial<TextOverlayStyle>) => {
      onStyleChange({ ...style, ...updates });
    },
    [onStyleChange, style],
  );

  const handleAnimationTypeChange = useCallback(
    (type: AnimationType) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, type });
      }
    },
    [onAnimationChange, animation],
  );

  const handleExitAnimationTypeChange = useCallback(
    (type: AnimationType) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, exitType: type });
      }
    },
    [onAnimationChange, animation],
  );

  const handleAnimationDurationChange = useCallback(
    (durationMs: number) => {
      if (onAnimationChange && animation) {
        onAnimationChange({ ...animation, durationMs });
      }
    },
    [onAnimationChange, animation],
  );

  const toggleTextTransform = (transform: TextTransform) => {
    applyStyleUpdate({
      textTransform: style.textTransform === transform ? "none" : transform,
    });
  };

  const toggleTextAlign = (align: TextAlignment) => {
    applyStyleUpdate({ textAlign: align });
  };

  const toggleGradient = () => {
    if (style.gradient?.enabled) {
      applyStyleUpdate({
        gradient: {
          enabled: false,
          color1: "#ffffff",
          color2: "#f5a623",
          direction: 90,
        },
      });
    } else {
      applyStyleUpdate({
        gradient: {
          enabled: true,
          color1: "#ffffff",
          color2: "#f5a623",
          direction: 90,
        },
      });
    }
  };

  const toggleTextShadow = () => {
    applyStyleUpdate({ textShadow: !style.textShadow });
  };

  const toggleBackground = (type: "none" | "solid" | "blur" | "pill") => {
    if (type === "none") {
      applyStyleUpdate({
        background: {
          color: "#000000",
          opacity: 0,
          radius: 0,
          paddingX: 0,
          paddingY: 0,
        },
      });
    } else if (type === "solid") {
      applyStyleUpdate({
        background: {
          color: style.background?.color || "#000000",
          opacity: style.background?.opacity ?? 0.8,
          radius: 6,
          paddingX: 8,
          paddingY: 4,
        },
      });
    } else if (type === "blur") {
      applyStyleUpdate({
        background: {
          color: "#000000",
          opacity: 0.8,
          radius: 0,
          paddingX: 12,
          paddingY: 8,
        },
      });
    } else if (type === "pill") {
      applyStyleUpdate({
        background: {
          color: "#000000",
          opacity: 0.8,
          radius: 20,
          paddingX: 12,
          paddingY: 6,
        },
      });
    }
  };

  const getBgType = (): "none" | "solid" | "blur" | "pill" => {
    const bg = style.background;
    if (!bg || bg.opacity === 0) return "none";
    if (bg.radius === 20) return "pill";
    if (bg.radius === 0) return "blur";
    return "solid";
  };

  return (
    <div className="flex flex-col text-[#e0e0e0]">
      {/* Tab Bar */}
      <div className="flex gap-1 p-2 bg-[#141414] border-b border-[#2a2a2a] rounded-t-lg">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 text-[11px] font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "text-[#f5a623] border-[#f5a623]"
                : "text-[#666] border-transparent hover:text-[#aaa]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-3 flex flex-col gap-3">
        {/* TYPE TAB */}
        {activeTab === "type" && (
          <div className="flex flex-col gap-3">
            {/* Presets */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {TEXT_PRESETS.map((preset) => (
                <PresetChip
                  key={preset.name}
                  name={preset.name}
                  active={
                    preset.name === "Custom"
                      ? false
                      : preset.name === "Title" && style.fontSize === 48
                  }
                  onClick={() =>
                    preset.name !== "Custom" && applyStyleUpdate(preset.style)
                  }
                />
              ))}
            </div>

            <Divider />

            {/* Font + Size row */}
            <div className="flex gap-2">
              <select
                value={style.fontFamily || "Inter, system-ui, sans-serif"}
                onChange={(e) =>
                  applyStyleUpdate({ fontFamily: e.target.value })
                }
                className="flex-1 bg-[#111] border border-[#333] rounded-md px-2 py-1.5 text-[12px] text-[#ddd] cursor-pointer h-[30px]"
              >
                {AVAILABLE_FONTS.map((font) => (
                  <option
                    key={font.value}
                    value={font.value}
                    style={{ fontFamily: font.value }}
                  >
                    {font.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 bg-[#111] border border-[#333] rounded-md px-2 h-[30px] min-w-[60px]">
                <input
                  type="number"
                  min={6}
                  max={200}
                  value={style.fontSize || 24}
                  onChange={(e) =>
                    applyStyleUpdate({ fontSize: Number(e.target.value) })
                  }
                  className="w-[28px] bg-transparent border-none text-[12px] text-[#ddd] outline-none"
                />
                <span className="text-[10px] text-[#555]">px</span>
              </div>
            </div>

            {/* Bold/Italic + Alignment row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    applyStyleUpdate({
                      fontWeight:
                        style.fontWeight === "bold" ? "normal" : "bold",
                    })
                  }
                  className={`w-[28px] h-[28px] rounded-md border text-[12px] font-bold cursor-pointer flex items-center justify-center transition-colors ${
                    style.fontWeight === "bold"
                      ? "bg-[#f5a623] border-[#f5a623] text-[#1a1a1a]"
                      : "bg-[#111] border-[#333] text-[#888] hover:border-[#555]"
                  }`}
                >
                  B
                </button>
                <button
                  onClick={() =>
                    applyStyleUpdate({
                      fontStyle:
                        style.fontStyle === "italic" ? "normal" : "italic",
                    })
                  }
                  className={`w-[28px] h-[28px] rounded-md border text-[12px] cursor-pointer flex items-center justify-center transition-colors ${
                    style.fontStyle === "italic"
                      ? "bg-[#f5a623] border-[#f5a623] text-[#1a1a1a]"
                      : "bg-[#111] border-[#333] text-[#888] hover:border-[#555]"
                  }`}
                  style={{ fontStyle: "italic" }}
                >
                  I
                </button>
                <div className="relative group">
                  <button
                    onClick={() => {}}
                    className="w-[28px] h-[28px] rounded-md border text-[12px] cursor-not-allowed flex items-center justify-center transition-colors bg-[#0a0a0a] border-[#222] text-[#333] opacity-50"
                  >
                    <span className="underline">U</span>
                  </button>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] text-[#f5a623] text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Coming Soon
                  </div>
                </div>
                <div className="relative group">
                  <button
                    onClick={() => {}}
                    className="w-[28px] h-[28px] rounded-md border text-[12px] cursor-not-allowed flex items-center justify-center transition-colors bg-[#0a0a0a] border-[#222] text-[#333] opacity-50"
                  >
                    <span className="line-through">S</span>
                  </button>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] text-[#f5a623] text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Coming Soon
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleTextAlign("left")}
                  className={`w-[28px] h-[28px] rounded-md border text-[13px] cursor-pointer flex items-center justify-center transition-colors ${
                    style.textAlign === "left"
                      ? "bg-[#f5a623] border-[#f5a623] text-[#1a1a1a]"
                      : "bg-[#111] border-[#333] text-[#555] hover:border-[#555]"
                  }`}
                >
                  ≡
                </button>
                <button
                  onClick={() => toggleTextAlign("center")}
                  className={`w-[28px] h-[28px] rounded-md border text-[13px] cursor-pointer flex items-center justify-center transition-colors ${
                    style.textAlign === "center"
                      ? "bg-[#f5a623] border-[#f5a623] text-[#1a1a1a]"
                      : "bg-[#111] border-[#333] text-[#555] hover:border-[#555]"
                  }`}
                >
                  ≡
                </button>
                <button
                  onClick={() => toggleTextAlign("right")}
                  className={`w-[28px] h-[28px] rounded-md border text-[13px] cursor-pointer flex items-center justify-center transition-colors ${
                    style.textAlign === "right"
                      ? "bg-[#f5a623] border-[#f5a623] text-[#1a1a1a]"
                      : "bg-[#111] border-[#333] text-[#555] hover:border-[#555]"
                  }`}
                >
                  ≡
                </button>
              </div>
            </div>

            {/* Case transform */}
            <div className="flex items-center gap-2">
              <MiniLabel>Case</MiniLabel>
              <div className="flex gap-1 bg-[#111] border border-[#2a2a2a] rounded-lg p-1">
                <button
                  onClick={() => toggleTextTransform("uppercase")}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                    style.textTransform === "uppercase"
                      ? "bg-[#f5a623] text-[#1a1a1a]"
                      : "text-[#555]"
                  }`}
                >
                  AA
                </button>
                <button
                  onClick={() => toggleTextTransform("capitalize")}
                  className={`px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors ${
                    style.textTransform === "capitalize"
                      ? "bg-[#f5a623] text-[#1a1a1a]"
                      : "text-[#555]"
                  }`}
                >
                  Aa
                </button>
                <button
                  onClick={() => toggleTextTransform("lowercase")}
                  className={`px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors ${
                    style.textTransform === "lowercase"
                      ? "bg-[#f5a623] text-[#1a1a1a]"
                      : "text-[#555]"
                  }`}
                >
                  aa
                </button>
              </div>
            </div>

            <Divider />

            {/* Color */}
            <div className="flex items-center justify-between">
              <MiniLabel>Color</MiniLabel>
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_COLORS.map((c) => (
                  <ColorDot
                    key={c.value}
                    color={c.value}
                    selected={style.color === c.value}
                    onClick={() => applyStyleUpdate({ color: c.value })}
                    border={c.value === "#1a1a1a"}
                  />
                ))}
                <input
                  type="color"
                  value={style.color || "#ffffff"}
                  onChange={(e) => applyStyleUpdate({ color: e.target.value })}
                  className="w-[22px] h-[22px] rounded-full border-2 border-dashed border-[#444] cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* STYLE TAB */}
        {activeTab === "style" && (
          <div className="flex flex-col gap-3">
            {/* Opacity (text alpha) */}
            <SliderRow
              label="Opacity"
              value={100}
              onChange={() => {}}
              min={0}
              max={100}
              format={(v) => `${v}%`}
            />

            <Divider />

            {/* Gradient - Coming Soon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MiniLabel>Gradient</MiniLabel>
                <span className="text-[8px] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded">
                  Coming Soon
                </span>
              </div>
              <div className="relative group">
                <button
                  onClick={toggleGradient}
                  className={`w-[30px] h-[17px] rounded-full cursor-pointer relative transition-colors ${
                    style.gradient?.enabled ? "bg-[#f5a623]" : "bg-[#333]"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-[13px] h-[13px] bg-white rounded-full transition-left ${
                      style.gradient?.enabled ? "left-[15px]" : "left-[2px]"
                    }`}
                  />
                </button>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1a1a1a] text-[#f5a623] text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Available in next update
                </div>
              </div>
            </div>
            {style.gradient?.enabled && (
              <div className="flex items-center gap-2">
                <div
                  className="w-[22px] h-[22px] rounded-md border border-[#333]"
                  style={{ backgroundColor: style.gradient.color1 }}
                />
                <div
                  className="flex-1 h-[18px] rounded-md border border-[#333]"
                  style={{
                    background: `linear-gradient(to right, ${style.gradient.color1}, ${style.gradient.color2})`,
                  }}
                />
                <div
                  className="w-[22px] h-[22px] rounded-md border border-[#333]"
                  style={{ backgroundColor: style.gradient.color2 }}
                />
              </div>
            )}

            <Divider />

            {/* Stroke */}
            <div className="flex flex-col gap-2">
              <MiniLabel>Stroke</MiniLabel>
              <div className="flex items-center gap-2">
                <div
                  className="w-[22px] h-[22px] rounded-md border border-[#444]"
                  style={{ backgroundColor: style.strokeColor || "#000000" }}
                />
                <SliderRow
                  value={style.strokeWidth || 0}
                  onChange={(v) => applyStyleUpdate({ strokeWidth: v })}
                  min={0}
                  max={20}
                  format={(v) => `${v}px`}
                />
              </div>
            </div>

            <Divider />

            {/* Shadow */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <MiniLabel>Shadow</MiniLabel>
                <Toggle
                  active={!!style.textShadow}
                  onClick={toggleTextShadow}
                />
              </div>
              {style.textShadow && typeof style.textShadow === "object" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#555]">Offset X</span>
                    <SliderRow
                      value={(style.textShadow as any)?.x ?? 2}
                      onChange={(v) =>
                        applyStyleUpdate({
                          textShadow: {
                            ...(style.textShadow as object),
                            x: v,
                          } as any,
                        })
                      }
                      min={-20}
                      max={20}
                      format={(v) => `${v}px`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#555]">Offset Y</span>
                    <SliderRow
                      value={(style.textShadow as any)?.y ?? 2}
                      onChange={(v) =>
                        applyStyleUpdate({
                          textShadow: {
                            ...(style.textShadow as object),
                            y: v,
                          } as any,
                        })
                      }
                      min={-20}
                      max={20}
                      format={(v) => `${v}px`}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-[#555]">Blur</span>
                    <SliderRow
                      value={(style.textShadow as any)?.blur ?? 4}
                      onChange={(v) =>
                        applyStyleUpdate({
                          textShadow: {
                            ...(style.textShadow as object),
                            blur: v,
                          } as any,
                        })
                      }
                      min={0}
                      max={30}
                      format={(v) => `${v}px`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#555]">Color</span>
                    <input
                      type="color"
                      value={(style.textShadow as any)?.color ?? "#000000"}
                      onChange={(v) =>
                        applyStyleUpdate({
                          textShadow: {
                            ...(style.textShadow as object),
                            color: v.target.value,
                          } as any,
                        })
                      }
                      className="w-[22px] h-[22px] rounded-md border border-[#444] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BG TAB */}
        {activeTab === "bg" && (
          <div className="flex flex-col gap-3">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <MiniLabel>Type</MiniLabel>
              <div className="flex gap-1 bg-[#111] border border-[#2a2a2a] rounded-lg p-1">
                <BgOption
                  label="None"
                  active={getBgType() === "none"}
                  onClick={() => toggleBackground("none")}
                />
                <BgOption
                  label="Solid"
                  active={getBgType() === "solid"}
                  onClick={() => toggleBackground("solid")}
                />
                <BgOption
                  label="Blur"
                  active={getBgType() === "blur"}
                  onClick={() => toggleBackground("blur")}
                />
                <BgOption
                  label="Pill"
                  active={getBgType() === "pill"}
                  onClick={() => toggleBackground("pill")}
                />
              </div>
            </div>

            <Divider />

            {/* Color */}
            {getBgType() !== "none" && (
              <>
                <div className="flex items-center justify-between">
                  <MiniLabel>Color</MiniLabel>
                  <div className="flex gap-1 flex-wrap">
                    {BG_COLORS.map((c) => (
                      <ColorDot
                        key={c.value}
                        color={c.value}
                        selected={style.background?.color === c.value}
                        onClick={() =>
                          applyStyleUpdate({
                            background: {
                              ...style.background,
                              color: c.value,
                            } as any,
                          })
                        }
                        border={c.value === "#1a1a1a"}
                      />
                    ))}
                    <input
                      type="color"
                      value={style.background?.color || "#000000"}
                      onChange={(e) =>
                        applyStyleUpdate({
                          background: {
                            ...style.background,
                            color: e.target.value,
                          } as any,
                        })
                      }
                      className="w-[22px] h-[22px] rounded-full border-2 border-dashed border-[#444] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Opacity */}
                <SliderRow
                  label="Opacity"
                  value={Math.round((style.background?.opacity ?? 0) * 100)}
                  onChange={(v) =>
                    applyStyleUpdate({
                      background: {
                        ...style.background,
                        opacity: v / 100,
                      } as any,
                    })
                  }
                  min={0}
                  max={100}
                  format={(v) => `${v}%`}
                />

                {/* Padding */}
                <SliderRow
                  label="Padding"
                  value={style.background?.paddingX || 8}
                  onChange={(v) =>
                    applyStyleUpdate({
                      background: {
                        ...style.background,
                        paddingX: v,
                        paddingY: v,
                      } as any,
                    })
                  }
                  min={0}
                  max={40}
                  format={(v) => `${v}px`}
                />

                {/* Corner radius */}
                <SliderRow
                  label="Corner radius"
                  value={style.background?.radius || 6}
                  onChange={(v) =>
                    applyStyleUpdate({
                      background: { ...style.background, radius: v } as any,
                    })
                  }
                  min={0}
                  max={30}
                  format={(v) => `${v}px`}
                />
              </>
            )}
          </div>
        )}

        {/* ANIMATE TAB */}
        {activeTab === "anim" && onAnimationChange && animation && (
          <div className="flex flex-col gap-3">
            {/* Coming Soon Note */}
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#f5a623]/10 border border-[#f5a623]/20 rounded">
              <span className="text-[10px] text-[#f5a623]">⚠️</span>
              <span className="text-[10px] text-[#bfa873]">
                Most animations export in next update. Fade only for now.
              </span>
            </div>

            {/* Entry */}
            <div className="flex flex-col gap-2">
              <MiniLabel>Entry</MiniLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {ENTRY_ANIMATIONS.map((anim) => (
                  <AnimButton
                    key={anim.type}
                    icon={anim.icon}
                    name={anim.name}
                    active={animation.type === anim.type}
                    disabled={anim.disabled}
                    tooltip={anim.tooltip}
                    onClick={() =>
                      !anim.disabled &&
                      handleAnimationTypeChange(anim.type as AnimationType)
                    }
                  />
                ))}
              </div>
            </div>

            <Divider />

            {/* Duration */}
            <SliderRow
              label="Duration"
              value={animation.durationMs}
              onChange={handleAnimationDurationChange}
              min={100}
              max={3000}
              step={100}
              format={(v) => `${(v / 1000).toFixed(1)}s`}
            />

            <Divider />

            {/* Exit */}
            <div className="flex flex-col gap-2">
              <MiniLabel>Exit</MiniLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {EXIT_ANIMATIONS.map((anim) => (
                  <AnimButton
                    key={anim.type}
                    icon={anim.icon}
                    name={anim.name}
                    active={animation.exitType === anim.type}
                    disabled={anim.disabled}
                    tooltip={anim.tooltip}
                    onClick={() =>
                      !anim.disabled &&
                      handleExitAnimationTypeChange(anim.type as AnimationType)
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
