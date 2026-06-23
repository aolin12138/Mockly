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

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature,
    max_tokens: 1024,
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

/**
 * Build a running transcript into OpenAI-compatible messages format.
 * @param {Array<{role: string, message: string}>} transcript
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
/**
 * Build a running transcript into OpenAI-compatible messages format.
 * @param {Array<{role: string, message: string}>} transcript
 * @returns {Array<{role: string, content: string}>}
 */
function transcriptToMessages(transcript) {
  return transcript.map(turn => ({
    role: turn.role === 'user' ? 'user' : 'assistant',
    content: turn.message,
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

    const systemPrompt = `${SIM_USER_PREFIX}\n\nScenario context: ${this.scenarioPrompt}\n\nYou are the candidate. Given the conversation so far, produce your next spoken response (1-3 sentences). If the interview appears to be ending naturally or the interviewer is wrapping up, respond with "[END_CALL]" as your entire response.`;

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
    if (!text || !text.trim()) return null;
    const cleaned = text.trim();
    if (cleaned.includes('[END_CALL]')) return null;
    if (cleaned.length < 3) return null;
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
    .map((t, i) => `[${i}] ${t.role.toUpperCase()}: ${t.message || ''}`)
    .join('\n');

  const systemPrompt = `You are an evaluator judging an AI interviewer in a coding interview. The scenario goal is: "${scenarioGoal}".

Criterion to evaluate (id: ${criterionId}):
${criterionPrompt}

Analyse the transcript below and determine whether the criterion PASSES or FAILS. Be strict but fair. Return your verdict as a JSON object with exactly two fields:
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
