import { prisma } from "@repo/db/client";
import type { RenderPayload } from "./types";
import { log } from "./logger";
import { CONFIG } from "./config";
import { publishConnection, metrics } from "./redis";
import { processRenderJob } from "./render";
import { toWorkerError } from "./errors";

export async function handleJob(payload: RenderPayload): Promise<void> {
  const { jobId, projectId } = payload;

  // Atomic QUEUED → PROCESSING transition (guards against duplicate processing)
  try {
    await prisma.exportJob.update({
      where: { id: jobId, status: "QUEUED" },
      data: { status: "PROCESSING", error: null },
    });
  } catch {
    log("warn", "Job already processing or not QUEUED — skipping", { jobId });
    return;
  }

  try {
    await processRenderJob(payload);
    metrics.processed++;
  } catch (err) {
    const retry = payload.retryCount ?? 0;
    const workerErr = toWorkerError(err);
    log("error", "Job failed", {
      jobId,
      retry,
      code: workerErr.code,
      recoverable: workerErr.recoverable,
      err: workerErr.message,
    });

    const errorPayload = JSON.stringify({
      code: workerErr.code,
      message: workerErr.message,
      recoverable: workerErr.recoverable,
      timestamp: new Date().toISOString(),
    });

    if (retry < CONFIG.MAX_RETRIES) {
      metrics.retried++;
      try {
        await prisma.exportJob.update({
          where: { id: jobId },
          data: { status: "QUEUED", error: errorPayload },
        });
        await publishConnection.rpush(
          CONFIG.QUEUE_NAME,
          JSON.stringify({ ...payload, retryCount: retry + 1 }),
        );
        log("info", "Job re-queued", { jobId, attempt: retry + 1 });
      } catch (retryErr: any) {
        if (retryErr?.code === "P2025") {
          log(
            "warn",
            "Cannot retry — ExportJob record not found (cascade-deleted)",
            { jobId },
          );
          metrics.failed++;
        } else {
          throw retryErr;
        }
      }
    } else {
      metrics.failed++;
      try {
        await prisma.$transaction([
          prisma.exportJob.update({
            where: { id: jobId },
            data: { status: "FAILED", error: errorPayload },
          }),
          prisma.editorProject.update({
            where: { id: projectId },
            data: { status: "FAILED" },
          }),
        ]);
      } catch (failErr: any) {
        if (failErr?.code === "P2025") {
          log(
            "warn",
            "Cannot mark as FAILED — record not found (cascade-deleted)",
            { jobId, projectId },
          );
        } else {
          throw failErr;
        }
      }
      log("error", "Job permanently failed", { jobId, projectId });

      // Push notification to user that export failed
      try {
        const project = await prisma.editorProject.findUnique({
          where: { id: projectId },
          select: { ownerId: true, meeting: { select: { roomName: true } } },
        });
        if (project) {
          const label =
            project.meeting.roomName ?? `Project ${projectId.slice(0, 8)}`;
          await publishConnection.rpush(
            "Notifications",
            JSON.stringify({
              userId: project.ownerId,
              type: "RENDER_FAILED",
              message: `Export "${label}" failed`,
              metadata: {
                jobId,
                projectId,
                error: workerErr.message,
                errorCode: workerErr.code,
                recoverable: workerErr.recoverable,
              },
            }),
          );
        }
      } catch (notifyErr: any) {
        log("warn", "Failed to push render-failed notification", {
          jobId,
          err: notifyErr.message,
        });
      }
    }
  }
}
