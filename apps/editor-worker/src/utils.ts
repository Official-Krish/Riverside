import * as fs from "node:fs/promises";
import { prisma } from "@repo/db/client";
import { log } from "./logger";
import type { RenderPayload } from "./types";

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function parsePayload(raw: string): RenderPayload | null {
  try {
    const p = JSON.parse(raw);
    if (
      typeof p.projectId !== "string" ||
      typeof p.jobId !== "string" ||
      typeof p.roomId !== "string"
    ) {
      log("warn", "Invalid payload shape", { raw: raw.slice(0, 200) });
      return null;
    }
    return { ...p, retryCount: p.retryCount ?? 0 };
  } catch (err: any) {
    log("warn", "Failed to parse payload", {
      err: err.message,
      raw: raw.slice(0, 200),
    });
    return null;
  }
}

export async function updateProgress(jobId: string, percent: number) {
  try {
    await prisma.exportJob.update({
      where: { id: jobId },
      data: { progress: percent },
    });
  } catch (err: any) {
    // P2025 = "Record not found" — the job was deleted (e.g. cascade from project cleanup).
    // Log and continue instead of crashing the worker.
    if (err?.code === "P2025") {
      log(
        "warn",
        "updateProgress skipped — ExportJob not found (likely cascade-deleted)",
        { jobId, percent },
      );
      return;
    }
    throw err;
  }
}

export async function verifySourceExists(sourcePath: string) {
  try {
    const stat = await fs.stat(sourcePath);
    if (!stat.isFile())
      throw new Error(`Path exists but is not a file: ${sourcePath}`);
  } catch (err: any) {
    throw new Error(
      `Source file not accessible at "${sourcePath}": ${err.message}`,
    );
  }
}

export function sanitizeDrawtext(text: string): string {
  // IMPORTANT: % must be escaped first before \ to avoid double-escaping
  return text
    .replace(/%/g, "%%")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,");
}

export function normalizeHexColor(
  color: string | undefined,
  fallback: string,
): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

export function rgbaColor(
  color: string | undefined,
  opacity: number | undefined,
  fallback: string,
): string {
  const base = normalizeHexColor(color, fallback).replace(/^0x/i, "");
  const alpha = Math.max(0, Math.min(1, opacity ?? 1));
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `0x${base}${alphaHex}`;
}
