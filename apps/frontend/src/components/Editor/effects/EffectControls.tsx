import { useMemo, type ChangeEvent, type ReactNode } from "react";
import { Sparkles, Aperture, Droplets, TimerReset, Upload } from "lucide-react";
import type {
  BlurEffectType,
  ClipEffects,
  FreezeFrameSegment,
  FocusRegion,
  SpeedPoint,
} from "./types";
import { normalizeClipEffects } from "./utils";

interface EffectControlsProps {
  value?: Partial<ClipEffects> | null;
  onChange: (effects: ClipEffects) => void;
  clipDurationMs: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function Section({
  title,
  description,
  icon,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-[#f5a623]/10 bg-[#060605]/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#fff5de]">
            {icon}
            {title}
          </div>
          <p className="text-[11px] leading-5 text-[#8d7850]">{description}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-[#bfa873]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-[#f5a623]"
          />
          On
        </label>
      </div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-[#8d7850]">
        <span>{label}</span>
        <span className="font-mono text-[#bfa873]">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[#f5a623]"
      />
    </label>
  );
}

function RegionEditor({
  value,
  onChange,
}: {
  value: FocusRegion;
  onChange: (next: FocusRegion) => void;
}) {
  const fields: Array<keyof FocusRegion> = [
    "x",
    "y",
    "width",
    "height",
    "feather",
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((field) => (
        <label key={field} className="space-y-1 text-[11px] text-[#8d7850]">
          <span className="capitalize">{field}</span>
          <input
            type="number"
            value={value[field]}
            onChange={(e) =>
              onChange({ ...value, [field]: Number(e.target.value) })
            }
            className="w-full rounded-md border border-[#f5a623]/15 bg-[#0a0a08] px-2 py-1 text-[#fff5de] outline-none"
          />
        </label>
      ))}
    </div>
  );
}

export function EffectControls({
  value,
  onChange,
  clipDurationMs,
}: EffectControlsProps) {
  const effects = useMemo(() => normalizeClipEffects(value), [value]);

  const update = (next: Partial<ClipEffects>) => {
    onChange(normalizeClipEffects({ ...effects, ...next }));
  };

  const updateBlur = (patch: Partial<ClipEffects["blur"]>) => {
    update({ blur: { ...effects.blur, ...patch } });
  };

  const updateColor = (patch: Partial<ClipEffects["color"]>) => {
    update({
      color: {
        ...effects.color,
        ...patch,
        lut: {
          ...effects.color.lut,
          ...(patch.lut ?? {}),
        },
      },
    });
  };

  const updateChroma = (patch: Partial<ClipEffects["chromaKey"]>) => {
    update({ chromaKey: { ...effects.chromaKey, ...patch } });
  };

  const updateSpeed = (patch: Partial<ClipEffects["speed"]>) => {
    update({ speed: { ...effects.speed, ...patch } });
  };

  const updateSpeedPoint = (id: string, patch: Partial<SpeedPoint>) => {
    updateSpeed({
      points: effects.speed.points.map((point) =>
        point.id === id ? { ...point, ...patch } : point,
      ),
    });
  };

  const addSpeedPoint = () => {
    const midpoint = clamp(0.5, 0, 1);
    updateSpeed({
      points: [
        ...effects.speed.points,
        { id: crypto.randomUUID(), at: midpoint, speed: 1 },
      ].sort((a, b) => a.at - b.at),
    });
  };

  const removeSpeedPoint = (id: string) => {
    if (effects.speed.points.length <= 2) return;
    updateSpeed({
      points: effects.speed.points.filter((point) => point.id !== id),
    });
  };

  const addFreezeFrame = () => {
    const next: FreezeFrameSegment = {
      id: crypto.randomUUID(),
      at: 0.5,
      durationMs: 300,
    };
    updateSpeed({
      freezeFrames: [...effects.speed.freezeFrames, next].sort(
        (a, b) => a.at - b.at,
      ),
    });
  };

  const handleLutUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const cubeData = await file.text();
    updateColor({
      lut: {
        ...effects.color.lut,
        enabled: true,
        name: file.name,
        cubeData,
      },
    });
    event.target.value = "";
  };

  return (
    <div className="space-y-4">
      <Section
        title="Blur Effects"
        description="Gaussian, motion, radial, background, and face blur with focus-region controls."
        icon={<Aperture className="h-4 w-4 text-[#f5a623]" />}
        enabled={effects.blur.enabled}
        onToggle={(enabled) => updateBlur({ enabled })}
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              "gaussian",
              "background",
              "face",
              "motion",
              "radial",
            ] as BlurEffectType[]
          ).map((type) => (
            <button
              key={type}
              onClick={() => updateBlur({ type })}
              className={`rounded-lg border px-3 py-2 text-left text-[11px] transition ${
                effects.blur.type === type
                  ? "border-[#f5a623]/40 bg-[#f5a623]/10 text-[#f5a623]"
                  : "border-[#f5a623]/10 bg-[#0a0a08] text-[#8d7850] hover:border-[#f5a623]/25"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <NumberField
          label="Blur Amount"
          value={effects.blur.amount}
          min={0}
          max={64}
          step={1}
          onChange={(amount) => updateBlur({ amount })}
        />
        <NumberField
          label="Mix"
          value={effects.blur.mix}
          min={0}
          max={1}
          step={0.05}
          onChange={(mix) => updateBlur({ mix })}
        />
        <NumberField
          label="Motion Angle"
          value={effects.blur.angle}
          min={-180}
          max={180}
          step={1}
          onChange={(angle) => updateBlur({ angle })}
        />
        <NumberField
          label="Temporal Frames"
          value={effects.blur.temporalFrames}
          min={2}
          max={12}
          step={1}
          onChange={(temporalFrames) => updateBlur({ temporalFrames })}
        />

        {(effects.blur.type === "background" ||
          effects.blur.type === "face") && (
          <RegionEditor
            value={effects.blur.focusRegion}
            onChange={(focusRegion) => updateBlur({ focusRegion })}
          />
        )}
      </Section>

      <Section
        title="Color Grading / LUTs"
        description="Brightness, contrast, saturation, vibrance, temperature, shadows, highlights, hue, and .cube LUT import."
        icon={<Droplets className="h-4 w-4 text-[#f5a623]" />}
        enabled={effects.color.enabled}
        onToggle={(enabled) => updateColor({ enabled })}
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Brightness"
            value={effects.color.brightness}
            min={-1}
            max={1}
            step={0.01}
            onChange={(brightness) => updateColor({ brightness })}
          />
          <NumberField
            label="Contrast"
            value={effects.color.contrast}
            min={0}
            max={3}
            step={0.01}
            onChange={(contrast) => updateColor({ contrast })}
          />
          <NumberField
            label="Saturation"
            value={effects.color.saturation}
            min={0}
            max={3}
            step={0.01}
            onChange={(saturation) => updateColor({ saturation })}
          />
          <NumberField
            label="Vibrance"
            value={effects.color.vibrance}
            min={-2}
            max={2}
            step={0.05}
            onChange={(vibrance) => updateColor({ vibrance })}
          />
          <NumberField
            label="Temperature"
            value={effects.color.temperature}
            min={-1}
            max={1}
            step={0.01}
            onChange={(temperature) => updateColor({ temperature })}
          />
          <NumberField
            label="Hue"
            value={effects.color.hue}
            min={-180}
            max={180}
            step={1}
            onChange={(hue) => updateColor({ hue })}
          />
          <NumberField
            label="Shadows"
            value={effects.color.shadows}
            min={-1}
            max={1}
            step={0.01}
            onChange={(shadows) => updateColor({ shadows })}
          />
          <NumberField
            label="Highlights"
            value={effects.color.highlights}
            min={-1}
            max={1}
            step={0.01}
            onChange={(highlights) => updateColor({ highlights })}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-[#f5a623]/10 bg-[#0a0a08] p-3">
          <div className="flex items-center justify-between text-[11px]">
            <div className="text-[#bfa873]">LUT Import (.cube)</div>
            {effects.color.lut.name && (
              <div className="font-mono text-[#8d7850]">
                {effects.color.lut.name}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#f5a623]/20 bg-[#f5a623]/5 px-3 py-2 text-[11px] text-[#f5a623]">
              <Upload className="h-3.5 w-3.5" />
              Import LUT
              <input
                type="file"
                accept=".cube"
                className="hidden"
                onChange={handleLutUpload}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-[11px] text-[#bfa873]">
              <input
                type="checkbox"
                checked={effects.color.lut.enabled}
                onChange={(e) =>
                  updateColor({
                    lut: { ...effects.color.lut, enabled: e.target.checked },
                  })
                }
                className="accent-[#f5a623]"
              />
              Enabled
            </label>
          </div>
          <NumberField
            label="LUT Intensity"
            value={effects.color.lut.intensity}
            min={0}
            max={1}
            step={0.05}
            onChange={(intensity) =>
              updateColor({ lut: { ...effects.color.lut, intensity } })
            }
          />
        </div>
      </Section>

      <Section
        title="Green Screen / Chroma Key"
        description="Remove green backgrounds, tune spill cleanup, and composite over a solid virtual background."
        icon={<Sparkles className="h-4 w-4 text-[#f5a623]" />}
        enabled={effects.chromaKey.enabled}
        onToggle={(enabled) => updateChroma({ enabled })}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[11px] text-[#8d7850]">
            <span>Key Color</span>
            <input
              type="color"
              value={effects.chromaKey.color}
              onChange={(e) => updateChroma({ color: e.target.value })}
              className="h-10 w-full rounded-md border border-[#f5a623]/15 bg-[#0a0a08]"
            />
          </label>
          <label className="space-y-1 text-[11px] text-[#8d7850]">
            <span>Virtual Background</span>
            <select
              value={effects.chromaKey.backgroundMode}
              onChange={(e) =>
                updateChroma({
                  backgroundMode: e.target
                    .value as ClipEffects["chromaKey"]["backgroundMode"],
                })
              }
              className="h-10 w-full rounded-md border border-[#f5a623]/15 bg-[#0a0a08] px-2 text-[#fff5de] outline-none"
            >
              <option value="none">Remove only</option>
              <option value="solid">Solid color</option>
            </select>
          </label>
        </div>
        {effects.chromaKey.backgroundMode === "solid" && (
          <label className="space-y-1 text-[11px] text-[#8d7850]">
            <span>Background Color</span>
            <input
              type="color"
              value={effects.chromaKey.backgroundColor}
              onChange={(e) =>
                updateChroma({ backgroundColor: e.target.value })
              }
              className="h-10 w-full rounded-md border border-[#f5a623]/15 bg-[#0a0a08]"
            />
          </label>
        )}
        <NumberField
          label="Similarity"
          value={effects.chromaKey.similarity}
          min={0}
          max={1}
          step={0.01}
          onChange={(similarity) => updateChroma({ similarity })}
        />
        <NumberField
          label="Blend"
          value={effects.chromaKey.blend}
          min={0}
          max={1}
          step={0.01}
          onChange={(blend) => updateChroma({ blend })}
        />
        <NumberField
          label="Spill"
          value={effects.chromaKey.spill}
          min={0}
          max={1}
          step={0.01}
          onChange={(spill) => updateChroma({ spill })}
        />
      </Section>

      <Section
        title="Speed Ramping"
        description={`Piecewise speed ramping, slow motion, fast motion, and freeze frames across the current clip (${Math.round(clipDurationMs / 1000)}s).`}
        icon={<TimerReset className="h-4 w-4 text-[#f5a623]" />}
        enabled={effects.speed.enabled}
        onToggle={(enabled) => updateSpeed({ enabled })}
      >
        <label className="inline-flex items-center gap-2 text-[11px] text-[#bfa873]">
          <input
            type="checkbox"
            checked={effects.speed.preservePitch}
            onChange={(e) => updateSpeed({ preservePitch: e.target.checked })}
            className="accent-[#f5a623]"
          />
          Preserve pitch
        </label>

        <label className="space-y-1 text-[11px] text-[#8d7850]">
          <span>Ramp Curve</span>
          <select
            value={effects.speed.curve}
            onChange={(e) =>
              updateSpeed({
                curve: e.target.value as ClipEffects["speed"]["curve"],
              })
            }
            className="h-10 w-full rounded-md border border-[#f5a623]/15 bg-[#0a0a08] px-2 text-[#fff5de] outline-none"
          >
            <option value="linear">Linear</option>
            <option value="ease-in">Ease In</option>
            <option value="ease-out">Ease Out</option>
            <option value="ease-in-out">Ease In Out</option>
          </select>
        </label>

        <div className="space-y-2 rounded-lg border border-[#f5a623]/10 bg-[#0a0a08] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-[#bfa873]">Speed Points</div>
            <button
              onClick={addSpeedPoint}
              className="text-[11px] text-[#f5a623] hover:underline"
            >
              Add point
            </button>
          </div>
          {effects.speed.points.map((point, index) => (
            <div key={point.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <label className="space-y-1 text-[11px] text-[#8d7850]">
                <span>
                  At (
                  {index === 0 || index === effects.speed.points.length - 1
                    ? "fixed edge"
                    : "%"}
                  )
                </span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={
                    index === 0 || index === effects.speed.points.length - 1
                  }
                  value={point.at}
                  onChange={(e) =>
                    updateSpeedPoint(point.id, {
                      at: clamp(Number(e.target.value), 0, 1),
                    })
                  }
                  className="w-full rounded-md border border-[#f5a623]/15 bg-[#060605] px-2 py-1 text-[#fff5de] outline-none disabled:opacity-50"
                />
              </label>
              <label className="space-y-1 text-[11px] text-[#8d7850]">
                <span>Speed</span>
                <input
                  type="number"
                  min={0.1}
                  max={4}
                  step={0.05}
                  value={point.speed}
                  onChange={(e) =>
                    updateSpeedPoint(point.id, {
                      speed: clamp(Number(e.target.value), 0.1, 4),
                    })
                  }
                  className="w-full rounded-md border border-[#f5a623]/15 bg-[#060605] px-2 py-1 text-[#fff5de] outline-none"
                />
              </label>
              <button
                disabled={
                  index === 0 || index === effects.speed.points.length - 1
                }
                onClick={() => removeSpeedPoint(point.id)}
                className="self-end rounded-md border border-[#ef4444]/20 px-2 py-1 text-[11px] text-[#f87171] disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-[#f5a623]/10 bg-[#0a0a08] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-[#bfa873]">Freeze Frames</div>
            <button
              onClick={addFreezeFrame}
              className="text-[11px] text-[#f5a623] hover:underline"
            >
              Add freeze
            </button>
          </div>
          {effects.speed.freezeFrames.length === 0 && (
            <div className="text-[11px] text-[#8d7850]">
              No freeze frames yet.
            </div>
          )}
          {effects.speed.freezeFrames.map((freeze) => (
            <div
              key={freeze.id}
              className="grid grid-cols-[1fr_1fr_auto] gap-2"
            >
              <label className="space-y-1 text-[11px] text-[#8d7850]">
                <span>At %</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={freeze.at}
                  onChange={(e) => {
                    const at = clamp(Number(e.target.value), 0, 1);
                    updateSpeed({
                      freezeFrames: effects.speed.freezeFrames.map((item) =>
                        item.id === freeze.id ? { ...item, at } : item,
                      ),
                    });
                  }}
                  className="w-full rounded-md border border-[#f5a623]/15 bg-[#060605] px-2 py-1 text-[#fff5de] outline-none"
                />
              </label>
              <label className="space-y-1 text-[11px] text-[#8d7850]">
                <span>Duration (ms)</span>
                <input
                  type="number"
                  min={40}
                  max={5000}
                  step={10}
                  value={freeze.durationMs}
                  onChange={(e) => {
                    const durationMs = clamp(Number(e.target.value), 40, 5000);
                    updateSpeed({
                      freezeFrames: effects.speed.freezeFrames.map((item) =>
                        item.id === freeze.id ? { ...item, durationMs } : item,
                      ),
                    });
                  }}
                  className="w-full rounded-md border border-[#f5a623]/15 bg-[#060605] px-2 py-1 text-[#fff5de] outline-none"
                />
              </label>
              <button
                onClick={() =>
                  updateSpeed({
                    freezeFrames: effects.speed.freezeFrames.filter(
                      (item) => item.id !== freeze.id,
                    ),
                  })
                }
                className="self-end rounded-md border border-[#ef4444]/20 px-2 py-1 text-[11px] text-[#f87171]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
