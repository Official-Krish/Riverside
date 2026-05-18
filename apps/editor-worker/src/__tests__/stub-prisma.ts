/**
 * Stub Prisma client for testing editor-worker without a real database.
 * Provides mock implementations for all methods used by processRenderJob.
 *
 * LOGIC ERRORS CAUGHT BY TESTS WITH THIS STUB:
 * 1. FFmpeg command construction errors (invalid filters, bad arguments)
 * 2. Filter graph errors (invalid stream specifiers, missing labels)
 * 3. File path handling errors (incorrect directory creation, bad quoting)
 * 4. Audio/video processing logic errors (missing audio guards, wrong presets)
 * 5. Storage operations errors (upload/download path issues)
 * 6. Clip ordering and transition logic errors
 * 7. Duration and offset calculations for clips and transitions
 * 8. Overlay rendering and positioning errors
 * 9. Effect application errors (chroma key, LUT, speed ramps)
 *
 * LOGIC ERRORS NOT CAUGHT (MOCKED):
 * - DB query logic (we stub all DB calls)
 * - Prisma constraint violations (we accept any data)
 * - DB transaction semantics (no real atomicity)
 * - Cache invalidation logic (cache stubs don't fail)
 * - Permission/access control (all requests succeed)
 *
 * For production-level testing, use a real PostgreSQL DB with migrations
 * and data fixtures, or use a test database with seed data.
 */

export const createStubPrisma = () => ({
  editorProject: {
    findFirst: async (query: any) => {
      // Return a mock project matching the query
      const projectId = query.where?.id || "stub-project";
      return {
        id: projectId,
        fps: 30,
        width: 640,
        height: 360,
        tracks: [
          {
            type: "VIDEO",
            clips: [
              {
                id: "stub-clip",
                sourceAssetId: "stub-asset",
                sourceStartMs: 0,
                timelineStartMs: 0,
                durationMs: 2000,
              },
            ],
          },
        ],
        overlays: [],
        meeting: { finalRecording: null },
        assets: [
          {
            id: "stub-asset",
            url: query.where?.id
              ? `${query.where.id}-source.mp4`
              : "source.mp4",
            durationMs: 2000,
          },
        ],
      };
    },
    update: async () => ({}),
  },
  exportJob: {
    update: async () => ({}),
  },
  meeting: {
    findFirst: async () => ({
      id: "stub-meeting",
      roomId: "stub-room",
      isHost: true,
      finalRecording: null,
    }),
  },
  finalRecording: {
    upsert: async () => ({}),
  },
  editorOverlay: {
    deleteMany: async () => ({}),
  },
  editorClip: {
    deleteMany: async () => ({}),
  },
  editorTrack: {
    deleteMany: async () => ({}),
  },
  editorAsset: {
    deleteMany: async () => ({}),
  },
  $transaction: async (fn: any) => {
    // Execute the transaction function with the stub client
    return fn({
      editorProject: { update: async () => ({}) },
      exportJob: { update: async () => ({}) },
      finalRecording: { upsert: async () => ({}) },
      meeting: { updateMany: async () => ({}) },
      editorOverlay: { deleteMany: async () => ({}) },
      editorClip: { deleteMany: async () => ({}) },
      editorTrack: { deleteMany: async () => ({}) },
      editorAsset: { deleteMany: async () => ({}) },
    });
  },
  $disconnect: async () => {},
});
