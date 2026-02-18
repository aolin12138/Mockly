import express from 'express';
import { prisma } from '../prismaClient.js';

const router = express.Router();

// In-memory store for session callback data (temporary until session is saved to DB)
const sessionCallbackStore = new Map();
// In-memory store mapping temporary sessionId -> userId
const sessionOwnerStore = new Map();

export function registerSessionOwner(sessionId, userId) {
  if (!sessionId || !userId) return;
  sessionOwnerStore.set(sessionId, userId);
}

export function clearSessionOwner(sessionId) {
  if (!sessionId) return;
  sessionOwnerStore.delete(sessionId);
}

export function seedCallbackData(sessionId, data) {
  if (!sessionId) return;
  const existing = sessionCallbackStore.get(sessionId) || {};
  const merged = {
    ...existing,
    ...data,
    receivedAt: new Date().toISOString()
  };
  sessionCallbackStore.set(sessionId, merged);
}

// n8n callback to store session data in memory (NO DATABASE WRITES)
router.post('/session/:sessionId/callback', async (req, res) => {
  const { sessionId } = req.params;
  const { agent_id, interview_plan, interview_prompt, interview_primpot, feedback_prompt, feedback_prompt_final, feedback, duration, first_message } = req.body || {};
  const interviewPromptValue = interview_prompt || interview_primpot || undefined;
  const feedbackPromptValue = feedback_prompt_final || feedback_prompt || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload:', JSON.stringify(req.body, null, 2));

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Merge with existing callback data (setup callback may arrive before feedback callback)
    const existing = sessionCallbackStore.get(sessionId) || {};
    const callbackData = {
      ...existing,
      ...(agent_id !== undefined && { agentId: agent_id }),
      ...(interview_plan !== undefined && { interviewPlan: interview_plan }),
      ...(interviewPromptValue !== undefined && { interviewPrompt: interviewPromptValue }),
      ...(feedbackPromptValue !== undefined && { feedbackPrompt: feedbackPromptValue }),
      ...(feedback !== undefined && { feedback: feedback }),
      ...(duration !== undefined && { duration: duration }),
      ...(first_message !== undefined && { firstMessage: first_message }),
      receivedAt: new Date().toISOString()
    };

    sessionCallbackStore.set(sessionId, callbackData);
    console.log(`✅ Callback data merged in memory for session "${sessionId}" (has feedback: ${!!feedback})`);
    console.log(`🗺️ Map now has ${sessionCallbackStore.size} entries. Keys: [${[...sessionCallbackStore.keys()].join(', ')}]`);

    // No Session DB writes here. Sessions are persisted only after feedback is received
    // in POST /behavioral/save.

    // Save Agent record during setup callback so quick-start can reuse it next time.
    if (agent_id && !feedback) {
      const ownerUserId = sessionOwnerStore.get(sessionId);
      if (!ownerUserId) {
        console.warn(`No session owner found for ${sessionId}; skipping Agent creation for ${agent_id}`);
      } else {
        try {
          await prisma.agent.upsert({
            where: { id: agent_id },
            create: {
              id: agent_id,
              userId: ownerUserId,
              interviewPrompt: interviewPromptValue ?? null,
              feedbackPrompt: feedbackPromptValue ?? null,
              interviewPlan: interview_plan ?? null,
              firstMessage: first_message ?? null
            },
            update: {
              interviewPrompt: interviewPromptValue ?? null,
              feedbackPrompt: feedbackPromptValue ?? null,
              interviewPlan: interview_plan ?? null,
              firstMessage: first_message ?? null
            }
          });
          console.log(`✅ Agent record upserted: ${agent_id} for user ${ownerUserId}`);
        } catch (agentError) {
          console.warn(`Failed to create Agent record for ${agent_id}:`, agentError?.message || agentError);
        }
      }
    }

    res.json({ success: true, message: 'Callback data received and stored' });
  } catch (error) {
    console.error('Error processing callback:', error);
    res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

// GET endpoint to retrieve stored callback data (checks in-memory Map first, then DB fallback)
router.get('/session/:sessionId/callback-data', async (req, res) => {
  const { sessionId } = req.params;

  console.log(`🔍 Callback data requested for sessionId: ${sessionId}`);
  console.log(`🗺️ In-memory store has ${sessionCallbackStore.size} entries. Keys: [${[...sessionCallbackStore.keys()].join(', ')}]`);

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // First check in-memory store
    const callbackData = sessionCallbackStore.get(sessionId);

    if (callbackData) {
      console.log(`✅ Found callback data in memory for ${sessionId}`);
      return res.json({ data: callbackData });
    }

    console.log(`❌ No callback data found anywhere for ${sessionId}`);
    return res.status(404).json({ error: 'No callback data found for this session' });
  } catch (error) {
    console.error('Error retrieving callback data:', error);
    res.status(500).json({ error: 'Failed to retrieve callback data', details: error.message });
  }
});

export default router;
