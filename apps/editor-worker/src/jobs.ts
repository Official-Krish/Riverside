import { prisma } from "@repo/db/client";
import type { RenderPayload } from "./types";
import { log } from "./logger";
import { CONFIG } from "./config";
import { publishConnection, metrics } from "./redis";
import { processRenderJob } from "./render";

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
  } catch (err: any) {
    const retry = payload.retryCount ?? 0;
    log("error", "Job failed", { jobId, retry, err: err.message });

    if (retry < CONFIG.MAX_RETRIES) {
      metrics.retried++;
      try {
        await prisma.exportJob.update({
          where: { id: jobId },
          data: { status: "QUEUED", error: err.message },
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
            data: { status: "FAILED", error: err.message },
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
    }
  }
}
