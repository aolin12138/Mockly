const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const rootDir = path.resolve(__dirname, '../../../');

dotenv.config({ path: path.join(rootDir, '.env') });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sourcePath = path.join(rootDir, 'Mockly/test/generated_question_candidates_2026-04-22.json');

async function main() {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const payload = JSON.parse(raw);
  const questions = Array.isArray(payload.questions) ? payload.questions : [];

  if (questions.length === 0) {
    throw new Error('No questions found in generated payload');
  }

  console.log(`Importing ${questions.length} questions from ${sourcePath}`);

  for (const question of questions) {
    const data = {
      id: question.id,
      title: question.title,
      difficulty: question.difficulty,
      pattern_tags: question.pattern_tags || [],
      languages_supported: question.languages_supported || [],
      estimated_time_min: question.estimated_time_min,
      problem_statement: question.problem_statement,
      examples: question.examples || [],
      constraints: question.constraints || [],
      hidden_tests: question.hidden_tests || [],
      solutions: question.solutions,
      hint_framework: question.hint_framework,
      common_mistakes: question.common_mistakes || [],
      follow_ups: question.follow_ups || [],
      meta: question.meta,
      topics: question.topics || []
    };

    await prisma.question.upsert({
      where: { id: question.id },
      update: data,
      create: data
    });

    console.log(`✓ Upserted ${question.id}`);
  }

  const count = await prisma.question.count();
  console.log(`Total questions in DB: ${count}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Import complete');
  })
  .catch(async (error) => {
    console.error('Import failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
