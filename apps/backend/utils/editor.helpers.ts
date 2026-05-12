import { buildS3Key } from "@repo/amazons3";
import { putObjectToS3 } from "./storage";

export const EDITOR_RENDER_QUEUE = "EditorRender";

export async function writeProjectSnapshot(roomId: string, projectId: string, payload: unknown) {
    const key = buildS3Key("weave-recordings", roomId, "editor", "projects", projectId, "project.json");
    await putObjectToS3({
        key,
        body: JSON.stringify(payload, null, 2),
        contentType: "application/json",
    });
}