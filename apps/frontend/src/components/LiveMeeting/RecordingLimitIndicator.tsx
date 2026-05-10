import { AlertCircle, Video, Check } from "lucide-react";
import type { RecordingLimitCheckResponse } from "@repo/types/api";

interface RecordingLimitIndicatorProps {
  limit: RecordingLimitCheckResponse | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function RecordingLimitIndicator({
  limit,
  isLoading,
  isError,
}: RecordingLimitIndicatorProps) {
  if (isLoading || !limit) {
    return null;
  }

  if (isError || !limit) {
    return null;
  }

  const isLimitReached = !limit.allowed;
  const recordingsRemaining = limit.remainingRecordings;
  const isUnlimited = limit.recordingsLimit === -1;

  // Only show if not unlimited and limited
  if (isUnlimited) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-[#a8c938]">
        <Check size={14} />
        <span>Unlimited recordings</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        isLimitReached
          ? "border border-red-500/30 bg-red-950/20 text-red-400"
          : "border border-[#f5a623]/20 bg-[#1a1408]/60 text-[#f5a623]"
      }`}
    >
      {isLimitReached ? (
        <>
          <AlertCircle size={14} />
          <span>Recording limit reached</span>
        </>
      ) : (
        <>
          <Video size={14} />
          <span>
            {recordingsRemaining} of {limit.recordingsLimit} recordings left
          </span>
        </>
      )}
    </div>
  );
}
