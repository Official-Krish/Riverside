import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "../https";
import { getStoredToken } from "../lib/auth";
import { getHttpErrorMessage } from "../lib/httpError";
import type { RecordingStatusResponse } from "@repo/types/api";
import {
  encryptMeetingChunk,
  generateMeetingCek,
  getMeetingCekStorageId,
  persistMeetingCek,
  readMeetingCek,
  wrapMeetingCek,
} from "../lib/meetingCrypto";
import { buildMeetingAudioConstraints } from "../lib/meetingAudio";

type ConnectionState =
  | "idle"
  | "loading-lib"
  | "connecting"
  | "connected"
  | "failed";

type UseMeetingRecordingArgs = {
  meetingId: string;
  roomName: string;
  authUserId: string;
  localParticipantId: string | null;
  connectionState: ConnectionState;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
  isMuted: boolean;
  isVideoOff: boolean;
  selectedMicId?: string;
  selectedCameraId?: string;
  jitsiLocalAudioTrack?: { getTrack?: () => MediaStreamTrack } | null;
};

function buildRecordingVideoConstraints(
  selectedCameraId?: string,
): MediaTrackConstraints {
  return {
    deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60 },
  };
}

export function useMeetingRecording({
  meetingId,
  roomName,
  authUserId,
  localParticipantId,
  connectionState,
  isRecording,
  setIsRecording,
  isMuted,
  isVideoOff,
  selectedMicId,
  selectedCameraId,
  jitsiLocalAudioTrack,
}: UseMeetingRecordingArgs) {
  const CHUNK_DURATION_MS = 10000;

  const [isUploadingChunks, setIsUploadingChunks] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAnimationRef = useRef<number | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const lastVideoTrackIdRef = useRef<string | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  const isMutedRef = useRef(isMuted);
  const isVideoOffRef = useRef(isVideoOff);
  const recorderStartingRef = useRef(false);
  const sequenceRef = useRef(0);
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());
  const stoppingRef = useRef(false);
  const chunkStartedAtRef = useRef<number | null>(null);
  const chunkStopTimeoutRef = useRef<number | null>(null);
  const ownedMediaTracksRef = useRef<Set<MediaStreamTrack>>(new Set());
  const jitsiLocalAudioTrackRef = useRef(jitsiLocalAudioTrack);

  useEffect(() => {
    jitsiLocalAudioTrackRef.current = jitsiLocalAudioTrack;
  }, [jitsiLocalAudioTrack]);

  const markTrackOwned = useCallback((track: MediaStreamTrack | null) => {
    if (track) {
      ownedMediaTracksRef.current.add(track);
    }
  }, []);

  const stopOwnedTracks = useCallback(() => {
    for (const track of ownedMediaTracksRef.current) {
      try {
        track.stop();
      } catch {
        // best effort
      }
    }
    ownedMediaTracksRef.current.clear();
  }, []);

  const resetRecorderSession = useCallback(() => {
    sequenceRef.current = 0;
    uploadChainRef.current = Promise.resolve();
    chunkStartedAtRef.current = null;
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
  }, []);

  const recordingStatusQuery = useQuery<RecordingStatusResponse>({
    queryKey: ["recording-status", meetingId],
    enabled: Boolean(meetingId),
    queryFn: async () => {
      const { data } = await http.get(`/recording/status/${meetingId}`);
      return data;
    },
    refetchInterval: (query) =>
      query.state.data?.recordingState === "RECORDING" ? 2000 : 3000,
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

  const enqueueChunkUpload = useCallback(
    (chunk: Blob, startedAtIso: string, durationMs: number) => {
      const meetingKey = roomName;

      if (!meetingKey) {
        return;
      }

      const nextSequence = sequenceRef.current++;

      uploadChainRef.current = uploadChainRef.current
        .then(async () => {
          if (chunk.size < 256) {
            console.warn(
              `[recording] Skipping chunk seq=${nextSequence} (${chunk.size} bytes) — too small to be valid WebM`,
            );
            return;
          }

          if (!authUserId) {
            throw new Error("User identity not loaded — cannot encrypt chunk");
          }

          const encryptedPayload = await encryptMeetingChunk({
            meetingId: roomName,
            authUserId,
            sequenceNumber: nextSequence,
            chunk,
          });

          const formData = new FormData();
          formData.append(
            "video",
            encryptedPayload.encryptedChunk,
            `chunk-${nextSequence}.enc`,
          );
          formData.append("meetingId", meetingKey);
          if (localParticipantId) {
            formData.append("participantId", localParticipantId);
          }
          formData.append("sequenceNumber", String(nextSequence));
          formData.append("startedAt", startedAtIso);
          formData.append("durationMs", String(durationMs));
          formData.append("mimeType", "application/octet-stream");
          formData.append("isEncrypted", "true");
          formData.append("sourceMimeType", encryptedPayload.sourceMimeType);
          formData.append("encryptionAlgorithm", encryptedPayload.algorithm);
          formData.append("encryptionIv", encryptedPayload.ivBase64);
          formData.append(
            "encryptionTagBits",
            String(encryptedPayload.tagBits),
          );

          const token = getStoredToken();
          const headers: Record<string, string> = {};

          if (token) {
            headers.Authorization = token.startsWith("Bearer ")
              ? token
              : `Bearer ${token}`;
          }

          await http.post("/upload-chunk", formData, {
            headers,
          });
        })
        .catch((error) => {
          setRecordingError(
            getHttpErrorMessage(
              error,
              "Failed to encrypt or upload one or more chunks.",
            ),
          );
          setIsUploadingChunks(false);
          uploadChainRef.current = Promise.resolve();
        });
    },
    [authUserId, roomName, localParticipantId],
  );

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

  const releaseRecorderResources = useCallback(() => {
    mediaRecorderRef.current = null;
    recordingStreamRef.current = null;
    processedStreamRef.current = null;
    audioTrackRef.current = null;
    chunkStartedAtRef.current = null;

    if (chunkStopTimeoutRef.current !== null) {
      window.clearTimeout(chunkStopTimeoutRef.current);
      chunkStopTimeoutRef.current = null;
    }

    stopOwnedTracks();

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
  }, [stopOwnedTracks]);

  const flushAndStopRecorder = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseRecorderResources();
      return;
    }

    if (chunkStopTimeoutRef.current !== null) {
      window.clearTimeout(chunkStopTimeoutRef.current);
      chunkStopTimeoutRef.current = null;
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };

      const handleData = (event: BlobEvent) => {
        if (!event.data || event.data.size === 0) {
          return;
        }
        const chunkEndedAt = Date.now();
        const chunkStartedAt =
          chunkStartedAtRef.current ?? chunkEndedAt - CHUNK_DURATION_MS;
        const actualDurationMs = Math.max(1, chunkEndedAt - chunkStartedAt);
        chunkStartedAtRef.current = chunkEndedAt;
        setIsUploadingChunks(true);
        enqueueChunkUpload(
          event.data,
          new Date(chunkStartedAt).toISOString(),
          actualDurationMs,
        );
      };

      recorder.addEventListener("dataavailable", handleData);
      recorder.addEventListener(
        "stop",
        () => {
          recorder.removeEventListener("dataavailable", handleData);
          finish();
        },
        { once: true },
      );

      try {
        recorder.stop();
      } catch {
        finish();
      }
    });

    releaseRecorderResources();
  }, [enqueueChunkUpload, releaseRecorderResources]);

  const waitForSharedJitsiAudioTrack = useCallback(async () => {
    const deadline = Date.now() + 8000;

    while (Date.now() < deadline) {
      const track = jitsiLocalAudioTrackRef.current?.getTrack?.() ?? null;
      if (track && track.readyState === "live") {
        return track;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return jitsiLocalAudioTrackRef.current?.getTrack?.() ?? null;
  }, []);

  const startLocalChunkRecorder = useCallback(
    async (options?: { isMuted?: boolean; isVideoOff?: boolean }) => {
      if (mediaRecorderRef.current || recorderStartingRef.current) {
        return;
      }

      recorderStartingRef.current = true;

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

        const sharedJitsiAudioTrack = await waitForSharedJitsiAudioTrack();

        const mediaConstraints: MediaStreamConstraints = {
          // Keep a real video source available even when the meeting camera is
          // currently "off" so later camera-on toggles can produce frames.
          video: buildRecordingVideoConstraints(selectedCameraId),
          // Reuse the Jitsi mic when possible — opening a second audio input
          // competes with WebRTC processing and causes echo / noise artifacts.
          audio: sharedJitsiAudioTrack
            ? false
            : buildMeetingAudioConstraints(selectedMicId, "recording"),
        };

        const stream =
          mediaConstraints.video || mediaConstraints.audio
            ? await navigator.mediaDevices.getUserMedia(mediaConstraints)
            : new MediaStream();

        recordingStreamRef.current = stream;
        stream.getTracks().forEach((track) => markTrackOwned(track));

        const recorderStream = new MediaStream();

        const rawAudioTrack =
          sharedJitsiAudioTrack ?? stream.getAudioTracks()[0] ?? null;
        if (rawAudioTrack) {
          audioTrackRef.current = rawAudioTrack;
          recorderStream.addTrack(rawAudioTrack);
          if (!sharedJitsiAudioTrack) {
            markTrackOwned(rawAudioTrack);
          }
        }

        const videoTrack = initialIsVideoOff
          ? null
          : (stream.getVideoTracks()[0] ?? null);
        const blackVideoTrack = initialIsVideoOff
          ? createBlackVideoTrack()
          : null;
        if (blackVideoTrack) {
          markTrackOwned(blackVideoTrack);
        }

        const canvas = document.createElement("canvas");
        canvasRef.current = canvas;
        const settings = videoTrack?.getSettings?.() as
          | MediaTrackSettings
          | undefined;
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
            const currentVideoTrack =
              recordingStreamRef.current?.getVideoTracks()[0] ?? null;
            if (
              currentVideoTrack &&
              lastVideoTrackIdRef.current !== currentVideoTrack.id
            ) {
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
                currentVideoTrack &&
                currentVideoTrack.readyState === "live" &&
                !currentVideoTrack.muted &&
                videoEl.readyState >= 2,
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
        const canvasVideoTrack =
          canvasStream.getVideoTracks()[0] ?? blackVideoTrack;
        if (canvasVideoTrack) {
          markTrackOwned(canvasVideoTrack);
          recorderStream.addTrack(canvasVideoTrack);
        }

        processedStreamRef.current = recorderStream;

        const startNextChunk = () => {
          if (stoppingRef.current || mediaRecorderRef.current) {
            return;
          }

          let nextRecorder: MediaRecorder;
          try {
            nextRecorder = new MediaRecorder(recorderStream, {
              mimeType: getSupportedMimeType(),
              audioBitsPerSecond: 256_000,
            });
          } catch {
            nextRecorder = new MediaRecorder(recorderStream);
          }

          nextRecorder.ondataavailable = (event) => {
            if (!event.data || event.data.size === 0) {
              return;
            }

            const chunkEndedAt = Date.now();
            const chunkStartedAt =
              chunkStartedAtRef.current ?? chunkEndedAt - CHUNK_DURATION_MS;
            const actualDurationMs = Math.max(1, chunkEndedAt - chunkStartedAt);
            chunkStartedAtRef.current = chunkEndedAt;
            setIsUploadingChunks(true);
            enqueueChunkUpload(
              event.data,
              new Date(chunkStartedAt).toISOString(),
              actualDurationMs,
            );
          };

          nextRecorder.onerror = () => {
            setRecordingError("Chunk recorder failed while capturing meeting.");
          };

          nextRecorder.onstop = async () => {
            await uploadChainRef.current;
            setIsUploadingChunks(false);

            mediaRecorderRef.current = null;

            if (!stoppingRef.current) {
              startNextChunk();
            }
          };

          mediaRecorderRef.current = nextRecorder;
          syncRecorderMediaState();
          chunkStartedAtRef.current = Date.now();

          try {
            nextRecorder.start();
          } catch (error) {
            setRecordingError("Chunk recorder failed while capturing meeting.");
            mediaRecorderRef.current = null;
            throw error;
          }

          if (chunkStopTimeoutRef.current !== null) {
            window.clearTimeout(chunkStopTimeoutRef.current);
          }
          chunkStopTimeoutRef.current = window.setTimeout(() => {
            if (nextRecorder.state === "recording") {
              try {
                nextRecorder.stop();
              } catch {
                // best effort
              }
            }
          }, CHUNK_DURATION_MS);
        };

        startNextChunk();
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
    },
    [
      enqueueChunkUpload,
      getSupportedMimeType,
      markTrackOwned,
      selectedCameraId,
      selectedMicId,
      syncRecorderMediaState,
      waitForSharedJitsiAudioTrack,
    ],
  );

  // Safe starter with retry/backoff in case permissions or audio context are not ready.
  const startLocalRecording = useCallback(
    async (opts?: {
      retries?: number;
      delayMs?: number;
      resetSession?: boolean;
    }) => {
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

          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
    },
    [resetRecorderSession, startLocalChunkRecorder],
  );

  const stopLocalChunkRecorder = useCallback(async () => {
    stoppingRef.current = true;
    await flushAndStopRecorder();
    await uploadChainRef.current;
    setIsUploadingChunks(false);
    stoppingRef.current = false;
  }, [flushAndStopRecorder]);

  const serverPublicKeyQuery = useQuery({
    queryKey: ["server-public-key"],
    queryFn: async () => {
      const { data } = await http.get<{
        algorithm: string;
        publicKey: JsonWebKey;
      }>("/keys/public");
      return data.publicKey;
    },
    staleTime: Infinity,
  });

  const uploadWrappedCekMutation = useMutation({
    mutationFn: async (wrappedCek: number[]) => {
      await http.post(`/keys/meeting/${roomName}/wrapped-cek`, {
        wrappedCek,
      });
    },
  });

  const initializeMeetingCek = useCallback(async (): Promise<void> => {
    const storageId = getMeetingCekStorageId(roomName);
    const existingCek = readMeetingCek(storageId);
    if (existingCek) {
      return;
    }

    if (!serverPublicKeyQuery.data) {
      throw new Error("Server public key not loaded");
    }

    try {
      const cek = generateMeetingCek();
      persistMeetingCek(storageId, cek);

      const wrappedCek = await wrapMeetingCek(serverPublicKeyQuery.data, cek);

      await uploadWrappedCekMutation.mutateAsync(wrappedCek);
    } catch (error) {
      console.error("Failed to initialize meeting encryption:", error);
      throw new Error("Failed to initialize encryption for recording", {
        cause: error,
      });
    }
  }, [roomName, serverPublicKeyQuery.data, uploadWrappedCekMutation]);

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
      void flushAndStopRecorder();
      setRecordingError(
        "Could not start recording. Check permissions and try again.",
      );
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
      void flushAndStopRecorder();
    };
  }, [flushAndStopRecorder]);

  useEffect(() => {
    const serverState = recordingStatusQuery.data?.recordingState;
    if (!serverState || connectionState !== "connected") {
      return;
    }

    const shouldRecord = serverState === "RECORDING";

    if (shouldRecord) {
      if (stoppingRef.current) {
        return;
      }

      if (!readMeetingCek(getMeetingCekStorageId(roomName))) {
        return;
      }

      void startLocalRecording({
        resetSession: !mediaRecorderRef.current,
      }).catch(() => {
        setRecordingError(
          "Could not start local recording. Please allow camera and microphone permission.",
        );
      });
      return;
    }

    if (mediaRecorderRef.current && !stoppingRef.current) {
      void (async () => {
        stoppingRef.current = true;
        // Grace period so the host's final chunk boundary aligns with guests.
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await stopLocalChunkRecorder();
      })();
    }
  }, [
    connectionState,
    roomName,
    recordingStatusQuery.data?.recordingState,
    startLocalRecording,
    stopLocalChunkRecorder,
  ]);

  const isRecordingBusy =
    startRecordingMutation.isPending || stopRecordingMutation.isPending;
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
    refetchRecordingStatus: recordingStatusQuery.refetch,
    hasActiveRecorder: () => Boolean(mediaRecorderRef.current),
    isMeetingEnded: Boolean(recordingStatusQuery.data?.isEnded),
  };
}
