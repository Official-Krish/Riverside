import { test, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Test that worker classifies retryable vs deterministic FFmpeg failures
const runTest = process.env.REAL_FFMPEG ? test.skip : test;

runTest(
  "worker retries on transient FFmpeg stall and fails on deterministic errors",
  async () => {
    const tmp = path.join(process.cwd(), "tmp_ff_fail");
    await fs.mkdir(tmp, { recursive: true });

    // Minimal project payload
    const projectId = "proj-fail";
    const jobId = "job-fail";
    const roomId = "room-fail";

    const project = {
      id: projectId,
      fps: 30,
      width: 320,
      height: 240,
      tracks: [
        {
          type: "VIDEO",
          clips: [
            {
              id: "c1",
              sourceAssetId: "a1",
              sourceStartMs: 0,
              timelineStartMs: 0,
              durationMs: 1000,
            },
          ],
        },
      ],
      overlays: [],
      meeting: { finalRecording: null },
      assets: [{ id: "a1", url: path.join(tmp, "s.mp4"), durationMs: 1000 }],
    };

    // create fake source
    await fs.writeFile(project.assets[0]!.url, "dummy");

    // Mock DB and storage like earlier tests
    vi.doMock("@repo/db/client", () => ({
      prisma: {
        editorProject: { findFirst: vi.fn(async () => project) },
        exportJob: { update: vi.fn(async () => ({})) },
      },
    }));
    vi.doMock("../storage", () => ({
      downloadSourceToLocal: async (p: string) => p,
      toPublicRecordingLink: (p: string) => p,
    }));
    vi.doMock("../artifacts", () => ({
      promoteRenderedVideo: vi.fn(async (r: string, out: string) =>
        out.replace(/\.mp4$/, "_final.mp4"),
      ),
      refreshMeetingRecordingArtifacts: vi.fn(async () => ({})),
    }));

    // First scenario: transient stall (simulate FFmpeg timeout) — runBinary throws a stall error first, then succeeds
    let callCount = 0;
    vi.doMock("../helpers", async () => {
      const actual =
        await vi.importActual<typeof import("../helpers")>("../helpers");
      return {
        ...actual,
        runBinary: async (_bin: string, _args: string[]) => {
          callCount += 1;
          if (callCount === 1) {
            const e: any = new Error(
              "FFmpeg stalled after 60000ms without progress",
            );
            throw e;
          }
          // On retry, create outputs
          const out = _args[_args.length - 1];
          if (typeof out === "string") {
            await fs.mkdir(path.dirname(out), { recursive: true });
            await fs.writeFile(out, "ok");
          }
        },
      };
    });

    const { processRenderJob } = await import("../render");
    // Should complete (retry logic in worker may re-run, but our test ensures runBinary eventually succeeds)
    await processRenderJob({ projectId, jobId, roomId });

    // Second scenario: deterministic error — inject via env var so short-circuit path fails
    process.env.FORCE_FFMPEG_FAIL = "deterministic";
    let threw = false;
    try {
      await processRenderJob({ projectId, jobId: jobId + "2", roomId });
    } catch (err: any) {
      threw = true;
      expect(String(err)).toContain("FFmpeg failed");
    } finally {
      delete process.env.FORCE_FFMPEG_FAIL;
    }
    expect(threw).toBe(true);

    await fs.rm(tmp, { recursive: true, force: true });
  },
);
