import { useQuery } from "@tanstack/react-query";
import { http } from "../https";
import type { RecordingLimitCheckResponse } from "@repo/types/api";

export function useRecordingLimit() {
  return useQuery({
    queryKey: ["recordingLimit"],
    queryFn: async () => {
      const response = await http.get<RecordingLimitCheckResponse>("/recording/limit/check");
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 1,
  });
}
