/**
 * Auto-sync the local agent/config.json with the live test agent.
 *
 * Called at the start of every eval run so the live agent's behaviour
 * always matches what we're trying to test. Also reusable by push-agent.mjs.
 *
 * The decision tree (per EVAL-PLAN.md §G.2):
 *   - local file missing       → action: 'skip'  (proceed against live as-is)
 *   - local == live            → action: 'identical'
 *   - only Mutable diffs       → action: 'patch' (auto-PATCH if confirm=true)
 *   - has Restricted diffs     → action: 'restricted' (requires allowRestricted=true to patch)
 *   - has Forbidden diffs      → action: 'forbidden' (NEVER patch; abort)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent, patchAgent } from './agent-api.mjs';
import { diffConfigs, classifyChanges, formatChange } from './diff-classify.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOCAL_PATH = resolve(__dirname, '..', 'agent', 'config.json');

/**
 * Build the PATCH payload from a full agent config. Mirrors what
 * restoreCheckpoint sends — only the fields ElevenLabs accepts on PATCH.
 */
function buildPatch(localConfig) {
  return {
    name: localConfig.name,
    conversation_config: localConfig.conversation_config,
    platform_settings: localConfig.platform_settings,
    workflow: localConfig.workflow,
    coaching_settings: localConfig.coaching_settings,
    procedures: localConfig.procedures,
    tags: localConfig.tags,
  };
}

/**
 * Compare local agent/config.json to the live test agent and (optionally) PATCH.
 *
 * @param {object} opts
 * @param {string} [opts.localPath]        - path to local config.json
 * @param {boolean} [opts.confirm]         - actually PATCH (default false = dry-run)
 * @param {boolean} [opts.allowRestricted] - allow PATCH despite Restricted-class changes
 * @param {boolean} [opts.silent]          - skip console output (caller will format)
 * @returns {Promise<{
 *   action: 'skip' | 'identical' | 'patch' | 'restricted' | 'forbidden',
 *   patched: boolean,
 *   byClass: {mutable: Array, restricted: Array, forbidden: Array, ignored: Array},
 *   live: object | null,
 *   local: object | null,
 *   newVersionId: string | null,
 *   message: string,
 * }>}
 */
export async function syncAgent({
  localPath = DEFAULT_LOCAL_PATH,
  confirm = false,
  allowRestricted = false,
  silent = false,
} = {}) {
  const log = silent ? () => {} : console.log.bind(console);

  // 1. Local file present?
  if (!existsSync(localPath)) {
    return {
      action: 'skip',
      patched: false,
      byClass: { mutable: [], restricted: [], forbidden: [], ignored: [] },
      live: null,
      local: null,
      newVersionId: null,
      message: `No local config at ${localPath}. Run bootstrap-agent.mjs to seed it. ` +
               `Proceeding with whatever is currently on the test agent.`,
    };
  }
  const local = JSON.parse(readFileSync(localPath, 'utf-8'));
  if (!local.conversation_config || !local.workflow) {
    throw new Error(`${localPath}: missing conversation_config or workflow — invalid agent config`);
  }

  // 2. Fetch live
  log(`Fetching live test agent for sync check...`);
  const live = await getAgent();

  // 3. Diff + classify
  const changes = diffConfigs(live, local);
  const byClass = classifyChanges(changes);

  // 4. Decide action
  if (byClass.forbidden.length) {
    return {
      action: 'forbidden',
      patched: false,
      byClass,
      live,
      local,
      newVersionId: null,
      message: `${byClass.forbidden.length} Forbidden field change(s) — push refused.`,
    };
  }
  if (byClass.restricted.length && !allowRestricted) {
    return {
      action: 'restricted',
      patched: false,
      byClass,
      live,
      local,
      newVersionId: null,
      message: `${byClass.restricted.length} Restricted field change(s) — pass --allow-restricted to proceed.`,
    };
  }
  if (!byClass.mutable.length && !byClass.restricted.length) {
    return {
      action: 'identical',
      patched: false,
      byClass,
      live,
      local,
      newVersionId: null,
      message: 'Local agent/config.json already matches live agent. No PATCH needed.',
    };
  }

  // 5. PATCH if confirmed
  if (!confirm) {
    return {
      action: 'patch',
      patched: false,
      byClass,
      live,
      local,
      newVersionId: null,
      message: `${byClass.mutable.length} Mutable + ${byClass.restricted.length} Restricted change(s) — dry-run, no PATCH.`,
    };
  }

  log(`Auto-pushing local agent/config.json to live test agent...`);
  const patch = buildPatch(local);
  const resp = await patchAgent(patch);
  return {
    action: 'patch',
    patched: true,
    byClass,
    live,
    local,
    newVersionId: resp.version_id || null,
    message: `Auto-pushed. New version_id: ${resp.version_id || '(unknown)'}`,
  };
}

/**
 * Pretty-print the result of syncAgent to console.
 */
export function printSyncResult(result) {
  const { byClass, action, message } = result;
  if (action !== 'identical' && action !== 'skip') {
    if (byClass.forbidden.length) {
      console.log(`\n[FORBIDDEN] ${byClass.forbidden.length} change(s):`);
      for (const c of byClass.forbidden) console.log(`  ✗ ${formatChange(c)}`);
    }
    if (byClass.restricted.length) {
      console.log(`\n[RESTRICTED] ${byClass.restricted.length} change(s):`);
      for (const c of byClass.restricted) console.log(`  ! ${formatChange(c)}`);
    }
    if (byClass.mutable.length) {
      console.log(`\n[MUTABLE] ${byClass.mutable.length} change(s):`);
      for (const c of byClass.mutable) console.log(`  ✓ ${formatChange(c)}`);
    }
    console.log();
  }
  console.log(message);
}
