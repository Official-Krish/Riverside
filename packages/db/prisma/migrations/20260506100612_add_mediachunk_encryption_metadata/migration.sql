-- AlterTable
ALTER TABLE "media_chunks" ADD COLUMN     "encryptionAlgorithm" TEXT,
ADD COLUMN     "encryptionIv" TEXT,
ADD COLUMN     "encryptionTagBits" INTEGER,
ADD COLUMN     "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceMimeType" TEXT;
