#!/usr/bin/env node
/**
 * Technical feedback eval harness — offline batch runner.
 *
 * The n8n "Technical feedback" workflow (webhook -> Format prompt -> GPT-5.2 ->
 * Parse & wrap -> Respond) is stateless: it grades exactly what is POSTed to it.
 * So evaluation = POST fixture payloads, then run deterministic checks on the output.
 *
 * Tiers implemented here:
 *   1. Schema/structure checks   (lib/schema-checks.mjs)
 *   2. Faithfulness-to-facts     (lib/fact-checks.mjs)
 *   +  Cross-fixture ordering constraints (fixture.ordering)
 *   +  Stability across repeats  (--repeats N: per-dimension stddev + label flips)
 *
 * Usage:
 *   node runner.mjs --all                       # every fixture, 1 repeat each
 *   node runner.mjs --fixture solved-clean      # one fixture
 *   node runner.mjs --all --repeats 3           # stability run
 *   node runner.mjs --all --dry                 # validate fixtures + print plan, no network
 *
 * Env:
 *   TECHNICAL_FEEDBACK_WEBHOOK_URL (default http://localhost:5678/webhook/technical-feedback)
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSchemaChecks, labelForScore, CANONICAL_DIMENSIONS } from './lib/schema-checks.mjs';
import { runFactChecks } from './lib/fact-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const RUNS_DIR = path.join(__dirname, 'runs');

const DEFAULT_URL = process.env.TECHNICAL_FEEDBACK_WEBHOOK_URL || 'http://localhost:5678/webhook/technical-feedback';
const STABILITY_STDDEV_GATE = 1.0;

// ---------- CLI ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const runAll = flag('all');
const fixtureFilter = opt('fixture', null);
const repeats = Math.max(1, Number(opt('repeats', 1)) || 1);
const webhookUrl = opt('url', DEFAULT_URL);
const timeoutMs = Number(opt('timeout', 180_000)) || 180_000;
const dryRun = flag('dry');

if (!runAll && !fixtureFilter) {
  console.log('Usage: node runner.mjs (--all | --fixture <id>[,<id>...]) [--repeats N] [--url <webhook>] [--timeout ms] [--dry]');
  process.exit(2);
}

// ---------- helpers ----------
const nowStamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stddev = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

async function loadFixtures() {
  const files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith('.json')).sort();
  const fixtures = [];
  for (const f of files) {
    const raw = await readFile(path.join(FIXTURES_DIR, f), 'utf8');
    let fx;
    try {
      fx = JSON.parse(raw);
    } catch (e) {
      console.error(`✗ Fixture ${f} is not valid JSON: ${e.message}`);
      process.exit(2);
    }
    if (!fx.id || !fx.payload) {
      console.error(`✗ Fixture ${f} missing required "id" or "payload"`);
      process.exit(2);
    }
    fixtures.push(fx);
  }
  return fixtures;
}

async function callWebhook(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let body = null;
    try { body = JSON.parse(rawText); } catch { /* keep raw */ }
    return { ok: res.ok, status: res.status, body, rawText, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

const dimScores = (body) => {
  const out = {};
  for (const d of Array.isArray(body?.dimensions) ? body.dimensions : []) {
    const s = Number(d?.score);
    if (CANONICAL_DIMENSIONS.includes(d?.name) && Number.isFinite(s)) out[d.name] = s;
  }
  return out;
};

// ---------- main ----------
const allFixtures = await loadFixtures();
const wanted = fixtureFilter ? fixtureFilter.split(',').map((s) => s.trim()) : null;
const fixtures = wanted ? allFixtures.filter((f) => wanted.includes(f.id)) : allFixtures;

if (wanted) {
  const missing = wanted.filter((id) => !fixtures.some((f) => f.id === id));
  if (missing.length) {
    console.error(`✗ Unknown fixture id(s): ${missing.join(', ')}. Available: ${allFixtures.map((f) => f.id).join(', ')}`);
    process.exit(2);
  }
}

console.log(`Technical feedback eval — ${fixtures.length} fixture(s) × ${repeats} repeat(s)`);
console.log(`Webhook: ${webhookUrl}${dryRun ? '  [DRY RUN — no network]' : ''}\n`);

if (dryRun) {
  for (const fx of fixtures) {
    const s = fx.payload.execution_summary || {};
    console.log(`- ${fx.id}: ${s.questionTitle} | transcript turns: ${fx.payload.transcript?.length ?? 0} | hints: ${s.hintCount ?? 0} | ordering: ${(fx.ordering || []).length}`);
  }
  console.log('\nDry run OK — fixtures are valid.');
  process.exit(0);
}

const runDir = path.join(RUNS_DIR, nowStamp());
await mkdir(path.join(runDir, 'responses'), { recursive: true });

const results = []; // { fixtureId, repeat, checks, scores, latencyMs, httpStatus }

for (const fx of fixtures) {
  for (let r = 1; r <= repeats; r++) {
    process.stdout.write(`▶ ${fx.id} (run ${r}/${repeats}) ... `);
    let entry = { fixtureId: fx.id, repeat: r, checks: [], scores: {}, latencyMs: null, httpStatus: null };
    try {
      const { ok, status, body, rawText, latencyMs } = await callWebhook(fx.payload);
      entry.latencyMs = latencyMs;
      entry.httpStatus = status;
      await writeFile(path.join(runDir, 'responses', `${fx.id}-r${r}.json`),
        JSON.stringify(body ?? { rawText }, null, 2));

      if (!ok || body == null) {
        entry.checks.push({ id: 'http_ok', name: 'Webhook returned 2xx JSON', pass: false, detail: `status ${status}: ${String(rawText).slice(0, 200)}` });
      } else {
        entry.checks.push({ id: 'http_ok', name: 'Webhook returned 2xx JSON', pass: true, detail: `${latencyMs}ms` });
        entry.checks.push(...runSchemaChecks(body));
        entry.checks.push(...runFactChecks(body, fx.payload, fx.expectations || {}));
        entry.scores = dimScores(body);
      }
    } catch (e) {
      entry.checks.push({ id: 'http_ok', name: 'Webhook returned 2xx JSON', pass: false, detail: e.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : e.message });
    }
    const failed = entry.checks.filter((c) => !c.pass);
    console.log(failed.length === 0 ? `PASS (${entry.checks.length} checks)` : `FAIL (${failed.length}/${entry.checks.length} checks failed)`);
    for (const c of failed) console.log(`    ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    results.push(entry);
  }
}

// ---------- stability (repeats > 1) ----------
const stabilityChecks = [];
if (repeats > 1) {
  console.log('\n— Stability —');
  for (const fx of fixtures) {
    const runs = results.filter((x) => x.fixtureId === fx.id && Object.keys(x.scores).length);
    for (const dim of CANONICAL_DIMENSIONS) {
      const xs = runs.map((x) => x.scores[dim]).filter((v) => Number.isFinite(v));
      if (xs.length < 2) continue;
      const sd = stddev(xs);
      const m = mean(xs);
      const labels = new Set(xs.map(labelForScore));
      // Label flips are inevitable when the true score sits ON a band boundary
      // (5.5 / 8.0); only fail flips when the mean is clearly inside a band.
      const nearBoundary = Math.abs(m - 5.5) <= 0.5 || Math.abs(m - 8.0) <= 0.5;
      const labelsOk = labels.size === 1 || nearBoundary;
      // Degraded-mode probes (fixture.stabilityAdvisory) report but never gate:
      // e.g. no-transcript grading has inherently less evidence, and production
      // now always sends the transcript.
      const advisory = fx.stabilityAdvisory === true;
      const withinGate = sd <= STABILITY_STDDEV_GATE && labelsOk;
      const pass = withinGate || advisory;
      stabilityChecks.push({ fixtureId: fx.id, dimension: dim, mean: m, stddev: sd, labels: [...labels], nearBoundary, advisory, pass });
      const mark = pass ? '✓' : '✗';
      const note = !withinGate && advisory ? ' (advisory fixture — not gating)'
        : labels.size > 1 && nearBoundary ? ' (flip at band boundary — tolerated)' : '';
      console.log(`  ${mark} ${fx.id} / ${dim}: mean ${m.toFixed(1)}, σ ${sd.toFixed(2)}, labels [${[...labels].join(', ')}]${note}`);
    }
  }
}

// ---------- ordering constraints ----------
const orderingChecks = [];
const meanScore = (fixtureId, dim) => {
  const xs = results.filter((x) => x.fixtureId === fixtureId).map((x) => x.scores[dim]).filter((v) => Number.isFinite(v));
  return xs.length ? mean(xs) : null;
};
const ranIds = new Set(results.map((x) => x.fixtureId));
console.log('\n— Ordering constraints —');
let anyOrdering = false;
for (const fx of fixtures) {
  for (const o of fx.ordering || []) {
    if (!ranIds.has(o.mustBeat)) {
      console.log(`  – skipped: ${fx.id} > ${o.mustBeat} on "${o.dimension}" (fixture not in this run)`);
      continue;
    }
    anyOrdering = true;
    const a = meanScore(fx.id, o.dimension);
    const b = meanScore(o.mustBeat, o.dimension);
    const pass = a != null && b != null && a > b;
    orderingChecks.push({ winner: fx.id, loser: o.mustBeat, dimension: o.dimension, winnerScore: a, loserScore: b, pass });
    console.log(`  ${pass ? '✓' : '✗'} ${o.dimension}: ${fx.id} (${a?.toFixed(1) ?? '?'}) > ${o.mustBeat} (${b?.toFixed(1) ?? '?'})`);
  }
}
if (!anyOrdering) console.log('  (none applicable)');

// ---------- summary + persist ----------
const perRunFailures = results.reduce((n, x) => n + x.checks.filter((c) => !c.pass).length, 0);
const stabilityFailures = stabilityChecks.filter((c) => !c.pass).length;
const orderingFailures = orderingChecks.filter((c) => !c.pass).length;
const totalFailures = perRunFailures + stabilityFailures + orderingFailures;

const summary = {
  ranAt: new Date().toISOString(),
  webhookUrl,
  repeats,
  fixtures: fixtures.map((f) => f.id),
  perRunFailures,
  stabilityFailures,
  orderingFailures,
  verdict: totalFailures === 0 ? 'PASS' : 'FAIL',
  results,
  stabilityChecks,
  orderingChecks,
};
await writeFile(path.join(runDir, 'results.json'), JSON.stringify(summary, null, 2));

console.log('\n— Summary —');
console.log(`  Per-run check failures: ${perRunFailures}`);
if (repeats > 1) console.log(`  Stability failures:     ${stabilityFailures}`);
console.log(`  Ordering failures:      ${orderingFailures}`);
console.log(`  Verdict:                ${summary.verdict}`);
console.log(`  Results saved:          ${path.relative(process.cwd(), path.join(runDir, 'results.json'))}`);

process.exit(totalFailures === 0 ? 0 : 1);
