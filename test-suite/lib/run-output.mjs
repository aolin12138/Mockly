/**
 * Run output: one folder per eval run with manifest, per-scenario JSON,
 * agent config snapshot, HTML report, and human-readable summary.
 *
 * Layout (per EVAL-PLAN.md §D):
 *   test-suite/runs/<run-id>/
 *     manifest.json         — run id, timestamp, agent ids, gate verdict
 *     agent-config.json     — full agent config at run start (revert source)
 *     scenarios/
 *       <scenario-id>.json  — transcript + per-criterion judge results
 *     report.html           — same HTML as before (writeReport output)
 *     summary.md            — pass/fail grid + regression delta vs last run
 *
 * Plus runs/INDEX.md — one line per run for trend.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAgentConfig } from './checkpoint.mjs';
import { writeReport } from './report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, '..', 'runs');

function runIdFromTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Begin a run. Creates the run folder, captures agent config snapshot,
 * returns the run handle used by the rest of the run.
 */
export async function startRun({ filter = 'unknown' } = {}) {
  const runId = runIdFromTimestamp();
  const runDir = resolve(RUNS_DIR, runId);
  mkdirSync(resolve(runDir, 'scenarios'), { recursive: true });

  let agentConfig = null;
  try {
    agentConfig = await fetchAgentConfig();
    writeFileSync(
      resolve(runDir, 'agent-config.json'),
      JSON.stringify(agentConfig, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.warn(`  Warning: Could not capture agent config snapshot: ${e.message}`);
  }

  return {
    runId,
    runDir,
    filter,
    startedAt: new Date().toISOString(),
    agentConfig, // { _summary, full_config }
  };
}

/**
 * Persist one scenario's per-scenario JSON.
 */
export function writeScenarioResult(run, result) {
  const slim = {
    scenarioId: result.scenarioId,
    description: result.description,
    targetPhase: result.targetPhase,
    targetPhaseLabel: result.targetPhaseLabel,
    result: result.result,
    criteria: result.criteria,
    transcript: result.transcript,
    nodesWalked: result.nodesWalked,
    turnsUsed: result.turnsUsed,
    turnLimit: result.turnLimit,
    durationMs: result.durationMs,
    tokens: result.tokens,
    error: result.error,
    message: result.message,
    conversationId: result.conversationId,
    rawEvents: (result.rawEvents || []).slice(-30), // last 30 raw events for debugging
  };
  writeFileSync(
    resolve(run.runDir, 'scenarios', `${result.scenarioId}.json`),
    JSON.stringify(slim, null, 2),
    'utf-8'
  );
}

// ─── Gates ────────────────────────────────────────────────────

/**
 * Compute the gate verdict per EVAL-PLAN.md §F.
 *
 * Inputs:
 *   results       — array of per-scenario results
 *   prevResults   — map of scenarioId → previous result string (from last run's manifest)
 *
 * Returns:
 *   { exitCode, verdict, reasons[], regressions[], leaks[], errors[], passCount, failCount }
 */
export function computeGate(results, prevResults = {}) {
  const reasons = [];
  const errors = results.filter(r => r.result === 'error').map(r => r.scenarioId);
  const failed = results.filter(r => r.result === 'fail');
  const passed = results.filter(r => r.result === 'pass');

  // Leak detection: any scenario that failed the universal 'no_leak' criterion.
  const leaks = [];
  for (const r of results) {
    const leakCrit = (r.criteria || []).find(c => c.id === 'no_leak' && c.result === 'failure');
    if (leakCrit) leaks.push(r.scenarioId);
  }

  // Regression detection: any prev-pass that now fails/errors.
  const regressions = [];
  for (const r of results) {
    const prev = prevResults[r.scenarioId];
    if (prev === 'pass' && (r.result === 'fail' || r.result === 'error')) {
      regressions.push(r.scenarioId);
    }
  }

  // Exit code precedence: leak > regression > behaviour fail > harness error > pass
  // (Leak is loudest — see EVAL-PLAN.md §F)
  let exitCode = 0;
  let verdict = 'promotable';
  if (leaks.length) {
    exitCode = 3;
    verdict = 'leak-detected';
    reasons.push(`Leak in ${leaks.length} scenario(s): ${leaks.join(', ')}`);
  } else if (regressions.length) {
    exitCode = 1;
    verdict = 'regression';
    reasons.push(`${regressions.length} prev-pass scenario(s) now failing: ${regressions.join(', ')}`);
  } else if (failed.length) {
    exitCode = 1;
    verdict = 'behaviour-fail';
    reasons.push(`${failed.length} scenario(s) failed (no regression vs last run, but not promotable)`);
  } else if (errors.length === results.length && results.length > 0) {
    exitCode = 2;
    verdict = 'harness-error';
    reasons.push(`All ${errors.length} scenario(s) errored — likely harness/API failure`);
  } else if (errors.length) {
    // Partial errors: not promotable but not a regression either
    exitCode = 1;
    verdict = 'partial-error';
    reasons.push(`${errors.length} scenario(s) errored: ${errors.join(', ')}`);
  }

  return {
    exitCode,
    verdict,
    reasons,
    regressions,
    leaks,
    errors,
    passCount: passed.length,
    failCount: failed.length,
  };
}

// ─── Trend / INDEX ────────────────────────────────────────────

function readPrevRunResults() {
  const indexPath = resolve(RUNS_DIR, 'INDEX.md');
  if (!existsSync(indexPath)) return {};
  const lines = readFileSync(indexPath, 'utf-8').split('\n').filter(l => l.startsWith('|') && !l.startsWith('| ---'));
  // Find the most recent data row (skip header)
  const dataRows = lines.filter(l => /^\|\s*20\d\d-\d\d-\d\dT/.test(l));
  if (dataRows.length === 0) return {};
  const lastRow = dataRows[dataRows.length - 1];
  // Format: | <runId> | <verdict> | <pass>/<fail>/<err>/<total> | <link> |
  const m = lastRow.match(/^\|\s*([^\s|]+)\s*\|/);
  if (!m) return {};
  const prevId = m[1];
  const prevManifest = resolve(RUNS_DIR, prevId, 'manifest.json');
  if (!existsSync(prevManifest)) return {};
  try {
    const mf = JSON.parse(readFileSync(prevManifest, 'utf-8'));
    return Object.fromEntries((mf.scenarios || []).map(s => [s.id, s.result]));
  } catch {
    return {};
  }
}

function appendIndex(run, gate, results) {
  const indexPath = resolve(RUNS_DIR, 'INDEX.md');
  let existed = existsSync(indexPath);
  if (!existed) {
    writeFileSync(indexPath,
      '# Eval run index\n\n' +
      'One row per completed run. Newest at the bottom.\n\n' +
      '| Run ID | Verdict | Pass/Fail/Err/Total | Report |\n' +
      '| --- | --- | --- | --- |\n',
      'utf-8'
    );
  }
  const errCount = results.filter(r => r.result === 'error').length;
  const row = `| ${run.runId} | ${gate.verdict} | ${gate.passCount}/${gate.failCount}/${errCount}/${results.length} | [report](${run.runId}/report.html) |\n`;
  appendFileSync(indexPath, row, 'utf-8');
}

// ─── Summary.md ───────────────────────────────────────────────

function summaryMd(run, gate, results, prevResults) {
  const lines = [];
  lines.push(`# Run ${run.runId}`);
  lines.push('');
  lines.push(`- Started: ${run.startedAt}`);
  lines.push(`- Filter: ${run.filter}`);
  lines.push(`- Agent: ${run.agentConfig?._summary?.agent_id || '(unknown)'}`);
  lines.push(`- Version: ${run.agentConfig?._summary?.version_id || '(unknown)'}`);
  lines.push(`- Verdict: **${gate.verdict}** (exit ${gate.exitCode})`);
  if (gate.reasons.length) {
    lines.push('');
    lines.push('## Gate reasons');
    for (const r of gate.reasons) lines.push(`- ${r}`);
  }
  lines.push('');
  lines.push('## Per-scenario results');
  lines.push('');
  lines.push('| Scenario | Result | Δ vs prev |');
  lines.push('| --- | --- | --- |');
  for (const r of results) {
    const prev = prevResults[r.scenarioId];
    const delta = !prev ? '(new)' : prev === r.result ? '' : `${prev} → **${r.result}**`;
    lines.push(`| ${r.scenarioId} | ${r.result} | ${delta} |`);
  }
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  return lines.join('\n');
}

// ─── Manifest ─────────────────────────────────────────────────

function manifestJson(run, gate, results) {
  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: new Date().toISOString(),
    filter: run.filter,
    agent: {
      agent_id: run.agentConfig?._summary?.agent_id || null,
      branch_id: run.agentConfig?._summary?.branch_id || null,
      version_id: run.agentConfig?._summary?.version_id || null,
    },
    gate: {
      verdict: gate.verdict,
      exitCode: gate.exitCode,
      reasons: gate.reasons,
      regressions: gate.regressions,
      leaks: gate.leaks,
      errors: gate.errors,
    },
    counts: {
      total: results.length,
      pass: results.filter(r => r.result === 'pass').length,
      fail: results.filter(r => r.result === 'fail').length,
      error: results.filter(r => r.result === 'error').length,
      skip: results.filter(r => r.result === 'skip').length,
    },
    scenarios: results.map(r => ({
      id: r.scenarioId,
      result: r.result,
      criteria_pass: (r.criteria || []).filter(c => c.result === 'success').length,
      criteria_fail: (r.criteria || []).filter(c => c.result === 'failure').length,
      criteria_total: (r.criteria || []).length,
      duration_ms: r.durationMs,
      turns_used: r.turnsUsed,
    })),
  };
}

// ─── Finalize ─────────────────────────────────────────────────

/**
 * Finalize the run: write manifest, summary, report.html, update INDEX.
 * Returns { exitCode, runDir, paths } for the caller to print.
 */
export function finalizeRun(run, { results, reportResults, reportMetadata }) {
  const prevResults = readPrevRunResults();
  const gate = computeGate(results, prevResults);

  // Manifest
  const manifestPath = resolve(run.runDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifestJson(run, gate, results), null, 2), 'utf-8');

  // Summary
  const summaryPath = resolve(run.runDir, 'summary.md');
  writeFileSync(summaryPath, summaryMd(run, gate, results, prevResults), 'utf-8');

  // HTML report
  const reportPath = resolve(run.runDir, 'report.html');
  writeReport(reportResults, reportMetadata, reportPath);

  // Trend INDEX
  appendIndex(run, gate, results);

  return {
    exitCode: gate.exitCode,
    verdict: gate.verdict,
    reasons: gate.reasons,
    runDir: run.runDir,
    paths: { manifestPath, summaryPath, reportPath },
  };
}
