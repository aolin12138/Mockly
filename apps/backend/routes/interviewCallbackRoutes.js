import express from 'express';
import { prisma } from '../prismaClient.js';

const router = express.Router();

// In-memory store for session callback data (temporary until session is saved to DB)
const sessionCallbackStore = new Map();

// n8n callback to store session data in memory (NO DATABASE WRITES)
router.post('/session/:sessionId/callback', async (req, res) => {
  const { sessionId } = req.params;
  const { agent_id, interview_plan, interview_prompt, interview_primpot, feedback_prompt, feedback_prompt_final, feedback, duration } = req.body || {};
  const interviewPromptValue = interview_prompt || interview_primpot || undefined;
  const feedbackPromptValue = feedback_prompt_final || feedback_prompt || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload:', JSON.stringify(req.body, null, 2));

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Store callback data in memory (fallback)
    const callbackData = {
      agentId: agent_id,
      interviewPlan: interview_plan,
      interviewPrompt: interviewPromptValue,
      feedbackPrompt: feedbackPromptValue,
      feedback: feedback,
      duration: duration,
      receivedAt: new Date().toISOString()
    };

    sessionCallbackStore.set(sessionId, callbackData);
    console.log(`Callback data stored in memory for session ${sessionId}`);

    // Persist callback data to database if session exists
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          agentId: agent_id || null,
          interviewPlan: interview_plan || null,
          interviewPrompt: interviewPromptValue || null,
          feedbackPrompt: feedbackPromptValue || null,
          feedback: feedback || null,
          duration: typeof duration === 'number' ? duration : null,
          status: 'ready'
        }
      });
      console.log(`Callback data persisted for session ${sessionId}`);
    } catch (dbError) {
      console.warn(`Callback data not persisted for session ${sessionId}:`, dbError?.message || dbError);
    }

    res.json({ success: true, message: 'Callback data received and stored' });
  } catch (error) {
    console.error('Error processing callback:', error);
    res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

// GET endpoint to retrieve stored callback data
router.get('/session/:sessionId/callback-data', async (req, res) => {
  const { sessionId } = req.params;

  console.log(`🔍 Callback data requested for sessionId: ${sessionId}`);

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const callbackData = sessionCallbackStore.get(sessionId);

    if (!callbackData) {
      return res.status(404).json({ error: 'No callback data found for this session' });
    }

    res.json({ data: callbackData });
  } catch (error) {
    console.error('Error retrieving callback data:', error);
    res.status(500).json({ error: 'Failed to retrieve callback data', details: error.message });
  }
});

export default router;
