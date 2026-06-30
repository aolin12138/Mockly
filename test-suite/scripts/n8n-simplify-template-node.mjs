#!/usr/bin/env node
/**
 * One-shot: simplify the n8n "Technical agent config" workflow so its embedded
 * agent template is a single JSON-parseable string, not 24 KB of scattered
 * JS literals.
 *
 * Before: the "Build full agent payload" Code node has:
 *   const systemPrompt = `# Who you are\\n...`;     // 6 KB backticked string
 *   const workflowConfig = { nodes: {...} };       // 5 KB object literal
 *   const MCP_SERVER_ID = "...";                    // constant
 *   // ...assemble payload from these literals...
 *
 * After: the Code node has:
 *   const TEMPLATE = JSON.parse(__TEMPLATE_JSON__);
 *   // ...override per-user voice, assemble payload from TEMPLATE...
 *
 * Why this matters: with one JSON-parseable string, promote-to-template.mjs
 * can swap the template safely in one line (JSON has no special characters
 * that collide with prompt content). Without this refactor, promotion would
 * be brittle string surgery across scattered JS literals.
 *
 * The n8n workflow behaviour stays identical: same fields go to ElevenLabs
 * PATCH. This is purely a code-shape change.
 *
 * Backup: the pre-change workflow lives in test-suite/n8n-backups/.
 * To revert: PUT that backup back via n8n API.
 *
 * Usage:
 *   node test-suite/scripts/n8n-simplify-template-node.mjs            # dry-run
 *   node test-suite/scripts/n8n-simplify-template-node.mjs --confirm  # actually PUT
 *
 * Env: requires N8N_API in .env (n8n API key with workflow write access).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const BACKUPS_DIR = resolve(__dirname, '..', 'n8n-backups');
const LOCAL_CONFIG_PATH = resolve(__dirname, '..', 'agent', 'config.json');

const WORKFLOW_ID = 'EchzraagTgTF72DM';
const NODE_NAME = 'Build full agent payload';
const N8N_BASE = 'http://localhost:5678/api/v1';

/**
 * The new Code node body. Reads the embedded TEMPLATE (a JSON string),
 * parses it, overrides per-user voice_id, returns the PATCH payload.
 * Behaviour is identical to the old 24 KB version; only the code shape
 * changes so promotion is a one-line JSON swap.
 *
 * The TEMPLATE JSON is substituted in by promote-to-template.mjs each time
 * a passing eval is approved. We seed it here with the agent's current
 * config so behaviour is preserved on the first PUT.
 */
function makeCodeBody(templateJson) {
  // Embed the JSON as a backticked string. JSON has no backticks of its own,
  // so this is safe. JSON.parse handles all escaping internally.
  return `// Build full agent payload
// Template is a single JSON-parseable string \u2014 swap it via
// test-suite/scripts/promote-to-template.mjs after a passing eval.
// Behaviour identical to the previous 24 KB version; only code shape changed.

const TEMPLATE_JSON = \`${templateJson}\`;
const TEMPLATE = JSON.parse(TEMPLATE_JSON);

const webhookBody = $('Webhook1').item.json.body;
const agentId = $json.agent_id || webhookBody.agent_id;
const voiceId = webhookBody.voice_id || 'cjVigY5qzO86Huf0OWal';

// Deep clone so we don't mutate TEMPLATE across n8n executions.
const payload = JSON.parse(JSON.stringify(TEMPLATE));

// Strip read-only fields ElevenLabs rejects on PATCH (agent_id, version_id,
// branch_id, etc) \u2014 keep only the configurational subset.
delete payload.agent_id;
delete payload.version_id;
delete payload.branch_id;
delete payload.main_branch_id;
delete payload.created_at_unix_secs;
delete payload.access_info;
delete payload.metadata;

// Override the per-user voice (BYOK). All other fields come from TEMPLATE.
payload.conversation_config = payload.conversation_config || {};
payload.conversation_config.tts = payload.conversation_config.tts || {};
payload.conversation_config.tts.voice_id = voiceId;

return [{
  json: {
    agent_id: agentId,
    payload: payload,
  }
}];
`;
}

// ─── Env ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(ROOT, '.env');
  const env = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

async function n8nGet(path, key) {
  const res = await fetch(`${N8N_BASE}${path}`, { headers: { 'X-N8N-API-KEY': key } });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function n8nPut(path, body, key) {
  const res = await fetch(`${N8N_BASE}${path}`, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status} — ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ─── Seed template ────────────────────────────────────────────
/**
 * Source of the seed template for the first refactor. Order of preference:
 *   1. test-suite/agent/config.json (if bootstrap-agent.mjs has been run)
 *   2. Fetch live test agent (read-only) and use that
 *
 * Either way, the seed equals what's currently in production behaviour, so
 * the refactor is a no-op semantically.
 */
async function getSeedTemplate(env) {
  if (existsSync(LOCAL_CONFIG_PATH)) {
    console.log(`Seeding TEMPLATE from local: ${LOCAL_CONFIG_PATH}`);
    return JSON.parse(readFileSync(LOCAL_CONFIG_PATH, 'utf-8'));
  }
  console.log('No local agent/config.json — fetching live test agent for seed...');
  const { CONFIG } = await import('../lib/config.mjs');
  const res = await fetch(
    `${CONFIG.baseUrl}/convai/agents/${CONFIG.agentId}${CONFIG.branchId ? '?branch_id=' + CONFIG.branchId : ''}`,
    { headers: { 'xi-api-key': CONFIG.apiKey } }
  );
  if (!res.ok) throw new Error(`Failed to fetch live test agent: ${res.status}`);
  return await res.json();
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const env = loadEnv();
  if (!env.N8N_API) throw new Error('N8N_API key missing in .env');

  console.log(`Fetching workflow ${WORKFLOW_ID}...`);
  const wf = await n8nGet(`/workflows/${WORKFLOW_ID}`, env.N8N_API);
  console.log(`  ${wf.name} — active: ${wf.active}, nodes: ${wf.nodes.length}`);

  const node = wf.nodes.find(n => n.name === NODE_NAME);
  if (!node?.parameters?.jsCode) {
    console.error(`Node "${NODE_NAME}" missing or has no jsCode parameter.`);
    process.exit(2);
  }
  const before = node.parameters.jsCode;
  console.log(`  "${NODE_NAME}": ${before.length} chars before`);

  // Idempotence guard: if the code already starts with our marker, the
  // refactor has been applied. Use promote-to-template.mjs to swap TEMPLATE.
  if (before.includes('const TEMPLATE = JSON.parse(TEMPLATE_JSON)')) {
    console.log('Code node already refactored. Use promote-to-template.mjs to swap the template.');
    process.exit(0);
  }

  const seed = await getSeedTemplate(env);
  const templateJson = JSON.stringify(seed);
  const newCode = makeCodeBody(templateJson);

  console.log(`\nNew code body: ${newCode.length} chars (${templateJson.length} of that is the TEMPLATE JSON literal)`);
  console.log('Preview (first 700 chars):');
  console.log('─'.repeat(60));
  console.log(newCode.slice(0, 700));
  console.log('─'.repeat(60));

  if (!confirm) {
    console.log('\nDRY RUN. Pass --confirm to actually PUT the refactored workflow.');
    console.log(`Backup of current workflow already saved under ${BACKUPS_DIR}/`);
    process.exit(0);
  }

  // Pre-PUT backup as final safety net
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = resolve(BACKUPS_DIR, `EchzraagTgTF72DM-${ts}-pre-simplify.json`);
  writeFileSync(backupPath, JSON.stringify(wf, null, 2), 'utf-8');
  console.log(`Pre-PUT backup: ${backupPath}`);

  node.parameters.jsCode = newCode;

  const putBody = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  };

  console.log('PUTting refactored workflow...');
  const resp = await n8nPut(`/workflows/${WORKFLOW_ID}`, putBody, env.N8N_API);
  console.log(`Done. Updated workflow: ${resp.id || WORKFLOW_ID}`);

  const after = await n8nGet(`/workflows/${WORKFLOW_ID}`, env.N8N_API);
  const afterNode = after.nodes.find(n => n.name === NODE_NAME);
  if (afterNode?.parameters?.jsCode?.includes('const TEMPLATE = JSON.parse(TEMPLATE_JSON)')) {
    console.log('✓ Verified: Code node refactored. Use promote-to-template.mjs from now on.');
  } else {
    console.warn('⚠ Re-fetch shows the refactor did NOT take. Restore from backup.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
