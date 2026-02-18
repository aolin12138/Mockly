-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "feedbackPrompt" TEXT,
ADD COLUMN     "firstMessage" TEXT,
ADD COLUMN     "interviewPlan" TEXT,
ADD COLUMN     "interviewPrompt" TEXT,
ADD COLUMN     "settingsHash" TEXT;
