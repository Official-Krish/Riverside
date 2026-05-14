import { blpopQueue, rpushQueue } from "./redis";
import { LocalVideoMerger } from "./merger";
import { reportWorkerStatus } from "./worker-status";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

interface QueuePayload {
    roomId?: string;
    meetingId?: string;
    retryCount?: number;
}

async function requeueWithRetry(meetingId: string, retryCount: number): Promise<void> {
    const delay = RETRY_DELAY_MS * retryCount;
    await new Promise(resolve => setTimeout(resolve, delay));

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

                await rpushQueue("TranscodeVideo", { meetingId, finalPath, version: "stable" });
            } catch (error) {
                const retryCount = (data.retryCount || 0) + 1;
                if (retryCount <= MAX_RETRIES) {
                    try {
                        await requeueWithRetry(meetingId, retryCount);
                    } catch {
                        await reportWorkerStatus(meetingId, "FAILED");
                    }
                } else {
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
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}