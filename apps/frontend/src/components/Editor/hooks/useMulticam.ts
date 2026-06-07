import { useState, useCallback } from "react";
import { multicamApi } from "../api";
import type {
  MulticamProjectConfig,
  ParticipantSourceInfo,
  SpeakerSegment,
  CameraPriorityEntry,
  LayoutPreset,
} from "../types";

export function useMulticam(projectId: string | null) {
  const [multicamConfig, setMulticamConfig] =
    useState<MulticamProjectConfig | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMulticam = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = await multicamApi.getProject(projectId);
      const sources: ParticipantSourceInfo[] = (data.sources || []).map(
        (s: Record<string, unknown>) => ({
          participantKey: s.participantKey as string,
          displayName: s.displayName || s.participantKey,
          role: s.role || "guest",
          sourceKind: s.sourceKind || "camera",
          assetId: s.assetId || "",
          url: s.videoUrl || "",
          durationMs: s.durationMs || 0,
          framing: s.framing || {
            cropX: 0,
            cropY: 0,
            cropW: 1,
            cropH: 1,
            zoomPreset: "full-body",
          },
          hidden: s.hidden ?? false,
          priority: s.priority ?? 0,
          order: s.order ?? 0,
        }),
      );

      const speakerTimeline: SpeakerSegment[] = (
        data.speakerTimelines || []
      ).map((st: Record<string, unknown>) => ({
        participantKey: st.participantKey as string,
        displayName:
          sources.find((s) => s.participantKey === st.participantKey)
            ?.displayName || (st.participantKey as string),
        startMs: st.startMs as number,
        endMs: st.endMs as number,
        confidence: (st.confidence as number) ?? 1,
      }));

      const priorities: CameraPriorityEntry[] = (data.priorities || []).map(
        (p: Record<string, unknown>) => ({
          participantKey: p.participantKey as string,
          priority: (p.priority as number) ?? 0,
        }),
      );

      setMulticamConfig({
        participantSources: sources,
        speakerTimeline,
        activeLayout: "single",
        activeAngle: sources[0]?.participantKey || null,
        cameraPriority: priorities,
        autoCutSegments: [],
      });
    } catch (err) {
      console.error("Failed to load multicam config", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const setActiveAngle = useCallback((participantKey: string) => {
    setMulticamConfig((prev) =>
      prev ? { ...prev, activeAngle: participantKey } : prev,
    );
  }, []);

  const setActiveLayout = useCallback((layout: LayoutPreset) => {
    setMulticamConfig((prev) =>
      prev ? { ...prev, activeLayout: layout } : prev,
    );
  }, []);

  return {
    multicamConfig,
    loading,
    loadMulticam,
    setActiveAngle,
    setActiveLayout,
  };
}
