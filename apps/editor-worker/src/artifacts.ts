import * as fs from "node:fs/promises";
import * as path from "node:path";
import { prisma } from "@repo/db/client";
import { publishConnection } from "./redis";
import { CONFIG } from "./config";
import { log } from "./logger";
import { recordingsRoot, toPublicRecordingLink } from "./helpers";
import {
  deleteS3Prefix,
  uploadLocalFileToS3,
  getS3ObjectSize,
} from "./storage";

export function getCanonicalFinalDir(roomId: string) {
  return path.join(recordingsRoot, roomId, "final");
}

export function getCanonicalFinalKey(
  roomId: string,
  version?: string | number,
) {
  const ver = version ?? Date.now();
  return `weave-recordings/${roomId}/final/meeting_grid_recording_v${ver}.mp4`;
}

export function getCanonicalHlsPrefix(
  roomId: string,
  version?: string | number,
) {
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

export async function promoteRenderedVideo(
  roomId: string,
  renderedPath: string,
  version?: string | number,
) {
  const finalKey = getCanonicalFinalKey(roomId, version);
  const stats = await fs.stat(renderedPath);
  const uploadStart = Date.now();

  log("info", "Uploading rendered editor export", {
    roomId,
    finalKey,
    renderedPath,
    bytes: stats.size,
  });

  await uploadLocalFileToS3(renderedPath, finalKey, "video/mp4");

  // Verify upload with HEAD request (zero bytes downloaded) instead of
  // fetching the entire file back into RAM
  const uploadedSize = await getS3ObjectSize(finalKey);
  const verified = (uploadedSize ?? 0) > stats.size * 0.5;

  if (!verified) {
    throw new Error(
      `S3 upload verification failed for ${finalKey} (uploaded: ${uploadedSize ?? 0}, expected: >${stats.size * 0.5})`,
    );
  }

  log("info", "Editor export upload verified", {
    roomId,
    finalKey,
    uploadedSize,
    durationMs: Date.now() - uploadStart,
  });

  await removeIfExists(renderedPath);
  return finalKey;
}

export async function refreshMeetingRecordingArtifacts(
  roomId: string,
  finalKey: string,
  jobId: string,
  projectId: string,
  version?: string | number,
) {
  const normalizedPublicFinalPath = toPublicRecordingLink(finalKey);

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

  try {
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
  } catch (txErr: any) {
    // If the ExportJob or EditorProject was already deleted (e.g. user deleted project
    // while export was running), log the error but don't crash — the video was already
    // promoted to S3 successfully.
    if (txErr?.code === "P2025") {
      log("warn", "Final status update skipped — record not found", {
        jobId,
        projectId,
        err: txErr.message,
      });
    } else {
      throw txErr;
    }
  }

  await publishConnection.rpush(
    CONFIG.TRANSCODE_QUEUE_NAME,
    JSON.stringify({
      meetingId: roomId,
      finalPath: finalKey,
      version,
    }),
  );

  log("info", "Export completed — queued for transcoding", {
    jobId,
    projectId,
    finalKey,
    version,
  });

  // Non-critical cleanup: delete old HLS versions and editor temp files.
  // Fire-and-forget so these never crash the job.
  log("info", "Starting post-export cleanup", { roomId, projectId });
  Promise.allSettled([
    deleteAllHlsVersions(roomId),
    removeIfExists(getCanonicalHlsDir(roomId, version)),
    cleanupEditorProjectState(roomId, projectId, finalKey),
  ])
    .then((results) => {
      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length > 0) {
        log("warn", "Post-export cleanup finished with non-fatal failures", {
          roomId,
          projectId,
          failedTasks: rejected.length,
        });
      } else {
        log("info", "Post-export cleanup finished", { roomId, projectId });
      }
    })
    .catch((cleanupErr) => {
      log("warn", "Post-export cleanup crashed unexpectedly (non-fatal)", {
        roomId,
        projectId,
        err: cleanupErr?.message ?? String(cleanupErr),
      });
    });

  return finalKey;
}

async function cleanupEditorProjectState(
  roomId: string,
  projectId: string,
  finalVideoUrl: string,
) {
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

  const preservedUrl =
    project.meeting.finalRecording?.videoLink ?? finalVideoUrl;
  const preservedAsset = project.assets.find(
    (asset) => asset.url === preservedUrl,
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.editorOverlay.deleteMany({ where: { projectId } });
      // Delete clips before tracks (clips FK → tracks)
      await tx.editorClip.deleteMany({ where: { track: { projectId } } });
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
  } catch (err: any) {
    // Guard against cascade-deletion or concurrent modifications
    if (err?.code === "P2025") {
      log(
        "warn",
        "Cleanup skipped — project or related records already deleted",
        { projectId },
      );
      return;
    }
    throw err;
  }

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
