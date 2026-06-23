-- Step 1: Add type column with a default for existing rows (default to Behavioural)
ALTER TABLE "Agent" ADD COLUMN "type" "InterviewType" NOT NULL DEFAULT 'Behavioural';

-- Step 2: Remove the default now that all rows have a value
ALTER TABLE "Agent" ALTER COLUMN "type" DROP DEFAULT;

-- Step 3: Add unique constraint (one agent per type per user)
-- First check for duplicates and keep the latest one
-- (if a user somehow has multiple Behavioural agents, keep the most recent)
DELETE FROM "Agent" a1
USING "Agent" a2
WHERE a1."userId" = a2."userId"
  AND a1."type" = a2."type"
  AND a1."createdAt" < a2."createdAt";

-- Now add the unique constraint
CREATE UNIQUE INDEX "Agent_userId_type_key" ON "Agent"("userId", "type");
