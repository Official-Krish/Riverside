import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  Lock,
  Mail,
  Play,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { RecordingPageResponse } from "@repo/types/api";
import { useAuth } from "../hooks/useAuth";
import { http } from "../https";
import { getHttpErrorMessage } from "../lib/httpError";
import HLSPlayer from "@/components/VideoPlayer/videoPlayer";
import { DesignCSS } from "@/components/FinalRecording/design";
import { RecordingDetail } from "@/components/FinalRecording/RecordingDetail";
import { Sharing } from "@/components/FinalRecording/Sharing";

export function FinalRecordingPage() {
  const { recordingId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const [persistedVisibleEmails, setPersistedVisibleEmails] = useState<string[]>([]);
  const [draftNewEmails, setDraftNewEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const navigate = useNavigate();

  const meetingQuery = useQuery({
    queryKey: ["final-recording-page", recordingId],
    queryFn: async () => {
      const response = await http.get<RecordingPageResponse>(
        `/recording/page/${recordingId}`
      );
      return response.data;
    },
    enabled: isAuthenticated && Boolean(recordingId),
  });

  const meeting = meetingQuery.data;

  const eligibleParticipants = useMemo(() => {
    const hostEmail = meeting?.hostEmail?.toLowerCase() || "";
    return (meeting?.participants || []).filter((p) => {
      const email = p.email?.toLowerCase() || "";
      return Boolean(email) && email !== hostEmail;
    });
  }, [meeting?.hostEmail, meeting?.participants]);

  useEffect(() => {
    if (!meeting?.visibleToEmails) {
      return;
    }

    setPersistedVisibleEmails(meeting.visibleToEmails);
    setDraftNewEmails([]);
  }, [meeting?.visibleToEmails]);

  const inputEmail = emailInput.trim().toLowerCase();
  const isEmailInputValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail);

  const suggestedParticipants = useMemo(() => {
    const selected = new Set([
      ...persistedVisibleEmails.map((email) => email.toLowerCase()),
      ...draftNewEmails.map((email) => email.toLowerCase()),
    ]);
    return eligibleParticipants.filter((participant) => {
      const email = participant.email?.toLowerCase() || "";
      return Boolean(email) && !selected.has(email);
    });
  }, [eligibleParticipants, persistedVisibleEmails, draftNewEmails]);

  const addEmailToShare = () => {
    if (!isEmailInputValid) { toast.error("Enter a valid email address"); return; }
    const alreadyPersisted = persistedVisibleEmails.some((email) => email.toLowerCase() === inputEmail);
    if (alreadyPersisted) {
      toast.error("Email is already in visible list");
      return;
    }

    setDraftNewEmails((cur) => cur.includes(inputEmail) ? cur : [...cur, inputEmail]);
    setEmailInput("");
  };

  const hlsManifestUrl = meeting?.hlsManifestUrl || "";
  const thumbnailVttUrl = meeting?.hlsThumbnailVttUrl || "";
  const posterUrl = meeting?.hlsPosterUrl || "";

  const canRenderPlayer = Boolean(
    meeting?.canViewRecording && meeting?.recordingState === "READY"
  );

  const hlsAvailabilityQuery = useQuery({
    queryKey: ["hls-availability", meeting?.meetingId],
    enabled: Boolean(canRenderPlayer && hlsManifestUrl),
    retry: false,
    queryFn: async () => {
      const res = await fetch(hlsManifestUrl, { method: "HEAD" });
      return res.ok;
    },
  });

  const saveVisibilityMutation = useMutation({
    mutationFn: async () => {
      const payloadEmails = [...new Set([...persistedVisibleEmails, ...draftNewEmails])];
      const response = await http.put<{ visibleToEmails?: string[] }>(`/recording/visibility/${meeting?.meetingId}`, {
        visibleToEmails: payloadEmails,
      });

      return {
        responseData: response.data,
        payloadEmails,
      };
    },
    onSuccess: ({ responseData, payloadEmails }) => {
      const updatedEmails = responseData?.visibleToEmails ?? payloadEmails;
      setPersistedVisibleEmails(updatedEmails);
      setDraftNewEmails([]);
      setEmailInput("");
      toast.success("Recording visibility updated");
      meetingQuery.refetch();
    },
    onError: (err) =>
      toast.error(getHttpErrorMessage(err, "Could not save visibility settings")),
  });

  const AskPermissionMutation = useMutation({
    mutationFn: async () => {
      await http.post(`/notifications/create`, {
        type: "RECORDING_REQUEST",
        roomId: meeting?.meetingId,
      });
    },
    onSuccess: () => {
      toast.success("Permission request sent to host");
    },
    onError: (err) =>
      toast.error(getHttpErrorMessage(err, "Could not send permission request")),
  })

  return (
    <>
      <style>{DesignCSS}</style>
      <section className="weave-recording-root wrp-section">

        {/* ── Header ── */}
        <div className="wrp-header">
          <div>
            <p className="wrp-eyebrow">Final Recording</p>
          </div>
          <div className="flex space-x-2">
            <Link to="/dashboard?section=recordings" className="wrp-back-btn">
              <ArrowLeft size={14} />
              Back to recordings
            </Link>
            {meeting && meeting.canEditRecording && (
              <button
                onClick={() => navigate("/edit/" + meeting.id)}
                className="flex items-center group relative overflow-hidden rounded-full px-6 py-3 text-sm font-bold tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                style={{
                    background: "#F5A623",
                    color: "#0c0c0e",
                }}
              >
                {/* Shimmer sweep */}
                <span
                  className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  style={{
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                  }}
                />
                Edit Recording
              </button>
            )}
          </div>
        </div>

        {meeting && meeting.canViewRecording && !meeting.canEditRecording && (
          <div className="wrp-state-card warning">
            <h2 className="wrp-state-title">You do not have editing access</h2>
            <p className="wrp-state-desc">
              Ask the host for access to edit this recording.
            </p>
          </div>
        )}

        {/* ── Auth gate ── */}
        {!isAuthenticated ? (
          <div className="wrp-signin-card">
            <Lock size={20} style={{ color: "var(--gold)", marginBottom: "0.6rem" }} />
            <h2 className="wrp-state-title">Sign in required</h2>
            <p className="wrp-state-desc">
              You need an authenticated session to open final recordings.
            </p>
            <Link to="/signin" className="wrp-signin-btn">Go to sign in</Link>
          </div>

        ) : meetingQuery.isLoading ? (
          <div className="wrp-loading-pill">
            <LoaderCircle size={15} style={{ animation: "spin 1s linear infinite" }} />
            Loading final recording…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>

        ) : meetingQuery.isError || !meeting ? (
          <div className="wrp-state-card error" style={{ marginTop: "1.5rem" }}>
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "#ff8080", margin: 0 }}>
              <AlertCircle size={16} />
              {getHttpErrorMessage(meetingQuery.error, "Could not load final recording.")}
            </p>
          </div>

        ) : (
          <div className="wrp-content-card">

            {/* ── Player / state ── */}
            {meeting.recordingState !== "READY" ? (
              <div className="wrp-state-card info">
                <Video size={20} style={{ color: "var(--gold)", marginBottom: "0.6rem" }} />
                <h2 className="wrp-state-title">Video is preparing</h2>
                <p className="wrp-state-desc">
                  Current status: {meeting.recordingState || "PROCESSING"}. You can stay on this page and retry shortly.
                </p>
              </div>

            ) : !meeting.canViewRecording ? (
              <div className="wrp-state-card warning">
                <h2 className="wrp-state-title">Access requires host permission</h2>
                <p className="wrp-state-desc">
                  You don't have permission to view this recording. Please ask the host for access.
                </p>
                <button type="button" onClick={() => AskPermissionMutation.mutate()} className="wrp-permission-btn">
                  <Mail size={13} />
                  Ask permission from host
                </button>
              </div>

            ) : (
              <div className="wrp-player-wrap">
                <HLSPlayer
                  src={hlsManifestUrl}
                  poster={posterUrl || undefined}
                  thumbnailVtt={hlsAvailabilityQuery.data ? thumbnailVttUrl : undefined}
                  className="w-full"
                />
              </div>
            )}

            {/* ── Stream badge ── */}
            <div className="wrp-stream-row">
              <span className="wrp-badge">
                <Play size={10} />
                {meeting.recordingState === "READY"
                  ? hlsAvailabilityQuery.data ? "HLS streaming" : "Local asset playback"
                  : "Preparing"}
              </span>
              <span className="wrp-stream-note">
                {meeting.recordingState !== "READY"
                  ? "Recording is being processed and will appear when ready."
                  : hlsAvailabilityQuery.data
                  ? "Video is streamed via HLS from our CDN for optimal performance."
                  : "HLS stream is not available yet."}
              </span>
            </div>

            <div className="wrp-divider" />

            {/* ── Recording details ── */}
            <RecordingDetail meeting={meeting} />

            {/* ── Sharing ── */}
            <Sharing 
              meeting={meeting} 
              suggestedParticipants={suggestedParticipants} 
              persistedVisibleEmails={persistedVisibleEmails}
              draftNewEmails={draftNewEmails}
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              addEmailToShare={addEmailToShare}
              setDraftNewEmails={setDraftNewEmails}
              onSaveSharing={() => saveVisibilityMutation.mutate()}
              isSaving={saveVisibilityMutation.isPending}
              isEmailInputValid={isEmailInputValid}
            />

          </div>
        )}
      </section>
    </>
  );
}