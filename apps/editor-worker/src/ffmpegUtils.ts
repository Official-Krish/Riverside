import { spawn } from "node:child_process";
// We'll dynamically import ffprobe-static inside hasAudioStream to avoid
// top-level require/import issues with typings.
// path import not required here

export function normalizeFfmpegColor(
  input: string | undefined,
  fallbackHex = "000000",
): string {
  const raw = (input ?? "").trim();
  if (!raw) return `0x${fallbackHex}`;

  // Keep named colors (e.g. "black", "white") as-is for ffmpeg.
  if (/^[a-zA-Z]+$/.test(raw)) {
    return raw;
  }

  // Accept #RRGGBB, RRGGBB, 0xRRGGBB and normalize to 0xRRGGBB.
  let hex = raw;
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (hex.toLowerCase().startsWith("0x")) hex = hex.slice(2);
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
    return `0x${hex}`;
  }

  return `0x${fallbackHex}`;
}

// Quote a path for use in shell command strings when necessary. If args are passed
// as arrays to spawn, prefer not to use this. This is a best-effort sanitizer for
// places that build command strings.
export function quoteShellPath(p: string): string {
  if (!p) return p;
  // Wrap in single quotes and escape existing single quotes.
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

export function formatFfmpegColorWithAlpha(
  input: string | undefined,
  alpha: number | undefined,
  fallbackHex = "000000",
): string {
  const base = normalizeFfmpegColor(input, fallbackHex);
  const a = Math.max(0, Math.min(1, alpha ?? 1));
  // If base is a named color (letters only), use color@alpha syntax
  if (/^[a-zA-Z]+$/.test(base)) {
    if (a >= 1) return base;
    return `${base}@${a.toFixed(3)}`;
  }
  // base is 0xRRGGBB or 0xRRGGBBAA already; append alpha hex
  const alphaHex = Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");
  // If base already contains alpha (8 hex digits), replace it
  const m = base.match(/^0x([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (m) {
    return `0x${m[1]}${alphaHex}`;
  }
  return base;
}

export async function hasAudioStream(
  videoPath: string,
  ffprobePath?: string,
): Promise<boolean> {
  // @ts-expect-error - ffprobe-static has no bundled types
  const ffprobeStatic = await import("ffprobe-static").catch(() => null);
  const probe =
    ffprobePath ?? (ffprobeStatic && ffprobeStatic.path) ?? "ffprobe";

  return await new Promise<boolean>((resolve, reject) => {
    const ffprobe = spawn(probe, [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      videoPath,
    ]);

    let stdout = "";
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      ffprobe.removeAllListeners();
      ffprobe.kill("SIGTERM");
    };

    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error(`FFprobe timeout for ${videoPath}`));
    }, 30000);

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.on("close", (code) => {
      cleanup();
      if (code === 0) {
        const hasAudio = stdout.trim().length > 0;
        resolve(hasAudio);
        return;
      }
      reject(new Error(`FFprobe failed with code ${code}`));
    });

    ffprobe.on("error", (error) => {
      cleanup();
      reject(error);
    });
  });
}
