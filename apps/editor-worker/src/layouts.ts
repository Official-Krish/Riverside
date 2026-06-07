import type { ParticipantSourcePlan, LayoutPreset } from "./types";

export interface LayoutFilterGraph {
  /** Ordered list of FFmpeg filter_complex parts for this segment */
  filterParts: string[];
  /** Label of the final composited video stream */
  outputLabel: string;
  /** Number of video inputs consumed */
  inputCount: number;
}

/**
 * Build an FFmpeg filter_complex for the given layout preset.
 *
 * Each participant video is represented as an input stream (0:v, 1:v, ...).
 * The function outputs a single composited video stream with label "comp".
 *
 * @param preset  layout preset (single | pip | split | grid)
 * @param sources ordered participant sources matching the input order
 * @param width   output canvas width
 * @param height  output canvas height
 * @param labels  whether to burn speaker labels via drawtext
 */
export function buildLayoutFilterGraph(
  preset: LayoutPreset,
  sources: ParticipantSourcePlan[],
  width: number,
  height: number,
  labels: boolean,
): LayoutFilterGraph {
  switch (preset) {
    case "single":
      return buildSingleLayout(sources, width, height, labels);
    case "pip":
      return buildPiPLayout(sources, width, height, labels);
    case "split":
      return buildSplitLayout(sources, width, height, labels);
    case "grid":
      return buildGridLayout(sources, width, height, labels);
    default:
      return buildSingleLayout(sources, width, height, labels);
  }
}

/**
 * Build a crop+scale filter string for a single participant.
 * Applies reframeSettings then scales to fit the given dimensions.
 */
function participantFilter(
  inputIndex: number,
  source: ParticipantSourcePlan,
  targetW: number,
  targetH: number,
  label: string,
): string {
  const { reframeSettings } = source;
  const rw = reframeSettings.cropW;
  const rh = reframeSettings.cropH;
  const rx = reframeSettings.cropX;
  const ry = reframeSettings.cropY;
  return `[${inputIndex}:v]crop=iw*${rw}:ih*${rh}:iw*${rx}:ih*${ry},scale=${targetW}:${targetH},setsar=1[${label}]`;
}

function drawtextFilter(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  label: string,
): string {
  const safe = text.replace(/'/g, "'\\\\''");
  return `[${label}]drawtext=text='${safe}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=white:shadowx=2:shadowy=2:shadowcolor=black@0.66[${label}_lbl]`;
}

function buildSingleLayout(
  sources: ParticipantSourcePlan[],
  width: number,
  height: number,
  labels: boolean,
): LayoutFilterGraph {
  if (sources.length === 0) {
    return {
      filterParts: [`color=c=#2a2a2a:s=${width}x${height}:d=1[comp]`],
      outputLabel: "comp",
      inputCount: 0,
    };
  }

  const filterParts: string[] = [];
  const s = sources[0]!;
  filterParts.push(participantFilter(0, s, width, height, "p0"));

  if (labels) {
    filterParts.push(
      drawtextFilter(
        s.displayName,
        24,
        height - 48,
        Math.round(height * 0.03),
        "p0",
      ),
    );
    filterParts.push(`[p0_lbl]null[comp]`);
  } else {
    filterParts.push(`[p0]null[comp]`);
  }

  return { filterParts, outputLabel: "comp", inputCount: 1 };
}

function buildPiPLayout(
  sources: ParticipantSourcePlan[],
  width: number,
  height: number,
  labels: boolean,
): LayoutFilterGraph {
  if (sources.length === 0) {
    return {
      filterParts: [`color=c=#2a2a2a:s=${width}x${height}:d=1[comp]`],
      outputLabel: "comp",
      inputCount: 0,
    };
  }

  const filterParts: string[] = [];
  const mainLabel = labels ? "main_lbl" : "main";
  const mainSource = sources[0]!;

  filterParts.push(participantFilter(0, mainSource, width, height, "main"));

  if (labels) {
    filterParts.push(
      drawtextFilter(
        mainSource.displayName,
        24,
        height - 48,
        Math.round(height * 0.03),
        "main",
      ),
    );
  }

  // PiP inset(s)
  const pipW = Math.round(width * 0.25);
  const pipH = Math.round(pipW * (9 / 16));
  const pipOverlays: string[] = [`[${mainLabel}]`];

  for (let i = 1; i < Math.min(sources.length, 4); i++) {
    const src = sources[i]!;
    const pipLabel = `pip${i}`;
    const pipLabelFinal = labels ? `pip${i}_lbl` : pipLabel;
    filterParts.push(participantFilter(i, src, pipW, pipH, pipLabel));

    if (labels) {
      filterParts.push(
        drawtextFilter(
          src.displayName,
          8,
          pipH - 18,
          Math.round(pipH * 0.08),
          pipLabel,
        ),
      );
    }

    const offsetY = 16 + (i - 1) * (pipH + 8);
    const overlayX = width - pipW - 16;
    pipOverlays.push(
      `[${pipLabelFinal}]overlay=${overlayX}:${offsetY}[pip_v${i}]`,
    );

    if (i < Math.min(sources.length, 4) - 1) {
      pipOverlays.push(`[pip_v${i}]`);
    }
  }

  const lastIdx = Math.min(sources.length, 4) - 1;
  const outputLabel = lastIdx >= 1 ? `pip_v${lastIdx}` : mainLabel;

  filterParts.push(pipOverlays.join(""));

  return {
    filterParts,
    outputLabel: outputLabel === mainLabel ? mainLabel : "comp",
    inputCount: Math.min(sources.length, 4),
  };
}

function buildSplitLayout(
  sources: ParticipantSourcePlan[],
  width: number,
  height: number,
  labels: boolean,
): LayoutFilterGraph {
  if (sources.length === 0) {
    return {
      filterParts: [`color=c=#2a2a2a:s=${width}x${height}:d=1[comp]`],
      outputLabel: "comp",
      inputCount: 0,
    };
  }

  const count = Math.min(sources.length, 4);
  const cols = count <= 2 ? count : 2;
  const rows = Math.ceil(count / cols);
  const cw = Math.round(width / cols);
  const ch = Math.round(height / rows);

  const filterParts: string[] = [];
  const cellLabels: string[] = [];

  for (let i = 0; i < count; i++) {
    const src = sources[i]!;
    const cellLabel = `cell${i}`;
    const finalLabel = labels ? `cell${i}_lbl` : cellLabel;
    filterParts.push(participantFilter(i, src, cw, ch, cellLabel));
    if (labels) {
      filterParts.push(
        drawtextFilter(
          src.displayName,
          8,
          ch - 18,
          Math.round(ch * 0.06),
          cellLabel,
        ),
      );
    }
    cellLabels.push(finalLabel);
  }

  if (count === 1) {
    filterParts.push(`[${cellLabels[0]}]null[comp]`);
  } else if (count === 2) {
    filterParts.push(
      `[${cellLabels[0]}][${cellLabels[1]}]hstack=inputs=2[comp]`,
    );
  } else {
    // Build xstack grid
    const positions = cellLabels
      .map((_label, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return `${col * cw}_${row * ch}`;
      })
      .join("|");
    filterParts.push(
      `[${cellLabels.join("][")}]xstack=inputs=${count}:fill=last:grid=${positions}[comp]`,
    );
  }

  return { filterParts, outputLabel: "comp", inputCount: count };
}

function buildGridLayout(
  sources: ParticipantSourcePlan[],
  width: number,
  height: number,
  labels: boolean,
): LayoutFilterGraph {
  if (sources.length === 0) {
    return {
      filterParts: [`color=c=#2a2a2a:s=${width}x${height}:d=1[comp]`],
      outputLabel: "comp",
      inputCount: 0,
    };
  }

  const count = Math.min(sources.length, 9);
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cw = Math.round(width / cols);
  const ch = Math.round(height / rows);

  const filterParts: string[] = [];
  const cellLabels: string[] = [];

  for (let i = 0; i < count; i++) {
    const src = sources[i]!;
    const cellLabel = `gcell${i}`;
    const finalLabel = labels ? `gcell${i}_lbl` : cellLabel;
    filterParts.push(participantFilter(i, src, cw, ch, cellLabel));
    if (labels) {
      filterParts.push(
        drawtextFilter(
          src.displayName,
          4,
          ch - 14,
          Math.round(ch * 0.06),
          cellLabel,
        ),
      );
    }
    cellLabels.push(finalLabel);
  }

  const positions = cellLabels
    .map((_label, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return `${col * cw}_${row * ch}`;
    })
    .join("|");
  filterParts.push(
    `[${cellLabels.join("][")}]xstack=inputs=${count}:fill=last:grid=${positions}[comp]`,
  );

  return { filterParts, outputLabel: "comp", inputCount: count };
}

/**
 * Build a placeholder video for a missing participant.
 */
export function buildPlaceholderFilter(
  participantKey: string,
  displayName: string,
  width: number,
  height: number,
  durationSec: number,
): string[] {
  const initial = displayName.charAt(0).toUpperCase() || "?";
  return [
    "-f",
    "lavfi",
    "-i",
    `color=c=#2a2a2a:s=${width}x${height}:r=30:d=${durationSec.toFixed(3)}`,
    "-vf",
    `drawtext=text='${initial}':fontsize=${Math.round(height * 0.15)}:fontcolor=white:x=(w-tw)/2:y=(h-th)/2-${Math.round(height * 0.06)},drawtext=text='${displayName}':fontsize=${Math.round(height * 0.04)}:fontcolor=white@0.5:x=(w-tw)/2:y=(h-th)/2+${Math.round(height * 0.1)}`,
  ];
}
