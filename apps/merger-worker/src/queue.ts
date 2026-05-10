import { blpopQueue, rpushQueue } from "./redis";
import { LocalVideoMerger } from "./merger";
import { reportWorkerStatus } from "./worker-status";

interface QueuePayload {
    roomId?: string;
    meetingId?: string;
}

export async function processQueue(): Promise<void> {
    console.log("Starting merger-worker queue processor...");

    while (true) {
        let meetingId: string | null = null;
        try {
            const result = await blpopQueue("ProcessVideo", 35);

            if (!result) {
                console.log(`[${new Date().toISOString()}] No result from queue`);
                continue;
            }

            const data: QueuePayload = JSON.parse(result);
            meetingId = data.roomId ?? data.meetingId ?? null;

            if (!meetingId) {
                console.error(`[${new Date().toISOString()}] Invalid queue payload: missing meetingId - ${JSON.stringify(data)}`);
                continue;
            }

            try {
                console.log(`[${new Date().toISOString()}] Starting merge for meeting ${meetingId}...`);
                await reportWorkerStatus(meetingId, "PROCESSING");
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Failed to report PROCESSING status:`, error);
            }

            try {
                const merger = new LocalVideoMerger(meetingId);
                const finalPath = await merger.process();

                await rpushQueue("TranscodeVideo", { meetingId, finalPath });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Merge failed for ${meetingId}:`, error);
                try {
                    await reportWorkerStatus(meetingId, "FAILED");
                } catch (statusError) {
                    console.error(`[${new Date().toISOString()}] Failed to report FAILED status:`, statusError);
                }
            }
        } catch (error) {
            if (error instanceof Error && error.message === "Redis timeout") {
                console.log(`[${new Date().toISOString()}] Queue timeout (normal), waiting for next job...`);
                continue;
            }
            console.error(`[${new Date().toISOString()}] Queue loop error:`, error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}