-- AlterTable
ALTER TABLE "editor_projects" ALTER COLUMN "width" SET DEFAULT 1920;
ALTER TABLE "editor_projects" ALTER COLUMN "height" SET DEFAULT 1080;

-- Backfill existing projects that still use the old default canvas size.
UPDATE "editor_projects"
SET "width" = 1920,
    "height" = 1080
WHERE "width" = 1280
  AND "height" = 720;
