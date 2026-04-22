import express from 'express';
import { prisma } from '../prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

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

function toQuestionPayload(question) {
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

function toPublicQuestionPayload(question) {
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

/**
 * GET /api/questions/random
 * Fetch a random question with all necessary metadata
 * Excludes hidden tests and hidden metadata
 */
router.get('/random', authMiddleware, async (req, res) => {
  try {
    const count = await prisma.question.count();

    if (count === 0) {
      return res.status(404).json({
        error: 'No questions available',
      });
    }

    const randomIndex = Math.floor(Math.random() * count);
    const question = await prisma.question.findMany({
      skip: randomIndex,
      take: 1,
    });

    if (!question.length) {
      return res.status(404).json({
        error: 'Question not found',
      });
    }
    res.json(toPublicQuestionPayload(question[0]));
  } catch (error) {
    console.error('Error fetching random question:', error);
    res.status(500).json({
      error: 'Failed to fetch question',
      message: error.message,
    });
  }
});

/**
 * GET /api/questions/:questionId
 * Fetch a specific question by ID
 */
router.get('/:questionId', authMiddleware, async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return res.status(404).json({
        error: 'Question not found',
      });
    }
    res.json(toQuestionPayload(question));
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      error: 'Failed to fetch question',
      message: error.message,
    });
  }
});

export default router;
