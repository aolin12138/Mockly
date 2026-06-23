/**
 * ElevenLabs API client for the test suite.
 * Handles simulate-conversation requests, retries, cost estimation, and error classification.
 */
import { CONFIG } from './config.mjs';
import { buildRequest } from './loader.mjs';

/**
 * Error classes for different failure modes.
 */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class CreditExhaustedError extends ApiError {
  constructor(message, status, body) {
    super(message, status, body);
    this.name = 'CreditExhaustedError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message, retryAfter) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter || 30;
  }
}

/**
 * Make an API request with retry and backoff.
 */
async function apiFetch(path, options = {}) {
  const url = `${CONFIG.baseUrl}${path}`;
  const headers = {
    'xi-api-key': CONFIG.apiKey,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let lastError;

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '30', 10);
        if (attempt < CONFIG.maxRetries) {
          const delay = Math.max(retryAfter * 1000, CONFIG.retryBackoffMs[attempt] || 30000);
          console.warn(`  Rate limited (429), waiting ${delay / 1000}s before retry ${attempt + 1}/${CONFIG.maxRetries}...`);
          await sleep(delay);
          continue;
        }
        throw new RateLimitError('Rate limit exceeded after retries', retryAfter);
      }

      if (res.status >= 500 || res.status === 520) {
        if (attempt < CONFIG.maxRetries) {
          const delay = CONFIG.retryBackoffMs[attempt] || 30000;
          console.warn(`  Server error (${res.status}), retrying in ${delay / 1000}s (${attempt + 1}/${CONFIG.maxRetries})...`);
          await sleep(delay);
          continue;
        }
        throw new ApiError(`Server error ${res.status}: ${JSON.stringify(body).slice(0, 200)}`, res.status, body);
      }

      if (!res.ok) {
        // Check for credit exhaustion
        const msg = typeof body === 'string' ? body : (body?.message || body?.detail || '');
        if (typeof msg === 'string' && (msg.toLowerCase().includes('credit') || msg.toLowerCase().includes('quota'))) {
          throw new CreditExhaustedError(msg, res.status, body);
        }
        throw new ApiError(`API error ${res.status}: ${JSON.stringify(body).slice(0, 300)}`, res.status, body);
      }

      return body;
    } catch (e) {
      if (e instanceof ApiError || e instanceof CreditExhaustedError || e instanceof RateLimitError) {
        throw e;
      }
      lastError = e;
      if (attempt < CONFIG.maxRetries) {
        const delay = CONFIG.retryBackoffMs[attempt] || 5000;
        console.warn(`  Network error: ${e.message}, retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  throw new ApiError(`Network error after retries: ${lastError?.message}`, 0, null);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract total token usage from a simulation response.
 */
function extractTokens(response) {
  let total = 0;
  for (const turn of (response.simulated_conversation || [])) {
    if (turn.llm_usage?.model_usage) {
      for (const [, usage] of Object.entries(turn.llm_usage.model_usage)) {
        total += (usage.total_tokens || usage.prompt_tokens || 0);
        total += (usage.completion_tokens || 0);
      }
    }
    // Alternative: conversation_turn_metrics.metrics
    if (turn.conversation_turn_metrics?.metrics) {
      const m = turn.conversation_turn_metrics.metrics;
      total += (m.total_tokens || m.llm_tokens || 0);
    }
  }
  return total;
}

/**
 * Run a single simulation for a scenario.
 * @returns {{ scenarioId, result: 'pass'|'fail'|'error', criteria: [], transcript: [], tokens: number, error?: string }}
 */
export async function simulateConversation(agentId, scenario) {
  const requestBody = buildRequest(scenario);
  const startTime = Date.now();

  let path = `/convai/agents/${agentId}/simulate-conversation`;
  if (CONFIG.branchId) path += `?branch_id=${CONFIG.branchId}`;

  const response = await apiFetch(
    path,
    { method: 'POST', body: JSON.stringify(requestBody) }
  );

  const durationMs = Date.now() - startTime;
  const analysis = response.analysis || {};
  const transcript = response.simulated_conversation || [];

  // Parse criteria results
  const criteriaResults = (analysis.evaluation_criteria_results_list || []).map(cr => ({
    id: cr.criteria_id,
    result: cr.result,
    rationale: cr.rationale || '',
  }));

  // Determine overall result
  const failures = criteriaResults.filter(c => c.result === 'failure');
  const unknowns = criteriaResults.filter(c => c.result === 'unknown');
  const overallResult = failures.length > 0 ? 'fail' : unknowns.length > 0 ? 'fail' : 'pass';

  // Extract tokens
  const tokens = extractTokens(response);

  return {
    scenarioId: scenario.id,
    description: scenario.description || '',
    targetPhase: scenario.target_phase || null,
    targetPhaseLabel: scenario.target_phase_label || '',
    historyCount: scenario.partial_conversation_history?.length || 0,
    result: overallResult,
    callSuccessful: analysis.call_successful === 'success',
    transcriptSummary: analysis.transcript_summary || '',
    criteria: criteriaResults,
    transcript,
    tokens,
    durationMs,
    turnsUsed: transcript.length,
    turnLimit: scenario.new_turns_limit,
  };
}

/**
 * Estimate the cost of running a scenario.
 * Uses a heuristic if the calculate-expected-llm-usage endpoint is unavailable.
 */
export async function estimateCost(agentId, scenario) {
  try {
    const requestBody = buildRequest(scenario);
    const response = await apiFetch(
      `/convai/agents/${agentId}/simulate-conversation/calculate-expected-llm-usage`,
      { method: 'POST', body: JSON.stringify(requestBody) }
    );
    return response.expected_usage || response.estimated_tokens || null;
  } catch {
    // Fallback heuristic: ~500 tokens per turn (user + agent + judge)
    const estimatedTurns = scenario.new_turns_limit;
    const tokensPerTurn = 500;
    return estimatedTurns * tokensPerTurn;
  }
}

/**
 * Run a simulation with timeout and error handling.
 */
export async function runScenario(agentId, scenario, timeoutMs = CONFIG.perScenarioTimeoutMs) {
  try {
    const result = await Promise.race([
      simulateConversation(agentId, scenario),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ]);
    return result;
  } catch (e) {
    // Classify the error
    if (e instanceof CreditExhaustedError) {
      return {
        scenarioId: scenario.id,
        result: 'error',
        error: 'CREDIT_EXHAUSTED',
        message: e.message,
        criteria: [],
        transcript: [],
        tokens: 0,
        durationMs: 0,
      };
    }
    if (e instanceof RateLimitError) {
      return {
        scenarioId: scenario.id,
        result: 'error',
        error: 'RATE_LIMITED',
        message: e.message,
        criteria: [],
        transcript: [],
        tokens: 0,
        durationMs: 0,
      };
    }
    return {
      scenarioId: scenario.id,
      result: 'error',
      error: 'API_OR_NETWORK',
      message: e.message,
      criteria: [],
      transcript: [],
      tokens: 0,
      durationMs: 0,
    };
  }
}
