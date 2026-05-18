-- AlterEnum
ALTER TYPE "UserTier" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "startedAt" TIMESTAMP(3);
