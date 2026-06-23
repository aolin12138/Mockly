#!/usr/bin/env node

/**
 * Mockly Test Suite Runner — CLI entry point.
 * 
 * Usage:
 *   node runner.mjs --all              Run all scenarios
 *   node runner.mjs --tag hints        Run scenarios matching tag
 *   node runner.mjs --scenario id1,id2 Run specific scenarios
 *   node runner.mjs --all --dry-run    Estimate cost only
 *   node runner.mjs --all --yes        Skip cost confirmation
 */

import { loadAllScenarios } from './lib/loader.mjs';
import { estimateCost, simulateConversation } from './lib/api-client.mjs';
import { runPool } from './lib/pool.mjs';
import { CONFIG } from './lib/config.mjs';

// ─── CLI argument parsing ──────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    all: false,
    tags: [],
    ids: [],
    dryRun: false,
    yes: false,
    concurrency: CONFIG.concurrency,
    output: CONFIG.defaultReportPath,
    timeout: CONFIG.perScenarioTimeoutMs,
    agentId: CONFIG.agentId,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all':
        opts.all = true;
        break;
      case '--tag':
        opts.tags.push(args[++i]);
        break;
      case '--scenario':
        opts.ids = (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--yes':
      case '-y':
        opts.yes = true;
        break;
      case '--concurrency':
        opts.concurrency = parseInt(args[++i], 10) || CONFIG.concurrency;
        break;
      case '--output':
        opts.output = args[++i] || CONFIG.defaultReportPath;
        break;
      case '--timeout':
        opts.timeout = parseInt(args[++i], 10) * 1000 || CONFIG.perScenarioTimeoutMs;
        break;
      case '--checkpoint':
        opts.checkpointDesc = args[++i] || '';
        break;
      case '--restore':
        opts.restore = args[++i] || '';
        break;
      case '--compare':
        opts.compare = (args[++i] || '').split(',').map(s => s.trim());
        break;
      case '--agent-id':
        opts.agentId = args[++i];
        break;
      case '--list-checkpoints':
        opts.listCheckpoints = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(2);
    }
  }

  // Quick commands don't need scenario filters
  if (!opts.all && opts.tags.length === 0 && opts.ids.length === 0 && !opts.listCheckpoints && !opts.compare && !opts.restore) {
    console.error('Error: Must specify --all, --tag, or --scenario');
    printHelp();
    process.exit(2);
  }

  return opts;
}

function printHelp() {
  console.log(`
Mockly Test Suite Runner

Usage: node runner.mjs [options]

Options:
  --all                  Run all scenarios
  --tag <tag>            Run scenarios matching a tag (repeatable)
  --scenario <ids>       Run specific scenario IDs (comma-separated)
  --dry-run              Estimate cost only, no execution
  --yes, -y              Skip cost confirmation prompt
  --concurrency <n>      Max parallel scenarios (default: ${CONFIG.concurrency})
  --timeout <secs>       Per-scenario timeout in seconds (default: ${CONFIG.perScenarioTimeoutMs / 1000})
  --output <path>        Report output path (default: report.html)
  --agent-id <id>        ElevenLabs agent ID (default: from .env)
  --help, -h             Show this help

Exit codes:
  0   All criteria passed
  1   One or more criteria failed
  2   Suite error (config, API unreachable)
`);
}

// ─── Progress display ──────────────────────────────────────────

function createProgressBar() {
  let lastLine = '';
  return function progress({ scenarioId, result, index, total }) {
    const icon = result === 'pass' ? '✓' : result === 'fail' ? '✗' : '⚠';
    const line = `  [${index}/${total}] ${icon} ${scenarioId} (${result})`;
    // Clear previous line and write new
    if (lastLine) process.stdout.write('\r\x1b[K');
    process.stdout.write(line);
    if (index === total) process.stdout.write('\n');
    lastLine = line;
  };
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log('Mockly Test Suite Runner');
  console.log(`Agent ID: ${opts.agentId}`);
  console.log();

  // Validate API key
  if (!CONFIG.apiKey) {
    console.error('Error: No API key found. Set ELEVENLABS_PLATFORM_KEY in .env');
    process.exit(2);
  }

  // ─── Quick commands (no simulation needed) ─────────────────
  if (opts.listCheckpoints) {
    const { listCheckpoints } = await import('./lib/checkpoint.mjs');
    const cps = listCheckpoints();
    if (cps.length === 0) {
      console.log('No checkpoints yet. Run --all to create one.');
    } else {
      console.log('Checkpoints:');
      for (const cp of cps) {
        console.log(`  ${cp.id} | ${cp.passed}P/${cp.failed}F/${cp.errors}E | ${cp.description}`);
      }
    }
    process.exit(0);
  }

  if (opts.compare) {
    const { compareCheckpoints } = await import('./lib/checkpoint.mjs');
    const diff = compareCheckpoints(opts.compare[0], opts.compare[1]);
    console.log(`Comparing: ${diff.description_from} → ${diff.description_to}`);
    console.log(`Results: ${diff.results.passed.from}P→${diff.results.passed.to}P, ${diff.results.failed.from}F→${diff.results.failed.to}F`);
    console.log(`Criteria: ${diff.results.criteria_pct_from}% → ${diff.results.criteria_pct_to}%`);
    if (diff.scenario_changes.length > 0) {
      console.log('Scenario changes:');
      for (const sc of diff.scenario_changes) {
        console.log(`  ${sc.change}: ${sc.id}`);
      }
    }
    if (diff.config_diff && Object.keys(diff.config_diff).length > 0) {
      console.log('Config changes:', JSON.stringify(diff.config_diff, null, 2));
    }
    process.exit(0);
  }

  if (opts.restore) {
    const { restoreCheckpoint } = await import('./lib/checkpoint.mjs');
    console.log(`Restoring agent config from checkpoint: ${opts.restore}`);
    console.log('WARNING: This will overwrite the current agent configuration!');
    await restoreCheckpoint(opts.restore, { dryRun: false });
    console.log('Done. Run --all to verify.');
    process.exit(0);
  }

  // ─── Load scenarios ─────────────────────────────────────────
  const { scenarios, totalAvailable, filter, loadErrors } = loadAllScenarios({
    ids: opts.ids.length > 0 ? opts.ids : undefined,
    tags: opts.tags.length > 0 ? opts.tags : undefined,
  });

  if (loadErrors.length > 0) {
    console.warn(`Warning: ${loadErrors.length} scenario(s) failed to load.`);
  }

  if (scenarios.length === 0) {
    console.error('Error: No scenarios matched the filter.');
    process.exit(2);
  }

  console.log(`Loaded ${scenarios.length} of ${totalAvailable} scenarios (filter: ${filter})`);
  console.log();

  // ─── Cost estimate ──────────────────────────────────────────
  console.log('Estimating cost...');
  let estimatedTokens = 0;
  for (const scenario of scenarios) {
    const est = await estimateCost(opts.agentId, scenario);
    estimatedTokens += est || 0;
  }
  console.log(`Estimated tokens: ~${estimatedTokens.toLocaleString()} (heuristic)`);
  console.log(`Estimated cost:   ~$${(estimatedTokens * 0.000002).toFixed(3)} (at ~$2/M tokens)`);
  console.log();

  if (opts.dryRun) {
    console.log('Dry run complete. No simulations executed.');
    process.exit(0);
  }

  // ─── Confirmation ───────────────────────────────────────────
  if (!opts.yes) {
    console.log(`About to run ${scenarios.length} scenarios. Continue? (y/N)`);
    // In a real CLI we'd use readline; for now, skip if not --yes
    console.log('Use --yes to skip this prompt.');
    console.log();
  }

  // ─── Run ────────────────────────────────────────────────────
  const startTime = Date.now();
  const progress = createProgressBar();

  console.log(`Running ${scenarios.length} scenarios (concurrency: ${opts.concurrency})...`);
  console.log();

  const results = await runPool(opts.agentId, scenarios, {
    concurrency: opts.concurrency,
    timeoutMs: opts.timeout,
    onProgress: progress,
  });

  const totalDurationMs = Date.now() - startTime;
  console.log();
  console.log(`Completed in ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log();

  // ─── Aggregate ───────────────────────────────────────────────
  const passed = results.filter(r => r.result === 'pass');
  const failed = results.filter(r => r.result === 'fail');
  const errored = results.filter(r => r.result === 'error');
  const totalCriteria = results.reduce((sum, r) => sum + r.criteria.length, 0);
  const passedCriteria = results.reduce((sum, r) => sum + r.criteria.filter(c => c.result === 'success').length, 0);
  const failedCriteria = results.reduce((sum, r) => sum + r.criteria.filter(c => c.result === 'failure').length, 0);
  const actualTokens = results.reduce((sum, r) => sum + r.tokens, 0);

  console.log('═══ Results ═══');
  console.log(`Scenarios:  ${results.length} total, ${passed.length} passed, ${failed.length} failed, ${errored.length} errors`);
  console.log(`Criteria:   ${totalCriteria} checks, ${passedCriteria} passed, ${failedCriteria} failed`);
  console.log(`Tokens:     ~${actualTokens.toLocaleString()} (estimated: ~${estimatedTokens.toLocaleString()})`);
  console.log();

  // Show failures
  if (failed.length > 0 || errored.length > 0) {
    console.log('─── Failures & Errors ───');
    for (const r of failed) {
      console.log(`  ✗ ${r.scenarioId}:`);
      for (const c of r.criteria.filter(c => c.result === 'failure')) {
        console.log(`      - ${c.id}: ${c.rationale.slice(0, 120)}`);
      }
    }
    for (const r of errored) {
      console.log(`  ⚠ ${r.scenarioId}: ${r.error} — ${r.message?.slice(0, 120) || ''}`);
    }
    console.log();
  }

  // ─── Render report ──────────────────────────────────────────
  const { writeReport } = await import('./lib/report.mjs');
  const reportPath = writeReport(results, {
    agentId: opts.agentId,
    filter,
    totalAvailable,
    estimatedTokens,
    totalDurationMs,
    timestamp: new Date().toISOString(),
  }, opts.output);
  console.log(`Report written: ${reportPath}`);

  // ─── Save checkpoint ────────────────────────────────────────
  const { saveCheckpoint } = await import('./lib/checkpoint.mjs');
  const desc = opts.checkpointDesc || `Run: ${filter} (${results.length} scenarios)`;
  await saveCheckpoint({
    description: desc,
    results,
    metadata: { filter, estimatedTokens, totalDurationMs },
  });
  console.log();

  // ─── Exit code ──────────────────────────────────────────────
  if (errored.length > 0) {
    process.exit(1);
  }
  if (failed.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(2);
});
