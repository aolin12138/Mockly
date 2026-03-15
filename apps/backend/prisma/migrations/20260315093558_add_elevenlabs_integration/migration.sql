-- AlterTable
ALTER TABLE "User" ADD COLUMN     "demoBehaviouralCredits" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ElevenLabsIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyCiphertext" BYTEA NOT NULL,
    "apiKeyIv" BYTEA NOT NULL,
    "apiKeyTag" BYTEA NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElevenLabsIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElevenLabsIntegration_userId_key" ON "ElevenLabsIntegration"("userId");

-- AddForeignKey
ALTER TABLE "ElevenLabsIntegration" ADD CONSTRAINT "ElevenLabsIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
