/* eslint-disable @typescript-eslint/no-explicit-any */
import { http } from "@/https";
import type { EditorProject, ExportJob } from "./types";
import type {
  ParticipantSourceInfo,
  SpeakerSegment,
  CameraPriorityEntry,
} from "./types";

export const editorApi = {
  async createProject(meetingId: string, sourceMode: "FINAL" | "MULTITRACK") {
    const response = await http.post<{ projectId: string }>(
      "/editor/projects",
      {
        meetingId,
        sourceMode,
      },
    );
    return response.data;
  },

  async getProject(projectId: string): Promise<EditorProject> {
    const response = await http.get<{ project: EditorProject }>(
      `/editor/projects/${projectId}`,
    );
    return response.data.project;
  },

  async saveProject(
    projectId: string,
    data: {
      tracks: EditorProject["tracks"];
      overlays: EditorProject["overlays"];
      durationMs: number;
      fps?: number;
      width?: number;
      height?: number;
    },
  ) {
    const response = await http.put<{ message: string }>(
      `/editor/projects/${projectId}`,
      data,
    );
    return response.data;
  },

  async getAssets(projectId: string) {
    const response = await http.get<{ assets: any[] }>(
      `/editor/projects/${projectId}/assets`,
    );
    return response.data.assets;
  },

  async exportProject(projectId: string): Promise<ExportJob> {
    const response = await http.post<{ job: ExportJob }>(
      `/editor/projects/${projectId}/exports`,
    );
    return response.data.job;
  },

  async getExportStatus(jobId: string): Promise<ExportJob> {
    const response = await http.get<{ job: ExportJob }>(
      `/editor/exports/${jobId}`,
    );
    return response.data.job;
  },

  async uploadAsset(
    projectId: string,
    file: File,
    durationMs?: number,
    assetType?: "VIDEO" | "AUDIO",
    assetId?: string,
  ): Promise<{
    id: string;
    assetType: "VIDEO" | "AUDIO";
    url: string;
    durationMs: number | null;
  }> {
    const formData = new FormData();
    formData.append("file", file);
    if (durationMs != null) {
      formData.append("durationMs", String(durationMs));
    }
    if (assetType) {
      formData.append("assetType", assetType);
    }
    if (assetId) {
      formData.append("assetId", assetId);
    }
    const response = await http.post<{
      asset: {
        id: string;
        assetType: "VIDEO" | "AUDIO";
        url: string;
        durationMs: number | null;
      };
    }>(`/editor/projects/${projectId}/assets/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.asset;
  },
};

export const multicamApi = {
  async init(meetingId: string, roomId: string) {
    const res = await http.post<{
      projectId: string;
      layout: any;
      sources: ParticipantSourceInfo[];
    }>("/multicam/init", { meetingId, roomId });
    return res.data;
  },

  async getProject(projectId: string) {
    const res = await http.get<{
      project: any;
      layouts: any[];
      framings: any[];
      priorities: CameraPriorityEntry[];
      sources: ParticipantSourceInfo[];
      speakerTimelines: SpeakerSegment[];
    }>(`/multicam/projects/${projectId}`);
    return res.data;
  },

  async createLayout(
    projectId: string,
    data: {
      name?: string;
      viewMode?: "GRID" | "SINGLE" | "PIP" | "CUSTOM";
      rows?: number;
      cols?: number;
      segments?: {
        participantKey: string;
        timelineStartMs: number;
        durationMs: number;
        transition?: string;
      }[];
    },
  ) {
    const res = await http.post(
      `/multicam/projects/${projectId}/layouts`,
      data,
    );
    return res.data;
  },

  async saveFramings(
    projectId: string,
    framings: {
      participantKey: string;
      cropX?: number | null;
      cropY?: number | null;
      cropW?: number | null;
      cropH?: number | null;
      zoom?: number;
    }[],
  ) {
    const res = await http.put(`/multicam/projects/${projectId}/framings`, {
      framings,
    });
    return res.data;
  },

  async savePriorities(
    projectId: string,
    priorities: {
      participantKey: string;
      priority: number;
      alwaysVisible?: boolean;
    }[],
  ) {
    const res = await http.put(`/multicam/projects/${projectId}/priorities`, {
      priorities,
    });
    return res.data;
  },

  async getSpeakerTimelines(meetingId: string) {
    const res = await http.get<{ speakerTimelines: any[] }>(
      `/multicam/meetings/${meetingId}/speakers`,
    );
    return res.data;
  },
};
