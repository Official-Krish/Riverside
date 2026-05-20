/* eslint-disable @typescript-eslint/no-explicit-any */
import { http } from "@/https";
import type { EditorProject, ExportJob } from "./types";

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
