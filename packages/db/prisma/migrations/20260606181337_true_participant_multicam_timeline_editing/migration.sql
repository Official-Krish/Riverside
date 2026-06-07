-- CreateEnum
CREATE TYPE "ViewMode" AS ENUM ('GRID', 'SINGLE', 'PIP', 'CUSTOM');

-- AlterTable
ALTER TABLE "editor_assets" ADD COLUMN     "participantKey" TEXT;

-- AlterTable
ALTER TABLE "editor_tracks" ADD COLUMN     "participantKey" TEXT;

-- CreateTable
CREATE TABLE "participant_sources" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "durationMs" INTEGER,
    "fileSizeBytes" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multicam_layouts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "viewMode" "ViewMode" NOT NULL DEFAULT 'GRID',
    "rows" INTEGER NOT NULL DEFAULT 2,
    "cols" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "multicam_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "multicam_segments" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "timelineStartMs" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "transition" TEXT DEFAULT 'cut',

    CONSTRAINT "multicam_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaker_timelines" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "speaker_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_framings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "cropX" DOUBLE PRECISION,
    "cropY" DOUBLE PRECISION,
    "cropW" DOUBLE PRECISION,
    "cropH" DOUBLE PRECISION,
    "zoom" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "participant_framings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camera_priorities" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "alwaysVisible" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "camera_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "participant_sources_meetingId_idx" ON "participant_sources"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "participant_sources_meetingId_participantId_key" ON "participant_sources"("meetingId", "participantId");

-- CreateIndex
CREATE INDEX "multicam_layouts_projectId_idx" ON "multicam_layouts"("projectId");

-- CreateIndex
CREATE INDEX "multicam_segments_layoutId_idx" ON "multicam_segments"("layoutId");

-- CreateIndex
CREATE INDEX "speaker_timelines_meetingId_idx" ON "speaker_timelines"("meetingId");

-- CreateIndex
CREATE INDEX "speaker_timelines_meetingId_participantKey_idx" ON "speaker_timelines"("meetingId", "participantKey");

-- CreateIndex
CREATE INDEX "participant_framings_projectId_idx" ON "participant_framings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "participant_framings_projectId_participantKey_key" ON "participant_framings"("projectId", "participantKey");

-- CreateIndex
CREATE INDEX "camera_priorities_projectId_idx" ON "camera_priorities"("projectId");

-- CreateIndex
CREATE INDEX "camera_priorities_projectId_priority_idx" ON "camera_priorities"("projectId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "camera_priorities_projectId_participantKey_key" ON "camera_priorities"("projectId", "participantKey");

-- AddForeignKey
ALTER TABLE "participant_sources" ADD CONSTRAINT "participant_sources_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multicam_layouts" ADD CONSTRAINT "multicam_layouts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "editor_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "multicam_segments" ADD CONSTRAINT "multicam_segments_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "multicam_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
