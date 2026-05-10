import { findDuration } from "@/lib/utils";
import type { RecordingPageResponse } from "@repo/types/api"
import { CalendarDays, Clock3, Users, Video, Download, Pencil } from "lucide-react"
import { Link } from "react-router-dom"

export const RecordingDetail = ({ meeting }: { meeting: RecordingPageResponse;}) => {
    const downloadableMp4Url = meeting?.finalVideoUrl || "";

    const startedAt = meeting.startedAt ? new Date(meeting.startedAt) : null;
    const endedAt = meeting.endedAt ? new Date(meeting.endedAt) : null;
    const durationLabel = findDuration(startedAt ?? new Date(), endedAt ?? new Date());
          
    return (
        <div className="wrp-panel">
            <h2 className="wrp-panel-title">
            <Video size={15} />
            Recording details
            </h2>
            <div className="wrp-meta-grid">
            <div className="wrp-meta-item">
                <Video size={13} />
                <span>Room Name: {meeting.roomName}</span>
            </div>
            <div className="wrp-meta-item">
                <Users size={13} />
                <span>{meeting.participants.length} participant{meeting.participants.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="wrp-meta-item">
                <CalendarDays size={13} />
                <span>{meeting.roomName ? "Meeting recording" : "Recording details"}</span>
            </div>
            <div className="wrp-meta-item">
                <Clock3 size={13} />
                <span>Recording Duration: {durationLabel}</span>
            </div>
            </div>

            <div className="flex gap-2 mt-4">
                {meeting.recordingState === "READY" && meeting.canViewRecording && (
                <a href={downloadableMp4Url} download className="wrp-download-btn">
                    <Download size={13} />
                    Download recording
                </a>
                )}
                {meeting?.meetingId && (
                    <Link
                        to={`/editor?meetingId=${meeting.meetingId}`}
                        className="wrp-download-btn"
                        style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                    >
                        <Pencil size={13} />
                        Edit in editor
                    </Link>
                )}
            </div>
        </div>
    )
}
