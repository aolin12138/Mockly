import { prisma } from '../prismaClient.js';

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

export function toQuestionPayload(question) {
  return {
    id: question.id,
    title: question.title,
    difficulty: question.difficulty,
    topics: parseJson(question.topics, []),
    pattern_tags: parseJson(question.pattern_tags, []),
    languages_supported: parseJson(question.languages_supported, []),
    estimated_time_min: question.estimated_time_min,
    problem_statement: question.problem_statement,
    examples: parseJson(question.examples, []),
    constraints: parseJson(question.constraints, []),
    hidden_tests: parseJson(question.hidden_tests, []),
    solutions: parseJson(question.solutions, {}),
    hint_framework: parseJson(question.hint_framework, {}),
    common_mistakes: parseJson(question.common_mistakes, []),
    follow_ups: parseJson(question.follow_ups, []),
    meta: parseJson(question.meta, {}),
  };
}

export function toPublicQuestionPayload(question) {
  return {
    id: question.id,
    title: question.title,
    difficulty: question.difficulty,
    topics: parseJson(question.topics, []),
    pattern_tags: parseJson(question.pattern_tags, []),
    languages_supported: parseJson(question.languages_supported, []),
    estimated_time_min: question.estimated_time_min,
    problem_statement: question.problem_statement,
    examples: parseJson(question.examples, []),
    constraints: parseJson(question.constraints, []),
  };
}

export async function getRandomQuestion() {
  const count = await prisma.question.count();
  if (count === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * count);
  const questions = await prisma.question.findMany({
    skip: randomIndex,
    take: 1,
  });

  return questions[0] || null;
}
