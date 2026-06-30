#!/usr/bin/env node
/**
 * Compatibility gate: diff two agent configs and classify every change.
 *
 * Thin CLI wrapper around lib/diff-classify.mjs.
 *
 * Usage:
 *   node test-suite/scripts/diff-config.mjs <baseline.json> <candidate.json>
 *   node test-suite/scripts/diff-config.mjs --baseline a.json --candidate b.json
 *
 * Exit codes:
 *   0  Only Mutable changes (or no changes) — promotable
 *   1  At least one Forbidden field changed — refuse promotion
 *   2  Restricted change — needs coordinated update (warning, not refusal)
 *   4  Invocation error
 */

import { diffConfigs, classifyChanges, formatChange, loadConfig } from '../lib/diff-classify.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  let baseline = null, candidate = null;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--baseline') baseline = args[++i];
    else if (args[i] === '--candidate') candidate = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
    else positional.push(args[i]);
  }
  if (!baseline && positional[0]) baseline = positional[0];
  if (!candidate && positional[1]) candidate = positional[1];
  if (!baseline || !candidate) {
    console.error('Usage: diff-config.mjs <baseline.json> <candidate.json>');
    process.exit(4);
  }
  return { baseline, candidate };
}

function printHelp() {
  console.log(`
diff-config.mjs — compatibility gate

Usage:
  node test-suite/scripts/diff-config.mjs <baseline> <candidate>

Classifies every field change as Mutable / Restricted / Forbidden per
EVAL-PLAN.md §G.2.

Exit codes:
  0  Only Mutable changes — promotable
  1  At least one Forbidden change — refuse promotion
  2  Restricted change — needs coordinated update (warning)
  4  Invocation error
`);
}

function main() {
  const { baseline, candidate } = parseArgs();
  const a = loadConfig(baseline);
  const b = loadConfig(candidate);
  const changes = diffConfigs(a, b);

  if (changes.length === 0) {
    console.log('No differences.');
    process.exit(0);
  }

  const byClass = classifyChanges(changes);

  if (byClass.forbidden.length) {
    console.log(`\n[FORBIDDEN — promotion refused] ${byClass.forbidden.length} change(s):`);
    for (const c of byClass.forbidden) console.log(`  ✗ ${formatChange(c)}`);
  }
  if (byClass.restricted.length) {
    console.log(`\n[RESTRICTED — needs coordinated update] ${byClass.restricted.length} change(s):`);
    for (const c of byClass.restricted) console.log(`  ! ${formatChange(c)}`);
  }
  if (byClass.mutable.length) {
    console.log(`\n[MUTABLE — safe] ${byClass.mutable.length} change(s):`);
    for (const c of byClass.mutable) console.log(`  ✓ ${formatChange(c)}`);
  }

  console.log();
  if (byClass.forbidden.length) {
    console.log('Result: FORBIDDEN changes detected. Promotion blocked.');
    process.exit(1);
  }
  if (byClass.restricted.length) {
    console.log('Result: RESTRICTED changes detected. Coordinated update required.');
    process.exit(2);
  }
  console.log('Result: only Mutable changes. Promotable.');
  process.exit(0);
}

main();
