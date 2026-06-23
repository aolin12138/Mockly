/**
 * Phase 0 — Quick debug of raw API responses
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.ELEVENLABS_PLATFORM_KEY;
const BASE = 'https://api.elevenlabs.io/v1';

async function call(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', ...options.headers }
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  // Use the agent ID from the .md config (different from .env!)
  // .md config: agent_4401ksvxrhwmfnxrbc5nes3wee22
  // .env:        agent_6601kc3hn3b8fbv9p4hpskza0qgm
  const agentIds = [
    env.TECHNICAL_INTERVIEW_AGENT_ID,  // from .env
    'agent_6601kc3hn3b8fbv9p4hpskza0qgm',  // explicit
  ];

  // 1. Try to GET the agent to see its actual config
  for (const agentId of agentIds) {
    console.log(`\n─── GET /convai/agents/${agentId} ───`);
    const { status, ok, body } = await call(`/convai/agents/${agentId}`);
    console.log(`  Status: ${status}`);
    if (ok) {
      console.log(`  Name: ${body.name}`);
      // Show tool IDs from workflow
      const nodes = body.workflow?.nodes || {};
      for (const [nid, node] of Object.entries(nodes)) {
        console.log(`  Node ${nid}: tools=${JSON.stringify(node.additional_tool_ids || [])}`);
      }
      // Check text_only setting
      console.log(`  text_only: ${body.conversation_config?.conversation?.text_only}`);
      // Check how tools are structured
      const tc = body.platform_settings?.tool_configurations;
      if (tc) {
        console.log(`  tool_configurations: ${JSON.stringify(tc).slice(0, 500)}`);
      }
      // Dump top-level keys briefly
      console.log(`  top keys: ${Object.keys(body).join(', ')}`);
    } else {
      console.log(`  Error: ${JSON.stringify(body).slice(0, 300)}`);
    }
  }

  // 2. Try tools list endpoint and dump structure
  console.log('\n─── GET /convai/tools ───');
  const tRes = await call('/convai/tools');
  console.log(`  Status: ${tRes.status}`);
  if (Array.isArray(tRes.body)) {
    for (const t of tRes.body.slice(0, 3)) {
      console.log(`  Tool: ${JSON.stringify(t).slice(0, 300)}`);
    }
  } else if (typeof tRes.body === 'object') {
    console.log(`  Keys: ${Object.keys(tRes.body).join(', ')}`);
    console.log(`  Sample: ${JSON.stringify(tRes.body).slice(0, 500)}`);
  }

  // 3. Try simulate-conversation with more debugging
  console.log('\n─── POST simulate-conversation (debug) ───');
  const agentId = agentIds[0];
  const reqBody = {
    simulation_specification: {
      simulated_user_config: {
        prompt: "You are a candidate for a coding interview. You say 'Hello' and wait.",
        first_message: "Hello"
      },
      dynamic_variables: { remaining_minutes: 30 }
    },
    extra_evaluation_criteria: [
      {
        id: "greeted",
        name: "Agent Greeted",
        conversation_goal_prompt: "The agent greeted the candidate in a natural, warm way. PASS if they said hello or similar.",
        use_knowledge_base: false
      }
    ],
    new_turns_limit: 3
  };
  
  const sRes = await call(`/convai/agents/${agentId}/simulate-conversation`, {
    method: 'POST',
    body: JSON.stringify(reqBody)
  });
  console.log(`  Status: ${sRes.status}`);
  if (typeof sRes.body === 'object') {
    console.log(`  Response keys: ${Object.keys(sRes.body).join(', ')}`);
    console.log(`  Raw: ${JSON.stringify(sRes.body).slice(0, 1000)}`);
  } else {
    console.log(`  Raw text: ${String(sRes.body).slice(0, 500)}`);
  }

  // 4. Try streaming endpoint as fallback
  console.log('\n─── POST simulate-conversation/stream ───');
  try {
    const streamRes = await fetch(`${BASE}/convai/agents/${agentId}/simulate-conversation/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(reqBody)
    });
    console.log(`  Status: ${streamRes.status}`);
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks++;
      const text = decoder.decode(value, { stream: true });
      console.log(`  Chunk ${chunks}: ${text.slice(0, 300)}`);
      if (chunks > 5) break;
    }
    console.log(`  Total chunks: ${chunks}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
