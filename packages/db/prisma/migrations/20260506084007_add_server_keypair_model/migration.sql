-- CreateTable
CREATE TABLE "server_keypairs" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "publicKeyPem" TEXT NOT NULL,
    "privateKeyPem" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RSA-OAEP-256',
    "modulusLength" INTEGER NOT NULL DEFAULT 4096,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_keypairs_pkey" PRIMARY KEY ("id")
);
