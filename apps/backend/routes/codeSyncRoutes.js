/**
 * POST /api/code/sync
 *
 * Frontend pushes the candidate's current code periodically so the MCP server
 * can serve it to the ElevenLabs interview agent via get_current_code.
 *
 * Body: { sessionId, code, language }
 */

import express from 'express';
import { prisma } from '../prismaClient.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

const VALID_LANGUAGES = new Set(['javascript', 'python', 'java']);
const MAX_CODE_LENGTH = 200 * 1024; // 200KB

router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const { sessionId, code, language } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    if (typeof code !== 'string') {
      return res.status(400).json({ error: 'code must be a string' });
    }

    if (code.length > MAX_CODE_LENGTH) {
      return res.status(413).json({ error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} bytes` });
    }

    const lang = (language || 'javascript').toLowerCase();
    if (!VALID_LANGUAGES.has(lang)) {
      return res.status(400).json({
        error: `Unsupported language: ${lang}. Supported: javascript, python, java`,
      });
    }

    // Verify session ownership
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.userId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        latestCode: code,
        latestLanguage: lang,
      },
    });

    res.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (error) {
    console.error('[code-sync] Error:', error.message);
    res.status(500).json({ error: 'Failed to sync code', details: error.message });
  }
});

export default router;
