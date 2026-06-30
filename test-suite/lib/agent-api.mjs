/**
 * Thin wrapper around ElevenLabs Convai agent API for the test agent.
 *
 * Reads agent_id, branch_id, and api_key from test-suite/lib/config.mjs (CONFIG).
 */

import { CONFIG } from './config.mjs';

function checkConfig() {
  if (!CONFIG.apiKey) throw new Error('ELEVENLABS_PLATFORM_KEY missing in .env');
  if (!CONFIG.agentId) throw new Error('CONFIG.agentId missing');
}

function agentUrl({ branchId = CONFIG.branchId } = {}) {
  const base = `${CONFIG.baseUrl}/convai/agents/${CONFIG.agentId}`;
  return branchId ? `${base}?branch_id=${branchId}` : base;
}

/**
 * GET the full agent config (the same JSON we treat as our source of truth).
 */
export async function getAgent({ branchId } = {}) {
  checkConfig();
  const res = await fetch(agentUrl({ branchId }), {
    headers: { 'xi-api-key': CONFIG.apiKey },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET agent failed: ${res.status} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * PATCH the agent. Pass the partial config to merge (typically the same
 * field set restoreCheckpoint uses).
 */
export async function patchAgent(partial, { branchId } = {}) {
  checkConfig();
  const res = await fetch(agentUrl({ branchId }), {
    method: 'PATCH',
    headers: { 'xi-api-key': CONFIG.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PATCH agent failed: ${res.status} — ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}
