import { test, expect, vi } from "vitest";

test("overlay builds drawtext and boxcolor tokens", async () => {
  vi.doMock("@repo/db/client", () => ({ prisma: {} }));
  const { buildOverlayFilter } = await import("../overlay");

  const overlays = [
    {
      content: { text: "Hello" },
      timelineStartMs: 0,
      durationMs: 1000,
      transform: { x: 10, y: 20 },
      style: {
        color: "black",
        background: { color: "#ff0000", opacity: 0.5 },
      },
    },
  ];

  const filter = buildOverlayFilter(overlays, 0);
  expect(typeof filter).toBe("string");
  expect(filter).toContain("drawtext");
  expect(filter).toMatch(/boxcolor=/);
});

test("speed graph synthesizes silence when source has no audio", async () => {
  vi.doMock("@repo/db/client", () => ({ prisma: {} }));
  const { buildSpeedGraph } = await import("../effects/ffmpeg");

  const clip: any = {
    id: "c1",
    durationMs: 1000,
    sourceStartMs: 0,
    sourceDurationMs: 1000,
    effects: {
      speed: {
        enabled: true,
        points: [
          { at: 0, speed: 1 },
          { at: 1, speed: 1 },
        ],
        preservePitch: true,
        freezeFrames: [],
      },
    },
    hasAudio: false,
  };

  const res = buildSpeedGraph(clip as any, "tst");
  expect(res.filterParts.join(" ")).toContain("anullsrc");
  expect(res.audioLabel).toBeDefined();
});

test("speed graph uses audio when source has audio", async () => {
  vi.doMock("@repo/db/client", () => ({ prisma: {} }));
  const { buildSpeedGraph } = await import("../effects/ffmpeg");

  const clip: any = {
    id: "c2",
    durationMs: 1000,
    sourceStartMs: 0,
    sourceDurationMs: 1000,
    effects: {
      speed: {
        enabled: true,
        points: [
          { at: 0, speed: 1 },
          { at: 1, speed: 1 },
        ],
        preservePitch: true,
        freezeFrames: [],
      },
    },
    hasAudio: true,
  };

  const res = buildSpeedGraph(clip as any, "tst");
  expect(res.filterParts.join(" ")).toContain("atrim");
  expect(res.audioLabel).toBeDefined();
});

test("crossfade concat builds xfade for parts with transitions", async () => {
  vi.doMock("@repo/db/client", () => ({ prisma: {} }));
  const { buildCrossfadeConcatArgs } = await import("../transitions");

  const parts = [
    {
      path: "a.mp4",
      durationMs: 1000,
      transition: { type: "fade", durationMs: 500 },
    },
    { path: "b.mp4", durationMs: 1000 },
  ];

  const out = buildCrossfadeConcatArgs(parts as any, "out.mp4", 30);
  expect(out).not.toBeNull();
  expect(out!.args.join(" ")).toContain("xfade");
});
