import axios from "axios";
import { getBackendServiceToken, getBackendUrl } from "./config";

export async function reportWorkerStatus(
  meetingId: string,
  status: "PROCESSING" | "READY" | "FAILED",
  finalPath?: string,
): Promise<void> {
  const backendUrl = getBackendUrl();

  let workerToken: string;
  try {
    workerToken = getBackendServiceToken();
  } catch (error) {
    console.warn(
      `[worker-status] Skipping status ${status} for ${meetingId}: worker token not configured (${error instanceof Error ? error.message : error})`,
    );
    return;
  }

  try {
    await axios.request({
      url: `${backendUrl}/worker/recording-status/${meetingId}`,
      method: "POST",
      headers: {
        "x-worker-token": workerToken,
        "Content-Type": "application/json",
      },
      data: {
        status,
        finalPath,
      },
      timeout: 10000,
      validateStatus: (code) => code >= 200 && code < 300,
    });
  } catch (error) {
    const statusCode =
      axios.isAxiosError(error) && error.response
        ? error.response.status
        : "unknown";
    console.warn(
      `[worker-status] Could not report ${status} for ${meetingId} (HTTP ${statusCode}). Check WORKER_SERVICE_JWT_SECRET matches backend.`,
    );
  }
}
