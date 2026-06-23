/**
 * Checkpoint system — snapshots agent config + test results for versioned tracking.
 * 
 * Usage:
 *   import { saveCheckpoint, listCheckpoints, compareCheckpoints } from './checkpoint.mjs';
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { CONFIG } from './config.mjs';

const CHECKPOINTS_DIR = resolve(CONFIG.scenariosDir, '..', 'checkpoints');

function ensureDir() {
  if (!existsSync(CHECKPOINTS_DIR)) mkdirSync(CHECKPOINTS_DIR, { recursive: true });
}

/**
 * Fetch the current agent configuration from ElevenLabs.
 */
export async function fetchAgentConfig() {
  const url = `https://api.elevenlabs.io/v1/convai/agents/${CONFIG.agentId}`;
  const res = await fetch(url, { headers: { 'xi-api-key': CONFIG.apiKey } });
  if (!res.ok) throw new Error(`Failed to fetch agent config: ${res.status}`);
  const agent = await res.json();

  // Save the FULL raw agent config for complete version history
  return {
    _fetched_at: new Date().toISOString(),
    _summary: {
      agent_id: agent.agent_id,
      name: agent.name,
      branch_id: agent.branch_id,
      version_id: agent.version_id,
      llm: agent.conversation_config?.agent?.prompt?.llm,
      text_only: agent.conversation_config?.conversation?.text_only,
      mcp_server_ids: agent.conversation_config?.agent?.prompt?.mcp_server_ids || [],
      enable_starting_workflow_node_id_from_client:
        agent.platform_settings?.overrides?.enable_starting_workflow_node_id_from_client,
      node_count: Object.keys(agent.workflow?.nodes || {}).length,
      tools_per_node: Object.fromEntries(
        Object.entries(agent.workflow?.nodes || {}).map(([id, node]) => [
          node.label || id.slice(-8),
          (node.additional_tool_ids || []).length,
        ])
      ),
    },
    full_config: agent,
  };
}

/**
 * Save a checkpoint: agent config snapshot + test results + change description.
 */
export async function saveCheckpoint({ description, results, metadata }) {
  ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const id = timestamp;

  let agentConfig = null;
  try {
    agentConfig = await fetchAgentConfig();
  } catch (e) {
    console.warn('Warning: Could not fetch agent config:', e.message);
  }

  const checkpoint = {
    id,
    timestamp: new Date().toISOString(),
    description,
    agent_config: agentConfig,
    results: {
      total: results.length,
      passed: results.filter(r => r.result === 'pass').length,
      failed: results.filter(r => r.result === 'fail').length,
      errors: results.filter(r => r.result === 'error').length,
      criteria_total: results.reduce((s, r) => s + r.criteria.length, 0),
      criteria_passed: results.reduce((s, r) => s + r.criteria.filter(c => c.result === 'success').length, 0),
      per_scenario: results.map(r => ({
        id: r.scenarioId,
        result: r.result,
        criteria: r.criteria.map(c => ({ id: c.id, result: c.result })),
      })),
    },
    metadata: {
      filter: metadata.filter,
      estimated_tokens: metadata.estimatedTokens,
      duration_ms: metadata.totalDurationMs,
    },
  };

  const filePath = resolve(CHECKPOINTS_DIR, `checkpoint-${id}.json`);
  writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  console.log(`Checkpoint saved: ${basename(filePath)}`);
  return filePath;
}

/**
 * List all checkpoints with summary info.
 */
export function listCheckpoints() {
  ensureDir();
  const files = readdirSync(CHECKPOINTS_DIR)
    .filter(f => f.startsWith('checkpoint-') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.map(f => {
    const data = JSON.parse(readFileSync(resolve(CHECKPOINTS_DIR, f), 'utf-8'));
    return {
      id: data.id,
      timestamp: data.timestamp,
      description: data.description,
      passed: data.results?.passed || 0,
      failed: data.results?.failed || 0,
      errors: data.results?.errors || 0,
      version_id: data.agent_config?._summary?.version_id || 'unknown',
      llm: data.agent_config?._summary?.llm || '?',
      tools_per_node: data.agent_config?._summary?.tools_per_node || {},
      file: f,
    };
  });
}

/**
 * Compare two checkpoints and return a diff.
 */
export function compareCheckpoints(id1, id2) {
  ensureDir();
  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json'));

  const find = (id) => {
    const file = files.find(f => f.includes(id));
    if (!file) throw new Error(`Checkpoint not found: ${id}`);
    return JSON.parse(readFileSync(resolve(CHECKPOINTS_DIR, file), 'utf-8'));
  };

  const cp1 = find(id1);
  const cp2 = find(id2);

  const diff = {
    from: cp1.id,
    to: cp2.id,
    description_from: cp1.description,
    description_to: cp2.description,
    results: {
      passed: { from: cp1.results.passed, to: cp2.results.passed, delta: cp2.results.passed - cp1.results.passed },
      failed: { from: cp1.results.failed, to: cp2.results.failed, delta: cp2.results.failed - cp1.results.failed },
      criteria_pct_from: cp1.results.criteria_total > 0
        ? Math.round((cp1.results.criteria_passed / cp1.results.criteria_total) * 100)
        : 0,
      criteria_pct_to: cp2.results.criteria_total > 0
        ? Math.round((cp2.results.criteria_passed / cp2.results.criteria_total) * 100)
        : 0,
    },
    scenario_changes: [],
    config_diff: {},
  };

  // Per-scenario changes
  const map1 = Object.fromEntries(cp1.results.per_scenario.map(s => [s.id, s]));
  const map2 = Object.fromEntries(cp2.results.per_scenario.map(s => [s.id, s]));

  for (const id of new Set([...Object.keys(map1), ...Object.keys(map2)])) {
    const r1 = map1[id];
    const r2 = map2[id];
    if (!r1) {
      diff.scenario_changes.push({ id, change: 'NEW', result: r2.result });
    } else if (!r2) {
      diff.scenario_changes.push({ id, change: 'REMOVED', result: r1.result });
    } else if (r1.result !== r2.result) {
      diff.scenario_changes.push({ id, change: `${r1.result} → ${r2.result}`, from: r1.result, to: r2.result });
    }
  }

  // Config diff — compare summaries + prompt changes
  if (cp1.agent_config && cp2.agent_config) {
    const s1 = cp1.agent_config._summary || {};
    const s2 = cp2.agent_config._summary || {};
    const fc1 = cp1.agent_config.full_config;
    const fc2 = cp2.agent_config.full_config;

    const changes = {};

    if (s1.version_id !== s2.version_id) changes.version = `${s1.version_id?.slice(-8) || '?'} → ${s2.version_id?.slice(-8) || '?'}`;
    if (s1.llm !== s2.llm) changes.llm = `${s1.llm} → ${s2.llm}`;
    if (s1.text_only !== s2.text_only) changes.text_only = `${s1.text_only} → ${s2.text_only}`;
    if (s1.enable_starting_workflow_node_id_from_client !== s2.enable_starting_workflow_node_id_from_client)
      changes.starting_node_override = `${s1.enable_starting_workflow_node_id_from_client} → ${s2.enable_starting_workflow_node_id_from_client}`;

    const mcp1 = (s1.mcp_server_ids || []).join(',') || 'none';
    const mcp2 = (s2.mcp_server_ids || []).join(',') || 'none';
    if (mcp1 !== mcp2) changes.mcp_servers = `${mcp1} → ${mcp2}`;

    // Tools per node changes
    const tp1 = s1.tools_per_node || {};
    const tp2 = s2.tools_per_node || {};
    for (const node of new Set([...Object.keys(tp1), ...Object.keys(tp2)])) {
      if ((tp1[node] || 0) !== (tp2[node] || 0)) {
        changes[`${node}_tools`] = `${tp1[node] || 0} → ${tp2[node] || 0}`;
      }
    }

    // Prompt changes (system prompt)
    const prompt1 = fc1?.conversation_config?.agent?.prompt?.prompt || '';
    const prompt2 = fc2?.conversation_config?.agent?.prompt?.prompt || '';
    if (prompt1 !== prompt2) {
      changes.system_prompt = `Changed (${prompt1.length} → ${prompt2.length} chars)`;
    }

    // Phase prompt changes
    const nodes1 = fc1?.workflow?.nodes || {};
    const nodes2 = fc2?.workflow?.nodes || {};
    for (const [nid, n1] of Object.entries(nodes1)) {
      const n2 = nodes2[nid];
      const ap1 = n1?.additional_prompt || '';
      const ap2 = n2?.additional_prompt || '';
      if (ap1 !== ap2 && n1?.label) {
        changes[`${n1.label}_prompt`] = `Changed (${ap1.length} → ${ap2.length} chars)`;
      }
    }

    diff.config_diff = Object.keys(changes).length > 0 ? changes : { note: 'No config changes detected' };
  }

  return diff;
}

/**
 * Restore agent configuration from a checkpoint.
 * PATCHes the agent with the saved full_config.
 * WARNING: This overwrites the current agent configuration.
 */
export async function restoreCheckpoint(checkpointId, { dryRun = false } = {}) {
  ensureDir();
  const files = readdirSync(CHECKPOINTS_DIR).filter(f => f.endsWith('.json'));
  const file = files.find(f => f.includes(checkpointId));
  if (!file) throw new Error(`Checkpoint not found: ${checkpointId}`);

  const cp = JSON.parse(readFileSync(resolve(CHECKPOINTS_DIR, file), 'utf-8'));
  const config = cp.agent_config?.full_config;
  if (!config) throw new Error('Checkpoint has no full agent config');

  // Build the PATCH payload from the saved config — include ALL configurational fields
  // so the agent can be fully reconfigured from the checkpoint alone
  const patch = {
    name: config.name,
    conversation_config: config.conversation_config,
    platform_settings: config.platform_settings,
    workflow: config.workflow,
    coaching_settings: config.coaching_settings,
    procedures: config.procedures,
    tags: config.tags,
  };

  if (dryRun) {
    console.log('DRY RUN — would PATCH agent with config from checkpoint:', cp.id);
    console.log('Config version:', cp.agent_config?._summary?.version_id);
    console.log('Description:', cp.description);
    return { dryRun: true, checkpointId: cp.id };
  }

  const branchId = config.branch_id || CONFIG.branchId || '';
  const url = `https://api.elevenlabs.io/v1/convai/agents/${CONFIG.agentId}${branchId ? '?branch_id=' + branchId : ''}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'xi-api-key': CONFIG.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to restore config: ${res.status} — ${JSON.stringify(err).slice(0, 300)}`);
  }

  console.log(`Config restored from checkpoint ${cp.id}`);
  return { restored: true, checkpointId: cp.id };
}
