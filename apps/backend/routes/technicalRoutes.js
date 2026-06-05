import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import { prisma } from '../prismaClient.js';
import {
  getRandomQuestion,
  toPublicQuestionPayload,
  toQuestionPayload,
} from '../lib/technicalQuestions.js';

const router = express.Router();

/**
 * GET /api/questions/random
 * Fetch a random question with all necessary metadata
 * Excludes hidden tests and hidden metadata
 */
router.get('/random', authMiddleware, async (req, res) => {
  try {
    const question = await getRandomQuestion();
    if (!question) {
      return res.status(404).json({
        error: 'No questions available',
      });
    }
    res.json(toPublicQuestionPayload(question));
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
