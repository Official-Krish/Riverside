import { type UserChunk } from "./types";

export type TimelineGapEvent = {
  type: "gap";
  durationSeconds: number;
};

export type TimelineChunkEvent = {
  type: "chunk";
  chunk: UserChunk;
};

export type TimelineEvent = TimelineGapEvent | TimelineChunkEvent;

const MIN_GAP_SECONDS = 0.25;

export function getChunkStartMs(chunk: UserChunk): number {
  return chunk.timestamp;
}

export function getChunkEndMs(chunk: UserChunk): number {
  return chunk.timestamp + chunk.durationSeconds * 1000;
}

export function sortChunksByTimeline(chunks: UserChunk[]): UserChunk[] {
  return [...chunks].sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    const aSeq = a.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.sequenceNumber ?? Number.MAX_SAFE_INTEGER;
    return aSeq - bSeq;
  });
}

/** Earliest absolute time any chunk begins (chunk timestamps only). */
export function computeMeetingEpochMs(
  userChunks: Map<string, UserChunk[]>,
): number {
  let epoch = Number.MAX_SAFE_INTEGER;

  for (const chunks of userChunks.values()) {
    if (chunks.length === 0) {
      continue;
    }
    const sorted = sortChunksByTimeline(chunks);
    epoch = Math.min(epoch, getChunkStartMs(sorted[0]!));
  }

  if (!Number.isFinite(epoch) || epoch === Number.MAX_SAFE_INTEGER) {
    return Date.now();
  }

  return epoch;
}

/** Latest absolute time any chunk ends. */
export function computeMeetingEndMs(
  userChunks: Map<string, UserChunk[]>,
): number {
  let end = 0;

  for (const chunks of userChunks.values()) {
    for (const chunk of chunks) {
      end = Math.max(end, getChunkEndMs(chunk));
    }
  }

  return end > 0 ? end : Date.now();
}

/**
 * Build an ordered list of gap + chunk events on the absolute meeting timeline.
 * Gaps use black video + silent audio in the final concat.
 */
export function buildUserTimeline(
  chunks: UserChunk[],
  meetingEpochMs: number,
  meetingEndMs: number,
): TimelineEvent[] {
  const sorted = sortChunksByTimeline(chunks);
  if (sorted.length === 0) {
    return [];
  }

  const events: TimelineEvent[] = [];
  let cursorMs = meetingEpochMs;

  for (const chunk of sorted) {
    const chunkStart = getChunkStartMs(chunk);
    const gapBeforeMs = chunkStart - cursorMs;

    if (gapBeforeMs >= MIN_GAP_SECONDS * 1000) {
      events.push({
        type: "gap",
        durationSeconds: gapBeforeMs / 1000,
      });
      cursorMs = chunkStart;
    } else if (chunkStart > cursorMs) {
      cursorMs = chunkStart;
    }

    events.push({ type: "chunk", chunk });
    cursorMs = Math.max(cursorMs, getChunkEndMs(chunk));
  }

  const trailingMs = meetingEndMs - cursorMs;
  // Avoid filling most of the timeline with black when metadata is wrong.
  const maxTrailingMs = Math.max(
    30_000,
    sorted.reduce((sum, c) => sum + c.durationSeconds * 1000, 0),
  );
  if (trailingMs >= MIN_GAP_SECONDS * 1000 && trailingMs <= maxTrailingMs) {
    events.push({
      type: "gap",
      durationSeconds: trailingMs / 1000,
    });
  }

  return events;
}

export function timelineDurationSeconds(
  meetingEpochMs: number,
  meetingEndMs: number,
): number {
  return Math.max(0.1, (meetingEndMs - meetingEpochMs) / 1000);
}
