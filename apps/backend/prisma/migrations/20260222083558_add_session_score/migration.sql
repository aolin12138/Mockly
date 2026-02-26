/*
  Warnings:

  - You are about to drop the column `firstMessage` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `settingsHash` on the `Agent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "firstMessage",
DROP COLUMN "settingsHash";

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "score" INTEGER;
