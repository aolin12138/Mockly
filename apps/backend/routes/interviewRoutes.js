import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const companyProfiles = require('../prompts/company_profile.json');
const roleRubrics = require('../prompts/role_rubrics.json');
import { prisma } from '../prismaClient.js';
import { decrypt } from '../lib/encryption.js';
import { extractCvText } from '../lib/cvTextExtractor.js';
import { setSessionOwner } from '../lib/sessionOwnerStore.js';
import { setSessionProgress } from '../lib/sessionProgressStore.js';

const PROMPT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7';
const AGENT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/9b19cc19-9275-43c2-8e66-6bcb0642c639';
const WEBHOOK_TIMEOUT_MS = 55_000;

const getWebhookValue = (payload, keys) => {
  const sources = [];
  if (payload != null) sources.push(payload);

  if (Array.isArray(payload) && payload.length > 0) {
    sources.push(payload[0]);
    if (payload[0]?.json) sources.push(payload[0].json);
  }

  if (payload && typeof payload === 'object') {
    if (payload.data) sources.push(payload.data);
    if (payload.json) sources.push(payload.json);
    if (payload.body) sources.push(payload.body);
    if (payload.result) sources.push(payload.result);
    if (Array.isArray(payload.items) && payload.items.length > 0) {
      sources.push(payload.items[0]);
      if (payload.items[0]?.json) sources.push(payload.items[0].json);
    }
  }

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of keys) {
      if (src[key] != null && src[key] !== '') return src[key];
    }
  }

  return null;
};

const fetchJsonWithTimeout = async (url, options, timeoutMs = WEBHOOK_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const rawText = await response.text();
    let body = {};
    if (rawText && rawText.trim()) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = {};
      }
    }
    return { response, body, rawText };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Helper: Resolve the ElevenLabs API key for a user.
 * - If user has an ElevenLabsIntegration row → decrypt and return their key.
 * - If not, and it's a behavioural session with demo credits → decrement credit, return platform key.
 * - Otherwise → throw with a user-facing message.
 */
async function resolveElevenLabsKey(userId, interviewMode) {
  const integration = await prisma.elevenLabsIntegration.findUnique({ where: { userId } });

  if (integration) {
    const apiKey = decrypt(integration.apiKeyCiphertext, integration.apiKeyIv, integration.apiKeyTag);
    await prisma.elevenLabsIntegration.update({ where: { userId }, data: { lastUsedAt: new Date() } });
    return { apiKey, isDemo: false };
  }

  // No integration — check demo eligibility
  const isBehavioural = interviewMode === 'behavioral' || interviewMode === 'behavioural';
  if (isBehavioural) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { demoBehaviouralCredits: true } });
    if (user && user.demoBehaviouralCredits > 0) {
      await prisma.user.update({ where: { id: userId }, data: { demoBehaviouralCredits: { decrement: 1 } } });
      // Use platform key for demo session
      const platformKey = process.env.ELEVENLABS_PLATFORM_KEY;
      if (!platformKey) {
        throw new Error('Platform ElevenLabs key not configured');
      }
      return { apiKey: platformKey, isDemo: true };
    }
  }

  throw new Error('ElevenLabs API key required. Please connect your key in Settings.');
}

const router = express.Router();

// Helper: unwrap feedback from array/nested structure
// Feedback can be stored as: { ... }, [{ feedback: { ... }, audio, transcript }], or a JSON string
const unwrapFeedback = (raw) => {
  let fb = raw;
  if (typeof fb === 'string') {
    try { fb = JSON.parse(fb); } catch (e) { return {}; }
  }
  if (Array.isArray(fb)) {
    if (fb.length === 0) return {};
    fb = fb[0];
  }
  // Unwrap nested { feedback: { ... }, audio, transcript } structure
  if (fb && typeof fb === 'object' && fb.feedback && typeof fb.feedback === 'object') {
    fb = fb.feedback;
  }
  return fb || {};
};

const normalizeInterviewConfig = (config) => {
  const session = config?.session || {};
  const candidate = config?.candidate || {};
  const role = config?.role || {};
  const interview = config?.interview || {};

  return {
    ...config,
    session: {
      ...session,
      mode: session.mode || 'practice',
      duration_min: Number(session.duration_min) || 30
    },
    candidate: {
      ...candidate,
      practice_context: {
        ...(candidate.practice_context || {}),
        focus_areas: Array.isArray(candidate.practice_context?.focus_areas)
          ? candidate.practice_context.focus_areas
          : [],
        prior_interview_experience: candidate.practice_context?.prior_interview_experience || 'none'
      }
    },
    role: {
      ...role,
      seniority: role.seniority || 'junior',
      stage: role.stage || 'behavioral',
      company_preset: role.company_preset || 'general_tech'
    },
    interview: {
      ...interview,
      mode: interview.mode || 'behavioral',
      probe_domains: Array.isArray(interview.probe_domains) ? interview.probe_domains : [],
      depth_preference: interview.depth_preference || 'balanced'
    }
  };
};

const resolveRubricKey = (mode, seniority) => {
  const modeFallback = {
    behavioral: ['intern', 'junior', 'mid', 'senior', 'staff'],
    technical: ['intern', 'junior', 'mid', 'senior']
  };

  const supported = modeFallback[mode] || [];
  if (supported.length === 0) return null;

  let normalized = seniority;

  if (normalized === 'lead') {
    normalized = mode === 'behavioral' ? 'staff' : 'senior';
  }

  if (!supported.includes(normalized)) {
    normalized = 'senior';
  }

  if (!supported.includes(normalized)) {
    normalized = supported[0];
  }

  return `${mode}_${normalized}`;
};

const isPdfCvFile = (cvFile) => {
  if (!cvFile || typeof cvFile !== 'object') return true;
  const mimeType = (cvFile.type || '').toLowerCase();
  const fileName = (cvFile.name || '').toLowerCase();
  return mimeType.includes('pdf') || fileName.endsWith('.pdf');
};

// GET: Paginated and sorted interview history for user
router.get('/user/interviews', async (req, res) => {
  const userId = req.userId;
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const sortBy = req.query.sortBy || 'time';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

  // All sort fields now map to DB columns
  const sortColumnMap = { score: 'score', duration: 'duration', time: 'createdAt' };
  const orderByColumn = sortColumnMap[sortBy] || 'createdAt';

  try {
    const mapSession = (session) => {
      let score = session.score || 0;
      let topic = '';
      let assessment = '';
      const feedback = unwrapFeedback(session.feedback);
      const interviewType = session.interviewType || 'Interview';
      const duration = session.duration || 0;
      const createdAt = session.createdAt;
      if (interviewType === 'Technical') {
        // If score column is empty, fall back to computing from feedback
        if (!score) {
          score = feedback?.outcome?.score || feedback?.overall?.score || 0;
          if (score <= 10) score = Math.round(score * 10);
        }
        topic = feedback?.meta?.questionTitle || feedback?.outcome?.verdict || 'Technical Interview';
        assessment = feedback?.overall?.summary || feedback?.outcome?.summary || 'Technical interview session completed.';
      } else {
        if (!score) {
          score = feedback?.overall_score || feedback?.overallScore || feedback?.score || 0;
          if (score <= 5) score = Math.round(score * 20);
          else if (score <= 10) score = Math.round(score * 10);
        }
        topic = feedback?.position_title || 'Interview';
        assessment = feedback?.overall_assessment?.summary || 'Interview session completed.';
      }
      return { id: session.id, interviewType, topic, assessment, score, duration, createdAt };
    };

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { [orderByColumn]: sortDir },
      skip: offset,
      take: limit
    });
    const interviews = sessions.map(mapSession);
    const totalCount = await prisma.session.count({ where: { userId } });

    const hasMore = offset + limit < totalCount;
    res.json({ interviews, hasMore });
  } catch (error) {
    console.error('Error fetching interview history:', error);
    res.status(500).json({ error: 'Failed to fetch interview history', details: error.message });
  }
});

// Init interview endpoint (just for logging/setup for now)
router.post('/init', (req, res) => {
  const interviewConfig = req.body;

  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

  // Print the JSON to the terminal as requested
  console.log("----- INTERVIEW CONFIGURATION RECEIVED -----");
  console.log(JSON.stringify(interviewConfig, null, 2));
  console.log("------------------------------------------");

  // TODO: Logic to generate questions or start session would go here

  res.status(200).json({ message: 'Configuration received', config: interviewConfig });
});

// Session route to create session + call n8n webhook (NO DB SAVE)
router.post('/session', async (req, res) => {
  console.log("Request received at /session");

  // Parse the interview config from JSON body
  let interviewConfig;
  try {
    interviewConfig = req.body;
    if (!interviewConfig) {
      return res.status(400).json({ error: 'No configuration provided' });
    }
    interviewConfig = normalizeInterviewConfig(interviewConfig);
    if (!isPdfCvFile(interviewConfig.candidate?.cv_file)) {
      return res.status(400).json({ error: 'Only PDF CV uploads are supported.' });
    }
  } catch (error) {
    console.error("Error parsing interview config:", error);
    return res.status(400).json({ error: 'Invalid configuration format', details: error.message });
  }

  const userId = req.userId; // From authMiddleware
  console.log("User ID from auth middleware:", userId);

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Attach Company Profile
  const companyPreset = interviewConfig.role?.company_preset || 'general_tech';
  const companyProfile = companyProfiles[companyPreset] || companyProfiles.general_tech;
  if (companyProfile) {
    interviewConfig.company_profile = companyProfile;
    console.log(`Attached company profile: ${companyPreset}`);
  }

  // Attach Role Rubrics
  const rubricKey = resolveRubricKey(interviewConfig.interview?.mode, interviewConfig.role?.seniority);
  if (rubricKey) {
    const rubric = roleRubrics[rubricKey];
    if (rubric) {
      interviewConfig.role_rubric = rubric;
      console.log(`Attached role rubric: ${rubricKey}`);

      if (interviewConfig.interview.probe_domains.length === 0 && Array.isArray(rubric.interview?.probe_domains)) {
        interviewConfig.interview.probe_domains = rubric.interview.probe_domains;
        console.log('Applied role rubric probe_domains fallback.');
      }
    } else {
      console.warn(`Role rubric not found for key: ${rubricKey}`);
    }
  }

  // Add userId + sessionId to the config
  interviewConfig.userId = userId;
  interviewConfig.session_id = tempSessionId;
  setSessionOwner(tempSessionId, userId);
  setSessionProgress(tempSessionId, 'Generating interview prompts...', 'prompt_generation');

  let cvText = null;
  try {
    cvText = await extractCvText(interviewConfig.candidate?.cv_file);
    if (cvText) {
      console.log(`Extracted CV text for session ${tempSessionId} (${cvText.length} chars)`);
    }
  } catch (error) {
    console.warn(`Failed to extract CV text for session ${tempSessionId}:`, error.message);
  }

  const cvRawText = cvText || interviewConfig.candidate?.cv_raw_text || interviewConfig.candidate?.cv_text || null;
  const candidatePayload = {
    ...interviewConfig.candidate,
    cv_available: Boolean(interviewConfig.candidate?.cv_available || cvRawText),
    cv_raw_text: cvRawText,
  };

  if (candidatePayload.cv_file?.content) {
    candidatePayload.cv_file = {
      ...candidatePayload.cv_file,
      content: undefined
    };
  }

  const setupWebhookPayload = {
    session_id: tempSessionId,
    session: interviewConfig.session,
    candidate: candidatePayload,
    role: interviewConfig.role,
    interview: interviewConfig.interview,
    company_profile: interviewConfig.company_profile,
    role_rubric: interviewConfig.role_rubric
  };

  console.log("----- SENDING JSON PAYLOAD TO WEBHOOK -----");
  console.log(JSON.stringify(setupWebhookPayload, null, 2));
  console.log("-------------------------------------------");

  // Resolve ElevenLabs API key (user's own key or demo)
  let elevenLabsKey;
  try {
    const interviewMode = interviewConfig.interview?.mode || 'behavioral';
    const resolved = await resolveElevenLabsKey(userId, interviewMode);
    elevenLabsKey = resolved.apiKey;
    if (resolved.isDemo) {
      console.log(`Using demo platform key for session ${tempSessionId}`);
    }
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  // Pre-serialize payload BEFORE sending response to avoid blocking
  const webhookPayloadString = JSON.stringify(setupWebhookPayload);

  // SEND RESPONSE FIRST - client gets sessionId immediately
  res.json({ sessionId: tempSessionId });

  // DEFER webhook to next event loop tick (after response flushes to client)
  // This ensures n8n connection delays don't block the response
  setImmediate(() => {
    fetch(PROMPT_SETUP_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ELEVENLABS-KEY': elevenLabsKey
      },
      body: webhookPayloadString
    }).then(() => {
      setSessionProgress(tempSessionId, 'Prompt generation in progress...', 'prompt_generation');
      console.log(`Webhook triggered for temporary session ${tempSessionId}`);
    }).catch(error => {
      setSessionProgress(tempSessionId, 'Retrying prompt generation...', 'retry');
      console.error(`Webhook error for session ${tempSessionId}:`, error.message);
    });
  });
});

// Technical session route - creates temporary session (NOT saved to DB)
router.post('/technical/session', async (req, res) => {
  console.log("Request received at /technical/session");

  const interviewConfig = normalizeInterviewConfig(req.body);
  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

  const userId = req.userId; // From authMiddleware
  console.log("User ID from auth middleware:", userId);

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`Created temporary technical session ${tempSessionId} for user ${userId}`);
  console.log("Session config:", JSON.stringify(interviewConfig, null, 2));

  // Return session ID immediately - NO DATABASE SAVE, NO WEBHOOK
  res.json({
    sessionId: tempSessionId
  });
});

// Save technical session with feedback to database
router.post('/technical/save', async (req, res) => {
  console.log("Request received at /technical/save");

  const { conversationId, executionSummary, feedback, duration } = req.body;
  const userId = req.userId; // From authMiddleware

  if (!feedback) {
    return res.status(400).json({ error: 'No feedback provided' });
  }

  // Extract and normalise score from feedback JSON
  const parsedFeedback = unwrapFeedback(feedback);
  let score = parsedFeedback?.outcome?.score || parsedFeedback?.overall?.score || 0;
  if (score <= 10) score = Math.round(score * 10);

  try {
    // Create session in database with feedback
    const session = await prisma.session.create({
      data: {
        userId: userId,
        interviewType: 'Technical',
        feedback: feedback,
        agentId: conversationId || null,
        status: 'completed',
        duration: duration || null, // Duration in seconds
        score: score || null,
        // Store execution summary in interviewPlan field (repurposed for technical)
        interviewPlan: executionSummary ? JSON.stringify(executionSummary) : null,
      }
    });

    console.log(`Technical session saved to database: ${session.id}`);
    console.log("Session details:", JSON.stringify({ id: session.id, userId, conversationId }, null, 2));

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error saving technical session:', error);
    res.status(500).json({ error: 'Failed to save session', details: error.message });
  }
});

// Save behavioral session with feedback to database
router.post('/behavioral/save', async (req, res) => {
  console.log("Request received at /behavioral/save");

  const { agentId, interviewPlan, interviewPrompt, feedbackPrompt, feedback, duration } = req.body;
  const userId = req.userId; // From authMiddleware

  if (!feedback) {
    return res.status(400).json({ error: 'No feedback provided' });
  }

  // Extract and normalise score from feedback JSON
  const parsedFeedback = unwrapFeedback(feedback);
  let score = parsedFeedback?.overall_score || parsedFeedback?.overallScore || parsedFeedback?.score || 0;
  if (score <= 5) score = Math.round(score * 20);
  else if (score <= 10) score = Math.round(score * 10);

  try {
    // Create session in database with all callback data
    const session = await prisma.session.create({
      data: {
        userId: userId,
        interviewType: 'Behavioural',
        feedback: feedback,
        agentId: agentId || null,
        interviewPlan: interviewPlan || null,
        interviewPrompt: interviewPrompt || null,
        feedbackPrompt: feedbackPrompt || null,
        status: 'completed',
        duration: duration || null, // Duration in seconds
        score: score || null,
      }
    });

    console.log(`Behavioral session saved to database: ${session.id}`);
    console.log("Session details:", JSON.stringify({ id: session.id, userId, agentId }, null, 2));

    // Create agent record if agent_id is provided and doesn't already exist
    if (agentId) {
      const existingAgent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!existingAgent) {
        await prisma.agent.create({
          data: {
            id: agentId,
            userId: userId
          }
        });
        console.log(`Agent created: ${agentId}`);
      }
    }

    res.json({
      success: true,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error saving behavioral session:', error);
    res.status(500).json({ error: 'Failed to save session', details: error.message });
  }
});

// PATCH: Update session with duration and/or feedback after interview ends
router.patch('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;
  const { duration, feedback } = req.body;

  try {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updateData = {};
    if (duration != null) updateData.duration = duration;
    if (feedback != null) {
      updateData.feedback = feedback;
      updateData.status = 'completed';
      // Extract and persist score
      const parsedFeedback = unwrapFeedback(feedback);
      const isTechnical = session.interviewType === 'Technical';
      let score = 0;
      if (isTechnical) {
        score = parsedFeedback?.outcome?.score || parsedFeedback?.overall?.score || 0;
        if (score <= 10) score = Math.round(score * 10);
      } else {
        score = parsedFeedback?.overall_score || parsedFeedback?.overallScore || parsedFeedback?.score || 0;
        if (score <= 5) score = Math.round(score * 20);
        else if (score <= 10) score = Math.round(score * 10);
      }
      if (score > 0) updateData.score = score;
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: updateData
    });

    console.log(`Session ${sessionId} updated:`, Object.keys(updateData).join(', '));
    res.json({ success: true, sessionId: updated.id });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session', details: error.message });
  }
});

// Session status route (polled by frontend)
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const ready = Boolean(session.agentId && session.interviewPrompt && session.interviewPlan && session.feedbackPrompt);

    res.json({
      sessionId: session.id,
      agentId: session.agentId,
      interviewPlan: session.interviewPlan,
      interviewPrompt: session.interviewPrompt,
      feedbackPrompt: session.feedbackPrompt,
      feedback: session.feedback,
      ready
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session', details: error.message });
  }
});

// Cancel session route
router.post('/session/:sessionId/cancel', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        status: 'cancelled'
      }
    });

    console.log(`Session ${sessionId} cancelled by user ${userId}`);
    res.json({ success: true, sessionId: session.id });
  } catch (error) {
    console.error('Error cancelling session:', error);
    res.status(500).json({ error: 'Failed to cancel session', details: error.message });
  }
});

// Update session duration route
router.post('/session/:sessionId/duration', async (req, res) => {
  const { sessionId } = req.params;
  const { duration } = req.body;
  const userId = req.userId;

  if (!duration || typeof duration !== 'number') {
    return res.status(400).json({ error: 'Invalid duration provided' });
  }

  try {
    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        duration: duration
      }
    });

    console.log(`Session ${sessionId} duration updated to ${duration} seconds by user ${userId}`);
    res.json({ success: true, sessionId: session.id, duration: session.duration });
  } catch (error) {
    console.error('Error updating session duration:', error);
    res.status(500).json({ error: 'Failed to update session duration', details: error.message });
  }
});

// Get last agent for user (quick-start)
router.get('/agent/last', async (req, res) => {
  const userId = req.userId;
  console.log(`Fetching last agent for user ${userId}`);

  try {
    const agent = await prisma.agent.findFirst({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!agent) {
      return res.json({ agent: null });
    }

    res.json({
      agent: {
        id: agent.id,
        name: agent.name
      }
    });
  } catch (error) {
    console.error('Error fetching last agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent', details: error.message });
  }
});

// Quick-start session with last agent setup
router.post('/session/quick-start', async (req, res) => {
  console.log("Request received at /session/quick-start");

  const userId = req.userId;
  console.log("User ID from auth middleware:", userId);

  // Generate a temporary session ID (UUID-like)
  const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Fetch last agent
    const agent = await prisma.agent.findFirst({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!agent) {
      return res.status(400).json({ error: 'No previous agent setup found. Please configure a new session.' });
    }

    console.log(`Quick-start: Using agent ${agent.id} for user ${userId}`);

    // Resolve ElevenLabs API key (user's own key or demo)
    let elevenLabsKey;
    try {
      const resolved = await resolveElevenLabsKey(userId, 'behavioral');
      elevenLabsKey = resolved.apiKey;
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    // Prepare quick-start config
    const quickStartConfig = {
      userId: userId,
      session_id: tempSessionId,
      agent_id: agent.id,
      interview_mode: 'behavioral',
      quick_start: true,
      timestamp: new Date().toISOString()
    };

    console.log("----- QUICK-START SESSION INITIATED -----");
    console.log(JSON.stringify(quickStartConfig, null, 2));
    console.log("----------------------------------------");

    // Trigger webhook for quick-start
    fetch('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ELEVENLABS-KEY': elevenLabsKey
      },
      body: JSON.stringify(quickStartConfig)
    }).then(() => {
      console.log(`Quick-start webhook triggered for session ${tempSessionId}`);
    }).catch(error => {
      console.error(`Webhook error for quick-start session ${tempSessionId}:`, error.message);
    });

    // Return temp session ID immediately
    res.json({
      sessionId: tempSessionId,
      agentId: agent.id,
      quick_start: true
    });
  } catch (error) {
    console.error('Error creating quick-start session:', error);
    res.status(500).json({ error: 'Failed to create quick-start session', details: error.message });
  }
});

export default router;
