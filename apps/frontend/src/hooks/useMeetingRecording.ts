import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "../https";
import type { RecordingStatusResponse } from "@repo/types/api";
import { encryptMeetingChunk, generateMeetingCek, persistMeetingCek, readMeetingCek, wrapMeetingCek } from "../lib/meetingCrypto";

type ConnectionState = "idle" | "loading-lib" | "connecting" | "connected" | "failed";

type UseMeetingRecordingArgs = {
  meetingId: string;
  roomName: string;
  localParticipantId: string | null;
  connectionState: ConnectionState;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  isMuted: boolean;
  isVideoOff: boolean;
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
  isMuted,
  isVideoOff,
  selectedMicId,
}: UseMeetingRecordingArgs) {
  const CHUNK_DURATION_MS = 5000;

  const [isUploadingChunks, setIsUploadingChunks] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAnimationRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const lastVideoTrackIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const recorderStartingRef = useRef(false);
  const sequenceRef = useRef(0);
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());

  const resetRecorderSession = useCallback(() => {
    sequenceRef.current = 0;
    uploadChainRef.current = Promise.resolve();
    setRecordingError(null);
    setIsUploadingChunks(false);
  }, []);

  const syncRecorderMediaState = useCallback(() => {
    if (!mediaRecorderRef.current) {
      return;
    }

    const audioTrack = audioTrackRef.current;
    if (audioTrack) {
      audioTrack.enabled = !isMutedRef.current;
    }

    const audioContext = audioContextRef.current;
    const gainNode = audioGainRef.current;
    if (audioContext && gainNode) {
      const targetGain = isMutedRef.current ? 0 : 1.8;
      try {
        gainNode.gain.setTargetAtTime(targetGain, audioContext.currentTime, 0.01);
      } catch {
        gainNode.gain.value = targetGain;
      }
    }
  }, []);

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

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (mediaRecorderRef.current) {
      syncRecorderMediaState();
    }
  }, [isMuted, syncRecorderMediaState]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
    if (mediaRecorderRef.current) {
      syncRecorderMediaState();
    }
  }, [isVideoOff, syncRecorderMediaState]);

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
    audioTrackRef.current = null;
    audioGainRef.current = null;

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

    // stop canvas animation if present
    if (canvasAnimationRef.current) {
      cancelAnimationFrame(canvasAnimationRef.current);
      canvasAnimationRef.current = null;
    }

    if (videoElementRef.current) {
      try {
        videoElementRef.current.pause();
        videoElementRef.current.srcObject = null;
      } catch {
        // best effort
      }
      videoElementRef.current = null;
    }

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const startLocalChunkRecorder = useCallback(async (options?: { isMuted?: boolean; isVideoOff?: boolean }) => {
    if (mediaRecorderRef.current || recorderStartingRef.current) {
      return;
    }

    recorderStartingRef.current = true;

    const initialIsMuted = options?.isMuted ?? isMutedRef.current;
    const initialIsVideoOff = options?.isVideoOff ?? isVideoOffRef.current;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Media capture is not supported in this browser");
      }

      const createBlackVideoTrack = () => {
        const canvas = document.createElement("canvas");
        canvasRef.current = canvas;
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        return canvas.captureStream(60).getVideoTracks()[0] ?? null;
      };

      const createSilentAudioTrack = async () => {
        if (typeof AudioContext === "undefined") {
          return null;
        }

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch {
            // best effort
          }
        }

        const destination = audioContext.createMediaStreamDestination();
        const oscillator = audioContext.createOscillator();
        const silence = audioContext.createGain();
        silence.gain.value = 0;
        oscillator.connect(silence);
        silence.connect(destination);
        oscillator.start();

        const silentAudioTrack = destination.stream.getAudioTracks()[0] ?? null;
        if (silentAudioTrack) {
          audioTrackRef.current = silentAudioTrack;
        }
        return silentAudioTrack;
      };

      const mediaConstraints: MediaStreamConstraints = {
        video: initialIsVideoOff
          ? false
          : {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 60 },
            },
        audio: initialIsMuted ? false : buildRecordingAudioConstraints(selectedMicId),
      };

      const stream =
        mediaConstraints.video || mediaConstraints.audio
          ? await navigator.mediaDevices.getUserMedia(mediaConstraints)
          : new MediaStream();

      recordingStreamRef.current = stream;

      let recorderStream = new MediaStream();

      const audioContext = typeof AudioContext !== "undefined" ? new AudioContext() : null;
      if (audioContext) {
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          try {
            await audioContext.resume();
          } catch {
            // best effort
          }
        }

        if (audioContext.state === "running" && !initialIsMuted) {
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
          audioGainRef.current = gainNode;

          const destination = audioContext.createMediaStreamDestination();

          source.connect(highPassFilter);
          highPassFilter.connect(compressor);
          compressor.connect(gainNode);
          gainNode.connect(destination);

          const audioOutTrack = destination.stream.getAudioTracks()[0] ?? null;
          if (audioOutTrack) {
            audioTrackRef.current = audioOutTrack;
            // Add the processed audio output into the recorder stream
            // so the MediaRecorder receives the audio from the AudioContext graph.
            recorderStream.addTrack(audioOutTrack);
          }
        } else {
          const silentAudioTrack = await createSilentAudioTrack();
          if (silentAudioTrack) {
            recorderStream.addTrack(silentAudioTrack);
          }
        }
      }

      const videoTrack = initialIsVideoOff ? null : stream.getVideoTracks()[0] ?? null;
      const blackVideoTrack = initialIsVideoOff ? createBlackVideoTrack() : null;

      const canvas = document.createElement("canvas");
      canvasRef.current = canvas;
      const settings = videoTrack?.getSettings?.() as any | undefined;
      const width = settings?.width ?? 1280;
      const height = settings?.height ?? 720;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      const videoEl = document.createElement("video");
      videoEl.autoplay = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoElementRef.current = videoEl;

      if (videoTrack) {
        lastVideoTrackIdRef.current = videoTrack.id;
        videoEl.srcObject = new MediaStream([videoTrack]);
        void videoEl.play().catch(() => {});
      }

      function drawFrame() {
        try {
          const currentVideoTrack = recordingStreamRef.current?.getVideoTracks()[0] ?? null;
          if (currentVideoTrack && lastVideoTrackIdRef.current !== currentVideoTrack.id) {
            lastVideoTrackIdRef.current = currentVideoTrack.id;
            try {
              videoEl.srcObject = new MediaStream([currentVideoTrack]);
              void videoEl.play().catch(() => {});
            } catch {
              // best effort
            }
          }

          const shouldShowVideo = Boolean(
            !isVideoOffRef.current &&
            (videoTrack || currentVideoTrack) &&
            videoEl.readyState >= 2
          );

          if (shouldShowVideo) {
            ctx?.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          } else {
            ctx?.fillRect(0, 0, canvas.width, canvas.height);
            if (ctx) {
              ctx.fillStyle = "black";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
          }
        } catch {
          if (ctx) {
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }

        canvasAnimationRef.current = requestAnimationFrame(drawFrame);
      }

      canvasAnimationRef.current = requestAnimationFrame(drawFrame);

      const canvasStream = canvas.captureStream(60);
      const canvasVideoTrack = canvasStream.getVideoTracks()[0] ?? blackVideoTrack;
      if (canvasVideoTrack) {
        recorderStream.addTrack(canvasVideoTrack);
      }

      processedStreamRef.current = recorderStream;

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
      syncRecorderMediaState();
      recorder.start(CHUNK_DURATION_MS);
    } catch (err) {
      // Ensure the transient starting flag is cleared on error so callers
      // (which may implement retry/backoff) can attempt to start again.
      recorderStartingRef.current = false;
      throw err;
    } finally {
      // Clear the transient starting flag; `mediaRecorderRef` remains the
      // authoritative guard for whether recording is active.
      recorderStartingRef.current = false;
    }
  }, [enqueueChunkUpload, getSupportedMimeType, selectedMicId, syncRecorderMediaState]);

  // Safe starter with retry/backoff in case permissions or audio context are not ready.
  const startLocalRecording = useCallback(async (opts?: { retries?: number; delayMs?: number; resetSession?: boolean }) => {
    const retries = opts?.retries ?? 3;
    const delayMs = opts?.delayMs ?? 500;
    const resetSession = opts?.resetSession ?? false;
    const initialIsMuted = isMutedRef.current;
    const initialIsVideoOff = isVideoOffRef.current;

    if (resetSession) {
      resetRecorderSession();
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await startLocalChunkRecorder({
          isMuted: initialIsMuted,
          isVideoOff: initialIsVideoOff,
        });
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        // wait and retry
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }, [resetRecorderSession, startLocalChunkRecorder]);

  const stopLocalChunkRecorder = useCallback(async () => {
    cleanupRecorder();
    await uploadChainRef.current;
    setIsUploadingChunks(false);
  }, [cleanupRecorder]);

  const serverPublicKeyQuery = useQuery({
    queryKey: ["server-public-key"],
    queryFn: async () => {
      const { data } = await http.get<{ algorithm: string; publicKey: JsonWebKey }>("/keys/public");
      return data.publicKey;
    },
    staleTime: Infinity,
  });

  const uploadWrappedCekMutation = useMutation({
    mutationFn: async (wrappedCek: number[]) => {
      await http.post(`/keys/meeting/${meetingId}/wrapped-cek`, {
        wrappedCek,
      });
    },
  });

  const initializeMeetingCek = useCallback(async (): Promise<void> => {
    const existingCek = readMeetingCek(meetingId);
    if (existingCek) {
      return;
    }

    if (!serverPublicKeyQuery.data) {
      throw new Error("Server public key not loaded");
    }

    try {
      const cek = generateMeetingCek();
      persistMeetingCek(meetingId, cek);

      const wrappedCek = await wrapMeetingCek(serverPublicKeyQuery.data, cek);

      await uploadWrappedCekMutation.mutateAsync(wrappedCek);
    } catch (error) {
      console.error("Failed to initialize meeting encryption:", error);
      throw new Error("Failed to initialize encryption for recording");
    }
  }, [meetingId, serverPublicKeyQuery.data, uploadWrappedCekMutation]);

  const startRecordingMutation = useMutation({
    mutationFn: async () => {
      await initializeMeetingCek();
      await http.post(`/recording/start/${meetingId}`);
      await startLocalRecording({ resetSession: true });
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
      void startLocalRecording({ resetSession: !mediaRecorderRef.current }).catch(() => {
        setRecordingError("Could not start local recording. Please allow camera and microphone permission.");
      });
      return;
    }

    if (mediaRecorderRef.current) {
      void (async () => {
        await stopLocalChunkRecorder();
      })();
    }
  }, [connectionState, recordingStatusQuery.data?.recordingState, startLocalRecording, stopLocalChunkRecorder]);

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

