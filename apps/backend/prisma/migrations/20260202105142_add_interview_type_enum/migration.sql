-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('Behavioural', 'Technical');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "interviewType" "InterviewType" NOT NULL DEFAULT 'Behavioural';
