import { Monitor, PictureInPicture2, Columns2, Grid3X3 } from "lucide-react";
import type { LayoutPreset } from "../types";

interface PresetOption {
  id: LayoutPreset;
  label: string;
  description: string;
  icon: typeof Monitor;
  participants: number;
}

const presets: PresetOption[] = [
  {
    id: "single",
    label: "Single",
    description: "One participant full-screen",
    icon: Monitor,
    participants: 1,
  },
  {
    id: "pip",
    label: "PiP",
    description: "Main + picture-in-picture",
    icon: PictureInPicture2,
    participants: 2,
  },
  {
    id: "split",
    label: "Split",
    description: "Side-by-side",
    icon: Columns2,
    participants: 2,
  },
  {
    id: "grid",
    label: "Grid",
    description: "Multi-camera grid",
    icon: Grid3X3,
    participants: 4,
  },
];

interface Props {
  active: LayoutPreset;
  onSelect: (preset: LayoutPreset) => void;
  participantCount: number;
}

export function PiPPresets({ active, onSelect, participantCount }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => {
        const Icon = preset.icon;
        const isActive = active === preset.id;
        const isDisabled = participantCount < preset.participants;

        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            disabled={isDisabled}
            className={`relative flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all duration-200 ${
              isActive
                ? "border-[#f5a623] bg-[#f5a623]/10 shadow-sm shadow-[#f5a623]/20"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
            } ${isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <Icon
              className={`h-5 w-5 ${isActive ? "text-[#f5a623]" : "text-white/60"}`}
            />
            <span
              className={`text-[11px] font-semibold ${isActive ? "text-[#f5a623]" : "text-white/80"}`}
            >
              {preset.label}
            </span>
            <span className="text-[9px] text-white/40 leading-tight text-center">
              {preset.description}
            </span>
            {isActive && (
              <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#f5a623] shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
