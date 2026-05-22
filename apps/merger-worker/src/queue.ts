import { blpopQueue, getRedisClient, rpushQueue } from "./redis";
import { LocalVideoMerger } from "./merger";
import { reportWorkerStatus } from "./worker-status";
import { toWorkerError } from "./errors";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

interface QueuePayload {
  roomId?: string;
  meetingId?: string;
  retryCount?: number;
}

async function requeueWithRetry(
  meetingId: string,
  retryCount: number,
): Promise<void> {
  const delay = RETRY_DELAY_MS * retryCount;
  await new Promise((resolve) => setTimeout(resolve, delay));

  await rpushQueue("ProcessVideo", { meetingId, retryCount });
}

export async function processQueue(): Promise<void> {
  while (true) {
    let meetingId: string | null = null;
    try {
      const result = await blpopQueue("ProcessVideo", 35);

      if (!result) {
        continue;
      }

      const data: QueuePayload = JSON.parse(result);
      meetingId = data.roomId ?? data.meetingId ?? null;

      if (!meetingId) {
        continue;
      }

      try {
        await reportWorkerStatus(meetingId, "PROCESSING");
      } catch {
        // ignore
      }

      try {
        const merger = new LocalVideoMerger(meetingId);
        const finalPath = await merger.process();

        // Push merge-complete notification
        try {
          const redisClient = getRedisClient();
          await redisClient.lpush(
            "Notifications",
            JSON.stringify({
              userId: meetingId,
              type: "MERGE_COMPLETE",
              message: `Recording merge complete for meeting ${meetingId}`,
              metadata: { meetingId, finalPath },
            }),
          );
        } catch (notifyErr: any) {
          console.error(
            `[${new Date().toISOString()}] Failed to push MERGE_COMPLETE notification:`,
            notifyErr.message,
          );
        }

        await rpushQueue("TranscodeVideo", {
          meetingId,
          finalPath,
          version: "stable",
        });
      } catch (error) {
        const workerErr = toWorkerError(error);
        console.error(
          `[${new Date().toISOString()}] Merge failed for meeting ${meetingId}:`,
          {
            code: workerErr.code,
            recoverable: workerErr.recoverable,
            message: workerErr.message,
          },
        );

        // Push merge-failed notification
        try {
          const redisClient = getRedisClient();
          await redisClient.lpush(
            "Notifications",
            JSON.stringify({
              userId: meetingId,
              type: "MERGE_FAILED",
              message: `Recording merge failed for meeting ${meetingId}`,
              metadata: {
                meetingId,
                error: workerErr.message,
                errorCode: workerErr.code,
                recoverable: workerErr.recoverable,
              },
            }),
          );
        } catch (notifyErr: any) {
          console.error(
            `[${new Date().toISOString()}] Failed to push MERGE_FAILED notification:`,
            notifyErr.message,
          );
        }

        const retryCount = (data.retryCount || 0) + 1;
        if (retryCount <= MAX_RETRIES) {
          console.log(
            `[${new Date().toISOString()}] Retrying meeting ${meetingId} (attempt ${retryCount}/${MAX_RETRIES})`,
          );
          try {
            await requeueWithRetry(meetingId, retryCount);
          } catch {
            await reportWorkerStatus(meetingId, "FAILED");
          }
        } else {
          console.error(
            `[${new Date().toISOString()}] Meeting ${meetingId} permanently failed after ${MAX_RETRIES} retries`,
          );
          try {
            await reportWorkerStatus(meetingId, "FAILED");
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Redis timeout") {
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
