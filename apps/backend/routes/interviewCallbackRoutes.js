import express from 'express';

const router = express.Router();

// --- SSE-based approach: no polling needed ---
// Maps sessionId -> { res: SSE response object } for waiting clients
const sseClients = new Map();
// Fallback store: if n8n callback arrives before the frontend connects via SSE
const callbackDataStore = new Map();

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
  const { agent_id, interview_plan, interview_prompt, interview_primpot, feedback_prompt, feedback_prompt_final, feedback, duration } = req.body || {};
  const interviewPromptValue = interview_prompt || interview_primpot || undefined;
  const feedbackPromptValue = feedback_prompt_final || feedback_prompt || undefined;

  console.log('🔔 Callback received for sessionId:', sessionId);
  console.log('📦 Callback payload keys:', Object.keys(req.body || {}));

  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const callbackData = {
      agentId: agent_id,
      interviewPlan: interview_plan,
      interviewPrompt: interviewPromptValue,
      feedbackPrompt: feedbackPromptValue,
      feedback: feedback,
      duration: duration,
      receivedAt: new Date().toISOString()
    };

    // If an SSE client is waiting, push the data immediately
    const sseClient = sseClients.get(sessionId);
    if (sseClient) {
      console.log(`🚀 Pushing callback data to SSE client for session ${sessionId}`);
      sseClient.write(`event: callback-data\ndata: ${JSON.stringify(callbackData)}\n\n`);
      sseClient.end();
      sseClients.delete(sessionId);
    } else {
      // No SSE client yet — store for when they connect
      console.log(`💾 No SSE client yet for session ${sessionId}, storing data for later`);
      callbackDataStore.set(sessionId, callbackData);
    }

    res.json({ success: true, message: 'Callback data received and delivered' });
  } catch (error) {
    console.error('Error processing callback:', error);
    res.status(500).json({ error: 'Failed to process callback', details: error.message });
  }
});

export default router;
