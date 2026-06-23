#!/usr/bin/env node

/**
 * Live test harness runner — CLI entry point.
 *
 * Runs scenarios against the real ElevenLabs agent over WebSocket in text-only mode.
 * Captures workflow_node_id, tool calls, and evaluates criteria via DeepSeek judge.
 *
 * Usage:
 *   node test-suite/live/runner.mjs --all              Run all non-prefilled scenarios
 *   node test-suite/live/runner.mjs --tag understanding  Run scenarios matching tag
 *   node test-suite/live/runner.mjs --scenario id1,id2  Run specific scenarios
 *   node test-suite/live/runner.mjs --all --dry-run     Estimate cost only
 *   node test-suite/live/runner.mjs --all --yes         Skip cost confirmation
 *
 * Report: live-report.html (use --output to change)
 */

import { loadAllScenarios } from '../lib/loader.mjs';
import { CONFIG } from '../lib/config.mjs';
import { loadEnv } from './_env.mjs';
import { runOne, PHASE_NODE_IDS } from './run-one.mjs';
import { judgeCriteria, overallResult } from './judge.mjs';
import { collectNodeIds } from './verify.mjs';
import { writeReport } from '../lib/report.mjs';

// Node ID → label mapping for readable output
const NODE_LABELS = {};
for (const [phase, id] of Object.entries(PHASE_NODE_IDS)) {
  NODE_LABELS[id] = `Phase ${phase}`;
}

// ─── CLI argument parsing ──────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    all: false,
    tags: [],
    ids: [],
    dryRun: false,
    yes: false,
    concurrency: 2,
    output: 'live-report.html',
    timeout: 120,
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
        opts.concurrency = parseInt(args[++i], 10) || 2;
        break;
      case '--output':
        opts.output = args[++i] || 'live-report.html';
        break;
      case '--timeout':
        opts.timeout = parseInt(args[++i], 10) || 120;
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

  if (!opts.all && opts.tags.length === 0 && opts.ids.length === 0) {
    console.error('Error: Must specify --all, --tag, or --scenario');
    printHelp();
    process.exit(2);
  }

  return opts;
}

function printHelp() {
  console.log(`
Mockly Live Test Suite Runner

Usage: node test-suite/live/runner.mjs [options]

Options:
  --all                  Run all non-prefilled scenarios
  --tag <tag>            Run scenarios matching a tag (repeatable)
  --scenario <ids>       Run specific scenario IDs (comma-separated)
  --dry-run              Estimate cost only, no execution
  --yes, -y              Skip cost confirmation prompt
  --concurrency <n>      Max parallel scenarios (default: 2)
  --timeout <secs>       Per-scenario timeout in seconds (default: 120)
  --output <path>        Report output path (default: live-report.html)
  --help, -h             Show this help

Exit codes:
  0   All criteria passed
  1   One or more scenarios failed
  2   Suite error (config, API unreachable)

Note: Scenarios with partial_conversation_history are skipped (live limitation).
`);
}

// ─── Helpers ────────────────────────────────────────────────────

function estimateCost(scenario) {
  // Heuristic: ~500 tokens per turn; ~$0.50/M tokens for DeepSeek chat
  const turns = scenario.new_turns_limit || 6;
  const tokensPerTurn = 500;
  const simUserTokens = turns * tokensPerTurn;
  const judgeTokens = (scenario.evaluation_criteria?.length || 2) * 200;
  return simUserTokens + judgeTokens;
}

function hasPrefilledHistory(scenario) {
  return scenario.partial_conversation_history &&
    Array.isArray(scenario.partial_conversation_history) &&
    scenario.partial_conversation_history.length > 0;
}

// ─── Progress display ───────────────────────────────────────────

function createProgressBar() {
  let lastLine = '';
  return function progress({ scenarioId, result, index, total, skipped = false }) {
    const icon = skipped ? '⏭' : result === 'pass' ? '✓' : result === 'fail' ? '✗' : '⚠';
    const label = skipped ? `skipped (history)` : result;
    const line = `  [${index}/${total}] ${icon} ${scenarioId} (${label})`;
    if (lastLine) process.stdout.write('\r\x1b[K');
    process.stdout.write(line);
    if (index === total) process.stdout.write('\n');
    lastLine = line;
  };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log('Mockly Live Test Suite Runner');
  console.log(`Agent ID: ${CONFIG.agentId}`);
  console.log(`Mode: text-only WebSocket (requires ElevenLabs platform key)`);
  console.log();

  // Validate API keys
  const env = loadEnv();
  const apiKey = env.ELEVENLABS_PLATFORM_KEY || env.VITE_ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('Error: No ElevenLabs API key found. Set ELEVENLABS_PLATFORM_KEY in .env');
    process.exit(2);
  }
  const deepseekKey = env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    console.error('Error: No DeepSeek API key found. Set DEEPSEEK_API_KEY in .env');
    process.exit(2);
  }

  // Quick DeepSeek key validation
  try {
    const testRes = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${deepseekKey}` },
    });
    if (!testRes.ok) {
      const errText = await testRes.text();
      console.warn(`Warning: DeepSeek API key validation failed (${testRes.status}). Judge and sim-user will be unavailable.`);
      console.warn(`  ${errText.slice(0, 200)}`);
      console.warn('  The runner will still start WS conversations and fetch transcripts.');
      console.warn('  Set a valid DEEPSEEK_API_KEY in .env for full functionality.');
    } else {
      console.log('DeepSeek API key: valid');
    }
  } catch (e) {
    console.warn('Warning: Could not validate DeepSeek API key:', e.message);
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

  // ─── Separate runnable vs skipped ───────────────────────────
  const runnable = scenarios.filter(s => !hasPrefilledHistory(s));
  const skipped = scenarios.filter(s => hasPrefilledHistory(s));

  if (skipped.length > 0) {
    console.log(`Skipping ${skipped.length} scenario(s) with partial_conversation_history:`);
    for (const s of skipped) {
      console.log(`  ⏭ ${s.id} — prefilled history (live limitation)`);
    }
    console.log();
  }

  console.log(`Runnable: ${runnable.length} scenario(s)`);
  console.log();

  if (runnable.length === 0) {
    console.log('No runnable scenarios. Exiting.');
    process.exit(0);
  }

  // ─── Cost estimate ──────────────────────────────────────────
  let estimatedTokens = 0;
  for (const scenario of runnable) {
    estimatedTokens += estimateCost(scenario);
  }
  const estimatedCostUSD = (estimatedTokens * 0.000002).toFixed(3);

  console.log(`Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
  console.log(`Estimated cost:   ~$${estimatedCostUSD} (heuristic, DeepSeek V3)`);
  console.log();

  if (opts.dryRun) {
    console.log('Dry run complete. No conversations executed.');
    process.exit(0);
  }

  if (!opts.yes) {
    console.log(`About to run ${runnable.length} live conversation(s). Continue? (use --yes to skip prompt)`);
    console.log();
    // For non-interactive mode, require --yes
    console.log('Use --yes to confirm.');
    console.log();
    // In real usage, we'd prompt. For now, auto-continue if --yes is set.
    // If not set, we simulate the same as --dry-run
    if (!opts.yes) {
      console.log('No --yes flag. Use --dry-run to estimate, or add --yes to execute.');
      process.exit(0);
    }
  }

  // ─── Run ────────────────────────────────────────────────────
  const startTime = Date.now();
  const progress = createProgressBar();
  const allResults = [];
  const total = runnable.length + skipped.length;
  let completed = 0;

  console.log(`Running ${runnable.length} live conversation(s) (concurrency: ${opts.concurrency})...`);
  console.log();

  // Simple sequential runner (concurrency via pool for future)
  for (const scenario of runnable) {
    completed++;
    console.log(`\n─── Scenario: ${scenario.id} (${completed}/${runnable.length}) ───`);

    const result = await runOne(scenario, {
      apiKey,
      agentId: CONFIG.agentId,
      turnTimeoutMs: 120000,
      conversationTimeoutMs: opts.timeout * 1000,
    });

    // If conversation succeeded, run judge
    if (result.result !== 'error') {
      try {
        const criteriaResults = await judgeCriteria({
          scenarioId: scenario.id,
          scenarioDescription: scenario.description || '',
          criteria: scenario.evaluation_criteria || [],
          transcript: result.transcript,
          apiKey: deepseekKey,
        });
        result.criteria = criteriaResults;
        result.result = overallResult(criteriaResults);
      } catch (err) {
        console.warn(`  Judge error for ${scenario.id}: ${err.message}. Criteria will be empty.`);
        result.criteria = (scenario.evaluation_criteria || []).map(c => ({
          id: c.id,
          result: 'unknown',
          rationale: 'Judge unavailable',
        }));
        result.result = 'fail';
      }
    }

    // Add node ID info for the report
    result.nodesWalked = collectNodeIds(result.transcript);

    progress({
      scenarioId: scenario.id,
      result: result.result,
      index: completed,
      total: runnable.length,
    });

    allResults.push(result);
  }

  // Add skipped results
  for (const s of skipped) {
    completed++;
    allResults.push({
      scenarioId: s.id,
      description: s.description || '',
      targetPhase: s.target_phase || null,
      targetPhaseLabel: s.target_phase_label || '(skipped — prefilled history)',
      result: 'skip',
      criteria: [],
      transcript: [],
      rawEvents: [],
      conversationId: null,
      tokens: 0,
      durationMs: 0,
      turnsUsed: 0,
      turnLimit: s.new_turns_limit,
      nodesWalked: [],
      skipped: true,
    });
    progress({
      scenarioId: s.id,
      result: 'skip',
      index: completed,
      total,
      skipped: true,
    });
  }

  const totalDurationMs = Date.now() - startTime;
  console.log();
  console.log(`Completed in ${(totalDurationMs / 1000).toFixed(1)}s`);

  // ─── Aggregate ───────────────────────────────────────────────
  const passed = allResults.filter(r => r.result === 'pass');
  const failed = allResults.filter(r => r.result === 'fail');
  const errored = allResults.filter(r => r.result === 'error');
  const skipCount = allResults.filter(r => r.result === 'skip');
  const totalCriteria = allResults.reduce((sum, r) => sum + (r.criteria?.length || 0), 0);
  const passedCriteria = allResults.reduce((sum, r) => sum + (r.criteria?.filter(c => c.result === 'success').length || 0), 0);
  const failedCriteria = allResults.reduce((sum, r) => sum + (r.criteria?.filter(c => c.result === 'failure').length || 0), 0);

  console.log();
  console.log('═══ Results ═══');
  console.log(`Scenarios:  ${allResults.length} total, ${passed.length} passed, ${failed.length} failed, ${errored.length} errors, ${skipCount.length} skipped`);
  console.log(`Criteria:   ${totalCriteria} checks, ${passedCriteria} passed, ${failedCriteria} failed`);
  console.log();

  // Show failures
  if (failed.length > 0 || errored.length > 0) {
    console.log('─── Failures & Errors ───');
    for (const r of failed) {
      console.log(`  ✗ ${r.scenarioId}:`);
      for (const c of (r.criteria?.filter(c => c.result === 'failure') || [])) {
        console.log(`      - ${c.id}: ${(c.rationale || '').slice(0, 120)}`);
      }
    }
    for (const r of errored) {
      console.log(`  ⚠ ${r.scenarioId}: ${r.error} — ${(r.message || '').slice(0, 120)}`);
    }
    console.log();
  }

  // Show workflow nodes walked
  console.log('─── Workflow Nodes ───');
  for (const r of allResults) {
    if (r.nodesWalked && r.nodesWalked.length > 0) {
      const nodes = r.nodesWalked
        .map(n => n.nodeId ? (NODE_LABELS[n.nodeId] || n.nodeId.slice(-8)) : 'none')
        .join(' → ');
      console.log(`  ${r.scenarioId}: [${nodes}]`);
    }
  }
  console.log();

  // ─── Render report ──────────────────────────────────────────
  // Adapt results to the format expected by the existing report generator.
  // The report template expects: scenarioId, description, targetPhase, targetPhaseLabel,
  //   result, criteria, transcript, tokens, durationMs, turnsUsed, turnLimit, error, message, historyCount
  const reportResults = allResults.map(r => {
    // Inject workflow node labels into transcript turns for readable report display
    const transcriptWithLabels = (r.transcript || []).map(turn => {
      if (turn.agent_metadata?.workflow_node_id) {
        const label = NODE_LABELS[turn.agent_metadata.workflow_node_id];
        if (label) {
          return {
            ...turn,
            agent_metadata: {
              ...turn.agent_metadata,
              workflow_node_id: label,  // Replace raw ID with label
            },
          };
        }
      }
      return turn;
    });
    return {
      ...r,
      transcript: transcriptWithLabels,
      result: r.result === 'skip' ? 'error' : r.result,
      error: r.error || (r.result === 'skip' ? 'SKIPPED' : undefined),
      message: r.message || (r.result === 'skip' ? 'Scenario has partial_conversation_history — live limitation. See test-suite/live/README.md.' : undefined),
      transcriptSummary: r.nodesWalked
        ? `Workflow nodes: ${r.nodesWalked.map(n => n.nodeId || '?').join(' → ')}`
        : '',
    };
  });

  const metadata = {
    agentId: CONFIG.agentId,
    filter,
    totalAvailable,
    estimatedTokens,
    totalDurationMs,
    timestamp: new Date().toISOString(),
  };

  const reportPath = writeReport(reportResults, metadata, opts.output);
  console.log(`Report written: ${reportPath}`);
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
