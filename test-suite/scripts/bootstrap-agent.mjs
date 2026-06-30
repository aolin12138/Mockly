#!/usr/bin/env node
/**
 * Bootstrap test-suite/agent/config.json from the live test agent.
 *
 * Read-only on ElevenLabs side. Run ONCE to seed the source-of-truth file.
 * After that, agent/config.json is the canonical artifact and push-agent.mjs
 * pushes it back to the agent.
 *
 * The shape is exactly what `GET /v1/convai/agents/<id>` returns — the same
 * JSON that the n8n agent-config workflow consumes as its template.
 *
 * Usage:
 *   node test-suite/scripts/bootstrap-agent.mjs
 *   node test-suite/scripts/bootstrap-agent.mjs --force   # overwrite existing file
 *
 * Output:
 *   test-suite/agent/config.json   — full ElevenLabs agent config (eval source of truth)
 *   test-suite/agent/_meta.json    — bootstrap timestamp, agent id, version_id
 *
 * Promotion: a passing config is copied into the n8n workflow's embedded
 * template by promote-to-template.mjs. Backend is uninvolved.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../lib/agent-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_DIR = resolve(__dirname, '..', 'agent');

const force = process.argv.includes('--force');

async function main() {
  const configPath = resolve(AGENT_DIR, 'config.json');
  if (existsSync(configPath) && !force) {
    console.error(`Refused: ${configPath} exists. Pass --force to overwrite.`);
    process.exit(1);
  }

  console.log('Fetching live test agent config...');
  const agent = await getAgent();

  if (!agent.conversation_config || !agent.workflow) {
    throw new Error('Agent response missing conversation_config or workflow');
  }

  mkdirSync(AGENT_DIR, { recursive: true });

  writeFileSync(configPath, JSON.stringify(agent, null, 2), 'utf-8');
  console.log(`  WRITE: test-suite/agent/config.json (${JSON.stringify(agent).length} chars)`);

  const meta = {
    bootstrapped_at: new Date().toISOString(),
    agent_id: agent.agent_id,
    branch_id: agent.branch_id,
    version_id: agent.version_id,
    workflow_nodes: Object.entries(agent.workflow?.nodes || {}).map(([id, n]) => ({
      id,
      label: n.label || null,
      tool_count: (n.additional_tool_ids || []).length,
      prompt_chars: (n.additional_prompt || '').length,
    })),
    mcp_server_ids: agent.conversation_config?.agent?.prompt?.mcp_server_ids || [],
  };
  writeFileSync(resolve(AGENT_DIR, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
  console.log('  WRITE: agent/_meta.json');

  console.log('\nDone. Edit test-suite/agent/config.json, then run push-agent.mjs.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
