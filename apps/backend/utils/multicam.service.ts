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
