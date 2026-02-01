import express from 'express';
import { prisma } from '../prismaClient.js';

const router = express.Router();

// Get user profile
router.get('/profile', async (req, res) => {
  const userId = req.userId; // From authMiddleware

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile', details: error.message });
  }
});

// Get user sessions with feedback
router.get('/sessions', async (req, res) => {
  const userId = req.userId; // From authMiddleware

  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
  }
});

export default router;
