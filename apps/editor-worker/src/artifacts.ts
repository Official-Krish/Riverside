import { getObjectBytesFromS3, resolveStorageContext } from "@repo/amazons3";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { prisma } from "@repo/db/client";
import { publishConnection } from "./redis";
import { CONFIG } from "./config";
import { recordingsRoot, toPublicRecordingLink } from "./helpers";
import { deleteS3Prefix, uploadLocalFileToS3 } from "./storage";

const storage = resolveStorageContext();

export function getCanonicalFinalDir(roomId: string) {
  return path.join(recordingsRoot, roomId, "final");
}

export function getCanonicalFinalKey(roomId: string, version?: string | number) {
  const ver = version ?? Date.now();
  return `weave-recordings/${roomId}/final/meeting_grid_recording_v${ver}.mp4`;
}

export function getCanonicalHlsPrefix(roomId: string, version?: string | number) {
  return `weave-recordings/${roomId}/hls_v${version ?? "stable"}/`;
}

export function getCanonicalHlsDir(roomId: string, version?: string | number) {
  return path.join(recordingsRoot, roomId, `hls_v${version ?? "stable"}`);
}

export async function deleteAllHlsVersions(roomId: string) {
  const prefixes: string[] = [
    `weave-recordings/${roomId}/hls/`,
    `weave-recordings/${roomId}/hls_vstable/`,
  ];
  for (let i = 0; i < 1000; i++) {
    prefixes.push(`weave-recordings/${roomId}/hls_v${i}/`);
  }
  await Promise.allSettled(prefixes.map((p) => deleteS3Prefix(p)));
}

export async function deleteAllFinalRecordings(roomId: string) {
  await deleteS3Prefix(`weave-recordings/${roomId}/final/`);
}

export async function removeIfExists(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function promoteRenderedVideo(roomId: string, renderedPath: string, version?: string | number) {
  const finalKey = getCanonicalFinalKey(roomId, version);
  const stats = await fs.stat(renderedPath);

  await uploadLocalFileToS3(renderedPath, finalKey, "video/mp4");

  const newBytes = await getObjectBytesFromS3({
    s3Client: storage.s3Client,
    bucketName: storage.bucketName,
    key: finalKey,
  });
  const verified = (newBytes?.length ?? 0) > stats.size * 0.5;

  if (!verified) {
    throw new Error(`S3 upload verification failed for ${finalKey}`);
  }

  await removeIfExists(renderedPath);
  return finalKey;
}

export async function refreshMeetingRecordingArtifacts(roomId: string, finalKey: string, jobId: string, projectId: string, version?: string | number) {
  const normalizedPublicFinalPath = toPublicRecordingLink(finalKey);

  await deleteAllHlsVersions(roomId);
  await deleteAllFinalRecordings(roomId);
  await removeIfExists(getCanonicalHlsDir(roomId, version));

  const hostMeeting = await prisma.meeting.findFirst({
    where: {
      roomId,
      isHost: true,
    },
    include: {
      finalRecording: true,
    },
  });

  if (!hostMeeting) {
    throw new Error(`Host meeting not found for room ${roomId}`);
  }

  await prisma.$transaction([
    prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: "DONE",
        outputUrl: normalizedPublicFinalPath,
        progress: 100,
        error: null,
      },
    }),
    prisma.editorProject.update({
      where: { id: projectId },
      data: { status: "COMPLETED" },
    }),
    prisma.finalRecording.upsert({
      where: {
        meetingId: hostMeeting.id,
      },
      create: {
        meetingId: hostMeeting.id,
        videoLink: finalKey,
        version: String(version ?? "0"),
        visibleToEmails: hostMeeting.finalRecording?.visibleToEmails ?? [],
      },
      update: {
        videoLink: finalKey,
        version: String(version ?? "0"),
      },
    }),
    prisma.meeting.updateMany({
      where: {
        roomId,
      },
      data: {
        recordingState: "PROCESSING",
        processingStartedAt: new Date(),
        processingEndedAt: null,
      },
    }),
  ]);

  await publishConnection.rpush(
    CONFIG.TRANSCODE_QUEUE_NAME,
    JSON.stringify({
      meetingId: roomId,
      finalPath: finalKey,
      version,
    }),
  );

  try {
    await cleanupEditorProjectState(roomId, projectId, finalKey);
  } catch {
    // ignore cleanup errors
  }

  return finalKey;
}

async function cleanupEditorProjectState(roomId: string, projectId: string, finalVideoUrl: string) {
  const project = await prisma.editorProject.findFirst({
    where: { id: projectId },
    include: {
      meeting: {
        include: {
          finalRecording: true,
        },
      },
      assets: true,
    },
  });

  if (!project) {
    return;
  }

  const preservedUrl = project.meeting.finalRecording?.videoLink ?? finalVideoUrl;
  const preservedAsset = project.assets.find((asset) => asset.url === preservedUrl);

  await prisma.$transaction(async (tx) => {
    await tx.editorOverlay.deleteMany({ where: { projectId } });
    await tx.editorTrack.deleteMany({ where: { projectId } });

    if (preservedAsset) {
      await tx.editorAsset.deleteMany({
        where: {
          projectId,
          id: { not: preservedAsset.id },
        },
      });
    } else {
      await tx.editorAsset.deleteMany({ where: { projectId } });
      await tx.editorAsset.create({
        data: {
          projectId,
          meetingId: project.meetingId,
          assetType: "VIDEO",
          url: preservedUrl,
        },
      });
    }

    await tx.editorProject.update({
      where: { id: projectId },
      data: {
        status: "DRAFT",
        durationMs: null,
      },
    });
  });

  const prefixesToCleanup = [
    `weave-recordings/${roomId}/raw/`,
    `weave-recordings/${roomId}/editor/`,
    `weave-recordings/${roomId}/tmp/`,
  ];

  await Promise.allSettled([
    removeIfExists(path.join(recordingsRoot, roomId, "editor")),
    removeIfExists(path.join(recordingsRoot, roomId, "raw")),
    removeIfExists(path.join(recordingsRoot, roomId, "tmp")),
    ...prefixesToCleanup.map((prefix) => deleteS3Prefix(prefix)),
  ]);
}