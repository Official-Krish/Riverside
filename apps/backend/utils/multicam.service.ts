import { prisma } from "@repo/db/client";
import { toPublicRecordingLink } from "./storage";
import { writeProjectSnapshot } from "./editor.helpers";

export async function seedMulticamProject(
  meetingId: string,
  roomId: string,
  ownerId: string,
  finalRecordingId?: string | null,
): Promise<string> {
  const existing = await prisma.editorProject.findFirst({
    where: { meetingId, ownerId, sourceMode: "MULTITRACK" },
  });
  if (existing) {
    return existing.id;
  }

  const { project } = await prisma.$transaction(async (tx) => {
    const project = await tx.editorProject.create({
      data: {
        ownerId,
        meetingId,
        sourceMode: "MULTITRACK",
        finalRecordingId: finalRecordingId ?? null,
        fps: 30,
        width: 1920,
        height: 1080,
      },
    });

    const sources = await tx.participantSource.findMany({
      where: { meetingId },
    });

    const assetIds: string[] = [];
    for (const source of sources) {
      if (source.videoUrl) {
        const asset = await tx.editorAsset.create({
          data: {
            projectId: project.id,
            meetingId,
            participantId: source.participantId,
            participantKey: source.participantId,
            assetType: "VIDEO",
            url: source.videoUrl,
            durationMs: source.durationMs ?? undefined,
          },
        });
        assetIds.push(asset.id);
      }
      if (source.audioUrl) {
        await tx.editorAsset.create({
          data: {
            projectId: project.id,
            meetingId,
            participantId: source.participantId,
            participantKey: source.participantId,
            assetType: "AUDIO",
            url: source.audioUrl,
            durationMs: source.durationMs ?? undefined,
          },
        });
      }
    }

    return { project, assetIds };
  });

  await writeProjectSnapshot(roomId, project.id, {
    projectId: project.id,
    meetingId,
    roomId,
    sourceMode: "MULTITRACK",
    tracks: [],
    overlays: [],
    assets: [],
    durationMs: null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });

  return project.id;
}

export async function buildParticipantManifest(meetingId: string) {
  const sources = await prisma.participantSource.findMany({
    where: { meetingId },
  });

  return sources.map((s) => ({
    participantKey: s.participantId,
    videoUrl: s.videoUrl ? toPublicRecordingLink(s.videoUrl) : null,
    audioUrl: s.audioUrl ? toPublicRecordingLink(s.audioUrl) : null,
    durationMs: s.durationMs,
  }));
}

/**
 * Generate auto-cut MulticamSegment records from SpeakerTimeline data.
 *
 * Strategy:
 * - Merge short segments (<500ms) into adjacent speakers
 * - For each speaker segment, create a MulticamSegment with:
 *   - timelineStartMs, durationMs from the speaker segment
 *   - participantKey = the active speaker
 *   - transition = "cut" (marker for auto-cut)
 */
export async function generateAutoCutSegments(projectId: string): Promise<
  Array<{
    id: string;
    timelineStartMs: number;
    durationMs: number;
    participantKey: string;
  }>
> {
  const project = await prisma.editorProject.findUnique({
    where: { id: projectId },
    select: { meetingId: true },
  });
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const speakerTimelines = await prisma.speakerTimeline.findMany({
    where: { meetingId: project.meetingId },
    orderBy: { startMs: "asc" },
  });

  if (speakerTimelines.length === 0) return [];

  const mergedSegments = mergeShortSegments(
    speakerTimelines.map((s) => ({
      participantKey: s.participantKey,
      startMs: s.startMs,
      endMs: s.endMs,
      confidence: s.confidence,
    })),
    500,
  );

  if (mergedSegments.length === 0) return [];

  // Find or create a MulticamLayout for "auto-cut"
  let layout = await prisma.multicamLayout.findFirst({
    where: { projectId, name: "Auto-Cut" },
  });

  if (!layout) {
    layout = await prisma.multicamLayout.create({
      data: { projectId, name: "Auto-Cut", viewMode: "GRID", rows: 1, cols: 1 },
    });
  }

  // Clear existing segments for this layout
  await prisma.multicamSegment.deleteMany({ where: { layoutId: layout.id } });

  const created = await prisma.$transaction(
    mergedSegments.map((seg, i) =>
      prisma.multicamSegment.create({
        data: {
          layoutId: layout!.id,
          participantKey: seg.participantKey,
          timelineStartMs: seg.startMs,
          durationMs: seg.endMs - seg.startMs,
          order: i,
          transition: "cut",
        },
      }),
    ),
  );

  return created.map((s) => ({
    id: s.id,
    timelineStartMs: s.timelineStartMs,
    durationMs: s.durationMs,
    participantKey: s.participantKey,
  }));
}

interface SpeakerEntry {
  participantKey: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

/**
 * Merge speaker segments that are shorter than minGapMs into adjacent longer segments.
 */
function mergeShortSegments(
  segments: SpeakerEntry[],
  minGapMs: number,
): SpeakerEntry[] {
  if (segments.length <= 1) return segments;

  const result: SpeakerEntry[] = [];
  let i = 0;

  while (i < segments.length) {
    const current = segments[i]!;

    // Check if the next segment is very short
    if (
      i + 1 < segments.length &&
      segments[i + 1]!.endMs - segments[i + 1]!.startMs < minGapMs
    ) {
      // Merge the short segment into the current one
      const next = segments[i + 1]!;
      // Extend current to cover the short segment's time
      result.push({
        participantKey: current.participantKey,
        startMs: current.startMs,
        endMs: next.endMs,
        confidence: Math.max(current.confidence, next.confidence),
      });
      i += 2;
    } else {
      result.push({ ...current });
      i++;
    }
  }

  return result;
}
