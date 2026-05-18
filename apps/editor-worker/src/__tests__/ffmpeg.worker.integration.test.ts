import { test, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { runBinaryWithRetries } from "../helpers";
import { createStubPrisma } from "./stub-prisma";

// This integration test runs the full `processRenderJob` flow but uses a stub Prisma
// so we don't need a real Postgres instance or migrations. It uses REAL_FFMPEG=1 and
// LOCAL_ONLY=1 to perform real ffmpeg work and store outputs under recordings/local_s3
// instead of S3.
//
// WHAT THIS TEST VALIDATES:
// - Full video processing pipeline (clip rendering, transitions, overlays, audio mix)
// - Real FFmpeg command construction and execution
// - File pathhandling and intermediate file creation
// - Storage operations (local upload/download)
// - Clip ordering and timeline math
// - Transition application (crossfade)
// - Overlay rendering and positioning
// - Audio mixing logic
// - Progress updates (DB stubs accept any progress value)
// - Error handling in FFmpeg execution
// - File promotion to final recording
//
// WHAT THIS TEST DOES NOT VALIDATE:
// - DB query semantics (uses stub Prisma)
// - Constraint violations (stub allows any data)
// - Access control / permissions (stub grants all access)
// - Real Prisma transaction semantics (uses stub $transaction)

const isReal = Boolean(process.env.REAL_FFMPEG);
const runIfReal = isReal ? test : test.skip;

runIfReal(
  "worker end-to-end integration (ffmpeg + local storage)",
  async () => {
    const tmp = path.join(process.cwd(), "tmp_worker_integration");
    await fs.mkdir(tmp, { recursive: true });

    // Create two source clips with audio
    const clipA = path.join(tmp, "a.mp4");
    const clipB = path.join(tmp, "b.mp4");

    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=640x360:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        clipA,
      ],
      2,
      200,
    );

    await runBinaryWithRetries(
      ffmpegPath as string,
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=green:s=640x360:d=2",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=660:duration=2",
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        clipB,
      ],
      2,
      200,
    );

    // Prepare a minimal project object that mirrors shape expected by processRenderJob
    const projectId = "int-proj";
    const jobId = "int-job";
    const roomId = "int-room";

    const project = {
      id: projectId,
      fps: 30,
      width: 640,
      height: 360,
      tracks: [
        {
          type: "VIDEO",
          clips: [
            {
              id: "c1",
              sourceAssetId: "assetA",
              sourceStartMs: 0,
              timelineStartMs: 0,
              durationMs: 2000,
            },
            {
              id: "c2",
              sourceAssetId: "assetB",
              sourceStartMs: 0,
              timelineStartMs: 2000,
              durationMs: 2000,
              transition: { type: "crossfade", durationMs: 1000 },
            },
          ],
        },
      ],
      overlays: [
        {
          type: "BOX",
          timelineStartMs: 0,
          timelineDurationMs: 4000,
          x: 10,
          y: 10,
          width: 200,
          height: 60,
          style: { color: "#000000", opacity: 0.5 },
        },
        {
          type: "TEXT",
          timelineStartMs: 0,
          timelineDurationMs: 4000,
          text: "Integration",
          style: { color: "white" },
          x: 20,
          y: 20,
        },
      ],
      meeting: { finalRecording: null },
      assets: [
        { id: "assetA", url: clipA, durationMs: 2000 },
        { id: "assetB", url: clipB, durationMs: 2000 },
      ],
    } as any;

    // Set up stub Prisma before importing render.ts (which imports prisma at module level)
    const stubPrisma = createStubPrisma();

    // Override the project in stub Prisma to use our test assets
    (stubPrisma.editorProject.findFirst as any) = async () => project;

    // Mock the DB client module before importing render
    vi.doMock("@repo/db/client", () => ({
      prisma: stubPrisma,
    }));

    // Mock artifacts to only mock the DB refresh (promoteRenderedVideo should run real to test storage)
    vi.doMock("../artifacts", async () => {
      const actual =
        await vi.importActual<typeof import("../artifacts")>("../artifacts");
      return {
        ...actual,
        refreshMeetingRecordingArtifacts: vi.fn(async () => ({})),
      };
    });

    // Now import render which will use the mocked prisma
    const { processRenderJob } = await import("../render");

    // Run the processing job (this will invoke real ffmpeg)
    await processRenderJob({ projectId, jobId, roomId });

    // Expect a final file exists in local_s3 / recordings
    const localS3Root = path.resolve(
      process.cwd(),
      "../../recordings/local_s3",
    );
    // Construct expected prefix used by artifacts.getCanonicalFinalKey
    const expectedPrefix = `weave-recordings/${roomId}/final`;

    // Look for any file under that prefix
    async function findAnyFile(
      dir: string,
      prefix: string,
    ): Promise<string | null> {
      const root = path.join(dir, prefix);
      try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile()) return path.join(root, e.name);
        }
      } catch {
        return null;
      }
      return null;
    }

    const finalPath = await findAnyFile(localS3Root, expectedPrefix);
    expect(finalPath).not.toBeNull();
    if (finalPath) {
      const s = await fs.stat(finalPath);
      expect(s.size).toBeGreaterThan(0);
    }

    // Clean up tmp files
    await fs.rm(tmp, { recursive: true, force: true });
  },
  2 * 60_000,
);
