/**
 * Shared getUserMedia audio constraints for meetings.
 *
 * Conference profile disables AGC (common source of pumping / background swell)
 * and enables Chromium-specific processing when available.
 */
export type MeetingAudioProfile = "conference" | "preview" | "recording";

export function buildMeetingAudioConstraints(
  selectedMicId?: string,
  profile: MeetingAudioProfile = "conference",
): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    // AGC often amplifies room noise and causes audible "breathing" artifacts.
    autoGainControl: { ideal: false },
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  };

  if (profile === "recording") {
    return base;
  }

  // conference + preview: stronger echo/noise handling for live calls
  return {
    ...base,
    ...({
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: false,
      googHighpassFilter: true,
      googTypingNoiseDetection: true,
    } as MediaTrackConstraints),
  };
}
