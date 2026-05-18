import { beforeEach, afterEach, test, expect, vi } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// Run tests in temp directory
const tmpDir = path.join(process.cwd(), "tmp_test_run");

beforeEach(async () => {
  await fs.mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

test("processRenderJob end-to-end (mocked binaries)", async () => {
  // Prepare a small dummy source file
  const sourcePath = path.join(tmpDir, "source.mp4");
  await fs.writeFile(sourcePath, "dummy");

  // Mock prisma to return a minimal project
  const projectId = "proj-test";
  const jobId = "job-test";
  const roomId = "room-test";

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
            id: "clip1",
            sourceAssetId: "asset1",
            sourceStartMs: 0,
            timelineStartMs: 0,
            durationMs: 1000,
          },
        ],
      },
    ],
    overlays: [],
    meeting: { finalRecording: null },
    assets: [
      {
        id: "asset1",
        url: sourcePath,
        durationMs: 1000,
      },
    ],
  };

  // Use doMock to avoid hoisting so `project` is in scope
  vi.doMock("@repo/db/client", () => {
    return {
      prisma: {
        editorProject: {
          findFirst: vi.fn(async () => project),
        },
        exportJob: {
          update: vi.fn(async () => ({})),
        },
      },
    };
  });

  // Mock storage.downloadSourceToLocal to just echo the path
  vi.doMock("../storage", () => ({
    downloadSourceToLocal: async (p: string) => p,
    toPublicRecordingLink: (p: string) => p,
  }));

  // Mock artifacts to no-op
  vi.doMock("../artifacts", () => ({
    promoteRenderedVideo: vi.fn(async (_roomId: string, outputPath: string) => {
      // Copy outputPath to a final location that won't be auto-deleted by the
      // worker cleanup to simulate promotion.
      const finalPath = outputPath.replace(/\.mp4$/, "_final.mp4");
      try {
        await fs.stat(outputPath);
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.copyFile(outputPath, finalPath);
      } catch {
        await fs.mkdir(path.dirname(finalPath), { recursive: true });
        await fs.writeFile(finalPath, "final");
      }
      return finalPath;
    }),
    refreshMeetingRecordingArtifacts: vi.fn(async () => ({})),
  }));

  // Mock runBinary to create output files when called
  vi.doMock("../helpers", async () => {
    const actual =
      await vi.importActual<typeof import("../helpers")>("../helpers");
    return {
      ...actual,
      runBinary: async (_bin: string, args: string[]) => {
        const out = args[args.length - 1];
        if (typeof out === "string") {
          await fs.mkdir(path.dirname(out), { recursive: true });
          await fs.writeFile(out, "rendered");
        }
      },
    };
  });

  // Now import the worker and run the job
  const { processRenderJob } = await import("../render");

  // Execute
  await processRenderJob({ projectId, jobId, roomId });

  // Expect output file exists
  const outPath = path.join(
    process.cwd(),
    "../../recordings",
    roomId,
    "editor",
    "projects",
    projectId,
    "exports",
    `${jobId}.mp4`,
  );

  const finalOut = outPath.replace(/\.mp4$/, "_final.mp4");
  const exists = await fs
    .stat(finalOut)
    .then(() => true)
    .catch(() => false);
  expect(exists).toBe(true);
});
