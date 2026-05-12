-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'STARTED', 'ENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "meeting_schedules" ADD COLUMN     "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED';
