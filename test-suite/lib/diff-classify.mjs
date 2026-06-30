/**
 * Diff + classify two ElevenLabs agent configs.
 *
 * Field classification (per EVAL-PLAN.md §G.2):
 *   - mutable     — safe to PATCH from eval-driven prompt changes
 *   - restricted  — needs coordinated update (backend/MCP/n8n)
 *   - forbidden   — must not change without explicit RFC
 *
 * Exported:
 *   diffConfigs(a, b)            → array of { path, type, from, to, ... }
 *   classifyChanges(changes)     → { mutable, restricted, forbidden, ignored }
 *   loadConfig(filePath)         → unwraps the various checkpoint shapes
 *   formatChange(change)         → human-readable one-liner
 */

import { readFileSync, existsSync } from 'node:fs';

// ─── Field classification rules ──────────────────────────────
// Each entry: path pattern (dot-separated, * for any key), and its class.
// Order matters: more specific paths first.
const FIELD_RULES = [
  // ---- Mutable: safe to PATCH from eval-driven prompt changes ----
  { path: 'conversation_config.agent.prompt.prompt',                    class: 'mutable' },
  { path: 'conversation_config.agent.prompt.temperature',               class: 'mutable' },
  { path: 'conversation_config.agent.prompt.llm',                       class: 'mutable' },
  { path: 'conversation_config.agent.first_message',                    class: 'mutable' },
  { path: 'conversation_config.agent.language',                         class: 'mutable' },
  { path: 'workflow.nodes.*.additional_prompt',                         class: 'mutable' },
  { path: 'workflow.edges.*.forward_condition.condition',                class: 'mutable' },
  { path: 'workflow.edges.*.forward_condition.label',                    class: 'mutable' },
  { path: 'workflow.nodes.*.label',                                     class: 'mutable' },

  // ---- Forbidden: changing these breaks the workflow contract ----
  { path: 'agent_id',                                                   class: 'forbidden' },
  { path: 'conversation_config.agent.prompt.mcp_server_ids',            class: 'forbidden' },
  { path: 'conversation_config.agent.prompt.tools',                     class: 'mutable' },     // Adding/removing tool configs = prompt change
  { path: 'conversation_config.agent.prompt.tool_ids',                  class: 'mutable' },     // Adding tool IDs = prompt-level, safe
  { path: 'conversation_config.agent.prompt.client_tools',              class: 'mutable' },     // Client-side tools = harness concern, safe
  { path: 'conversation_config.asr',                                    class: 'forbidden' },
  { path: 'conversation_config.turn',                                   class: 'forbidden' },
  { path: 'conversation_config.tts',                                    class: 'forbidden' },
  { path: 'conversation_config.audio',                                  class: 'forbidden' },
  { path: 'conversation_config.conversation.client_events',             class: 'forbidden' },
  { path: 'conversation_config.conversation.text_only',                 class: 'forbidden' },
  { path: 'platform_settings.workspace_overrides',                      class: 'forbidden' },
  { path: 'platform_settings.overrides.enable_starting_workflow_node_id_from_client', class: 'forbidden' },
  { path: 'platform_settings.dynamic_variables',                        class: 'forbidden' },
  { path: 'workflow.nodes.*.additional_tool_ids',                       class: 'forbidden' },
  { path: 'workflow.nodes.*.tool_ids',                                  class: 'forbidden' },
  { path: 'workflow.edges',                                             class: 'restricted' },
  { path: 'workflow.start_node_id',                                     class: 'forbidden' },
];

const CATCHALL_RULES = [
  { pathPrefix: 'workflow.nodes.', defaultClass: 'restricted' },
  { pathPrefix: 'workflow.', defaultClass: 'restricted' },
  { pathPrefix: 'conversation_config.', defaultClass: 'forbidden' },
  { pathPrefix: 'platform_settings.', defaultClass: 'forbidden' },
];

// Paths that are pure metadata noise (snapshot timestamps, server-assigned
// version IDs that always bump on PATCH). Excluded from the diff.
const IGNORE_PATHS = new Set([
  'fetched_at',
  '_fetched_at',
  'version_id',
  'created_at_unix_secs',
  'main_branch_id',
  'metadata',
  'updated_at_unix_secs',
]);

function matchPath(pattern, actual) {
  const pp = pattern.split('.');
  const ap = actual.split('.');
  if (pp.length !== ap.length) return false;
  for (let i = 0; i < pp.length; i++) {
    if (pp[i] === '*') continue;
    if (pp[i] !== ap[i]) return false;
  }
  return true;
}

function classify(path) {
  for (const rule of FIELD_RULES) {
    if (matchPath(rule.path, path)) return rule.class;
  }
  for (const rule of CATCHALL_RULES) {
    if (path.startsWith(rule.pathPrefix)) return rule.defaultClass;
  }
  return 'restricted';
}

function isIgnored(path) {
  if (IGNORE_PATHS.has(path)) return true;
  const last = path.split('.').pop();
  return IGNORE_PATHS.has(last);
}

// ─── Deep diff ────────────────────────────────────────────────
export function diffConfigs(a, b, path = '') {
  const changes = [];
  const aMissing = a === undefined || a === null;
  const bMissing = b === undefined || b === null;
  if (aMissing && bMissing) return changes;
  if (aMissing || bMissing) {
    changes.push({ path, type: aMissing ? 'added' : 'removed', from: a, to: b });
    return changes;
  }
  if (typeof a !== typeof b) {
    changes.push({ path, type: 'type', from: typeof a, to: typeof b });
    return changes;
  }
  if (typeof a !== 'object') {
    if (a !== b) {
      const trunc = (v) => typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v;
      changes.push({
        path, type: 'value', from: trunc(a), to: trunc(b),
        fromLen: typeof a === 'string' ? a.length : undefined,
        toLen: typeof b === 'string' ? b.length : undefined,
      });
    }
    return changes;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    changes.push({ path, type: 'shape', from: Array.isArray(a) ? 'array' : 'object', to: Array.isArray(b) ? 'array' : 'object' });
    return changes;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length || JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ path, type: 'array', from: `len=${a.length}`, to: `len=${b.length}` });
    }
    return changes;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    changes.push(...diffConfigs(a[k], b[k], path ? `${path}.${k}` : k));
  }
  return changes;
}

/**
 * Bucket diff entries by class.
 * @param {Array} changes - output of diffConfigs()
 * @returns {{mutable: Array, restricted: Array, forbidden: Array, ignored: Array}}
 */
export function classifyChanges(changes) {
  const out = { mutable: [], restricted: [], forbidden: [], ignored: [] };
  for (const c of changes) {
    if (isIgnored(c.path)) { out.ignored.push(c); continue; }
    const cls = classify(c.path);
    out[cls].push(c);
  }
  return out;
}

/**
 * Format one change as a human-readable line.
 */
export function formatChange(c) {
  if (c.type === 'value' && c.fromLen !== undefined && c.toLen !== undefined) {
    return `${c.path}  (string ${c.fromLen} → ${c.toLen} chars)`;
  }
  if (c.type === 'value')   return `${c.path}  ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`;
  if (c.type === 'added')   return `${c.path}  (added)`;
  if (c.type === 'removed') return `${c.path}  (removed)`;
  if (c.type === 'array')   return `${c.path}  (array ${c.from} → ${c.to})`;
  return `${c.path}  (${c.type})`;
}

/**
 * Load a config from any of the known wrapper shapes:
 *   - raw agent body { agent_id, conversation_config, workflow }
 *   - newer checkpoint { agent_config: { full_config: ..., _summary: ... } }
 *   - older checkpoint { agent_config: { agent_id, conversation_config, ... } }
 *   - run-folder agent-config.json { full_config: ..., _summary: ... }
 */
export function loadConfig(filePath) {
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (data?.agent_config?.full_config) return data.agent_config.full_config;
  if (data?.agent_config?.conversation_config) return data.agent_config;
  if (data?.full_config) return data.full_config;
  if (data?.conversation_config || data?.workflow) return data;
  throw new Error(`Unrecognised config shape in ${filePath}`);
}
