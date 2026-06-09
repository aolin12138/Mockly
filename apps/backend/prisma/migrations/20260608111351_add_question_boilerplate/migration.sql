-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "boilerplate" JSONB NOT NULL DEFAULT '{}';
