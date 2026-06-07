import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient.js';
import { decrypt } from '../lib/encryption.js';
import { getSessionOwner, deleteSessionOwner } from '../lib/sessionOwnerStore.js';
import { getSessionProgress, setSessionProgress, deleteSessionProgress } from '../lib/sessionProgressStore.js';
import { clearFeedbackGenerationInFlight } from './interviewRoutes.js';

const router = express.Router();

// --- SSE-based approach: no polling needed ---
// Maps sessionId -> { res: SSE response object } for waiting clients
const sseClients = new Map();
// Fallback store: if n8n callback arrives before the frontend connects via SSE
const callbackDataStore = new Map();
// Retry context store when agent setup fails (in-memory)
const pendingAgentSetupStore = new Map();
// Map temp session IDs to persisted DB session IDs (in-memory)
const tempSessionToPersistedSessionId = new Map();
// Maps sessionId -> Set<SSE response>
const feedbackSseClients = new Map();
// Fallback store in case callback arrives before results SSE connects
const feedbackEventStore = new Map();

const AGENT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/9b19cc19-9275-43c2-8e66-6bcb0642c639';
const ELEVENLABS_CONVAI_BASE_URL = 'https://api.elevenlabs.io/v1/convai';
const CREDIT_TOOL_NAME = 'getCreditStatus';
const COMPLETE_INTERVIEW_TOOL_NAME = 'completeInterview';

const CREDIT_TOOL_WARNING_MESSAGE = 'Credit-aware wrap-up may be unavailable for this session. If your remaining credits are low, the interview could end abruptly.';
const FEEDBACK_CALLBACK_SECRET = process.env.FEEDBACK_CALLBACK_SECRET || '';

const verifyUserIdFromToken = (token) => {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded?.userId || null;
  } catch {
    return null;
  }
};

const buildCreditToolConfig = () => ({
  type: 'client',
  name: CREDIT_TOOL_NAME,
  description: 'Check remaining ElevenLabs credits and estimated minutes for this user session.',
  expects_response: true,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
});

const buildCompleteInterviewToolConfig = () => ({
  type: 'client',
  name: COMPLETE_INTERVIEW_TOOL_NAME,
  description: 'Finish the interview in the app. Use this when the interview is truly complete, instead of any built-in end-call or hang-up action.',
  expects_response: true,
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
});

const normalizeToolList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tools)) return payload.tools;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const findMatchingCreditTool = (tools) => {
  return tools.find((tool) => {
    const cfg = tool?.tool_config || {};
    return cfg.type === 'client' && cfg.name === CREDIT_TOOL_NAME;
  }) || null;
};

const findMatchingCompleteInterviewTool = (tools) => {
  return tools.find((tool) => {
    const cfg = tool?.tool_config || {};
    return cfg.type === 'client' && cfg.name === COMPLETE_INTERVIEW_TOOL_NAME;
  }) || null;
};

async function elevenLabsRequest(apiKey, path, options = {}) {
  const response = await fetch(`${ELEVENLABS_CONVAI_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const raw = await response.text();
  let data = null;
  if (raw && raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const err = new Error(raw || `${options.method || 'GET'} ${path} failed with ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return data;
}

async function ensureCreditToolAttachedForAgent({ userId, agentId }) {
  try {
    console.log('[credit_tool_check_start]', JSON.stringify({ userId, agentId }));

    const keyResolution = await resolveElevenLabsKey(userId);
    const apiKey = keyResolution.apiKey;

    const agent = await elevenLabsRequest(apiKey, `/agents/${agentId}`);
    const existingPrompt = agent?.conversation_config?.agent?.prompt || {};
    const { tools: _legacyTools, tool_ids: _existingToolIds, ...promptWithoutTools } = existingPrompt;
    const existingToolIds = agent?.conversation_config?.agent?.prompt?.tool_ids;
    const mergedToolIds = Array.isArray(existingToolIds) ? [...existingToolIds] : [];

    const allToolsPayload = await elevenLabsRequest(apiKey, '/tools');
    const allTools = normalizeToolList(allToolsPayload);

    let creditTool = findMatchingCreditTool(allTools);
    if (!creditTool) {
      const createdTool = await elevenLabsRequest(apiKey, '/tools', {
        method: 'POST',
        body: {
          tool_config: buildCreditToolConfig()
        }
      });
      creditTool = createdTool;
      console.log('[credit_tool_created]', JSON.stringify({ userId, agentId, toolId: creditTool?.id || null }));
    } else {
      console.log('[credit_tool_found]', JSON.stringify({ userId, agentId, toolId: creditTool.id }));
    }

    const toolId = creditTool?.id;
    if (!toolId) {
      throw new Error('Credit tool ID missing after lookup/create');
    }

    let needsPatch = false;
    if (!mergedToolIds.includes(toolId)) {
      mergedToolIds.push(toolId);
      needsPatch = true;
      console.log('[credit_tool_attached]', JSON.stringify({ userId, agentId, toolId }));
    }

    let completionToolReady = true;
    try {
      let completionTool = findMatchingCompleteInterviewTool(allTools);
      if (!completionTool) {
        completionTool = await elevenLabsRequest(apiKey, '/tools', {
          method: 'POST',
          body: {
            tool_config: buildCompleteInterviewToolConfig()
          }
        });
        console.log('[complete_interview_tool_created]', JSON.stringify({ userId, agentId, toolId: completionTool?.id || null }));
      } else {
        console.log('[complete_interview_tool_found]', JSON.stringify({ userId, agentId, toolId: completionTool.id }));
      }

      const completionToolId = completionTool?.id;
      if (!completionToolId) {
        throw new Error('Complete interview tool ID missing after lookup/create');
      }

      if (!mergedToolIds.includes(completionToolId)) {
        mergedToolIds.push(completionToolId);
        needsPatch = true;
        console.log('[complete_interview_tool_attached]', JSON.stringify({ userId, agentId, toolId: completionToolId }));
      }
    } catch (error) {
      completionToolReady = false;
      console.error('[complete_interview_tool_soft_fail]', JSON.stringify({
        userId,
        agentId,
        message: error?.message || 'Unknown error'
      }));
    }

    if (needsPatch) {
      await elevenLabsRequest(apiKey, `/agents/${agentId}`, {
        method: 'PATCH',
        body: {
          conversation_config: {
            agent: {
              prompt: {
                ...promptWithoutTools,
                tool_ids: mergedToolIds
              }
            }
          }
        }
      });
    }

    return { toolReady: true, toolId, completionToolReady };
  } catch (error) {
    console.error('[credit_tool_soft_fail]', JSON.stringify({
      userId,
      agentId,
      message: error?.message || 'Unknown error'
    }));
    return {
      toolReady: false,
      toolWarning: CREDIT_TOOL_WARNING_MESSAGE
    };
  }
}

async function ensurePersistedBehavioralSession({
  tempSessionId,
  userId,
  agentId,
  interviewPlan,
  interviewPrompt,
  feedbackPrompt
}) {
  const existingId = tempSessionToPersistedSessionId.get(tempSessionId);
  if (existingId) {
    return existingId;
  }

  const session = await prisma.session.upsert({
    where: { id: tempSessionId },
    update: {
      userId,
      interviewType: 'Behavioural',
      agentId: agentId || null,
      interviewPlan: interviewPlan || null,
      interviewPrompt: interviewPrompt || null,
      feedbackPrompt: feedbackPrompt || null
    },
    create: {
      id: tempSessionId,
      userId,
      interviewType: 'Behavioural',
      agentId: agentId || null,
      interviewPlan: interviewPlan || null,
      interviewPrompt: interviewPrompt || null,
      feedbackPrompt: feedbackPrompt || null,
      feedback: null,
      status: 'not_started'
    }
  });

  tempSessionToPersistedSessionId.set(tempSessionId, session.id);
  return session.id;
}

/**
 * Resolve ElevenLabs API key for a user (from their integration or platform key for demo)
 */
async function resolveElevenLabsKey(userId) {
  if (!userId) {
    throw new Error('Missing userId for ElevenLabs key resolution');
  }

  const integration = await prisma.elevenLabsIntegration.findUnique({ where: { userId } });
  if (!integration) {
    throw new Error(`No ElevenLabs integration found for user ${userId}`);
  }

  const apiKey = decrypt(integration.apiKeyCiphertext, integration.apiKeyIv, integration.apiKeyTag);
  await prisma.elevenLabsIntegration.update({ where: { userId }, data: { lastUsedAt: new Date() } });

  return { apiKey, source: 'user' };
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

const deliverSseEvent = (sessionId, eventName, payload, closeConnection = false) => {
  const sseClient = sseClients.get(sessionId);
  if (sseClient) {
    sseClient.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    if (closeConnection) {
      sseClient.end();
      sseClients.delete(sessionId);
      deleteSessionProgress(sessionId);
    }
    return;
  }

  callbackDataStore.set(sessionId, {
    event: eventName,
    payload,
    closeConnection
  });
};

const deliverFeedbackSseEvent = (sessionId, eventName, payload, closeConnection = false) => {
  const clients = feedbackSseClients.get(sessionId);
  if (clients?.size) {
    for (const client of clients) {
      client.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
      if (closeConnection) {
        client.end();
      }
    }

    if (closeConnection) {
      feedbackSseClients.delete(sessionId);
    }
  }

  feedbackEventStore.set(sessionId, {
    event: eventName,
    payload,
    closeConnection
  });
};

const triggerAgentSetupWorkflow = async ({
  sessionId,
  callbackUserId,
  callbackAgentId,
  interviewPromptValue,
  feedbackPromptValue,
  firstMessageValue,
  cvValue
}) => {
  const keyResolution = await resolveElevenLabsKey(callbackUserId);
  const elevenLabsKey = keyResolution.apiKey;
  console.log('🔑 Resolved ElevenLabs key source:', keyResolution.source, '| user:', callbackUserId || 'unknown', '| key exists:', !!elevenLabsKey);

  const agentSetupPayload = {
    interview_prompt: interviewPromptValue,
    feedback_prompt: feedbackPromptValue,
    first_message: firstMessageValue,
    session_id: sessionId,
    cv: cvValue,
    agent_id: callbackAgentId || ''
  };

  console.log('🔧 Agent setup payload:', JSON.stringify({
    interview_prompt: !!interviewPromptValue,
    feedback_prompt: !!feedbackPromptValue,
    first_message: !!firstMessageValue,
    session_id: sessionId,
    cv: !!cvValue,
    agent_id: callbackAgentId || ''
  }));

  const headers = {
    'Content-Type': 'application/json',
    'X-ELEVENLABS-KEY': elevenLabsKey
  };

  const agentSetupResponse = await fetch(AGENT_SETUP_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(agentSetupPayload)
  });

  if (!agentSetupResponse.ok) {
    throw new Error(`Agent setup workflow failed with status ${agentSetupResponse.status}`);
  }

  const agentSetupRaw = await agentSetupResponse.text();
  if (!agentSetupRaw || !agentSetupRaw.trim()) {
    throw new Error('Agent setup workflow returned an empty body');
  }

  let agentSetupResult;
  try {
    agentSetupResult = JSON.parse(agentSetupRaw);
  } catch {
    throw new Error('Agent setup workflow returned non-JSON body');
  }

  const normalizedResult = Array.isArray(agentSetupResult)
    ? (agentSetupResult[0] || {})
    : agentSetupResult;

  const resolvedAgentId =
    normalizedResult.agent_id ||
    normalizedResult.agentId ||
    normalizedResult.data?.agent_id ||
    normalizedResult.data?.agentId ||
    null;

  if (!resolvedAgentId) {
    throw new Error('Agent setup workflow did not return agent_id');
  }

  return resolvedAgentId;
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
    const eventName = existingData.event || 'callback-data';
    const eventPayload = existingData.payload || existingData;
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(eventPayload)}\n\n`);
    callbackDataStore.delete(sessionId);
    if (existingData.closeConnection !== false) {
      res.end();
      return;
    }
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

router.get('/session/:sessionId/feedback-stream', async (req, res) => {
  const { sessionId } = req.params;
  const token = req.query?.token;
  const userId = verifyUserIdFromToken(typeof token === 'string' ? token : '');

  if (!userId) {
    return res.status(401).json({ error: 'Invalid or missing token' });
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      userId
    },
    select: {
      id: true,
      feedback: true,
      status: true,
      duration: true,
      score: true
    }
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write('event: connected\ndata: {}\n\n');

  if (session.feedback) {
    res.write(`event: feedback-ready\ndata: ${JSON.stringify({
      sessionId,
      status: session.status,
      duration: session.duration,
      score: session.score,
      feedback: session.feedback
    })}\n\n`);
    res.end();
    return;
  }

  const existingEvent = feedbackEventStore.get(sessionId);
  if (existingEvent) {
    res.write(`event: ${existingEvent.event || 'feedback-ready'}\ndata: ${JSON.stringify(existingEvent.payload || {})}\n\n`);
    if (existingEvent.closeConnection !== false) {
      res.end();
      return;
    }
  }

  const currentClients = feedbackSseClients.get(sessionId) || new Set();
  currentClients.add(res);
  feedbackSseClients.set(sessionId, currentClients);

  const keepAlive = setInterval(() => {
    res.write(':keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const clients = feedbackSseClients.get(sessionId);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) {
      feedbackSseClients.delete(sessionId);
    }
  });
});

// n8n callback: store data and push to waiting SSE client instantly
router.post('/session/:sessionId/callback', async (req, res) => {
  const { sessionId } = req.params;
  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };
  const interviewPromptValue = payloadBody.interview_prompt || payloadBody.interview_primpot || undefined;
  const feedbackPromptValue = payloadBody.feedback_prompt_final || payloadBody.feedback_prompt || undefined;
  const firstMessageValue = payloadBody.first_message || payloadBody.firstMessage || undefined;
  const cvValue = payloadBody.cv || payloadBody.candidate_cv || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload keys:', Object.keys(payloadBody || {}));
  console.log('📦 agent_id from callback:', payloadBody.agent_id || payloadBody.agentId || null, '| interview_prompt exists:', !!interviewPromptValue);
  console.log('📦 cv exists:', !!cvValue, '| cv length:', cvValue?.length || 0);

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const persistedSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, agentId: true }
    });

    let callbackAgentId = payloadBody.agent_id || payloadBody.agentId || persistedSession?.agentId || null;
    let callbackUserId = payloadBody.userId || payloadBody.user_id || persistedSession?.userId || getSessionOwner(sessionId) || null;

    // Resolve agent_id from DB only when callback did not provide one.
    if (!callbackAgentId && callbackUserId) {
      const existingAgent = await prisma.agent.findFirst({
        where: { userId: callbackUserId },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      });
      if (existingAgent?.id) {
        callbackAgentId = existingAgent.id;
        console.log('🔎 Resolved existing agent_id from DB for user:', callbackUserId, '| agent_id:', callbackAgentId);
      } else {
        console.log('🔎 No existing agent_id found in DB for user:', callbackUserId, '| using empty agent_id for workflow');
      }
    } else if (callbackAgentId) {
      console.log('🔎 Using agent_id from callback payload:', callbackAgentId);
    }

    // If callback has no userId, try resolving from agent ownership as a fallback.
    if (!callbackUserId && callbackAgentId) {
      const ownerAgent = await prisma.agent.findUnique({
        where: { id: callbackAgentId },
        select: { userId: true }
      });
      if (ownerAgent?.userId) {
        callbackUserId = ownerAgent.userId;
        console.log('🔎 Resolved callback userId from agent ownership:', callbackUserId);
      }
    }

    if (!callbackUserId) {
      throw new Error('Missing userId for ElevenLabs key resolution. Session owner context is unavailable.');
    }

    const callbackData = {
      agentId: callbackAgentId,
      interviewPlan: payloadBody.interview_plan,
      interviewPrompt: interviewPromptValue,
      feedbackPrompt: feedbackPromptValue,
      firstMessage: firstMessageValue,
      feedback: payloadBody.feedback,
      duration: payloadBody.duration,
      receivedAt: new Date().toISOString()
    };

    emitProgressUpdate(sessionId, 'Interview prompts ready.', 'prompt_ready');

    console.log('🔧 Triggering agent setup workflow to configure agent prompts...');
    console.log('🔧 Calling:', AGENT_SETUP_WEBHOOK_URL);
    emitProgressUpdate(sessionId, 'Configuring your agent...', 'agent_setup');

    pendingAgentSetupStore.set(sessionId, {
      callbackUserId,
      callbackDataBase: {
        interviewPlan: payloadBody.interview_plan,
        interviewPrompt: interviewPromptValue,
        feedbackPrompt: feedbackPromptValue,
        firstMessage: firstMessageValue,
        feedback: payloadBody.feedback,
        duration: payloadBody.duration
      },
      setupContext: {
        sessionId,
        callbackUserId,
        callbackAgentId,
        interviewPromptValue,
        feedbackPromptValue,
        firstMessageValue,
        cvValue
      }
    });

    const resolvedAgentId = await triggerAgentSetupWorkflow({
      sessionId,
      callbackUserId,
      callbackAgentId,
      interviewPromptValue,
      feedbackPromptValue,
      firstMessageValue,
      cvValue
    });

    const creditToolState = callbackUserId
      ? await ensureCreditToolAttachedForAgent({
          userId: callbackUserId,
          agentId: resolvedAgentId
        })
      : {
          toolReady: false,
          toolWarning: CREDIT_TOOL_WARNING_MESSAGE
        };

    callbackAgentId = resolvedAgentId;
    callbackData.agentId = callbackAgentId;

    try {
      const persistedSessionId = await ensurePersistedBehavioralSession({
        tempSessionId: sessionId,
        userId: callbackUserId,
        agentId: callbackAgentId,
        interviewPlan: callbackData.interviewPlan,
        interviewPrompt: callbackData.interviewPrompt,
        feedbackPrompt: callbackData.feedbackPrompt
      });
      callbackData.persistedSessionId = persistedSessionId;
      callbackData.sessionId = persistedSessionId;
    } catch (persistError) {
      console.warn('[callback] Failed to pre-persist behavioral session:', persistError?.message || persistError);
      callbackData.persistedSessionId = null;
    }

    callbackData.toolReady = Boolean(creditToolState?.toolReady);
    callbackData.toolWarning = creditToolState?.toolReady ? null : (creditToolState?.toolWarning || CREDIT_TOOL_WARNING_MESSAGE);
    pendingAgentSetupStore.delete(sessionId);
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
      tempSessionToPersistedSessionId.delete(sessionId);
      emitProgressUpdate(sessionId, 'Session is ready. Launching your interview...', 'ready');
    } else if (callbackAgentId) {
      console.warn(`⚠️ Received agent_id ${callbackAgentId} but no userId in callback body; skipping immediate persistence.`);
    }

    console.log(`🚀 Delivering callback data for session ${sessionId}`);
    deliverSseEvent(sessionId, 'callback-data', callbackData, true);

    res.json({ success: true, message: 'Callback data received and delivered' });
  } catch (error) {
    console.error('Error processing callback:', error);
    const retryable = pendingAgentSetupStore.has(sessionId);
    emitProgressUpdate(sessionId, 'Setup hit an issue, retrying steps...', 'error');
    deliverSseEvent(sessionId, 'setup-error', {
      message: error.message || 'Agent setup failed',
      retryable,
      stage: 'agent_setup'
    }, false);
    res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

router.post('/session/:sessionId/feedback-callback', async (req, res) => {
  const { sessionId } = req.params;

  if (FEEDBACK_CALLBACK_SECRET) {
    const providedSecret = req.get('x-feedback-callback-secret') || req.body?.callback_secret || req.body?.callbackSecret;
    if (providedSecret !== FEEDBACK_CALLBACK_SECRET) {
      return res.status(401).json({ error: 'Invalid callback secret' });
    }
  }

  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const callbackError =
      payloadBody.error ||
      payloadBody.details ||
      payloadBody.message ||
      null;

    const explicitFailure =
      payloadBody.success === false ||
      payloadBody.status === 'error' ||
      payloadBody.status === 'failed' ||
      payloadBody.result === 'error';

    const feedbackPayload =
      payloadBody.feedback ||
      payloadBody.feedback_result ||
      (payloadBody.summary || payloadBody.overall_score || payloadBody.dimension_scores ? payloadBody : null);

    if (!feedbackPayload) {
      if (explicitFailure || callbackError) {
        clearFeedbackGenerationInFlight(sessionId);
        deliverFeedbackSseEvent(sessionId, 'feedback-error', {
          sessionId,
          status: session.status,
          message: String(callbackError || 'Feedback workflow failed.')
        }, true);
        return res.json({ success: false, sessionId, cleared: true });
      }

      return res.status(400).json({ error: 'Missing feedback payload in callback' });
    }

    const callDurationRaw =
      payloadBody.call_duration_secs ??
      payloadBody.callDurationSecs ??
      payloadBody.duration_seconds ??
      payloadBody.duration ??
      null;

    const transcripts = payloadBody.transcripts ?? payloadBody.transcript ?? null;
    const audio = payloadBody.audio ?? null;
    const durationSeconds = Number.isFinite(Number(callDurationRaw)) ? Math.max(0, Math.round(Number(callDurationRaw))) : (session.duration ?? null);

    const storedFeedback = {
      feedback: feedbackPayload,
      ...(callDurationRaw != null ? { call_duration_secs: Number(callDurationRaw) } : {}),
      ...(transcripts != null ? { transcripts } : {}),
      ...(audio != null ? { audio } : {})
    };

    let score = feedbackPayload?.overall_score ?? feedbackPayload?.overallScore ?? feedbackPayload?.score ?? 0;
    score = Number(score) || 0;
    if (score > 0 && score <= 5) score = Math.round(score * 20);
    else if (score > 0 && score <= 10) score = Math.round(score * 10);
    else if (score > 0) score = Math.round(score);

    const status = durationSeconds != null && durationSeconds < 600
      ? 'incomplete'
      : 'completed';

    const updateData = {
      feedback: storedFeedback,
      status,
      ...(durationSeconds != null ? { duration: durationSeconds } : {}),
      ...(score > 0 ? { score } : {})
    };

    await prisma.session.update({
      where: { id: sessionId },
      data: updateData
    });

    clearFeedbackGenerationInFlight(sessionId);

    deliverFeedbackSseEvent(sessionId, 'feedback-ready', {
      sessionId,
      status,
      duration: updateData.duration ?? session.duration ?? null,
      score: updateData.score ?? session.score ?? null,
      feedback: storedFeedback
    }, true);

    return res.json({ success: true, sessionId, status });
  } catch (error) {
    console.error('Error processing behavioral feedback callback:', error);
    return res.status(500).json({ error: 'Failed to process feedback callback', details: error.message });
  }
});

router.post('/session/:sessionId/retry-agent-setup', async (req, res) => {
  const { sessionId } = req.params;
  const retryContext = pendingAgentSetupStore.get(sessionId);

  if (!retryContext) {
    return res.status(404).json({ error: 'No retry context found for this session.' });
  }

  try {
    emitProgressUpdate(sessionId, 'Retrying agent setup...', 'agent_setup_retry');

    const resolvedAgentId = await triggerAgentSetupWorkflow(retryContext.setupContext);
    const creditToolState = retryContext.callbackUserId
      ? await ensureCreditToolAttachedForAgent({
          userId: retryContext.callbackUserId,
          agentId: resolvedAgentId
        })
      : {
          toolReady: false,
          toolWarning: CREDIT_TOOL_WARNING_MESSAGE
        };

    const callbackData = {
      ...retryContext.callbackDataBase,
      agentId: resolvedAgentId,
      toolReady: Boolean(creditToolState?.toolReady),
      toolWarning: creditToolState?.toolReady ? null : (creditToolState?.toolWarning || CREDIT_TOOL_WARNING_MESSAGE),
      receivedAt: new Date().toISOString()
    };

    try {
      const persistedSessionId = await ensurePersistedBehavioralSession({
        tempSessionId: sessionId,
        userId: retryContext.callbackUserId,
        agentId: resolvedAgentId,
        interviewPlan: callbackData.interviewPlan,
        interviewPrompt: callbackData.interviewPrompt,
        feedbackPrompt: callbackData.feedbackPrompt
      });
      callbackData.persistedSessionId = persistedSessionId;
      callbackData.sessionId = persistedSessionId;
    } catch (persistError) {
      console.warn('[retry] Failed to pre-persist behavioral session:', persistError?.message || persistError);
      callbackData.persistedSessionId = null;
    }

    if (resolvedAgentId && retryContext.callbackUserId) {
      await prisma.agent.upsert({
        where: { id: resolvedAgentId },
        update: { userId: retryContext.callbackUserId },
        create: { id: resolvedAgentId, userId: retryContext.callbackUserId }
      });
      deleteSessionOwner(sessionId);
      tempSessionToPersistedSessionId.delete(sessionId);
    }

    pendingAgentSetupStore.delete(sessionId);
    emitProgressUpdate(sessionId, 'Session is ready. Launching your interview...', 'ready');
    deliverSseEvent(sessionId, 'callback-data', callbackData, true);

    return res.json({ success: true, agentId: resolvedAgentId });
  } catch (error) {
    console.error('Retry agent setup failed:', error);
    emitProgressUpdate(sessionId, 'Retry failed. Please try again or return to dashboard.', 'error');
    deliverSseEvent(sessionId, 'setup-error', {
      message: error.message || 'Retry failed',
      retryable: true,
      stage: 'agent_setup_retry'
    }, false);
    return res.status(500).json({ error: 'Retry failed', details: error.message });
  }
});

export default router;
