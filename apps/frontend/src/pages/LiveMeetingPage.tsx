import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { AudioTrackSink } from "../components/LiveMeeting/AudioTrackSink";
import { MeetingAlerts } from "../components/LiveMeeting/MeetingAlerts";
import { MeetingChatSidebar } from "../components/LiveMeeting/MeetingChatSidebar";
import { MeetingControls } from "../components/LiveMeeting/MeetingControls";
import { MeetingInfo } from "../components/LiveMeeting/MeetingInfo";
import { RecordingIndicator } from "../components/LiveMeeting/RecordingIndicator";
import { RecordingLimitIndicator } from "../components/LiveMeeting/RecordingLimitIndicator";
import { MeetingStage } from "../components/LiveMeeting/MeetingStage";
import { ParticipantsSidebar } from "../components/LiveMeeting/ParticipantsSidebar";
import { useMeetingRealtime } from "../hooks/useMeetingRealtime";
import { useMeetingRecording } from "../hooks/useMeetingRecording";
import { useMeetingRoom } from "../hooks/useMeetingRoom";
import { useRecordingLimit } from "../hooks/useRecordingLimit";
import { http } from "../https";
import {
  generateMeetingCek,
  persistMeetingCek,
  wrapMeetingCek,
} from "../lib/meetingCrypto";
import { getParticipantMediaState } from "../lib/participantMediaState";
import { getHttpErrorMessage } from "../lib/httpError";
import type {
  FocusedTiles,
  MeetingConnectionState,
  MeetingParticipantState,
  MeetingTile,
  RemoteAudioTrackItem,
} from "../types/meeting";
import type {
  JoinMeetingResponse,
  RegisterWrappedCekResponse,
  ServerPublicKeyResponse,
} from "@repo/types/api";

export function LiveMeetingPage() {
  const { meetingId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const endingRef = useRef(false);
  const initialRecordingStartedRef = useRef(false);

  const displayName = searchParams.get("name") || "Guest";
  const isHost = searchParams.get("role") === "host";
  const passcode = searchParams.get("passcode") || "";
  const roomName = useMemo(() => meetingId.trim(), [meetingId]);
  const initialRecordingState = searchParams.get("recordingState") === "true";
  const selectedMicId = searchParams.get("micId") || "";
  const selectedCameraId = searchParams.get("cameraId") || "";

  const wrappedCekMutation = useMutation<
    RegisterWrappedCekResponse,
    unknown,
    void
  >({
    mutationFn: async () => {
      const publicKeyResponse =
        await http.get<ServerPublicKeyResponse>("/keys/public");
      const cek = generateMeetingCek();
      persistMeetingCek(roomName, cek);

      const wrappedCek = await wrapMeetingCek(
        publicKeyResponse.data.publicKey,
        cek,
      );
      const response = await http.post<RegisterWrappedCekResponse>(
        `/keys/meeting/${meetingId}/wrapped-cek`,
        {
          wrappedCek,
        },
      );

      return response.data;
    },
  });

  const joinMutation = useMutation<
    JoinMeetingResponse,
    unknown,
    { passcode?: string } | undefined
  >({
    mutationFn: async (vars) => {
      const res = await http.post<JoinMeetingResponse>(
        `/meeting/join/${meetingId}`,
        {
          passcode: vars?.passcode || undefined,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      wrappedCekMutation.mutate();
    },
  });

  useEffect(() => {
    if (!meetingId) return;
    joinMutation.mutate({ passcode: passcode || undefined });
  }, [meetingId]);

  const {
    connectionState,
    error,
    localVideoTrack,
    localScreenTrack,
    participants,
    isMuted,
    isVideoOff,
    isScreenSharing,
    isRecording,
    setIsRecording,
    localParticipantId,
    isSidebarOpen,
    setIsSidebarOpen,
    activeLayout,
    setActiveLayout,
    selectedParticipantId,
    setSelectedParticipantId,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveRoom,
  } = useMeetingRoom({
    meetingId: roomName,
    displayName,
    selectedCameraId,
    selectedMicId,
    enabled:
      joinMutation.status === "success" &&
      wrappedCekMutation.status === "success",
  });

  const {
    isUploadingChunks,
    recordingError,
    startRecordingMutation,
    stopRecordingMutation,
    isRecordingBusy,
    recordingButtonLabel,
    stopLocalChunkRecorder,
    startLocalRecording,
    hasActiveRecorder,
    isMeetingEnded,
  } = useMeetingRecording({
    meetingId,
    roomName,
    localParticipantId,
    connectionState,
    isRecording,
    setIsRecording,
    isMuted,
    isVideoOff,
    selectedMicId,
  });

  const {
    data: recordingLimitData,
    isLoading: recordingLimitLoading,
    isError: recordingLimitError,
  } = useRecordingLimit();

  const {
    chatMessages,
    typingNames,
    unreadCount,
    sendChatMessage,
    setTyping,
    sendMeetingEnded,
    sendRecordingState,
    sendMediaState,
    participantMediaStates,
    reactions,
    participantNamesById,
    sendReaction,
  } = useMeetingRealtime({
    roomId: roomName,
    displayName,
    participantId: localParticipantId,
    isHost,
    enabled: Boolean(localParticipantId),
    localMediaState: {
      isMuted,
      isVideoOff,
    },
    onRemoteRecordingState: (remoteIsRecording) => {
      setIsRecording(remoteIsRecording);

      // If server signalled recording start/stop, start/stop local recorder immediately for non-hosts.
      if (!isHost) {
        if (remoteIsRecording) {
          void startLocalRecording?.().catch(() => {
            // best-effort: notify user

            console.warn("Failed to start local recording on signal");
          });
        } else {
          void stopLocalChunkRecorder();
        }
      }
    },
    onParticipantJoined: (participant) => {
      toast.success(`${participant.displayName} joined the meeting`);
    },
    onParticipantLeft: (participant) => {
      toast(`${participant.displayName} left the meeting`);
    },
    onMeetingEnded: ({ displayName: endedBy }) => {
      if (isHost) {
        return;
      }

      if (endingRef.current) {
        return;
      }

      toast.error(`Meeting ended by ${endedBy}`);
      void handleRemoteMeetingEnded();
    },
    isChatOpen,
  });

  useEffect(() => {
    if (!localParticipantId) {
      return;
    }

    sendMediaState({
      isMuted,
      isVideoOff,
    });
  }, [isMuted, isVideoOff, localParticipantId, sendMediaState]);

  useEffect(() => {
    if (!initialRecordingState || initialRecordingStartedRef.current) {
      return;
    }

    initialRecordingStartedRef.current = true;
    toast("This meeting is currently being recorded", {
      description:
        "Please be aware that your audio and video may be recorded during this meeting.",
      duration: 4000,
    });

    if (isHost) {
      startRecordingMutation.mutate(undefined, {
        onSuccess: () => {
          sendRecordingState(true);
        },
      });
    } else {
      void startLocalRecording({ resetSession: true }).then(() => {
        sendRecordingState(true);
      });
    }
  }, [
    initialRecordingState,
    sendRecordingState,
    startRecordingMutation,
    startLocalRecording,
    isHost,
  ]);

  const allTiles = useMemo<MeetingTile[]>(() => {
    const remoteTiles = participants.flatMap((participant) => {
      const cameraTrack =
        participant.tracks.find(
          (track) =>
            track.getType?.() === "video" &&
            track.getVideoType?.() !== "desktop",
        ) || null;
      const screenTrack =
        participant.tracks.find(
          (track) =>
            track.getType?.() === "video" &&
            track.getVideoType?.() === "desktop",
        ) || null;

      const participantName = participant.displayName || participant.id;
      const mediaState = getParticipantMediaState(
        participantMediaStates,
        participant.id,
        {
          isMuted: false,
          isVideoOff: !cameraTrack,
        },
      );

      const tiles = [
        {
          id: participant.id,
          title: participantName,
          subtitle: "Remote participant",
          track: cameraTrack,
          participantId: participant.id,
          isMuted: mediaState.isMuted,
          isVideoOff: mediaState.isVideoOff,
          isScreenSharing: Boolean(screenTrack),
          isLocal: false,
        },
      ];

      if (screenTrack) {
        tiles.push({
          id: `${participant.id}-screen`,
          title: `${participantName} screen`,
          subtitle: "Screen share",
          track: screenTrack,
          participantId: participant.id,
          isMuted: mediaState.isMuted,
          isVideoOff: false,
          isScreenSharing: true,
          isLocal: false,
        });
      }

      return tiles;
    });

    const tiles = [
      {
        id: "local",
        title: displayName,
        subtitle: "You",
        track: localVideoTrack,
        participantId: "local",
        isMuted,
        isVideoOff,
        isScreenSharing,
        isLocal: true,
      },
    ];

    if (localScreenTrack) {
      tiles.push({
        id: "local-screen",
        title: `${displayName} screen`,
        subtitle: "Your screen share",
        track: localScreenTrack,
        participantId: "local",
        isMuted,
        isVideoOff: false,
        isScreenSharing: true,
        isLocal: true,
      });
    }

    return [...tiles, ...remoteTiles];
  }, [
    displayName,
    isMuted,
    isScreenSharing,
    isVideoOff,
    localScreenTrack,
    localVideoTrack,
    participantMediaStates,
    participants,
  ]);

  const remoteAudioTracks = useMemo<RemoteAudioTrackItem[]>(
    () =>
      participants
        .map((participant) => {
          const mediaState = getParticipantMediaState(
            participantMediaStates,
            participant.id,
          );
          return {
            id: participant.id,
            track: mediaState.isMuted
              ? null
              : participant.tracks.find(
                  (track) => track.getType?.() === "audio",
                ) || null,
          };
        })
        .filter((item) => item.track),
    [participantMediaStates, participants],
  );

  const participantList = useMemo<MeetingParticipantState[]>(() => {
    const remoteParticipants = participants.map((participant) => {
      const cameraTrack =
        participant.tracks.find(
          (track) =>
            track.getType?.() === "video" &&
            track.getVideoType?.() !== "desktop",
        ) || null;
      const screenTrack =
        participant.tracks.find(
          (track) =>
            track.getType?.() === "video" &&
            track.getVideoType?.() === "desktop",
        ) || null;
      const mediaState = getParticipantMediaState(
        participantMediaStates,
        participant.id,
        {
          isMuted: false,
          isVideoOff: !cameraTrack,
        },
      );

      return {
        id: participant.id,
        name: participant.displayName || participant.id,
        isMuted: mediaState.isMuted,
        isVideoOff: mediaState.isVideoOff,
        isScreenSharing: Boolean(screenTrack),
      };
    });

    return [
      {
        id: "local",
        name: displayName,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isLocal: true,
      },
      ...remoteParticipants,
    ];
  }, [
    displayName,
    isMuted,
    isScreenSharing,
    isVideoOff,
    participantMediaStates,
    participants,
  ]);

  const focusedTiles = useMemo<FocusedTiles | null>(() => {
    if (activeLayout !== "focus" || !selectedParticipantId) {
      return null;
    }

    const selected = allTiles.find((tile) => tile.id === selectedParticipantId);
    if (!selected) {
      return null;
    }

    return {
      selected,
      others: allTiles.filter((tile) => tile.id !== selectedParticipantId),
    };
  }, [activeLayout, allTiles, selectedParticipantId]);

  const endMeetingMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/meeting/end/${meetingId}`);
    },
    onSettled: () => {
      navigate("/dashboard");
    },
  });

  const handleExit = async () => {
    if (!meetingId || ending) {
      return;
    }

    setEnding(true);

    if (isRecording && isHost) {
      try {
        await stopRecordingMutation.mutateAsync();
        sendRecordingState(false);
      } catch {
        // best effort
      }
    }

    if (!isHost && hasActiveRecorder()) {
      await stopLocalChunkRecorder();
    }

    leaveRoom();

    navigate("/dashboard");
  };

  const handleRemoteMeetingEnded = useCallback(async () => {
    if (endingRef.current) {
      return;
    }

    setEnding(true);

    if (hasActiveRecorder()) {
      await stopLocalChunkRecorder();
    }

    leaveRoom();
    navigate("/dashboard");
  }, [hasActiveRecorder, leaveRoom, navigate, stopLocalChunkRecorder]);

  useEffect(() => {
    if (!isMeetingEnded || ending) {
      return;
    }

    if (!isHost) {
      toast.error("Meeting ended by the host");
      void handleRemoteMeetingEnded();
      return;
    }

    setEnding(true);
    leaveRoom();
    navigate("/dashboard");
  }, [
    ending,
    handleRemoteMeetingEnded,
    isHost,
    isMeetingEnded,
    leaveRoom,
    navigate,
  ]);

  const handleEndForAll = async () => {
    if (!isHost || !meetingId || ending) {
      return;
    }

    setEnding(true);

    if (isRecording) {
      try {
        await stopRecordingMutation.mutateAsync();
        sendRecordingState(false);
      } catch {
        // best effort
      }
    }

    sendMeetingEnded();
    leaveRoom();
    toast.success("Meeting ended for all participants");
    await endMeetingMutation.mutateAsync();
  };

  useEffect(() => {
    const handleShortcutKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) ||
          Boolean(target.closest("a,button,[role='button']")))
      ) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "m") {
        event.preventDefault();
        void toggleAudio();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        void toggleVideo();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        void toggleScreenShare();
        return;
      }

      if (key === "l") {
        event.preventDefault();
        setActiveLayout((current) => {
          if (current === "focus") {
            setSelectedParticipantId(null);
            return "grid";
          }

          setSelectedParticipantId(allTiles[0]?.id ?? null);
          return "focus";
        });
        return;
      }

      if (key === "u") {
        event.preventDefault();
        setIsChatOpen(false);
        setIsSidebarOpen((current) => !current);
        return;
      }

      if (key === "c") {
        event.preventDefault();
        setIsSidebarOpen(false);
        setIsChatOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcutKeyDown);

    return () => window.removeEventListener("keydown", handleShortcutKeyDown);
  }, [
    allTiles,
    setActiveLayout,
    setIsChatOpen,
    setIsSidebarOpen,
    setSelectedParticipantId,
    toggleAudio,
    toggleScreenShare,
    toggleVideo,
  ]);

  if (!roomName) {
    return (
      <section className="rounded-[2rem] border border-border/80 bg-card/82 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-foreground">
          Missing meeting room
        </h1>
        <p className="mt-3 text-muted-foreground">
          We could not find a meeting ID for this live room.
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
        >
          Back to dashboard
        </Link>
      </section>
    );
  }

  // Show loading state while joining meeting
  if (
    joinMutation.status === "pending" ||
    wrappedCekMutation.status === "pending"
  ) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative h-[calc(100vh-3rem)] overflow-hidden rounded-2xl border border-[#f5a623]/16 bg-[#060504] flex items-center justify-center"
      >
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f5a623]/16 bg-[#130f0a]/92 px-4 py-2 text-sm mb-4">
            <svg
              className="h-4 w-4 animate-spin text-[#f5a623]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Joining meeting...
          </div>
          <p className="text-[#c9af79] text-sm mt-2">
            Please wait while we verify access
          </p>
        </div>
      </motion.section>
    );
  }

  // Show error state if join failed
  if (
    joinMutation.status === "error" ||
    wrappedCekMutation.status === "error"
  ) {
    const errorMsg = getHttpErrorMessage(
      joinMutation.error || wrappedCekMutation.error,
      "You don't have permission to join this meeting.",
    );
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative h-[calc(100vh-3rem)] overflow-hidden rounded-2xl border border-[#f5a623]/16 bg-[#060504] flex items-center justify-center"
      >
        <div className="rounded-[2rem] border border-border/80 bg-card/82 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl max-w-md">
          <h1 className="text-2xl font-semibold text-red-300">Access Denied</h1>
          <p className="mt-3 text-muted-foreground text-sm">
            {errorMsg || "You don't have permission to join this meeting."}
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
          >
            Back to dashboard
          </Link>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative h-[calc(100vh-3rem)] overflow-hidden rounded-2xl border border-[#f5a623]/16 bg-[#060504]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(245,166,35,0.09),transparent_40%),radial-gradient(circle_at_86%_22%,rgba(255,207,107,0.07),transparent_34%),radial-gradient(circle_at_50%_82%,rgba(245,166,35,0.05),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-size-[180px_180px] bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] opacity-60" />

      <RecordingIndicator isRecording={isRecording} />

      <div
        className={`absolute top-4 right-4 z-30 pointer-events-auto ${isRecording ? "top-16" : "top-4"}`}
      >
        {isHost && (
          <RecordingLimitIndicator
            limit={recordingLimitData}
            isLoading={recordingLimitLoading}
            isError={recordingLimitError}
          />
        )}
      </div>

      <MeetingInfo
        meetingId={meetingId}
        participantCount={participantList.length}
      />

      <div className="absolute inset-0">
        <MeetingStage
          connectionState={connectionState as MeetingConnectionState}
          focusedTiles={focusedTiles}
          allTiles={allTiles}
          onSelectFocusTile={(tileId) => {
            setActiveLayout("focus");
            setSelectedParticipantId(tileId);
          }}
        />
      </div>

      <div className="absolute left-4 right-4 top-16 z-30">
        <MeetingAlerts error={error} recordingError={recordingError} />
      </div>

      {remoteAudioTracks.map((item) => (
        <AudioTrackSink key={`audio-${item.id}`} track={item.track} />
      ))}

      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        isSidebarOpen={isSidebarOpen}
        isChatOpen={isChatOpen}
        activeLayout={activeLayout}
        isHost={isHost}
        isUploadingChunks={isUploadingChunks}
        isRecordingBusy={isRecordingBusy}
        canToggleRecording={
          connectionState === "connected" &&
          (recordingLimitData?.allowed ?? true)
        }
        recordingLimitExceeded={
          recordingLimitData && !recordingLimitData.allowed
        }
        unreadMessages={unreadCount}
        recordingButtonLabel={recordingButtonLabel}
        onToggleAudio={async () => {
          const nextMuted = await toggleAudio();
          if (nextMuted === null) {
            return;
          }

          sendMediaState({
            isMuted: nextMuted,
            isVideoOff,
          });
        }}
        onToggleVideo={async () => {
          const nextVideoOff = await toggleVideo();
          if (nextVideoOff === null) {
            return;
          }

          sendMediaState({
            isMuted,
            isVideoOff: nextVideoOff,
          });
        }}
        onToggleScreenShare={toggleScreenShare}
        onToggleSidebar={() => {
          setIsChatOpen(false);
          setIsSidebarOpen((value) => !value);
        }}
        onToggleChat={() => {
          setIsSidebarOpen(false);
          setIsChatOpen((value) => !value);
        }}
        onToggleLayout={() => {
          if (activeLayout === "focus") {
            setActiveLayout("grid");
            setSelectedParticipantId(null);
            return;
          }

          setActiveLayout("focus");
          setSelectedParticipantId(allTiles[0]?.id ?? null);
        }}
        onToggleRecording={() => {
          if (!isHost) {
            return;
          }

          // Check recording limit before allowing to start
          if (
            !isRecording &&
            recordingLimitData &&
            !recordingLimitData.allowed
          ) {
            toast.error(
              `Recording limit exceeded. You have ${recordingLimitData.recordingsUsed} of ${recordingLimitData.recordingsLimit} recordings.`,
              {
                duration: 5000,
              },
            );
            return;
          }

          if (isRecording) {
            if (isHost) {
              stopRecordingMutation.mutate(undefined, {
                onSuccess: () => {
                  sendRecordingState(false);
                },
              });
            } else {
              stopLocalChunkRecorder().then(() => {
                sendRecordingState(false);
              });
            }
            return;
          }

          if (isHost) {
            startRecordingMutation.mutate(undefined, {
              onSuccess: () => {
                sendRecordingState(true);
              },
            });
          } else {
            startLocalRecording({ resetSession: true }).then(() => {
              sendRecordingState(true);
            });
          }
        }}
        onEndForAll={handleEndForAll}
        onLeaveCall={handleExit}
      />

      <ParticipantsSidebar
        participants={participantList}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <MeetingChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        typingNames={typingNames}
        selfName={displayName}
        onSendMessage={sendChatMessage}
        onTyping={setTyping}
        reactions={reactions}
        participantNamesById={participantNamesById}
        participantId={localParticipantId}
        onSendReaction={sendReaction}
      />
      {ending || endMeetingMutation.isPending ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-xl border border-[#f5a623]/18 bg-[#120f0a] px-5 py-3 text-sm text-[#f4e7cc]">
            Ending meeting...
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}
