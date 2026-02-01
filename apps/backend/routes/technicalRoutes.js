import express from 'express';
import { prisma } from '../prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/questions/random
 * Fetch a random question with all necessary metadata
 * Excludes hidden tests and hidden metadata
 */
router.get('/random', authMiddleware, async (req, res) => {
  try {
    // Get total count of questions
    const count = await prisma.question.count();

    if (count === 0) {
      return res.status(404).json({
        error: 'No questions available',
      });
    }

    // Get random question
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

    const q = question[0];

    // Parse JSON fields safely
    let boilerplate = {};
    let visibleTests = [];
    let constraints = [];
    let skillTargets = [];
    let tags = [];

    try {
      boilerplate = typeof q.boilerplate === 'string' ? JSON.parse(q.boilerplate) : q.boilerplate;
      visibleTests = typeof q.visibleTests === 'string' ? JSON.parse(q.visibleTests) : q.visibleTests;
      constraints = typeof q.constraints === 'string' ? JSON.parse(q.constraints) : q.constraints;
      skillTargets = typeof q.skillTargets === 'string' ? JSON.parse(q.skillTargets) : q.skillTargets;
      tags = typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags;
    } catch (parseError) {
      console.error('Error parsing question JSON:', parseError);
    }

    // Return question with all necessary data, EXCLUDING hidden tests and hidden metadata
    res.json({
      id: q.id,
      slug: q.slug,
      title: q.title,
      difficulty: q.difficulty,
      skillTargets,
      tags,
      problemStatement: q.problemStatement,
      constraints,
      boilerplate, // All 3 languages
      visibleTests, // Only visible tests (user can see these)
      // NEVER include:
      // - hiddenTests
      // - failureModes
      // - hints (could be exposed)
      // - interviewerProbes
    });
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
      where: { id: parseInt(questionId) },
    });

    if (!question) {
      return res.status(404).json({
        error: 'Question not found',
      });
    }

    // Parse JSON fields safely
    let boilerplate = {};
    let visibleTests = [];
    let constraints = [];
    let skillTargets = [];
    let tags = [];

    try {
      boilerplate = typeof question.boilerplate === 'string' ? JSON.parse(question.boilerplate) : question.boilerplate;
      visibleTests = typeof question.visibleTests === 'string' ? JSON.parse(question.visibleTests) : question.visibleTests;
      constraints = typeof question.constraints === 'string' ? JSON.parse(question.constraints) : question.constraints;
      skillTargets = typeof question.skillTargets === 'string' ? JSON.parse(question.skillTargets) : question.skillTargets;
      tags = typeof question.tags === 'string' ? JSON.parse(question.tags) : question.tags;
    } catch (parseError) {
      console.error('Error parsing question JSON:', parseError);
    }

    res.json({
      id: question.id,
      slug: question.slug,
      title: question.title,
      difficulty: question.difficulty,
      skillTargets,
      tags,
      problemStatement: question.problemStatement,
      constraints,
      boilerplate,
      visibleTests,
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      error: 'Failed to fetch question',
      message: error.message,
    });
  }
});

export default router;
