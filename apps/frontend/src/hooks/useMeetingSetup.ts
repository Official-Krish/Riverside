import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CreateMeetingResponse, JoinMeetingResponse } from "@repo/types/api";
import { http } from "../https";
import { getHttpErrorMessage } from "../lib/httpError";
import { toast } from "sonner";
import { buildMeetingLivePath } from "../lib/meeting";

type UseMeetingSetupArgs = {
  displayNameFallback: string;
  navigate: (path: string) => void;
};

function buildPreviewAudioConstraints(selectedMicId: string): MediaTrackConstraints | boolean {
  return {
    deviceId: selectedMicId ? { exact: selectedMicId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48000 },
  };
}

function buildPreviewVideoConstraints(selectedCameraId: string): MediaTrackConstraints | boolean {
  return {
    deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, max: 60 },
    aspectRatio: { ideal: 16 / 9 },
  };
}

export function useMeetingSetup({ displayNameFallback, navigate }: UseMeetingSetupArgs) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const monitorAudioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const micMonitorEnabledRef = useRef(false);

  const [mode, setMode] = useState<"create" | "join">("create");
  const [createRoomName, setCreateRoomName] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");
  const [joinMeetingId, setJoinMeetingId] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [selectedMicId, setSelectedMicId] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [micMonitorEnabled, setMicMonitorEnabled] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    micMonitorEnabledRef.current = micMonitorEnabled;
  }, [micMonitorEnabled]);

  const syncMonitorAudio = async () => {
    const audioElement = monitorAudioRef.current;
    const currentStream = streamRef.current;

    if (!audioElement || !currentStream) {
      return;
    }

    if (!micMonitorEnabledRef.current) {
      audioElement.pause();
      audioElement.srcObject = null;
      return;
    }

    audioElement.srcObject = currentStream;

    try {
      await audioElement.play();
    } catch {
      // Playback can be blocked until the user interacts with the page.
    }
  };

  const getNormalizedInviteEmail = () => inviteEmail.trim().toLowerCase();

  const addInvite = () => {
    const email = getNormalizedInviteEmail();
    if (!email || !email.includes("@") || invites.includes(email)) {
      return;
    }
    setInvites((current) => [...current, email]);
    setInviteEmail("");
  };

  const removeInvite = (email: string) => {
    setInvites((current) => current.filter((item) => item !== email));
  };

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPreviewError("Media device APIs are not available in this browser.");
      return;
    }

    let mounted = true;
    let stream: MediaStream | null = null;

    const stopAudioMeter = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };

    const loadPreview = async () => {
      try {
        setPreviewError(null);
        setMicLevel(0);
        stopAudioMeter();
        stream = await navigator.mediaDevices.getUserMedia({
          video: buildPreviewVideoConstraints(selectedCameraId),
          audio: buildPreviewAudioConstraints(selectedMicId),
        });

        streamRef.current = stream;

        if (mounted && videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (mounted) {
          void syncMonitorAudio();
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const microphones = devices.filter((device) => device.kind === "audioinput");

        if (mounted) {
          setCameraDevices(cameras);
          setMicDevices(microphones);

          if (!selectedCameraId && cameras[0]?.deviceId) {
            setSelectedCameraId(cameras[0].deviceId);
          }
          if (!selectedMicId && microphones[0]?.deviceId) {
            setSelectedMicId(microphones[0].deviceId);
          }
        }

        const audioTracks = stream.getAudioTracks();
        if (mounted && audioTracks.length > 0 && typeof AudioContext !== "undefined") {
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          if (audioContext.state === "suspended") {
            try {
              await audioContext.resume();
            } catch {
              // best effort
            }
          }

          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256; // Smaller FFT for more responsive meter
          analyser.smoothingTimeConstant = 0.8; // Slightly less smoothing for responsiveness
          source.connect(analyser);

          const timeDomainData = new Float32Array(analyser.fftSize);

          const updateMicLevel = () => {
            if (!mounted) {
              return;
            }

            analyser.getFloatTimeDomainData(timeDomainData);
            
            // Find peak (max absolute value) - matches Chrome's behavior
            let peak = 0;
            for (let i = 0; i < timeDomainData.length; i++) {
              const value = Math.abs(timeDomainData[i]);
              if (value > peak) {
                peak = value;
              }
            }
            let levelDb: number;
            if (peak > 0) {
              levelDb = 20 * Math.log10(peak);
            } else {
              levelDb = -96; // Represent silence
            }

            const normalizedLevel = Math.min(
              100,
              Math.max(0, Math.round(((levelDb + 40) / 40) * 100))
            );
            
            setMicLevel(normalizedLevel);
            animationFrameRef.current = requestAnimationFrame(updateMicLevel);
          };

          updateMicLevel();
        }
      } catch {
        if (mounted) {
          setPreviewError("Could not access camera/microphone for preview.");
          setMicLevel(0);
        }
      }
    };

    void loadPreview();

    return () => {
      mounted = false;
      stopAudioMeter();

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (monitorAudioRef.current) {
        monitorAudioRef.current.pause();
        monitorAudioRef.current.srcObject = null;
      }

      streamRef.current = null;
    };
  }, [selectedCameraId, selectedMicId]);

  useEffect(() => {
    void syncMonitorAudio();
  }, [micMonitorEnabled]);

  const createMeetingMutation = useMutation({
    mutationFn: async (invitedParticipants: string[]) => {
      const response = await http.post<CreateMeetingResponse>("/meeting/create", {
        roomName: createRoomName,
        passcode: createPasscode || undefined,
        invitedParticipants,
      });

      return response.data;
    },
    onSuccess: (data) => {
      navigate(
        buildMeetingLivePath({
          roomId: data.roomId,
          name: data.name || displayNameFallback || "Host",
          role: "host",
          micId: selectedMicId,
          cameraId: selectedCameraId,
        })
      );
    },
    onError: (error) => {
      setErrorMessage(
        getHttpErrorMessage(error, "Could not create the meeting. Please try again.")
      );
    },
  });

  const joinMeetingMutation = useMutation({
    mutationFn: async () => {
      const response = await http.post<JoinMeetingResponse>(
        `/meeting/join/${joinMeetingId}`,
        {
          passcode: joinPasscode || undefined,
        }
      );

      return response.data;
    },
    onSuccess: (data) => {
      const host = data.isHost ? "host" : "guest";
      const recordingState = data.recordingState == "RECORDING";
      navigate(
        buildMeetingLivePath({
          roomId: data.roomId,
          name: displayNameFallback || "Guest",
          role: host,
          recordingState,
          micId: selectedMicId,
          cameraId: selectedCameraId,
        })
      );
    },
    onError: (error) => {
      toast.error(
        getHttpErrorMessage(error, "Could not join the meeting. Check the meeting ID and passcode.")
      );
      setErrorMessage(
        getHttpErrorMessage(
          error,
          "Could not join the meeting. Check the meeting ID and passcode."
        )
      );
    },
  });

  const isBusy = createMeetingMutation.isPending || joinMeetingMutation.isPending;

  const busyLabel = useMemo(() => {
    if (createMeetingMutation.isPending) {
      return "Creating room...";
    }
    if (joinMeetingMutation.isPending) {
      return "Joining room...";
    }
    return null;
  }, [createMeetingMutation.isPending, joinMeetingMutation.isPending]);

  const submitCreate = () => {
    const pendingInvite = getNormalizedInviteEmail();
    const nextInvites =
      pendingInvite && pendingInvite.includes("@") && !invites.includes(pendingInvite)
        ? [...invites, pendingInvite]
        : invites;

    if (nextInvites.length !== invites.length) {
      setInvites(nextInvites);
      setInviteEmail("");
    }
    setErrorMessage(null);
    createMeetingMutation.mutate(nextInvites);
  };

  const submitJoin = () => {
    setErrorMessage(null);
    joinMeetingMutation.mutate();
  };

  const toggleMicMonitor = () => {
    setMicMonitorEnabled((current) => !current);
  };

  return {
    videoRef,
    monitorAudioRef,
    mode,
    setMode,
    createRoomName,
    setCreateRoomName,
    createPasscode,
    setCreatePasscode,
    joinMeetingId,
    setJoinMeetingId,
    joinPasscode,
    setJoinPasscode,
    inviteEmail,
    setInviteEmail,
    invites,
    cameraDevices,
    micDevices,
    selectedCameraId,
    setSelectedCameraId,
    selectedMicId,
    setSelectedMicId,
    micLevel,
    micMonitorEnabled,
    toggleMicMonitor,
    previewError,
    errorMessage,
    setErrorMessage,
    addInvite,
    removeInvite,
    createMeetingMutation,
    joinMeetingMutation,
    isBusy,
    busyLabel,
    submitCreate,
    submitJoin,
  };
}
