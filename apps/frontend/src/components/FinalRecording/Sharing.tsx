/* eslint-disable @typescript-eslint/no-explicit-any */
import { http } from "@/https";
import { getHttpErrorMessage } from "@/lib/httpError";
import type {
  RecordingPageResponse,
  RemoveVisibleEmailRequest,
} from "@repo/types/api";
import { useMutation } from "@tanstack/react-query";
import { Crown, Mail, Shield, Users, X } from "lucide-react";
import { toast } from "sonner";

export const Sharing = ({
  meeting,
  suggestedParticipants,
  persistedVisibleEmails = [],
  emailInput = "",
  setEmailInput = () => {},
  addEmailToShare = () => {},
  draftNewEmails = [],
  setDraftNewEmails = () => {},
  isEmailInputValid = false,
  onSaveSharing = () => {},
  onRefreshSharing = () => {},
  isSaving = false,
}: {
  meeting: RecordingPageResponse;
  suggestedParticipants: any[];
  persistedVisibleEmails: string[];
  emailInput: string;
  setEmailInput: (email: string) => void;
  addEmailToShare: () => void;
  draftNewEmails: string[];
  setDraftNewEmails: (emails: string[]) => void;
  isEmailInputValid?: boolean;
  onSaveSharing: () => void;
  onRefreshSharing?: () => void;
  isSaving: boolean;
}) => {
  const hostEmail = meeting?.hostEmail?.toLowerCase() || "";
  const participantEntries = (meeting?.participants || [])
    .filter((p) => Boolean(p.email))
    .map((p, index) => ({
      id: `participant-${(p.email || "").toLowerCase()}-${index}`,
      email: (p.email || "").toLowerCase(),
      isHost: (p.email || "").toLowerCase() === hostEmail,
    }));
  if (hostEmail && !participantEntries.some((p) => p.email === hostEmail)) {
    participantEntries.unshift({
      id: `host-${hostEmail}`,
      email: hostEmail,
      isHost: true,
    });
  }

  const removeSharingMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await http.post<RemoveVisibleEmailRequest>(
        `/recording/removeVisibleEmail/${meeting.meetingId}`,
        { email },
      );
      return response.data;
    },
    onSuccess: () => {
      onRefreshSharing();
      toast.success("Email visibility removed successfully");
    },
    onError: (error) => {
      toast.error(
        getHttpErrorMessage(error) || "Failed to remove email visibility",
      );
    },
  });

  return (
    <div className="wrp-panel">
      <h2 className="wrp-panel-title">
        <Mail size={15} />
        Sharing
      </h2>
      <p className="wrp-share-desc">Add emails to grant recording access.</p>

      <div className="wrp-share-grid">
        <div className="wrp-share-box">
          <p className="wrp-share-box-title">
            <Shield size={12} />
            Recording visible to emails
          </p>
          {persistedVisibleEmails.length > 0 ? (
            <div className="wrp-email-tags" style={{ marginTop: 0 }}>
              {persistedVisibleEmails.map((email) => (
                <div className="flex justify-between">
                  <span
                    key={email}
                    className={`${meeting.isHost ? "wrp-tag" : "wrp2-tag"}`}
                    style={{ cursor: "default" }}
                  >
                    {email}
                    {meeting.isHost && (
                      <X
                        size={10}
                        className="cursor-pointer"
                        onClick={() => removeSharingMutation.mutate(email)}
                      />
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="wrp-share-empty">No additional emails added yet.</p>
          )}
        </div>

        <div className="wrp-share-box">
          <p className="wrp-share-box-title">
            <Users size={12} />
            Participants
          </p>
          {participantEntries.length > 0 ? (
            <div className="wrp-participant-list">
              {participantEntries.map((participant) => (
                <div key={participant.id} className="wrp-participant-row">
                  <span>{participant.email}</span>
                  {participant.isHost ? (
                    <span className="wrp-host-pill">
                      <Crown size={10} />
                      Host
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="wrp-share-empty">No participants available.</p>
          )}
        </div>
      </div>

      {meeting.isHost ? (
        <>
          <div className="wrp-input-row">
            <input
              type="email"
              className="wrp-email-input"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Enter email to share"
              onKeyDown={(e) => e.key === "Enter" && addEmailToShare()}
            />
            <button
              type="button"
              onClick={addEmailToShare}
              className="wrp-add-btn"
              disabled={!isEmailInputValid || emailInput.trim() === ""}
            >
              Add email
            </button>
          </div>

          {draftNewEmails.length > 0 && (
            <div className="wrp-email-tags">
              {draftNewEmails.map((email) => (
                <button
                  key={email}
                  type="button"
                  className="wrp-tag"
                  onClick={() =>
                    setDraftNewEmails(draftNewEmails.filter((v) => v !== email))
                  }
                >
                  {email}
                  <span className="wrp-tag-x">
                    <X size={8} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {suggestedParticipants.length > 0 && (
            <div className="wrp-participant-grid">
              {suggestedParticipants.map((participant) => {
                const email = participant.email?.toLowerCase() || "";
                const checked = draftNewEmails.includes(email);
                return (
                  <label
                    key={participant.email}
                    className="wrp-participant-label"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (!email) return;
                        if (e.target.checked) {
                          setDraftNewEmails(
                            draftNewEmails.includes(email)
                              ? draftNewEmails
                              : [...draftNewEmails, email],
                          );
                        } else {
                          setDraftNewEmails(
                            draftNewEmails.filter((i) => i !== email),
                          );
                        }
                      }}
                    />
                    <span className="wrp-participant-name">
                      {participant.email}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="wrp-save-btn"
            onClick={onSaveSharing}
            disabled={isSaving || draftNewEmails.length === 0}
          >
            {isSaving ? "Saving…" : "Save sharing"}
          </button>
        </>
      ) : (
        <div className="wrp-access-note">
          {meeting.canViewRecording
            ? "You currently have access to this recording."
            : "You do not have access yet. Ask the host for permission."}
        </div>
      )}
    </div>
  );
};
