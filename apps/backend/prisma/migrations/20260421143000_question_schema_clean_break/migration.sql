-- Clean break: replace legacy Question schema with canonical authoring schema.
DROP TABLE IF EXISTS "Question";

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "pattern_tags" JSONB NOT NULL DEFAULT '[]',
    "languages_supported" JSONB NOT NULL DEFAULT '[]',
    "estimated_time_min" INTEGER NOT NULL,
    "problem_statement" TEXT NOT NULL,
    "examples" JSONB NOT NULL DEFAULT '[]',
    "constraints" JSONB NOT NULL DEFAULT '[]',
    "hidden_tests" JSONB NOT NULL DEFAULT '[]',
    "solutions" JSONB NOT NULL,
    "hint_framework" JSONB NOT NULL,
    "common_mistakes" JSONB NOT NULL DEFAULT '[]',
    "follow_ups" JSONB NOT NULL DEFAULT '[]',
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Session"
    ADD COLUMN "technicalQuestionId" TEXT,
    ADD COLUMN "technicalQuestionSnapshot" JSONB;

ALTER TABLE "Session"
    ADD CONSTRAINT "Session_technicalQuestionId_fkey"
    FOREIGN KEY ("technicalQuestionId") REFERENCES "Question"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
