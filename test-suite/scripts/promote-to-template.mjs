#!/usr/bin/env node
/**
 * Promote test-suite/agent/config.json into the n8n workflow's embedded template.
 *
 * After a passing eval, this script:
 *   1. Reads test-suite/agent/config.json (the trusted config).
 *   2. Fetches the n8n workflow "Technical agent config".
 *   3. Finds the TEMPLATE_JSON backtick-string inside the "Build full agent
 *      payload" Code node and replaces it with the new JSON.
 *   4. PUTs the workflow back.
 *
 * Prereq: the Code node must have been refactored once by
 * n8n-simplify-template-node.mjs so it contains a TEMPLATE_JSON constant.
 *
 * Safe by default: dry-run shows the change but does NOT PUT.
 *
 * Usage:
 *   node test-suite/scripts/promote-to-template.mjs            # dry-run
 *   node test-suite/scripts/promote-to-template.mjs --confirm  # actually PUT
 *
 * Exit codes:
 *   0  dry-run or PUT succeeded
 *   1  fatal error
 *   2  Code node not refactored yet — run n8n-simplify-template-node.mjs first
 *   5  TEMPLATE_JSON marker not found in the Code node
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

// Marker regex — matches the TEMPLATE_JSON backtick-string in the Code node.
// Whatever's between the backticks gets replaced. Anchored on a line start
// to avoid matching the marker inside any embedded JSON content.
const TEMPLATE_RE = /(const\s+TEMPLATE_JSON\s*=\s*`)([\s\S]*?)(`\s*;)/;

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

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const env = loadEnv();
  if (!env.N8N_API) throw new Error('N8N_API key missing in .env');

  // 1. Load local trusted config
  if (!existsSync(LOCAL_CONFIG_PATH)) {
    throw new Error(`Missing ${LOCAL_CONFIG_PATH}. Run bootstrap-agent.mjs first.`);
  }
  const local = JSON.parse(readFileSync(LOCAL_CONFIG_PATH, 'utf-8'));
  if (!local.conversation_config || !local.workflow) {
    throw new Error('agent/config.json: missing conversation_config or workflow');
  }
  const newJson = JSON.stringify(local);
  console.log(`Local trusted config: ${newJson.length} chars`);

  // 2. Fetch n8n workflow
  console.log(`\nFetching workflow ${WORKFLOW_ID}...`);
  const wf = await n8nGet(`/workflows/${WORKFLOW_ID}`, env.N8N_API);
  const node = wf.nodes.find(n => n.name === NODE_NAME);
  if (!node?.parameters?.jsCode) {
    console.error(`Node "${NODE_NAME}" missing or has no jsCode.`);
    process.exit(2);
  }
  const before = node.parameters.jsCode;

  // 3. Find the TEMPLATE_JSON marker
  const match = TEMPLATE_RE.exec(before);
  if (!match) {
    console.error(
      'Code node is not refactored \u2014 no `const TEMPLATE_JSON = \\`...\\`` found.\n' +
      'Run n8n-simplify-template-node.mjs --confirm first.'
    );
    process.exit(2);
  }
  const oldJson = match[2];
  if (oldJson === newJson) {
    console.log('No change \u2014 n8n template already matches local config.json.');
    process.exit(0);
  }

  console.log(`  Existing TEMPLATE_JSON: ${oldJson.length} chars`);
  console.log(`  New TEMPLATE_JSON:      ${newJson.length} chars`);
  console.log(`  Net delta:              ${newJson.length - oldJson.length} chars`);

  // Brief structural diff for user visibility (top-level keys)
  try {
    const oldObj = JSON.parse(oldJson);
    const newObj = JSON.parse(newJson);
    const oldKeys = new Set(Object.keys(oldObj));
    const newKeys = new Set(Object.keys(newObj));
    const added = [...newKeys].filter(k => !oldKeys.has(k));
    const removed = [...oldKeys].filter(k => !newKeys.has(k));
    if (added.length || removed.length) {
      console.log(`  Top-level keys: +[${added.join(', ')}]  -[${removed.join(', ')}]`);
    }
    // Show prompt char-count delta if both have one
    const oldPrompt = oldObj?.conversation_config?.agent?.prompt?.prompt || '';
    const newPrompt = newObj?.conversation_config?.agent?.prompt?.prompt || '';
    if (oldPrompt !== newPrompt) {
      console.log(`  System prompt: ${oldPrompt.length} \u2192 ${newPrompt.length} chars`);
    }
    const oldNodes = Object.keys(oldObj?.workflow?.nodes || {}).length;
    const newNodes = Object.keys(newObj?.workflow?.nodes || {}).length;
    if (oldNodes !== newNodes) {
      console.log(`  Workflow nodes: ${oldNodes} \u2192 ${newNodes}`);
    }
  } catch { /* structural diff is best-effort */ }

  if (!confirm) {
    console.log('\nDRY RUN. Pass --confirm to PUT the new template into n8n.');
    process.exit(0);
  }

  // 4. Pre-PUT backup
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = resolve(BACKUPS_DIR, `EchzraagTgTF72DM-${ts}-pre-promote.json`);
  writeFileSync(backupPath, JSON.stringify(wf, null, 2), 'utf-8');
  console.log(`Pre-PUT backup: ${backupPath}`);

  // 5. Surgically replace TEMPLATE_JSON
  node.parameters.jsCode = before.replace(TEMPLATE_RE, `$1${newJson}$3`);

  const putBody = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  };

  console.log('\nPUTting workflow with new template...');
  const resp = await n8nPut(`/workflows/${WORKFLOW_ID}`, putBody, env.N8N_API);
  console.log(`Done. Workflow id: ${resp.id || WORKFLOW_ID}`);

  // Verify
  const after = await n8nGet(`/workflows/${WORKFLOW_ID}`, env.N8N_API);
  const afterNode = after.nodes.find(n => n.name === NODE_NAME);
  const afterMatch = TEMPLATE_RE.exec(afterNode?.parameters?.jsCode || '');
  if (afterMatch && afterMatch[2] === newJson) {
    console.log('\u2713 Verified: n8n TEMPLATE_JSON now matches local config.json.');
  } else {
    console.warn('\u26a0 Re-fetch shows the promotion did NOT take. Restore from backup.');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
