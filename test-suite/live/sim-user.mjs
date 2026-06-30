/**
 * SimulatedUser — DeepSeek-powered interview candidate simulator and judge.
 *
 * Uses DeepSeek's OpenAI-compatible API (no extra SDK dependency).
 * Two roles:
 *   1. Candidate: given scenario prompt + running transcript, produces next user utterance
 *   2. Judge: given criteria + transcript, returns pass/fail + rationale
 */
import { loadEnv } from './_env.mjs';

const env = loadEnv();
const DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
const DEEPSEEK_SIM_MODEL = 'deepseek-chat';    // V3 — fast, cheap for sim-user
const DEEPSEEK_JUDGE_MODEL = 'deepseek-v4-pro'; // V4 Pro with thinking for judge
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';

// Reuse the same prefix as the existing test suite CONFIG.simUserPrefix
const SIM_USER_PREFIX = `IMPORTANT: You are SPEAKING aloud in a voice interview. NEVER write code, use code blocks, or type. Keep responses short (1-3 sentences). Stay in character — you are a coding interview candidate. Do NOT offer to paste code, share screen, or send files. If asked to show code, describe it verbally in a sentence. Do NOT volunteer extra context, ask "do you need anything else?", or check if the interviewer is still there. Just answer what was asked and stop.`;

/**
 * Call DeepSeek via OpenAI-compatible API.
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} [opts]
 * @param {string} [opts.model] - model name (default: deepseek-chat)
 * @param {number} [opts.temperature]
 * @param {string} [opts.apiKey]
 * @param {boolean} [opts.thinking] - enable V4 thinking mode
 * @returns {Promise<string>}
 */
async function callLLM(systemPrompt, messages, opts = {}) {
  const apiKey = opts.apiKey || DEEPSEEK_API_KEY;
  const model = opts.model || DEEPSEEK_SIM_MODEL;
  const temperature = opts.temperature ?? 0.3;

  // Reasoning models (thinking=true) consume tokens internally before output.
  // Long transcripts can exhaust a small budget mid-JSON. Give judge a much
  // bigger ceiling. Sim-user stays small (no thinking, short responses).
  const max_tokens = opts.thinking ? 8192 : 1024;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature,
    max_tokens,
  };

  // Enable V4 thinking mode for judge
  if (opts.thinking) {
    body.reasoning_effort = 'high';
    body.thinking = { type: 'enabled' };
  }

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('DeepSeek returned empty response');
  return text.trim();
}

// Tool-call → candidate-visible annotation. Sim-user reads the conversation
// and needs to know what the agent did with tools (silence, end-call, code
// check, etc.) so it can react naturally and decide when the interview is over.
const TOOL_ANNOTATIONS = {
  skip_turn:                '[Interviewer stayed silent — waiting for you to continue]',
  end_call:                 '[Interviewer ended the call]',
  get_current_code:         '[Interviewer is checking your code]',
  run_code_against_tests:   '[Interviewer is running your code against the tests]',
  log_event:                null, // background telemetry, hide from sim-user
};

// When skip_turn is called with no text, override annotation to signal failure
const SILENT_SKIP_ANNOTATION = '[FAIL: Agent called skip_turn with no acknowledgment text. End immediately with [END_CALL].]';

function annotateAgentTurn(turn) {
  const text = (turn.message || '').trim();
  const calls = turn.tool_calls || [];
  const annotations = [];
  
  const hasSkipTurn = calls.some(tc => tc.tool_name === 'skip_turn');
  
  for (const tc of calls) {
    const name = tc.toolName || tc.tool_name;
    // If skip_turn was called with no text, use failure annotation
    if (name === 'skip_turn' && !text) {
      annotations.push(SILENT_SKIP_ANNOTATION);
      continue;
    }
    const a = TOOL_ANNOTATIONS[name];
    if (a) annotations.push(a);
  }
  // If agent said nothing AND made no annotated tool call, mark explicit silence
  if (!text && annotations.length === 0) {
    annotations.push('[Interviewer stayed silent]');
  }
  const parts = [];
  if (text) parts.push(text);
  if (annotations.length) parts.push(annotations.join(' '));
  return parts.join(' ').trim();
}

/**
 * Build a running transcript into OpenAI-compatible messages format.
 * Agent turns include tool-call annotations so the sim-user can react to
 * skip_turn, end_call, etc.
 * @param {Array<{role: string, message: string, tool_calls?: Array}>} transcript
 * @returns {Array<{role: string, content: string}>}
 */
function transcriptToMessages(transcript) {
  return transcript.map(turn => ({
    role: turn.role === 'user' ? 'user' : 'assistant',
    content: turn.role === 'user' ? (turn.message || '') : annotateAgentTurn(turn),
  }));
}

/**
 * SimulatedUser class.
 *
 * Usage:
 *   const user = new SimulatedUser({ scenarioPrompt: scenario.simulated_user.prompt });
 *   const nextMsg = await user.next(transcript);
 */
export class SimulatedUser {
  /**
   * @param {Object} opts
   * @param {string} opts.scenarioPrompt - from scenario.simulated_user.prompt
   * @param {string} [opts.firstMessage] - from scenario.simulated_user.first_message
   * @param {string} [opts.apiKey] - DeepSeek API key
   */
  constructor(opts) {
    this.scenarioPrompt = opts.scenarioPrompt;
    this.firstMessage = opts.firstMessage || null;
    this.apiKey = opts.apiKey || DEEPSEEK_API_KEY;
    this.firstTurnDone = false;
    this.endedBySimUser = false;  // sim-user decided enough info gathered
  }

  /**
   * Get the next user utterance given the current transcript.
   */
  async next(transcript) {
    if (!this.firstTurnDone && this.firstMessage) {
      this.firstTurnDone = true;
      return this.firstMessage;
    }
    this.firstTurnDone = true;

    // Count consecutive silent agent turns
    let silentStreak = 0;
    for (let i = transcript.length - 1; i >= 0; i--) {
      const t = transcript[i];
      if (t.role !== 'agent') continue;
      const hasMsg = t.message && t.message.trim();
      const hasTool = t.tool_calls && t.tool_calls.length > 0;
      if (!hasMsg && !hasTool) silentStreak++;
      else if (!hasMsg && hasTool) silentStreak++;
      else break;
    }

    const turnInfo = `Turn info: ${silentStreak} consecutive silent agent turns so far. If the agent called skip_turn with no text (empty message + skip_turn tool), that is an immediate failure — end now with [END_CALL]. If the agent spoke text first THEN called skip_turn, continue normally. You are evaluating the agent — once you have enough evidence or the agent is clearly stuck, end with [END_CALL].`;
    const systemPrompt = `${SIM_USER_PREFIX}\n\n${turnInfo}\n\nScenario context: ${this.scenarioPrompt}\n\nYou are the candidate AND an evaluator. Given the conversation so far, produce your next spoken response (1-3 sentences). End with "[END_CALL]" when you have enough to evaluate OR the agent has been silent for 3+ consecutive turns OR the conversation has clearly stalled.`;

    const messages = transcriptToMessages(transcript);
    if (messages.length === 0) {
      messages.push({ role: 'user', content: '(This is the start of the interview. Please produce your first response.)' });
    }

    const text = await callLLM(systemPrompt, messages, { apiKey: this.apiKey, temperature: 0.3 });

    // Filter code blocks — if detected, reroll once
    if (/```|`[a-z]+|function\s+|def\s+|import\s/.test(text)) {
      const retryText = await callLLM(
        systemPrompt + '\n\nCRITICAL: Your previous response contained code. You are speaking in a voice interview — NEVER output code. Respond in plain sentences only.',
        messages,
        { apiKey: this.apiKey, temperature: 0.3 }
      );
      return this.#clean(retryText);
    }

    return this.#clean(text);
  }

  #clean(text) {
    if (!text || !text.trim()) return 'Still working…';
    const cleaned = text.trim();
    if (cleaned.includes('[END_CALL]')) {
      this.endedBySimUser = true;
      return null;
    }
    if (cleaned.length < 3) return 'Okay, go on.';
    return cleaned;
  }
}

/**
 * Evaluate a criterion against a transcript using DeepSeek as judge.
 */
export async function evaluateCriterion(opts) {
  const { scenarioGoal, criterionId, criterionPrompt, transcript } = opts;
  const apiKey = opts.apiKey || DEEPSEEK_API_KEY;

  const transcriptText = transcript
    .map((t, i) => {
      const tag = t.warmup ? '[CONTEXT]' : '[EVAL]';
      return `${tag} [${i}] ${t.role.toUpperCase()}: ${t.message || ''}`;
    })
    .join('\n');

  const systemPrompt = `You are an evaluator judging an AI interviewer in a coding interview. The scenario goal is: "${scenarioGoal}".

Criterion to evaluate (id: ${criterionId}):
${criterionPrompt}

Analyse the transcript below. [CONTEXT] turns are pre-conversation setup for context only — do NOT evaluate them. Evaluate ONLY the [EVAL] turns and determine whether the criterion PASSES or FAILS. Be strict but fair. Return your verdict as a JSON object with exactly two fields:
- "result": "success" or "failure" or "unknown"
- "rationale": a brief explanation (1-3 sentences)`;

  const text = await callLLM(systemPrompt, [
    { role: 'user', content: `Transcript:\n${transcriptText}\n\nVerdict (JSON):` },
  ], { apiKey, model: DEEPSEEK_JUDGE_MODEL, temperature: 0.0, thinking: true });

  // Parse JSON from response
  try {
    const parsed = JSON.parse(text);
    return { result: parsed.result || 'unknown', rationale: parsed.rationale || '' };
  } catch {
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return { result: parsed.result || 'unknown', rationale: parsed.rationale || '' };
      } catch { /* fall through */ }
    }
    const success = /success|pass/i.test(text);
    const failure = /failure|fail/i.test(text);
    return {
      result: success && !failure ? 'success' : failure ? 'failure' : 'unknown',
      rationale: text.slice(0, 500),
    };
  }
}
