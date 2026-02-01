import express from 'express';
import { prisma } from '../prismaClient.js';

const router = express.Router();

// n8n callback to update session after async processing
router.post('/session/:sessionId/callback', async (req, res) => {
  const { sessionId } = req.params;
  const { agent_id, interview_plan, interview_prompt, interview_primpot, feedback_prompt, feedback_prompt_final, feedback } = req.body || {};
  const interviewPromptValue = interview_prompt || interview_primpot || undefined;
  const feedbackPromptValue = feedback_prompt_final || feedback_prompt || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload:', JSON.stringify(req.body, null, 2));

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        agentId: agent_id || undefined,
        interviewPlan: interview_plan || undefined,
        interviewPrompt: interviewPromptValue,
        feedbackPrompt: feedbackPromptValue,
        feedback: feedback || undefined
      }
    });

    if (agent_id) {
      const existingAgent = await prisma.agent.findUnique({ where: { id: agent_id } });
      if (!existingAgent) {
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (session?.userId) {
          await prisma.agent.create({
            data: {
              id: agent_id,
              userId: session.userId
            }
          });
        }
      }
    }

    console.log(`Session ${sessionId} updated via callback`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating session via callback:', error);
    res.status(500).json({ error: 'Failed to update session', details: error.message });
  }
});

export default router;
