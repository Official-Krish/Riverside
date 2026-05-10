import axios from "axios";
import { getBackendServiceToken, getBackendUrl } from "./config";

export async function reportWorkerStatus(
    meetingId: string,
    status: "PROCESSING" | "READY" | "FAILED",
    finalPath?: string
): Promise<void> {
    const backendUrl = getBackendUrl();
    try {
        await axios.request({
            url: `${backendUrl}/worker/recording-status/${meetingId}`,
            method: "POST",
            headers: {
                "x-worker-token": getBackendServiceToken(),
                "Content-Type": "application/json",
            },
            data: {
                status,
                finalPath,
            },
            timeout: 10000,
        });
    } catch (error) {
        console.error(`Failed to report status ${status} for meeting ${meetingId}:`, error);
        throw error;
    }
}