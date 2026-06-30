#!/usr/bin/env node
/**
 * Push test-suite/agent/config.json to the live test agent.
 *
 * Thin CLI wrapper around lib/auto-sync.mjs (which is also what runner.mjs
 * uses internally — same sync logic everywhere).
 *
 * Safe by default: dry-run shows the diff but does NOT PATCH.
 *
 * Usage:
 *   node test-suite/scripts/push-agent.mjs                # dry-run
 *   node test-suite/scripts/push-agent.mjs --confirm      # actually PATCH
 *   node test-suite/scripts/push-agent.mjs --confirm --allow-restricted
 *                                                        # also allow restricted-class changes
 *
 * Exit codes:
 *   0  dry-run or PATCH succeeded
 *   1  fatal error (file missing, PATCH failed)
 *   3  Forbidden field would change — refused (always, even with --confirm)
 *   4  Restricted field would change without --allow-restricted
 */

import { syncAgent, printSyncResult } from '../lib/auto-sync.mjs';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const allowRestricted = args.includes('--allow-restricted');

async function main() {
  let result;
  try {
    result = await syncAgent({ confirm, allowRestricted });
  } catch (e) {
    console.error('Fatal:', e.message);
    process.exit(1);
  }
  printSyncResult(result);

  switch (result.action) {
    case 'skip':
    case 'identical':
      process.exit(0);
    case 'forbidden':
      process.exit(3);
    case 'restricted':
      // Only reached when !allowRestricted (otherwise it would have been 'patch')
      process.exit(4);
    case 'patch':
      if (!result.patched) {
        console.log('\nDRY RUN. Pass --confirm to actually PATCH the agent.');
      }
      process.exit(0);
  }
}

main();
