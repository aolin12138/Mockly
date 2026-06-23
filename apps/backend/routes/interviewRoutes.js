import express from 'express';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { executeCode } from '../lib/judge0.js';
import { generateJavaScriptHarness } from '../lib/harness/javascript.js';
import { generatePythonHarness } from '../lib/harness/python.js';
const HARNESS_BY_LANG = { javascript: generateJavaScriptHarness, python: generatePythonHarness };
const LANGUAGE_IDS = { javascript: 63, python: 71 };
const MAX_SANDBOX_CODE_LENGTH = 100 * 1024;

function parseMaybeJsonForSandbox(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try { return JSON.parse(trimmed); } catch {}
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const rhs = trimmed.substring(eqIdx + 1).trim();
    if (rhs.includes(',') && !rhs.startsWith('[') && !rhs.startsWith('(')) {
      const parts = []; let depth = 0, current = '', inStr = false;
      for (const ch of rhs) {
        if (ch === '"' || ch === "'") inStr = !inStr;
        if (!inStr) { if (ch === '[' || ch === '(') depth++; if (ch === ']' || ch === ')') depth--; }
        if (ch === ',' && depth === 0 && !inStr) { parts.push(current.trim()); current = ''; }
        else current += ch;
      }
      if (current.trim()) parts.push(current.trim());
      return parts.map(p => { try { return JSON.parse(p); } catch { return p.replace(/^["']|["']$/g, ''); } });
    }
    try { return JSON.parse(rhs); } catch { return rhs.replace(/^["']|["']$/g, ''); }
  }
  return value;
}

const require = createRequire(import.meta.url);
const companyProfiles = require('../prompts/company_profile.json');
const roleRubrics = require('../prompts/role_rubrics.json');
import { prisma } from '../prismaClient.js';
import { decrypt } from '../lib/encryption.js';
import { extractCvText } from '../lib/cvTextExtractor.js';
import { expireStaleTechnicalSessions, getAbandonedSessionStatus } from '../lib/sessionLifecycle.js';
import { setSessionOwner } from '../lib/sessionOwnerStore.js';
import { setSessionProgress } from '../lib/sessionProgressStore.js';
import { getRandomQuestion, toPublicQuestionPayload } from '../lib/technicalQuestions.js';

const PROMPT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7';
const AGENT_SETUP_WEBHOOK_URL = 'http://localhost:5678/webhook/9b19cc19-9275-43c2-8e66-6bcb0642c639';
const FEEDBACK_WEBHOOK_URL = process.env.FEEDBACK_WEBHOOK_URL || 'http://localhost:5678/webhook/feedback';
const TECHNICAL_AGENT_WEBHOOK_URL = 'http://localhost:5678/webhook/84281349-1d93-47cd-ad3d-dfcc7013ad3b';
const TECHNICAL_FEEDBACK_WEBHOOK_URL = process.env.TECHNICAL_FEEDBACK_WEBHOOK_URL || 'http://localhost:5678/webhook/technical-feedback';
const CENTRAL_AGENT_VERSION = 1;
const FEEDBACK_CALLBACK_BASE_URL = process.env.FEEDBACK_CALLBACK_BASE_URL || '';
const FEEDBACK_CALLBACK_SECRET = process.env.FEEDBACK_CALLBACK_SECRET || '';
const WEBHOOK_TIMEOUT_MS = 55_000;

// Weighted scoring: backend computes overall from dimension scores (0-10)
const DIMENSION_WEIGHTS = {
  'Correctness & Completeness': 0.25,
  'Problem-Solving & Thinking': 0.20,
  'Technical Communication': 0.15,
  'Complexity & Optimization': 0.15,
  'Code Quality': 0.15,
  'Independence': 0.10,
};

function computeOverallScore(parsedFeedback) {
  const dimensions = parsedFeedback?.dimensions || [];
  console.log('[computeOverallScore] dimensions count:', dimensions.length);
  if (!dimensions.length) return null;
  let weightedSum = 0, totalWeight = 0;
  for (const dim of dimensions) {
    const score = Number(dim?.score);
    const weight = DIMENSION_WEIGHTS[dim.name] || 0;
    console.log(`[computeOverallScore] ${dim.name}: score=${dim?.score} (parsed=${score}), weight=${weight}`);
    if (!Number.isFinite(score)) continue;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  console.log('[computeOverallScore] weightedSum:', weightedSum, 'totalWeight:', totalWeight);
  if (totalWeight === 0) return null;
  const overall = Math.round((weightedSum / totalWeight) * 10) / 10; // 1 decimal
  let label = 'needs work';
  if (overall >= 8.0) label = 'strong';
  else if (overall >= 5.5) label = 'adequate';
  console.log('[computeOverallScore] result:', overall, label);
  return { score: overall, label };
}
const FEEDBACK_IN_FLIGHT_TTL_MS = 2 * 60 * 1000;
const feedbackGenerationInFlight = new Map();

const markFeedbackGenerationInFlight = (sessionId) => {
  if (!sessionId) return;
  feedbackGenerationInFlight.set(sessionId, Date.now() + FEEDBACK_IN_FLIGHT_TTL_MS);
};

export const clearFeedbackGenerationInFlight = (sessionId) => {
  if (!sessionId) return;
  feedbackGenerationInFlight.delete(sessionId);
};

const isFeedbackGenerationInFlight = (sessionId) => {
  if (!sessionId) return false;
  const expiresAt = feedbackGenerationInFlight.get(sessionId);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    feedbackGenerationInFlight.delete(sessionId);
    return false;
  }
  return true;
};

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
    let response;
    try {
      response = await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Webhook request timed out after ${timeoutMs}ms`);
        timeoutError.status = 504;
        timeoutError.code = 'WEBHOOK_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
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

async function ensurePendingBehavioralSession({
  sessionId,
  userId,
  agentId = undefined,
  interviewPlan = undefined,
  interviewPrompt = undefined,
  feedbackPrompt = undefined
}) {
  const updateData = {
    userId,
    interviewType: 'Behavioural'
  };

  if (agentId !== undefined) updateData.agentId = agentId || null;
  if (interviewPlan !== undefined) updateData.interviewPlan = interviewPlan || null;
  if (interviewPrompt !== undefined) updateData.interviewPrompt = interviewPrompt || null;
  if (feedbackPrompt !== undefined) updateData.feedbackPrompt = feedbackPrompt || null;

  return prisma.session.upsert({
    where: { id: sessionId },
    update: updateData,
    create: {
      id: sessionId,
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
}

const buildFeedbackCallbackUrl = (req, sessionId) => {
  const configuredBase = FEEDBACK_CALLBACK_BASE_URL.trim();
  const baseUrl = configuredBase || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/interview/session/${sessionId}/feedback-callback`;
};

const extractImmediateFeedbackPayload = (payload) => {
  if (!payload) return null;

  const direct = getWebhookValue(payload, ['feedback', 'feedback_result']);
  if (direct && typeof direct === 'object') {
    return direct;
  }

  if (Array.isArray(payload)) {
    if (payload.length === 1) {
      return extractImmediateFeedbackPayload(payload[0]);
    }
    return null;
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const looksLikeBehavioralFeedback =
    Object.prototype.hasOwnProperty.call(payload, 'overall_score') ||
    Object.prototype.hasOwnProperty.call(payload, 'dimension_scores') ||
    Object.prototype.hasOwnProperty.call(payload, 'areas_for_improvement') ||
    Object.prototype.hasOwnProperty.call(payload, 'summary');

  return looksLikeBehavioralFeedback ? payload : null;
};

async function runFeedbackWorkflow({ userId, sessionId, agentId, feedbackPrompt, conversationId, callbackUrl, callbackSecret }) {
  const resolved = await resolveElevenLabsKey(userId, 'behavioral');
  const elevenLabsKey = resolved.apiKey;

  const webhookPayload = {
    session_id: sessionId || null,
    agent_id: agentId,
    conversation_id: conversationId || null,
    feedback_agent_prompt: feedbackPrompt,
    feedback_prompt: feedbackPrompt,
    callback_url: callbackUrl || null,
    callbackUrl: callbackUrl || null,
    callback_secret: callbackSecret || null,
    callbackSecret: callbackSecret || null
  };

  const { response, body, rawText } = await fetchJsonWithTimeout(
    FEEDBACK_WEBHOOK_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ELEVENLABS-KEY': elevenLabsKey
      },
      body: JSON.stringify(webhookPayload)
    }
  );

  if (!response.ok) {
    const error = new Error(rawText || response.statusText || 'Feedback workflow failed');
    error.status = 502;
    throw error;
  }

  if (!rawText || !rawText.trim()) {
    const error = new Error('Feedback workflow returned empty response');
    error.status = 502;
    throw error;
  }

  return body;
}

/**
 * Call n8n Technical Agent Config workflow to provision/update an agent.
 * Returns { agent_id, version, updated } on success, { error, retryable } on failure.
 */
async function callTechnicalAgentWorkflow({ elevenlabsApiKey, voiceId, agentId, version }) {
  const payload = {
    elevenlabs_api_key: elevenlabsApiKey,
    voice_id: voiceId || 'cjVigY5qzO86Huf0OWal',
  };
  if (agentId) {
    payload.agent_id = agentId;
    payload.version = version ?? 0;
  }

  const { response, body, rawText } = await fetchJsonWithTimeout(
    TECHNICAL_AGENT_WEBHOOK_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    WEBHOOK_TIMEOUT_MS
  );

  if (!response.ok) {
    const err = new Error(rawText || `Agent workflow failed with status ${response.status}`);
    err.status = 502;
    throw err;
  }

  // n8n Respond to Webhook may wrap in array or data
  const result = getWebhookValue(body, ['agent_id', 'version', 'updated', 'error', 'retryable']);
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    // Direct response from Respond to Webhook node
    if (body.error) {
      console.warn('[technical-agent] Workflow returned error:', body.error);
      return { error: body.error, retryable: body.retryable !== false };
    }
    return {
      agent_id: body.agent_id,
      version: body.version,
      updated: body.updated,
    };
  }

  // Fallback: extract from nested response
  return {
    agent_id: getWebhookValue(body, ['agent_id', 'agentId']),
    version: getWebhookValue(body, ['version']),
    updated: getWebhookValue(body, ['updated']),
  };
}

async function runTechnicalFeedbackWorkflow({ userId, executionSummary }) {
  const resolved = await resolveElevenLabsKey(userId, 'technical');
  const elevenLabsKey = resolved.apiKey;

  // Single attempt with 120s timeout — enough for GPT-5.2
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  let response, rawText, body;
  try {
    response = await fetch(TECHNICAL_FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-ELEVENLABS-KEY': elevenLabsKey },
      body: JSON.stringify(executionSummary || {}),
      signal: controller.signal,
    });
    rawText = await response.text();
    try { body = JSON.parse(rawText); } catch { /* non-JSON */ }
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const error = new Error(rawText || response.statusText || 'Technical feedback workflow failed');
    error.status = 502;
    throw error;
  }

  if (!rawText || !rawText.trim()) {
    const error = new Error('Technical feedback workflow returned empty response');
    error.status = 502;
    throw error;
  }

  // Warn if code_assessment is empty (Part 6: treat as bug)
  try {
    const fb = (body && body.feedback && typeof body.feedback === 'object') ? body.feedback : body;
    if (fb && typeof fb === 'object' && !Array.isArray(fb)) {
      if (!fb.code_assessment) console.warn('[tech-feedback] code_assessment is empty — possible agent bug');
      if (!fb.thinking_and_logic) console.warn('[tech-feedback] thinking_and_logic is empty — possible agent bug');
      if (!fb.next_steps || (Array.isArray(fb.next_steps) && fb.next_steps.length === 0)) console.warn('[tech-feedback] next_steps is empty — possible agent bug');
    }
  } catch (e) { /* ignore validation errors */ }

  return body;
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

const hasStoredFeedbackContent = (raw) => {
  const feedback = unwrapFeedback(raw);
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    return Boolean(feedback);
  }
  return Object.keys(feedback).length > 0;
};

const normalizeDurationSeconds = (duration) => {
  if (!Number.isFinite(Number(duration))) return null;
  const value = Math.round(Number(duration));
  return value > 0 ? value : null;
};

const getSessionStatus = ({ feedback, durationSeconds }) => {
  if (durationSeconds != null && durationSeconds < 600) return 'incomplete';
  if (feedback) return 'completed';
  return 'pending';
};

const extractFeedbackEnvelope = ({ feedbackPayload, rawPayload = {} }) => {
  const callDurationRaw =
    rawPayload.call_duration_secs ??
    rawPayload.callDurationSecs ??
    rawPayload.duration_seconds ??
    rawPayload.duration ??
    null;
  const transcripts = rawPayload.transcripts ?? rawPayload.transcript ?? null;
  const audio = rawPayload.audio ?? null;

  const hasEnvelopeFields =
    callDurationRaw != null ||
    transcripts != null ||
    audio != null ||
    (feedbackPayload && typeof feedbackPayload === 'object' && (
      Object.prototype.hasOwnProperty.call(feedbackPayload, 'feedback') ||
      Object.prototype.hasOwnProperty.call(feedbackPayload, 'call_duration_secs') ||
      Object.prototype.hasOwnProperty.call(feedbackPayload, 'transcripts') ||
      Object.prototype.hasOwnProperty.call(feedbackPayload, 'audio')
    ));

  const durationSeconds = normalizeDurationSeconds(callDurationRaw);

  if (!hasEnvelopeFields) {
    return {
      storedFeedback: feedbackPayload || null,
      feedbackForScoring: feedbackPayload || null,
      durationSeconds
    };
  }

  let baseEnvelope = {};
  if (feedbackPayload && typeof feedbackPayload === 'object' && !Array.isArray(feedbackPayload)) {
    baseEnvelope = { ...feedbackPayload };
  }

  if (!Object.prototype.hasOwnProperty.call(baseEnvelope, 'feedback')) {
    baseEnvelope.feedback = feedbackPayload;
  }
  if (callDurationRaw != null && !Object.prototype.hasOwnProperty.call(baseEnvelope, 'call_duration_secs')) {
    baseEnvelope.call_duration_secs = Number(callDurationRaw);
  }
  if (transcripts != null && !Object.prototype.hasOwnProperty.call(baseEnvelope, 'transcripts')) {
    baseEnvelope.transcripts = transcripts;
  }
  if (audio != null && !Object.prototype.hasOwnProperty.call(baseEnvelope, 'audio')) {
    baseEnvelope.audio = audio;
  }

  return {
    storedFeedback: baseEnvelope,
    feedbackForScoring: baseEnvelope.feedback || feedbackPayload || null,
    durationSeconds
  };
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
    await expireStaleTechnicalSessions(prisma, { userId });

    const mapSession = (session) => {
      let score = session.score || 0;
      let topic = '';
      let assessment = '';
      const status = session.status || 'pending';
      const feedback = unwrapFeedback(session.feedback);
      const interviewType = session.interviewType || 'Interview';
      const duration = session.duration || 0;
      const createdAt = session.createdAt;

      if (status === 'cancelled') {
        topic = interviewType === 'Technical' ? 'Technical Interview' : 'Interview';
        assessment = 'Session was cancelled before completion.';
      } else if (status === 'not_started') {
        topic = interviewType === 'Technical' ? 'Technical Interview' : 'Interview';
        assessment = 'Session is prepared and ready to start.';
      } else if (status === 'incomplete') {
        topic = interviewType === 'Technical' ? 'Technical Interview' : 'Interview';
        assessment = 'Session ended too early to generate a complete assessment.';
      }

      if (interviewType === 'Technical') {
        // If score column is empty, fall back to computing from feedback
        if (!score) {
          score = feedback?.outcome?.score || feedback?.overall?.score || 0;
          if (score <= 10) score = Math.round(score * 10);
        }
        topic = feedback?.meta?.questionTitle || feedback?.outcome?.verdict || 'Technical Interview';
        if (status !== 'cancelled' && status !== 'incomplete') {
          assessment = feedback?.overall?.summary || feedback?.outcome?.summary || (status === 'pending' ? 'Feedback is still being prepared.' : 'Technical interview session completed.');
        }
      } else {
        if (!score) {
          score = feedback?.overall_score || feedback?.overallScore || feedback?.score || 0;
          if (score <= 5) score = Math.round(score * 20);
          else if (score <= 10) score = Math.round(score * 10);
        }
        topic = feedback?.position_title || 'Interview';
        if (status !== 'cancelled' && status !== 'incomplete') {
          assessment = feedback?.summary?.one_liner || (status === 'pending' ? 'Feedback is still being prepared.' : 'Interview session completed.');
        }
      }
      return { id: session.id, interviewType, topic, assessment, score, duration, createdAt, status };
    };

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        status: {
          not: 'expired'
        }
      },
      orderBy: { [orderByColumn]: sortDir },
      skip: offset,
      take: limit
    });
    const interviews = sessions.map(mapSession);
    const totalCount = await prisma.session.count({
      where: {
        userId,
        status: {
          not: 'expired'
        }
      }
    });

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

// Session route to create a persisted behavioural session and call n8n webhook
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

  const sessionId = randomUUID();
  setSessionOwner(sessionId, userId);

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
  interviewConfig.session_id = sessionId;
  setSessionOwner(sessionId, userId);
  setSessionProgress(sessionId, 'Generating interview prompts...', 'prompt_generation');

  let cvText = null;
  try {
    cvText = await extractCvText(interviewConfig.candidate?.cv_file);
    if (cvText) {
      console.log(`Extracted CV text for session ${sessionId} (${cvText.length} chars)`);
    }
  } catch (error) {
    console.warn(`Failed to extract CV text for session ${sessionId}:`, error.message);
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
    userId,
    user_id: userId,
    session_id: sessionId,
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
      console.log(`Using demo platform key for session ${sessionId}`);
    }
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }

  try {
    await ensurePendingBehavioralSession({
      sessionId,
      userId
    });
  } catch (error) {
    console.error(`Failed to persist pending behavioral session ${sessionId}:`, error.message);
    return res.status(500).json({ error: 'Failed to create session', details: error.message });
  }

  // Pre-serialize payload BEFORE sending response to avoid blocking
  const webhookPayloadString = JSON.stringify(setupWebhookPayload);

  // SEND RESPONSE FIRST - client gets sessionId immediately
  res.json({ sessionId });

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
      setSessionProgress(sessionId, 'Prompt generation in progress...', 'prompt_generation');
      console.log(`Webhook triggered for behavioural session ${sessionId}`);
    }).catch(error => {
      setSessionProgress(sessionId, 'Retrying prompt generation...', 'retry');
      console.error(`Webhook error for session ${sessionId}:`, error.message);
    });
  });
});

// Technical session route - provisions agent, selects question, and creates session
router.post('/technical/session', async (req, res) => {
  console.log("Request received at /technical/session");

  const interviewConfig = normalizeInterviewConfig(req.body);
  if (!interviewConfig) {
    return res.status(400).json({ error: 'No configuration provided' });
  }

  const userId = req.userId;
  console.log("User ID from auth middleware:", userId);

  try {
    // 1. Resolve ElevenLabs API key for this user
    let elevenLabsKey;
    try {
      const resolved = await resolveElevenLabsKey(userId, 'technical');
      elevenLabsKey = resolved.apiKey;
    } catch (err) {
      return res.status(403).json({ error: err.message });
    }

    // 2. Check if user already has a TECHNICAL agent
    const existingAgent = await prisma.agent.findFirst({
      where: { userId, type: 'Technical' },
    });

    let agentId;

    if (existingAgent?.id) {
      // User already has an agent — reuse it, skip n8n provisioning
      agentId = existingAgent.id;
      console.log(`[technical/session] Reusing existing technical agent ${agentId} for user ${userId}`);
    } else {
      // No agent yet — call n8n to provision one
      let agentResult;
      try {
        agentResult = await callTechnicalAgentWorkflow({
          elevenlabsApiKey: elevenLabsKey,
          voiceId: interviewConfig?.tts?.voice_id,
        });
      } catch (err) {
        console.error('[technical/session] Agent workflow call failed:', err.message);
        return res.status(503).json({
          error: 'Could not set up your interviewer. Please try again.',
          retryable: true,
          details: err.message,
        });
      }

      if (agentResult?.error) {
        return res.status(503).json({
          error: 'Could not set up your interviewer. Please try again.',
          retryable: agentResult.retryable !== false,
          details: agentResult.error,
        });
      }

      agentId = agentResult?.agent_id;
      if (!agentId) {
        return res.status(500).json({ error: 'Agent provisioning did not return an agent ID' });
      }

      // 3. Store new agent record
      await prisma.agent.upsert({
        where: { userId_type: { userId, type: 'Technical' } },
        update: { id: agentId, configVersion: agentResult?.version ?? CENTRAL_AGENT_VERSION },
        create: { id: agentId, userId, type: 'Technical', configVersion: agentResult?.version ?? CENTRAL_AGENT_VERSION },
      });
      console.log(`[technical/session] Agent ${agentId} provisioned for user ${userId}, version ${agentResult?.version ?? CENTRAL_AGENT_VERSION}`);
    }

    // 5. Load question
    const question = await getRandomQuestion();
    if (!question) {
      return res.status(404).json({ error: 'No technical questions available' });
    }

    const publicQuestion = toPublicQuestionPayload(question);

    // 6. Create session
    const session = await prisma.session.create({
      data: {
        userId,
        interviewType: 'Technical',
        technicalQuestionId: question.id,
        technicalQuestionSnapshot: publicQuestion,
        agentId,
        status: 'pending',
      },
    });

    console.log(`Created technical session ${session.id} for user ${userId} with agent ${agentId}`);

    // 7. Return everything the frontend needs
    res.json({
      sessionId: session.id,
      agentId,
      question: publicQuestion,
    });
  } catch (error) {
    console.error('Error creating technical session:', error);
    res.status(500).json({ error: 'Failed to create technical session', details: error.message });
  }
});

// Save technical session with feedback to database
router.post('/technical/save', async (req, res) => {
  console.log("Request received at /technical/save");

  const { sessionId, conversationId, executionSummary, feedback, duration } = req.body;
  const userId = req.userId; // From authMiddleware
  const envelope = extractFeedbackEnvelope({
    feedbackPayload: feedback,
    rawPayload: req.body || {}
  });
  const durationSeconds = normalizeDurationSeconds(duration) ?? envelope.durationSeconds;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  let score = null;
  if (envelope.feedbackForScoring) {
    const parsedFeedback = unwrapFeedback(envelope.feedbackForScoring);
    const overall = computeOverallScore(parsedFeedback);
    score = overall ? Math.round(overall.score * 10) : null; // scale 0-10 to 0-100 for DB
  }
  const status = getSessionStatus({ feedback: envelope.feedbackForScoring, durationSeconds });

  try {
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        interviewType: 'Technical',
      }
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Technical session not found' });
    }

    const session = await prisma.session.update({
      where: { id: existingSession.id },
      data: {
        feedback: envelope.storedFeedback || null,
        conversationId: conversationId || null,
        status,
        duration: durationSeconds, // Duration in seconds
        score: score || null,
        technicalQuestionId: existingSession.technicalQuestionId || executionSummary?.questionId || null,
        technicalQuestionSnapshot: existingSession.technicalQuestionSnapshot || executionSummary?.questionSnapshot || null,
        interviewPlan: executionSummary ? JSON.stringify(executionSummary) : existingSession.interviewPlan,
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

// End technical session — mark ended, trigger feedback generation
router.post('/technical/end', async (req, res) => {
  console.log("Request received at /technical/end");

  const { sessionId, conversationId, code, language, results } = req.body || {};
  const userId = req.userId;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId, interviewType: 'Technical' },
    });

    if (!session) {
      return res.status(404).json({ error: 'Technical session not found' });
    }

    // 1. Mark session as ended
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        latestCode: code || session.latestCode,
        latestLanguage: language || session.latestLanguage,
      },
    });

    // 2. Build execution summary for feedback — enrich with event data + question answer key
    const questionSnapshot = session.technicalQuestionSnapshot || {};

    // Fetch events (hint log, phase changes)
    let hintLog = [];
    let reachedPhase = 0;
    let phaseTimestamps = {};
    try {
      const events = await prisma.eventLog.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: { eventType: true, payload: true, createdAt: true },
      });
      for (const ev of events) {
        if (ev.eventType === 'hint_given') {
          hintLog.push({
            phase: ev.payload?.phase || reachedPhase,
            depth: ev.payload?.depth || 'general',
            topic: ev.payload?.topic || '',
          });
        }
        if (ev.eventType === 'phase_change') {
          reachedPhase = ev.payload?.phase || 0;
          if (reachedPhase) phaseTimestamps['phase_' + reachedPhase] = ev.createdAt;
        }
      }
    } catch (e) {
      console.warn('[technical/end] Could not fetch events:', e.message);
    }

    // Fetch answer key from question
    let questionAnswerKey = {};
    try {
      if (session.technicalQuestionId) {
        const q = await prisma.question.findUnique({
          where: { id: session.technicalQuestionId },
          select: { solutions: true, follow_ups: true, common_mistakes: true, pattern_tags: true, constraints: true },
        });
        if (q) questionAnswerKey = q;
      }
    } catch (e) {
      console.warn('[technical/end] Could not fetch answer key:', e.message);
    }

    const startedAt = session.startedAt ? new Date(session.startedAt) : null;
    const endedAt = new Date();
    const timeTakenSeconds = startedAt ? Math.round((endedAt - startedAt) / 1000) : null;
    const timeTakenMinutes = timeTakenSeconds ? Math.round(timeTakenSeconds / 60) : null;

    const executionSummary = {
      sessionId,
      conversationId,
      questionId: session.technicalQuestionId,
      questionTitle: questionSnapshot.title,
      difficulty: questionSnapshot.difficulty,
      language: language || session.latestLanguage,
      code: code || session.latestCode,
      results: results || null,
      completed: true,
      reachedPhase,
      timeTakenSeconds,
      timeTakenMinutes,
      timeBudgetMinutes: 35, // default, could be per-session config
      hintCount: hintLog.length,
      hintLog,
      questionSnapshot: {
        id: questionSnapshot.id,
        title: questionSnapshot.title,
        difficulty: questionSnapshot.difficulty,
      },
      question: questionAnswerKey,
    };

    // 3. Trigger feedback generation synchronously (wait for it)
    let feedbackBody = null;
    try {
      const resolved = await resolveElevenLabsKey(userId, 'technical');
      // Pass conversation_id + elevenlabs key at top level for n8n webhook
      const feedbackPayload = {
        conversation_id: conversationId,
        execution_summary: executionSummary,
        elevenlabs_api_key: resolved.apiKey,
        openai_api_key: process.env.OPENAI_API_KEY || '',
      };
      feedbackBody = await runTechnicalFeedbackWorkflow({
        userId,
        executionSummary: feedbackPayload,
      });
      console.log('[technical/end] Feedback received from n8n');
    } catch (err) {
      console.error('[technical/end] Feedback workflow failed:', err.message);
    }

    // 4. Store feedback if we got it
    if (feedbackBody) {
      try {
        const envelope = extractFeedbackEnvelope({
          feedbackPayload: feedbackBody,
          rawPayload: feedbackBody || {},
        });
        const feedbackResult = envelope.feedbackForScoring;
        const parsedFeedback = unwrapFeedback(feedbackResult);
        const overall = computeOverallScore(parsedFeedback);
        let score = overall ? Math.round(overall.score * 10) : 0; // scale 0-10 to 0-100

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            feedback: envelope.storedFeedback,
            status: 'completed',
            score: score || null,
            interviewPlan: JSON.stringify(executionSummary),
          },
        });
        console.log(`[technical/end] Feedback stored for session ${sessionId}, score: ${score}`);
      } catch (storeErr) {
        console.error('[technical/end] Failed to store feedback:', storeErr.message);
      }
    }

    // 5. Return result
    res.json({
      success: true,
      sessionId,
      feedback: feedbackBody,
    });
  } catch (error) {
    console.error('Error ending technical session:', error);
    res.status(500).json({ error: 'Failed to end session', details: error.message });
  }
});

// Save behavioral session with feedback to database
router.post('/behavioral/save', async (req, res) => {
  console.log("Request received at /behavioral/save");

  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };

  const agentId = payloadBody.agentId || payloadBody.agent_id || null;
  const conversationId = payloadBody.conversationId || payloadBody.conversation_id || null;
  const requestSessionId = payloadBody.sessionId || payloadBody.session_id || null;
  const interviewPlan = payloadBody.interviewPlan || payloadBody.interview_plan || null;
  const interviewPrompt = payloadBody.interviewPrompt || payloadBody.interview_prompt || null;
  const feedbackPrompt =
    payloadBody.feedbackPrompt ||
    payloadBody.feedback_prompt ||
    payloadBody.feedback_agent_prompt ||
    null;
  const feedback = payloadBody.feedback || payloadBody.feedback_result || null;
  const duration = payloadBody.duration || payloadBody.duration_seconds || null;
  const envelope = extractFeedbackEnvelope({
    feedbackPayload: feedback,
    rawPayload: payloadBody
  });
  const durationSeconds = normalizeDurationSeconds(duration) ?? envelope.durationSeconds;
  const userId = req.userId; // From authMiddleware

  let score = null;
  if (envelope.feedbackForScoring) {
    const parsedFeedback = unwrapFeedback(envelope.feedbackForScoring);
    const rawScore = parsedFeedback?.overall_score || parsedFeedback?.overallScore || parsedFeedback?.score || 0;
    score = rawScore <= 5 ? Math.round(rawScore * 20) : rawScore <= 10 ? Math.round(rawScore * 10) : rawScore;
  }
  const status = getSessionStatus({ feedback: envelope.feedbackForScoring, durationSeconds });

  try {
    console.log('Behavioral save payload keys:', Object.keys(payloadBody));

    let session;
    if (requestSessionId) {
      const existingSession = await prisma.session.findFirst({
        where: {
          id: requestSessionId,
          userId,
          interviewType: 'Behavioural'
        }
      });

      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found for update' });
      }

      const computedStatus = (!envelope.feedbackForScoring && durationSeconds == null && existingSession.status === 'not_started')
        ? 'not_started'
        : getSessionStatus({ feedback: envelope.feedbackForScoring, durationSeconds });

      const updateData = {
        feedback: envelope.storedFeedback,
        agentId: agentId || existingSession.agentId || null,
        conversationId: conversationId || existingSession.conversationId || null,
        interviewPlan: interviewPlan || existingSession.interviewPlan || null,
        interviewPrompt: interviewPrompt || existingSession.interviewPrompt || null,
        feedbackPrompt: feedbackPrompt || existingSession.feedbackPrompt || null,
        status: computedStatus,
        duration: durationSeconds != null ? durationSeconds : existingSession.duration,
        score: score || existingSession.score || null,
      };

      if (requestSessionId.startsWith('temp_')) {
        const promotedSessionId = randomUUID();
        await prisma.$executeRawUnsafe(
          'UPDATE "Session" SET "id" = $1, "feedback" = CAST($2 AS jsonb), "agentId" = $3, "conversationId" = $4, "interviewPlan" = $5, "interviewPrompt" = $6, "feedbackPrompt" = $7, "status" = $8, "duration" = $9, "score" = $10, "updatedAt" = NOW() WHERE "id" = $11',
          promotedSessionId,
          JSON.stringify(updateData.feedback),
          updateData.agentId,
          updateData.conversationId,
          updateData.interviewPlan,
          updateData.interviewPrompt,
          updateData.feedbackPrompt,
          updateData.status,
          updateData.duration,
          updateData.score,
          requestSessionId
        );
        session = await prisma.session.findUnique({
          where: { id: promotedSessionId }
        });
      } else {
        session = await prisma.session.update({
          where: { id: requestSessionId },
          data: updateData
        });
      }
    } else {
      session = await prisma.session.create({
        data: {
          userId: userId,
          interviewType: 'Behavioural',
          feedback: envelope.storedFeedback,
          agentId: agentId || null,
          conversationId: conversationId || null,
          interviewPlan: interviewPlan || null,
          interviewPrompt: interviewPrompt || null,
          feedbackPrompt: feedbackPrompt || null,
          status,
          duration: durationSeconds,
          score: score || null,
        }
      });
    }

    console.log(`Behavioral session saved to database: ${session.id}`);
    console.log("Session details:", JSON.stringify({ id: session.id, userId, agentId }, null, 2));

    // Create agent record if agent_id is provided and doesn't already exist
    if (agentId) {
      const existingAgent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!existingAgent) {
        await prisma.agent.create({
          data: {
            id: agentId,
            userId: userId,
            type: 'Behavioural',
          }
        });
        console.log(`Behavioural agent created: ${agentId}`);
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

// Generate behavioural feedback before persistence (for temp sessions)
router.post('/behavioral/generate-feedback', async (req, res) => {
  const userId = req.userId;
  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };

  const sessionId = payloadBody.session_id || payloadBody.sessionId || null;
  const agentId = payloadBody.agent_id || payloadBody.agentId || null;
  const conversationId = payloadBody.conversation_id || payloadBody.conversationId || null;
  const feedbackPrompt =
    payloadBody.feedback_prompt ||
    payloadBody.feedbackPrompt ||
    payloadBody.feedback_agent_prompt ||
    null;

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agent_id for feedback generation' });
  }

  if (!feedbackPrompt) {
    return res.status(400).json({ error: 'Missing feedback_prompt for feedback generation' });
  }

  try {
    const feedbackBody = await runFeedbackWorkflow({
      userId,
      sessionId,
      agentId,
      feedbackPrompt,
      conversationId
    });

    return res.json({
      success: true,
      sessionId,
      agentId,
      feedback: feedbackBody
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    console.error('Error generating behavioural feedback:', error);
    return res.status(status).json({ error: 'Failed to generate feedback', details: error.message });
  }
});

// Generate technical feedback for a saved session and persist it
router.post('/session/:sessionId/generate-technical-feedback', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    await expireStaleTechnicalSessions(prisma, { userId });

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        interviewType: 'Technical'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Technical session not found' });
    }

    // Reconstruct execution summary from session data if not stored
    let executionSummary;
    if (session.interviewPlan) {
      try {
        executionSummary = JSON.parse(session.interviewPlan);
      } catch {
        // Invalid JSON — fall through to reconstruction
      }
    }
    
    if (!executionSummary) {
      // Reconstruct from session fields + enrich with events + answer key
      const snapshot = session.technicalQuestionSnapshot || {};

      // Fetch events
      let hintLog = [];
      let reachedPhase = 0;
      try {
        const events = await prisma.eventLog.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'asc' },
          select: { eventType: true, payload: true, createdAt: true },
        });
        for (const ev of events) {
          if (ev.eventType === 'hint_given') {
            hintLog.push({
              phase: ev.payload?.phase || reachedPhase,
              depth: ev.payload?.depth || 'general',
              topic: ev.payload?.topic || '',
            });
          }
          if (ev.eventType === 'phase_change') {
            reachedPhase = ev.payload?.phase || 0;
          }
        }
      } catch (e) { /* ignore */ }

      // Fetch answer key
      let questionAnswerKey = {};
      try {
        if (session.technicalQuestionId) {
          const q = await prisma.question.findUnique({
            where: { id: session.technicalQuestionId },
            select: { solutions: true, follow_ups: true, common_mistakes: true, pattern_tags: true, constraints: true },
          });
          if (q) questionAnswerKey = q;
        }
      } catch (e) { /* ignore */ }

      executionSummary = {
        sessionId: session.id,
        conversationId: session.conversationId,
        questionId: session.technicalQuestionId,
        questionTitle: snapshot.title || 'Unknown',
        difficulty: snapshot.difficulty || 'Unknown',
        language: session.latestLanguage || 'javascript',
        code: session.latestCode || 'No code submitted',
        completed: session.status === 'ended',
        reachedPhase,
        hintCount: hintLog.length,
        hintLog,
        questionSnapshot: { id: snapshot.id, title: snapshot.title, difficulty: snapshot.difficulty },
        question: questionAnswerKey,
      };
    }

    // Resolve ElevenLabs key and enrich
    const resolved = await resolveElevenLabsKey(userId, 'technical');
    const openaiKey = process.env.OPENAI_API_KEY || '';

    // Fetch transcript and audio from ElevenLabs if conversation_id available
    let transcript = null;
    let audioBase64 = null;
    let callDurationSecs = null;
    const convId = executionSummary.conversationId || session.conversationId;
    if (convId && resolved.apiKey) {
      try {
        // Fetch transcript
        const convResp = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(convId)}`,
          { headers: { 'xi-api-key': resolved.apiKey } }
        );
        if (convResp.ok) {
          const convData = await convResp.json();
          if (convData.transcript && Array.isArray(convData.transcript)) {
            transcript = convData.transcript.map(t => ({
              role: t.role || 'unknown',
              text: t.message || t.content || '',
              timestart: t.time_in_call_secs || null,
            }));
          }
          callDurationSecs = convData.metadata?.call_duration_secs || null;
        }
        // Fetch audio
        const audioResp = await fetch(
          `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(convId)}/audio`,
          { headers: { 'xi-api-key': resolved.apiKey } }
        );
        if (audioResp.ok) {
          const audioBuffer = await audioResp.arrayBuffer();
          audioBase64 = Buffer.from(audioBuffer).toString('base64');
        }
      } catch (e) {
        console.warn('[tech-feedback] Could not fetch transcript/audio:', e.message);
      }
    }

    const feedbackPayload = {
      conversation_id: convId,
      execution_summary: executionSummary,
      elevenlabs_api_key: resolved.apiKey,
      openai_api_key: openaiKey,
      transcript: transcript,
      call_duration_secs: callDurationSecs,
      audio: audioBase64 ? { mimeType: 'audio/mpeg', base64: audioBase64 } : null,
    };

    const feedbackBody = await runTechnicalFeedbackWorkflow({
      userId,
      executionSummary: feedbackPayload,
    });

    const envelope = extractFeedbackEnvelope({ feedbackPayload: feedbackBody, rawPayload: feedbackBody || {} });
    const feedbackResult = envelope.feedbackForScoring;
    const parsedFeedback = unwrapFeedback(feedbackResult);
    const overall = computeOverallScore(parsedFeedback);
    const score = overall ? Math.round(overall.score * 10) : 0; // scale 0-10 to 0-100 for DB

    const durationSeconds = envelope.durationSeconds ?? normalizeDurationSeconds(session.duration);
    const updateData = {
      feedback: envelope.storedFeedback,
      status: getSessionStatus({ feedback: feedbackResult, durationSeconds })
    };
    if (score > 0) {
      updateData.score = score;
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: updateData
    });

    return res.json({
      success: true,
      sessionId,
      feedback: feedbackBody,
      score: score || null,
    });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    console.error('Error generating technical feedback:', error);
    return res.status(status).json({ error: 'Failed to generate technical feedback', details: error.message });
  }
});

// PATCH: Update session with duration and/or feedback after interview ends
router.patch('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;
  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };
  const duration = payloadBody.duration ?? payloadBody.duration_seconds;
  const feedback = payloadBody.feedback ?? payloadBody.feedback_result;

  try {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'expired') {
      return res.status(410).json({ error: 'Session expired' });
    }

    const updateData = {};
    const normalizedDuration = normalizeDurationSeconds(duration);
    if (normalizedDuration != null) updateData.duration = normalizedDuration;
    if (feedback != null) {
      updateData.feedback = feedback;
      updateData.status = getSessionStatus({
        feedback,
        durationSeconds: normalizedDuration != null ? normalizedDuration : normalizeDurationSeconds(session.duration)
      });
      // Extract and persist score
      const parsedFeedback = unwrapFeedback(feedback);
      const isTechnical = session.interviewType === 'Technical';
      let score = 0;
      if (isTechnical) {
        const overall = computeOverallScore(parsedFeedback);
        score = overall ? Math.round(overall.score * 10) : 0;
      } else {
        score = parsedFeedback?.overall_score || parsedFeedback?.overallScore || parsedFeedback?.score || 0;
        if (score <= 5) score = Math.round(score * 20);
        else if (score <= 10) score = Math.round(score * 10);
      }
      if (score > 0) updateData.score = score;
    }

    if (feedback == null && normalizedDuration != null && session.status === 'pending') {
      updateData.status = getSessionStatus({ feedback: null, durationSeconds: normalizedDuration });
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
      conversationId: session.conversationId,
      interviewPlan: session.interviewPlan,
      interviewPrompt: session.interviewPrompt,
      feedbackPrompt: session.feedbackPrompt,
      feedback: hasStoredFeedbackContent(session.feedback) ? session.feedback : null,
      interviewType: session.interviewType,
      technicalQuestionId: session.technicalQuestionId,
      technicalQuestionSnapshot: session.technicalQuestionSnapshot,
      status: session.status,
      duration: session.duration,
      score: session.score,
      latestCode: session.latestCode,
      latestLanguage: session.latestLanguage,
      ready
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session', details: error.message });
  }
});

// Generate behavioural feedback for a saved session (server-side so ElevenLabs key stays private)
router.post('/session/:sessionId/generate-feedback', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  const rawBody = req.body || {};
  const rootBody = Array.isArray(rawBody) ? (rawBody[0] || {}) : rawBody;
  const dataBody = rootBody?.data && typeof rootBody.data === 'object' ? rootBody.data : {};
  const payloadBody = { ...dataBody, ...rootBody };

  try {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const agentId = payloadBody.agent_id || payloadBody.agentId || session.agentId;
    const feedbackPrompt =
      payloadBody.feedback_prompt ||
      payloadBody.feedbackPrompt ||
      payloadBody.feedback_agent_prompt ||
      session.feedbackPrompt;

    if (!agentId) {
      return res.status(400).json({ error: 'Missing agent_id for feedback generation' });
    }

    if (!feedbackPrompt) {
      return res.status(400).json({ error: 'Missing feedback_prompt for feedback generation' });
    }

    if (hasStoredFeedbackContent(session.feedback)) {
      return res.json({
        success: true,
        sessionId,
        agentId,
        feedback: session.feedback,
        cached: true
      });
    }

    if (isFeedbackGenerationInFlight(sessionId)) {
      return res.status(202).json({
        success: false,
        inProgress: true,
        sessionId,
        message: 'Feedback generation is already in progress. Please retry shortly.'
      });
    }

    markFeedbackGenerationInFlight(sessionId);
    let keepInFlightLock = false;

    try {
      const callbackUrl = buildFeedbackCallbackUrl(req, sessionId);
      const body = await runFeedbackWorkflow({
        userId,
        sessionId,
        agentId,
        feedbackPrompt,
        conversationId: session.conversationId || payloadBody.conversation_id || payloadBody.conversationId || null,
        callbackUrl,
        callbackSecret: FEEDBACK_CALLBACK_SECRET || null
      });

      const immediateFeedback = extractImmediateFeedbackPayload(body);
      if (!immediateFeedback) {
        keepInFlightLock = true;
        return res.status(202).json({
          success: false,
          inProgress: true,
          sessionId,
          callback: true,
          message: 'Feedback generation started. Waiting for callback completion.'
        });
      }

      const envelope = extractFeedbackEnvelope({ feedbackPayload: immediateFeedback, rawPayload: body || {} });
      const feedbackResult = envelope.feedbackForScoring;
      const parsedFeedback = unwrapFeedback(feedbackResult);
      let score = parsedFeedback?.overall_score || parsedFeedback?.overallScore || parsedFeedback?.score || 0;
      if (score <= 5) score = Math.round(score * 20);
      else if (score <= 10) score = Math.round(score * 10);

      const durationSeconds = envelope.durationSeconds ?? normalizeDurationSeconds(session.duration);
      const updateData = {
        feedback: envelope.storedFeedback,
        status: getSessionStatus({ feedback: feedbackResult, durationSeconds })
      };
      if (score > 0) {
        updateData.score = score;
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: updateData
      });

      return res.json({
        success: true,
        sessionId,
        agentId,
        feedback: immediateFeedback
      });
    } catch (error) {
      if (error?.code === 'WEBHOOK_TIMEOUT' || error?.name === 'AbortError') {
        keepInFlightLock = true;
        return res.status(202).json({
          success: false,
          inProgress: true,
          sessionId,
          callback: true,
          message: 'Feedback generation is still processing. Waiting for callback completion.'
        });
      }

      console.error('Error generating feedback:', error);
      return res.status(500).json({ error: 'Failed to generate feedback', details: error.message });
    } finally {
      if (!keepInFlightLock) {
        clearFeedbackGenerationInFlight(sessionId);
      }
    }
  } catch (error) {
    console.error('Error generating feedback:', error);
    return res.status(500).json({ error: 'Failed to generate feedback', details: error.message });
  }
});

router.post('/session/:sessionId/link-conversation', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;
  const conversationId = req.body?.conversationId || req.body?.conversation_id || null;

  if (!conversationId) {
    return res.status(400).json({ error: 'Missing conversationId' });
  }

  try {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updated = await prisma.session.update({
      where: { id: sessionId },
      data: {
        conversationId,
        status: session.status === 'not_started' ? 'pending' : session.status
      }
    });

    return res.json({ success: true, sessionId: updated.id, conversationId: updated.conversationId, status: updated.status });
  } catch (error) {
    console.error('Error linking conversation:', error);
    return res.status(500).json({ error: 'Failed to link conversation', details: error.message });
  }
});

router.post('/session/:sessionId/spawn-reconnect-session', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;

  try {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
        interviewType: 'Behavioural'
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const cloned = await prisma.session.create({
      data: {
        userId,
        interviewType: 'Behavioural',
        agentId: session.agentId,
        interviewPlan: session.interviewPlan,
        interviewPrompt: session.interviewPrompt,
        feedbackPrompt: session.feedbackPrompt,
        status: 'not_started'
      }
    });

    return res.json({ success: true, sessionId: cloned.id });
  } catch (error) {
    console.error('Error spawning reconnect session:', error);
    return res.status(500).json({ error: 'Failed to create reconnect session', details: error.message });
  }
});

// Cancel session route
router.post('/session/:sessionId/cancel', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;
  const { duration, conversationId } = req.body || {};

  try {
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const normalizedDuration = duration == null
      ? existingSession.duration
      : normalizeDurationSeconds(duration);

    if (duration != null && normalizedDuration == null) {
      return res.status(400).json({ error: 'Invalid duration provided' });
    }

    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        status: getAbandonedSessionStatus(existingSession),
        duration: normalizedDuration,
        conversationId: conversationId || existingSession.conversationId
      }
    });

    console.log(`Session ${sessionId} marked as ${session.status} by user ${userId}`);
    res.json({ success: true, sessionId: session.id, status: session.status });
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
    const existingSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!existingSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const durationSeconds = normalizeDurationSeconds(duration);
    if (durationSeconds == null) {
      return res.status(400).json({ error: 'Invalid duration provided' });
    }

    const status = existingSession.status === 'pending'
      ? getSessionStatus({ feedback: existingSession.feedback, durationSeconds })
      : existingSession.status;

    const session = await prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        duration: durationSeconds,
        status
      }
    });

    console.log(`Session ${sessionId} duration updated to ${durationSeconds} seconds by user ${userId}`);
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

  const sessionId = randomUUID();
  setSessionOwner(sessionId, userId);

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
      user_id: userId,
      session_id: sessionId,
      agent_id: agent.id,
      interview_mode: 'behavioral',
      quick_start: true,
      timestamp: new Date().toISOString()
    };

    console.log("----- QUICK-START SESSION INITIATED -----");
    console.log(JSON.stringify(quickStartConfig, null, 2));
    console.log("----------------------------------------");

    await ensurePendingBehavioralSession({
      sessionId,
      userId,
      agentId: agent.id
    });

    // Trigger webhook for quick-start
    fetch('http://localhost:5678/webhook/a24ea15d-5793-4e3a-bfc4-1d6ce125cac7', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ELEVENLABS-KEY': elevenLabsKey
      },
      body: JSON.stringify(quickStartConfig)
    }).then(() => {
      console.log(`Quick-start webhook triggered for session ${sessionId}`);
    }).catch(error => {
      console.error(`Webhook error for quick-start session ${sessionId}:`, error.message);
    });

    // Return the persisted session ID immediately
    res.json({
      sessionId,
      agentId: agent.id,
      quick_start: true
    });
  } catch (error) {
    console.error('Error creating quick-start session:', error);
    res.status(500).json({ error: 'Failed to create quick-start session', details: error.message });
  }
});

// Sandbox: run submitted code against full test set (post-interview, visible results)
router.post('/session/:sessionId/run-tests', async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.userId;
  const { code, language } = req.body || {};

  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }
  if (code.length > MAX_SANDBOX_CODE_LENGTH) {
    return res.status(400).json({ error: `Code exceeds ${MAX_SANDBOX_CODE_LENGTH / 1024}KB limit` });
  }

  try {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId, interviewType: 'Technical' },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const question = await prisma.question.findUnique({
      where: { id: session.technicalQuestionId },
    });
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const langKey = (language || 'javascript').toLowerCase();
    const langId = LANGUAGE_IDS[langKey];
    if (!langId) return res.status(400).json({ error: `Unsupported language: ${langKey}` });

    const harnessGen = HARNESS_BY_LANG[langKey];
    if (!harnessGen) return res.status(400).json({ error: `No harness for: ${langKey}` });

    // Run against ALL tests (visible examples + hidden tests)
    const examples = question.examples || [];
    const hiddenTests = question.hidden_tests || [];
    const allTests = [
      ...examples.map((e, i) => ({ ...e, id: `visible_${i + 1}`, visible: true })),
      ...hiddenTests.map((t, i) => ({ ...t, id: `hidden_${i + 1}`, visible: false })),
    ];

    const inputs = allTests.map(t => parseMaybeJsonForSandbox(t.input));
    const expected = allTests.map(t => t.expected_output ?? t.output);

    const harness = await harnessGen(code, inputs);
    if (!harness) return res.status(500).json({ error: 'Failed to generate harness' });

    const result = await executeCode(langId, harness);

    // Parse results
    const results = allTests.map((tc, i) => {
      const passed = result.testResults?.[i]?.passed ?? result.tests?.[i]?.passed ?? false;
      const actual = result.testResults?.[i]?.actual ?? result.tests?.[i]?.actual ?? null;
      return { id: tc.id, passed, actual, expected: expected[i], visibility: tc.visible ? 'visible' : 'hidden' };
    });

    res.json({
      passed: results.filter(r => r.passed).length,
      total: results.length,
      results,
      compileError: result.compile_error || null,
    });
  } catch (error) {
    console.error('Error running sandbox tests:', error);
    res.status(500).json({ error: 'Failed to run tests', details: error.message });
  }
});

export default router;
