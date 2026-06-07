import { spawn } from "node:child_process";
import { prisma } from "@repo/db/client";
import { ffmpegBin } from "./ffmpeg";

/** A detected speaking segment for a single participant */
export interface SpeakingSegment {
  startMs: number;
  endMs: number;
}

/**
 * Run FFmpeg silencedetect on a participant's audio track and return
 * speaking segments (inverted silence detection).
 *
 * Algorithm:
 * 1. Use silencedetect to find silence boundaries
 * 2. Invert: speaking occurs between silence_end and the next silence_start
 * 3. Return sorted array of { startMs, endMs }
 */
export async function analyzeParticipantAudio(
  videoPath: string,
  silenceThreshold = "-30dB",
  silenceDuration = "0.5",
): Promise<SpeakingSegment[]> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      videoPath,
      "-af",
      `silencedetect=n=${silenceThreshold}:d=${silenceDuration}`,
      "-f",
      "null",
      "-",
    ];

    const ffmpeg = spawn(ffmpegBin, args);
    let stderr = "";
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      ffmpeg.removeAllListeners();
      ffmpeg.kill("SIGTERM");
    };

    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error(`silencedetect timed out for ${videoPath}`));
    }, 300000);

    ffmpeg.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      cleanup();
      if (code !== 0 && code !== 255) {
        reject(new Error(`FFmpeg silencedetect exited with code ${code}`));
        return;
      }

      const segments = parseSilenceDetectOutput(stderr);
      resolve(segments);
    });

    ffmpeg.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Parse FFmpeg silencedetect stderr output and return speaking segments.
 *
 * silencedetect outputs lines like:
 *   [silencedetect @ 0x...] silence_end: 2.543 | silence_duration: 0.512
 *   [silencedetect @ 0x...] silence_start: 3.055
 *
 * We collect silence intervals and invert them to get speaking intervals.
 */
export function parseSilenceDetectOutput(stderr: string): SpeakingSegment[] {
  const silenceStartRegex = /silence_start:\s*([\d.]+)/g;
  const silenceEndRegex = /silence_end:\s*([\d.]+)/g;

  const starts: number[] = [];
  const ends: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = silenceStartRegex.exec(stderr)) !== null) {
    const val = match[1];
    if (val) starts.push(parseFloat(val) * 1000);
  }
  while ((match = silenceEndRegex.exec(stderr)) !== null) {
    const val = match[1];
    if (val) ends.push(parseFloat(val) * 1000);
  }

  if (
    ends.length > 0 &&
    (starts.length === 0 || (ends[0] ?? 0) < (starts[0] ?? 0))
  ) {
    starts.unshift(0);
  }

  const speakingSegments: SpeakingSegment[] = [];
  for (let i = 0; i < ends.length; i++) {
    const endMs = ends[i]!;
    const nextStartMs = i < starts.length ? (starts[i] ?? Infinity) : Infinity;

    const silenceStartIdx = starts.findIndex((s) => s >= endMs);
    const speakingEndMs =
      silenceStartIdx >= 0
        ? (starts[silenceStartIdx] ?? Infinity)
        : nextStartMs;

    if (Number.isFinite(speakingEndMs) && speakingEndMs > endMs + 100) {
      speakingSegments.push({
        startMs: Math.round(endMs),
        endMs: Math.round(speakingEndMs),
      });
    }
  }

  return speakingSegments;
}

/**
 * Cross-reference speaking segments across multiple participants.
 *
 * For each 500ms window across the full meeting duration:
 * - If exactly 1 participant is speaking → they are the active speaker (confidence 1.0)
 * - If multiple are speaking → first detected wins (confidence 0.5)
 * - If none → no active speaker
 *
 * Returns merged SpeakerTimeline-style records.
 */
export function crossReferenceSpeakers(
  participants: Map<string, SpeakingSegment[]>,
  totalDurationMs: number,
): Array<{
  participantKey: string;
  startMs: number;
  endMs: number;
  confidence: number;
}> {
  const WINDOW_MS = 500;
  const rawSegments: Array<{
    participantKey: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }> = [];

  for (let t = 0; t < totalDurationMs; t += WINDOW_MS) {
    const windowEnd = Math.min(t + WINDOW_MS, totalDurationMs);

    // Find all participants speaking in this window
    const activeSpeakers: Array<{ key: string; overlapMs: number }> = [];

    for (const [key, segs] of participants) {
      for (const seg of segs) {
        if (seg.startMs < windowEnd && seg.endMs > t) {
          const overlap =
            Math.min(seg.endMs, windowEnd) - Math.max(seg.startMs, t);
          if (overlap > 0) {
            activeSpeakers.push({ key, overlapMs: overlap });
          }
        }
      }
    }

    if (activeSpeakers.length === 0) continue;

    // Sort by overlap duration (loudest/heuristic)
    activeSpeakers.sort((a, b) => b.overlapMs - a.overlapMs);

    const winner = activeSpeakers[0]!;
    const confidence = activeSpeakers.length === 1 ? 1.0 : 0.5;

    rawSegments.push({
      participantKey: winner.key,
      startMs: t,
      endMs: windowEnd,
      confidence,
    });
  }

  // Merge consecutive same-speaker windows
  if (rawSegments.length === 0) return [];

  const merged: typeof rawSegments = [];
  let current = rawSegments[0]!;

  for (let i = 1; i < rawSegments.length; i++) {
    const next = rawSegments[i]!;
    if (next.participantKey === current.participantKey) {
      current.endMs = next.endMs;
      current.confidence = Math.max(current.confidence, next.confidence);
    } else {
      merged.push({ ...current });
      current = next;
    }
  }
  merged.push({ ...current });

  return merged;
}

/**
 * Full pipeline: analyze all participant videos, cross-reference, store results.
 *
 * @param participantVideos  Map of participantKey → local video path
 * @param meetingId          Meeting ID for storing SpeakerTimeline records
 * @param totalDurationMs    Total meeting duration in ms
 * @returns The stored SpeakerTimeline records
 */
export async function runSpeakerAnalysis(
  participantVideos: Map<string, string>,
  meetingId: string,
  totalDurationMs: number,
): Promise<
  Array<{
    participantKey: string;
    startMs: number;
    endMs: number;
    confidence: number;
  }>
> {
  // 1. Analyze each participant's audio in parallel
  const analysisResults = new Map<string, SpeakingSegment[]>();

  await Promise.all(
    [...participantVideos.entries()].map(async ([key, videoPath]) => {
      try {
        const segments = await analyzeParticipantAudio(videoPath);
        analysisResults.set(key, segments);
      } catch (err) {
        console.error(`[SpeakerAnalysis] Failed to analyze ${key}:`, err);
        analysisResults.set(key, []);
      }
    }),
  );

  // 2. Cross-reference to determine active speaker
  const speakerTimelines = crossReferenceSpeakers(
    analysisResults,
    totalDurationMs,
  );

  // 3. Store in database (atomically replace for this meeting)
  await prisma.$transaction([
    prisma.speakerTimeline.deleteMany({ where: { meetingId } }),
    ...speakerTimelines.map((s) =>
      prisma.speakerTimeline.create({
        data: {
          meetingId,
          participantKey: s.participantKey,
          startMs: s.startMs,
          endMs: s.endMs,
          confidence: s.confidence,
        },
      }),
    ),
  ]);

  return speakerTimelines;
}
