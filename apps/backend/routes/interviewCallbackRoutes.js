import express from 'express';
import { prisma } from '../prismaClient.js';
import { decrypt } from '../lib/encryption.js';
import { getSessionOwner, deleteSessionOwner } from '../lib/sessionOwnerStore.js';
import { getSessionProgress, setSessionProgress, deleteSessionProgress } from '../lib/sessionProgressStore.js';

const router = express.Router();

// --- SSE-based approach: no polling needed ---
// Maps sessionId -> { res: SSE response object } for waiting clients
const sseClients = new Map();
// Fallback store: if n8n callback arrives before the frontend connects via SSE
const callbackDataStore = new Map();

const AGENT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/9b19cc19-9275-43c2-8e66-6bcb0642c639';

/**
 * Resolve ElevenLabs API key for a user (from their integration or platform key for demo)
 */
async function resolveElevenLabsKey(userId) {
  if (!userId) {
    return { apiKey: null, source: 'no_user' };
  }

  const integration = await prisma.elevenLabsIntegration.findUnique({ where: { userId } });
  if (integration) {
    const apiKey = decrypt(integration.apiKeyCiphertext, integration.apiKeyIv, integration.apiKeyTag);
    await prisma.elevenLabsIntegration.update({ where: { userId }, data: { lastUsedAt: new Date() } });
    return { apiKey, source: 'user' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { demoBehaviouralCredits: true }
  });

  if (user && user.demoBehaviouralCredits > 0) {
    const platformKey = process.env.ELEVENLABS_PLATFORM_KEY;
    if (platformKey) {
      return { apiKey: platformKey, source: 'demo' };
    }
  }

  return { apiKey: null, source: 'none' };
}

const emitProgressUpdate = (sessionId, message, stage = 'info') => {
  const progress = {
    message,
    stage,
    updatedAt: new Date().toISOString()
  };

  setSessionProgress(sessionId, message, stage);

  const sseClient = sseClients.get(sessionId);
  if (sseClient) {
    sseClient.write(`event: progress-update\ndata: ${JSON.stringify(progress)}\n\n`);
  }
};

// SSE endpoint: frontend connects here and waits for n8n callback data
router.get('/session/:sessionId/stream', (req, res) => {
  const { sessionId } = req.params;

  console.log(`📡 SSE client connected for session ${sessionId}`);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial heartbeat so the client knows the connection is alive
  res.write('event: connected\ndata: {}\n\n');

  const existingProgress = getSessionProgress(sessionId);
  if (existingProgress) {
    res.write(`event: progress-update\ndata: ${JSON.stringify(existingProgress)}\n\n`);
  }

  // Check if callback data already arrived before SSE connected (race condition)
  const existingData = callbackDataStore.get(sessionId);
  if (existingData) {
    console.log(`⚡ Callback data already exists for session ${sessionId}, sending immediately`);
    res.write(`event: callback-data\ndata: ${JSON.stringify(existingData)}\n\n`);
    callbackDataStore.delete(sessionId);
    res.end();
    return;
  }

  // Register this client to receive the callback when it arrives
  sseClients.set(sessionId, res);

  // Keep-alive ping every 15 seconds to prevent proxy/browser timeout
  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 15000);

  // Cleanup when client disconnects
  req.on('close', () => {
    console.log(`📡 SSE client disconnected for session ${sessionId}`);
    clearInterval(keepAlive);
    sseClients.delete(sessionId);
  });
});

// n8n callback: store data and push to waiting SSE client instantly
router.post('/session/:sessionId/callback', async (req, res) => {
  const { sessionId } = req.params;
  const {
    agent_id,
    agentId,
    userId,
    user_id,
    interview_plan,
    interview_prompt,
    interview_primpot,
    feedback_prompt,
    feedback_prompt_final,
    firstMessage,
    first_message,
    feedback,
    duration,
    cv,
    candidate_cv
  } = req.body || {};
  let callbackAgentId = agent_id || agentId || null;
  const callbackUserId = userId || user_id || getSessionOwner(sessionId) || null;
  const interviewPromptValue = interview_prompt || interview_primpot || undefined;
  const feedbackPromptValue = feedback_prompt_final || feedback_prompt || undefined;
  const firstMessageValue = firstMessage || first_message || undefined;
  const cvValue = cv || candidate_cv || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload keys:', Object.keys(req.body || {}));
  console.log('📦 agent_id from callback:', callbackAgentId, '| interview_prompt exists:', !!interviewPromptValue);
  console.log('📦 cv exists:', !!cvValue, '| cv length:', cvValue?.length || 0);

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Prompt workflow does not return agent_id; resolve from DB user association first.
    if (callbackUserId) {
      const existingAgent = await prisma.agent.findFirst({
        where: { userId: callbackUserId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });
      if (existingAgent?.id) {
        callbackAgentId = existingAgent.id;
        console.log('🔎 Resolved existing agent_id from DB for user:', callbackUserId, '| agent_id:', callbackAgentId);
      } else {
        callbackAgentId = null;
        console.log('🔎 No existing agent_id found in DB for user:', callbackUserId);
      }
    }

    const callbackData = {
      agentId: callbackAgentId,
      interviewPlan: interview_plan,
      interviewPrompt: interviewPromptValue,
      feedbackPrompt: feedbackPromptValue,
      firstMessage: firstMessageValue,
      feedback: feedback,
      duration: duration,
      receivedAt: new Date().toISOString()
    };

    emitProgressUpdate(sessionId, 'Interview prompts ready.', 'prompt_ready');

    console.log('🔧 Triggering agent setup workflow to configure agent prompts...');
    console.log('🔧 Calling:', AGENT_SETUP_WEBHOOK_URL);
    emitProgressUpdate(sessionId, 'Configuring your agent...', 'agent_setup');

    // Resolve ElevenLabs API key for this user (or platform fallback) for agent setup.
    const keyResolution = await resolveElevenLabsKey(callbackUserId);
    const elevenLabsKey = keyResolution.apiKey;
    console.log('🔑 Resolved ElevenLabs key source:', keyResolution.source, '| user:', callbackUserId || 'unknown', '| key exists:', !!elevenLabsKey);

    const agentSetupPayload = {
      interview_prompt: interviewPromptValue,
      feedback_prompt: feedbackPromptValue,
      first_message: firstMessageValue,
      session_id: sessionId,
      cv: cvValue,
      agent_id: callbackAgentId || ''  // Always send agent_id field; empty lets workflow create one
    };

    console.log('🔧 Agent setup payload:', JSON.stringify({
      interview_prompt: !!interviewPromptValue,
      feedback_prompt: !!feedbackPromptValue,
      first_message: !!firstMessageValue,
      session_id: sessionId,
      cv: !!cvValue,
      agent_id: callbackAgentId || ''
    }));

    const headers = { 'Content-Type': 'application/json' };
    if (elevenLabsKey) {
      headers['X-ELEVENLABS-KEY'] = elevenLabsKey;
    } else {
      console.warn('⚠️ No ElevenLabs key resolved for agent setup workflow.');
    }

    const agentSetupResponse = await fetch(AGENT_SETUP_WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(agentSetupPayload)
    });

    if (!agentSetupResponse.ok) {
      throw new Error(`Agent setup workflow failed with status ${agentSetupResponse.status}`);
    }

    const agentSetupResult = await agentSetupResponse.json().catch(() => ({}));
    const resolvedAgentId =
      agentSetupResult.agent_id ||
      agentSetupResult.agentId ||
      agentSetupResult.data?.agent_id ||
      agentSetupResult.data?.agentId ||
      callbackAgentId ||
      null;

    if (!resolvedAgentId) {
      throw new Error('Agent setup workflow did not return agent_id');
    }

    callbackAgentId = resolvedAgentId;
    callbackData.agentId = callbackAgentId;
    emitProgressUpdate(sessionId, 'Agent configured. Finalizing your session...', 'finalizing');

    // Persist agent as soon as n8n returns it for the first time.
    if (callbackAgentId && callbackUserId) {
      await prisma.agent.upsert({
        where: { id: callbackAgentId },
        update: { userId: callbackUserId },
        create: { id: callbackAgentId, userId: callbackUserId }
      });
      console.log(`💾 Persisted callback agent_id ${callbackAgentId} for user ${callbackUserId}`);
      deleteSessionOwner(sessionId);
      emitProgressUpdate(sessionId, 'Session is ready. Launching your interview...', 'ready');
    } else if (callbackAgentId) {
      console.warn(`⚠️ Received agent_id ${callbackAgentId} but no userId in callback body; skipping immediate persistence.`);
    }

    // If an SSE client is waiting, push the data immediately
    const sseClient = sseClients.get(sessionId);
    if (sseClient) {
      console.log(`🚀 Pushing callback data to SSE client for session ${sessionId}`);
      sseClient.write(`event: callback-data\ndata: ${JSON.stringify(callbackData)}\n\n`);
      sseClient.end();
      sseClients.delete(sessionId);
      deleteSessionProgress(sessionId);
    } else {
      // No SSE client yet — store for when they connect
      console.log(`💾 No SSE client yet for session ${sessionId}, storing data for later`);
      callbackDataStore.set(sessionId, callbackData);
    }

    res.json({ success: true, message: 'Callback data received and delivered' });
  } catch (error) {
    console.error('Error processing callback:', error);
    emitProgressUpdate(sessionId, 'Setup hit an issue, retrying steps...', 'error');
    res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

export default router;
