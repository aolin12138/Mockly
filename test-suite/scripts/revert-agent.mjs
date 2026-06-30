#!/usr/bin/env node
/**
 * Revert the test agent to a previously captured config.
 *
 * Two sources:
 *   --from-checkpoint <id>    — checkpoint id (e.g. "2026-06-16T06-57-19") under test-suite/checkpoints/
 *   --from-run <run-id>       — run id under test-suite/runs/ (uses runs/<id>/agent-config.json)
 *
 * Safe by default: prints what would be PATCHed but does NOT PATCH.
 * Pass --confirm to actually write.
 *
 * Usage:
 *   node test-suite/scripts/revert-agent.mjs --from-checkpoint 2026-06-16T06-57-19
 *   node test-suite/scripts/revert-agent.mjs --from-run 2026-06-24T10-15-22 --confirm
 *
 * Exit codes:
 *   0  dry-run or revert succeeded
 *   1  fatal error
 *   4  invocation error
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreCheckpoint } from '../lib/checkpoint.mjs';
import { patchAgent } from './lib/agent-api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  let checkpoint = null, runId = null, confirm = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-checkpoint') checkpoint = args[++i];
    else if (args[i] === '--from-run') runId = args[++i];
    else if (args[i] === '--confirm') confirm = true;
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown arg: ${args[i]}`); process.exit(4); }
  }
  if (!checkpoint && !runId) {
    console.error('Specify --from-checkpoint <id> or --from-run <id>');
    process.exit(4);
  }
  if (checkpoint && runId) {
    console.error('Pass only one source (--from-checkpoint OR --from-run)');
    process.exit(4);
  }
  return { checkpoint, runId, confirm };
}

function printHelp() {
  console.log(`
revert-agent.mjs — PATCH the test agent back to a saved config.

Usage:
  node test-suite/scripts/revert-agent.mjs --from-checkpoint <id> [--confirm]
  node test-suite/scripts/revert-agent.mjs --from-run <id>        [--confirm]

Without --confirm, prints the source config summary and exits without PATCHing.
`);
}

async function revertFromRun(runId, confirm) {
  const runDir = resolve(ROOT, 'runs', runId);
  if (!existsSync(runDir)) {
    // Maybe partial match
    const runs = existsSync(resolve(ROOT, 'runs'))
      ? readdirSync(resolve(ROOT, 'runs')).filter(f => f.includes(runId))
      : [];
    if (runs.length !== 1) {
      throw new Error(`Run not found: ${runId}. Matches: ${runs.length === 0 ? 'none' : runs.join(', ')}`);
    }
  }
  const configPath = resolve(runDir, 'agent-config.json');
  if (!existsSync(configPath)) throw new Error(`Missing: ${configPath}`);
  const wrap = JSON.parse(readFileSync(configPath, 'utf-8'));
  const config = wrap.full_config || wrap;
  if (!config?.conversation_config) throw new Error('agent-config.json: no conversation_config');

  console.log(`Source run: ${runId}`);
  console.log(`  version_id: ${wrap._summary?.version_id || config.version_id || '?'}`);
  console.log(`  agent_id:   ${config.agent_id || '?'}`);

  const patch = {
    name: config.name,
    conversation_config: config.conversation_config,
    platform_settings: config.platform_settings,
    workflow: config.workflow,
    coaching_settings: config.coaching_settings,
    procedures: config.procedures,
    tags: config.tags,
  };

  if (!confirm) {
    console.log('\nDRY RUN — would PATCH agent with this config. Pass --confirm to execute.');
    return;
  }
  console.log('\nPATCHing...');
  const resp = await patchAgent(patch);
  console.log(`Done. New version: ${resp.version_id || '(unknown)'}`);
}

async function main() {
  const { checkpoint, runId, confirm } = parseArgs();
  if (checkpoint) {
    const result = await restoreCheckpoint(checkpoint, { dryRun: !confirm });
    if (result.dryRun) {
      console.log('\n(Pass --confirm to actually PATCH.)');
    }
  } else {
    await revertFromRun(runId, confirm);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
