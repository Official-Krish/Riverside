import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "../https";
import type { RecordingStatusResponse } from "@repo/types/api";
import { encryptMeetingChunk } from "../lib/meetingCrypto";

type ConnectionState = "idle" | "loading-lib" | "connecting" | "connected" | "failed";

type UseMeetingRecordingArgs = {
  meetingId: string;
  roomName: string;
  localParticipantId: string | null;
  connectionState: ConnectionState;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  selectedMicId?: string;
};

function buildRecordingAudioConstraints(selectedMicId?: string): MediaTrackConstraints {
  return {
    deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
    sampleRate: 48000,
  };
}

export function useMeetingRecording({
  meetingId,
  roomName,
  localParticipantId,
  connectionState,
  isRecording,
  setIsRecording,
  selectedMicId,
}: UseMeetingRecordingArgs) {
  const CHUNK_DURATION_MS = 5000;

  const [isUploadingChunks, setIsUploadingChunks] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recorderStartingRef = useRef(false);
  const sequenceRef = useRef(0);
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());

  const recordingStatusQuery = useQuery<RecordingStatusResponse>({
    queryKey: ["recording-status", meetingId],
    enabled: Boolean(meetingId),
    queryFn: async () => {
      const { data } = await http.get(`/recording/status/${meetingId}`);
      return data;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!recordingStatusQuery.data) {
      return;
    }

    const serverState = recordingStatusQuery.data.recordingState;
    setIsRecording(serverState === "RECORDING");
  }, [recordingStatusQuery.data, setIsRecording]);

  const enqueueChunkUpload = useCallback((chunk: Blob) => {
    const meetingKey = roomName;

    if (!meetingKey) {
      return;
    }

    const nextSequence = sequenceRef.current++;
    const startedAt = new Date().toISOString();

    uploadChainRef.current = uploadChainRef.current.then(async () => {
      const participantForNonce = localParticipantId || "unknown-participant";
      const encryptedPayload = await encryptMeetingChunk({
        meetingId,
        participantId: participantForNonce,
        sequenceNumber: nextSequence,
        chunk,
      });

      const formData = new FormData();
      formData.append("video", encryptedPayload.encryptedChunk, `chunk-${nextSequence}.enc`);
      formData.append("meetingId", meetingKey);
      if (localParticipantId) {
        formData.append("participantId", localParticipantId);
      }
      formData.append("sequenceNumber", String(nextSequence));
      formData.append("startedAt", startedAt);
      formData.append("durationMs", String(CHUNK_DURATION_MS));
      formData.append("mimeType", "application/octet-stream");
      formData.append("isEncrypted", "true");
      formData.append("sourceMimeType", encryptedPayload.sourceMimeType);
      formData.append("encryptionAlgorithm", encryptedPayload.algorithm);
      formData.append("encryptionIv", encryptedPayload.ivBase64);
      formData.append("encryptionTagBits", String(encryptedPayload.tagBits));

      await http.post("/upload-chunk", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
    }).catch(() => {
      setRecordingError("Failed to encrypt or upload one or more chunks.");
      setIsUploadingChunks(false);
    });
  }, [roomName, localParticipantId, meetingId]);

  const getSupportedMimeType = useCallback(() => {
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "video/webm";
  }, []);

  const cleanupRecorder = useCallback(() => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      // best effort
    }
    mediaRecorderRef.current = null;

    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // best effort
        }
      });
      recordingStreamRef.current = null;
    }

    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // best effort
        }
      });
      processedStreamRef.current = null;
    }

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const startLocalChunkRecorder = useCallback(async () => {
    if (mediaRecorderRef.current || recorderStartingRef.current) {
      return;
    }

    recorderStartingRef.current = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Media capture is not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 60 },
        },
        audio: buildRecordingAudioConstraints(selectedMicId),
      });

      recordingStreamRef.current = stream;

      let recorderStream = stream;

      if (typeof AudioContext !== "undefined") {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch {
            // best effort
          }
        }

        if (audioContext.state === "running") {
          const source = audioContext.createMediaStreamSource(stream);
          const highPassFilter = audioContext.createBiquadFilter();
          highPassFilter.type = "highpass";
          highPassFilter.frequency.value = 90;

          const compressor = audioContext.createDynamicsCompressor();
          compressor.threshold.value = -24;
          compressor.knee.value = 18;
          compressor.ratio.value = 3;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.2;

          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.8;

          const destination = audioContext.createMediaStreamDestination();

          source.connect(highPassFilter);
          highPassFilter.connect(compressor);
          compressor.connect(gainNode);
          gainNode.connect(destination);

          const mergedStream = new MediaStream();
          stream.getVideoTracks().forEach((track) => mergedStream.addTrack(track));
          destination.stream.getAudioTracks().forEach((track) => mergedStream.addTrack(track));
          processedStreamRef.current = mergedStream;
          recorderStream = mergedStream;
        }
      }

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(recorderStream, {
          mimeType: getSupportedMimeType(),
        });
      } catch {
        recorder = new MediaRecorder(recorderStream);
      }

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }
        setIsUploadingChunks(true);
        enqueueChunkUpload(event.data);
      };

      recorder.onerror = () => {
        setRecordingError("Chunk recorder failed while capturing meeting.");
      };

      recorder.onstop = async () => {
        await uploadChainRef.current;
        setIsUploadingChunks(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(CHUNK_DURATION_MS);
    } finally {
      recorderStartingRef.current = false;
    }
  }, [enqueueChunkUpload, getSupportedMimeType, selectedMicId]);

  // Safe starter with retry/backoff in case permissions or audio context are not ready.
  const startLocalRecording = useCallback(async (opts?: { retries?: number; delayMs?: number }) => {
    const retries = opts?.retries ?? 3;
    const delayMs = opts?.delayMs ?? 500;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await startLocalChunkRecorder();
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        // wait and retry
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }, [startLocalChunkRecorder]);

  const stopLocalChunkRecorder = useCallback(async () => {
    cleanupRecorder();
    await uploadChainRef.current;
    setIsUploadingChunks(false);
  }, [cleanupRecorder]);

  const startRecordingMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/recording/start/${meetingId}`);
      sequenceRef.current = 0;
      uploadChainRef.current = Promise.resolve();
      await startLocalChunkRecorder();
    },
    onSuccess: () => {
      setRecordingError(null);
      setIsRecording(true);
      recordingStatusQuery.refetch();
    },
    onError: () => {
      cleanupRecorder();
      setRecordingError("Could not start recording. Check permissions and try again.");
      setIsRecording(false);
    },
  });

  const stopRecordingMutation = useMutation({
    mutationFn: async () => {
      await stopLocalChunkRecorder();
      await http.post(`/recording/stop/${meetingId}`);
    },
    onSuccess: () => {
      setIsRecording(false);
      recordingStatusQuery.refetch();
    },
    onError: () => {
      setRecordingError("Could not stop recording cleanly.");
    },
  });

  useEffect(() => {
    return () => {
      cleanupRecorder();
    };
  }, [cleanupRecorder]);

  useEffect(() => {
    const serverState = recordingStatusQuery.data?.recordingState;
    if (!serverState || connectionState !== "connected") {
      return;
    }

    const shouldRecord = serverState === "RECORDING";

    if (shouldRecord) {
      startLocalChunkRecorder().catch(() => {
        setRecordingError("Could not start local recording. Please allow camera and microphone permission.");
      });
      return;
    }

    if (mediaRecorderRef.current) {
      void stopLocalChunkRecorder();
    }
  }, [connectionState, recordingStatusQuery.data?.recordingState, startLocalChunkRecorder, stopLocalChunkRecorder]);

  const isRecordingBusy = startRecordingMutation.isPending || stopRecordingMutation.isPending;
  const recordingButtonLabel = stopRecordingMutation.isPending
    ? "Stopping..."
    : startRecordingMutation.isPending
      ? "Starting..."
      : isRecording
        ? "Stop recording"
        : "Start recording";

  return {
    isUploadingChunks,
    recordingError,
    startRecordingMutation,
    stopRecordingMutation,
    isRecordingBusy,
    recordingButtonLabel,
    stopLocalChunkRecorder,
    startLocalRecording,
    hasActiveRecorder: () => Boolean(mediaRecorderRef.current),
    isMeetingEnded: Boolean(recordingStatusQuery.data?.isEnded),
  };
}

