import { findDuration } from "@/lib/utils";
import type { RecordingPageResponse } from "@repo/types/api"
import { CalendarDays, Clock3, Users, Video, Download, Pencil } from "lucide-react"
import { Link } from "react-router-dom"
import { useState } from "react";

export const RecordingDetail = ({ meeting }: { meeting: RecordingPageResponse;}) => {
    const downloadableMp4Url = meeting?.finalVideoUrl || "";
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!downloadableMp4Url || isDownloading) return;
        
        setIsDownloading(true);
        try {
            const response = await fetch(downloadableMp4Url);
            if (!response.ok) throw new Error("Download failed");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `recording-${meeting?.meetingId || "video"}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
            window.open(downloadableMp4Url, "_blank");
        } finally {
            setIsDownloading(false);
        }
    };

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
                    <button onClick={handleDownload} disabled={isDownloading} className="wrp-download-btn">
                        <Download size={13} />
                        {isDownloading ? "Downloading..." : "Download recording"}
                    </button>
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
