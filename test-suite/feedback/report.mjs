#!/usr/bin/env node
/**
 * Feedback eval report generator.
 *
 * Produces:
 *   1. runs/<ts>/pages/<fixture>-r<N>.html — a faithful static replica of the REAL
 *      ResultsTechnicalPage (apps/frontend/.../ResultsTechnicalPage.jsx) rendered from
 *      the feedback the generator produced for that fixture, so you can see exactly
 *      what the user would see. Same transform (transformFeedbackData port) and same
 *      backend scoring (computeOverallScore port with DIMENSION_WEIGHTS).
 *   2. feedback-report.html — harness-style dark report (like ../live-report.html):
 *      per-fixture check results, scores, ordering/stability gates, and an embedded
 *      preview of each rendered feedback page.
 *
 * Usage:
 *   node report.mjs             # latest run in runs/
 *   node report.mjs --run 2026-07-06T01-21-33
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelForScore } from './lib/schema-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(__dirname, 'runs');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT = path.join(__dirname, 'feedback-report.html');

// ── Backend scoring port (interviewRoutes.js computeOverallScore) ────────────
const DIMENSION_WEIGHTS = {
  'Correctness & Completeness': 0.25,
  'Problem-Solving & Thinking': 0.20,
  'Technical Communication': 0.15,
  'Complexity & Optimization': 0.15,
  'Code Quality': 0.15,
  'Independence': 0.10,
};
function computeOverallScore(feedback) {
  const dimensions = feedback?.dimensions || [];
  if (!dimensions.length) return null;
  let weightedSum = 0, totalWeight = 0;
  for (const dim of dimensions) {
    const score = Number(dim?.score);
    const weight = DIMENSION_WEIGHTS[dim.name] || 0;
    if (!Number.isFinite(score)) continue;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// ── Frontend transform port (ResultsTechnicalPage.jsx transformFeedbackData) ─
function transformFeedbackData(data) {
  if (!data || typeof data !== 'object') return null;
  const feedback = data.feedback || data;
  return {
    summary: feedback.summary ?? null,
    outcome: feedback.outcome || null,
    completed: feedback.completed ?? true,
    reachedPhase: feedback.reached_phase ?? feedback.reachedPhase ?? null,
    testResults: feedback.test_results ?? feedback.testResults ?? null,
    time: feedback.time ?? null,
    dimensions: Array.isArray(feedback.dimensions) ? feedback.dimensions : [],
    thinkingAndLogic: feedback.thinking_and_logic ?? feedback.thinkingAndLogic ?? null,
    codeAssessment: feedback.code_assessment ?? feedback.codeAssessment ?? null,
    nextSteps: Array.isArray(feedback.next_steps ?? feedback.nextSteps) ? (feedback.next_steps ?? feedback.nextSteps) : [],
    patternsToStudy: Array.isArray(feedback.patterns_to_study ?? feedback.patternsToStudy) ? (feedback.patterns_to_study ?? feedback.patternsToStudy) : [],
    encouragement: feedback.encouragement ?? null,
    transcript: Array.isArray(data.transcript) ? data.transcript : null,
  };
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
const esc = (s) => s == null ? '' : String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// getScoreColor port — same thresholds as the page
function scoreColors(score) {
  if (score >= 8) return { text: 'text-emerald-400', gradient: 'from-emerald-500 to-cyan-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (score >= 5.5) return { text: 'text-amber-400', gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
  return { text: 'text-red-400', gradient: 'from-red-500 to-rose-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
}

const OUTCOME_CHIP = {
  solved: { cls: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', label: 'Solved', icon: '✓' },
  partially_solved: { cls: 'bg-amber-500/20 border-amber-500/40 text-amber-400', label: 'Partially Solved', icon: '⚠' },
  not_solved: { cls: 'bg-red-500/20 border-red-500/40 text-red-400', label: 'Not Solved', icon: '✕' },
};

function scoreCircleHtml(score100) {
  const outOfTen = score100 != null ? (score100 / 10).toFixed(1) : '—';
  const label = score100 != null ? labelForScore(score100 / 10) : '—';
  const colors = scoreColors(score100 != null ? score100 / 10 : 0);
  const dash = score100 != null ? (score100 / 100) * 264 : 0;
  return `
  <div class="flex flex-col items-center gap-1">
    <div class="relative w-28 h-28 text-3xl flex items-center justify-center">
      <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGrad)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${dash} 264"/>
        <defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient></defs>
      </svg>
      <span class="relative font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">${outOfTen}</span>
    </div>
    <span class="text-xs font-medium ${colors.text}">${esc(label)}</span>
  </div>`;
}

const quickFact = (label, value) => value == null ? '' : `
  <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-white/5">
    <span class="text-xs text-slate-400">${esc(label)}:</span>
    <span class="text-xs font-semibold text-white">${esc(value)}</span>
  </div>`;

const sectionCard = (title, inner) => !inner ? '' : `
  <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
    <h2 class="text-lg font-semibold text-white mb-4">${esc(title)}</h2>
    ${inner}
  </div>`;

function dimensionCardHtml(dim, idx) {
  const score = Number(dim?.score) || 0;
  const colors = scoreColors(score);
  const label = dim?.label || labelForScore(score);
  const hints = dim?.hints_used ?? dim?.hintsUsed ?? null;
  return `
  <div class="${colors.bg} border ${colors.border} rounded-2xl p-4">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-semibold text-white">${esc(dim?.name || 'Unknown Dimension')}</span>
      <div class="flex items-center gap-2">
        ${hints != null ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300 border border-white/10">${esc(hints)} hint${hints !== 1 ? 's' : ''}</span>` : ''}
        <span class="text-xs font-bold ${colors.text}">${score.toFixed(1)}/10</span>
      </div>
    </div>
    <div class="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden mb-2">
      <div class="h-full bg-gradient-to-r ${colors.gradient} shadow-lg" style="width:${(score / 10) * 100}%"></div>
    </div>
    <div class="mb-3"><span class="text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}">${esc(label)}</span></div>
    ${dim?.what_went_well ? `<div class="mb-2"><p class="text-xs text-emerald-400 font-medium mb-1">What went well</p><p class="text-xs text-slate-300 leading-relaxed">${esc(dim.what_went_well)}</p></div>` : ''}
    ${dim?.what_to_improve ? `<div><p class="text-xs text-amber-400 font-medium mb-1">What to improve</p><p class="text-xs text-slate-300 leading-relaxed">${esc(dim.what_to_improve)}</p></div>` : ''}
  </div>`;
}

function testResultsPanelHtml(tr) {
  if (!tr) return '';
  const passed = tr.passed ?? 0, total = tr.total ?? 0;
  const pct = total > 0 ? (passed / total) * 100 : 0;
  const barGrad = passed === total ? 'from-emerald-500 to-cyan-500' : passed >= total / 2 ? 'from-amber-500 to-orange-500' : 'from-red-500 to-rose-500';
  const byCat = tr.by_category ?? tr.byCategory ?? {};
  const cats = Object.entries(byCat).map(([cat, result]) => {
    const isPass = result === 'pass' || result === true;
    const isFail = result === 'fail' || result === false || (typeof result === 'string' && result.toLowerCase().includes('fail'));
    const cls = isPass ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : isFail ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300';
    return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${cls}"><span>${isPass ? '✓' : isFail ? '✕' : '⚠'}</span><span class="capitalize">${esc(cat)}</span><span class="ml-auto font-medium">${esc(typeof result === 'string' ? result : (isPass ? 'pass' : 'fail'))}</span></div>`;
  }).join('');
  return `
  <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
    <div class="flex items-center justify-between">
      <span class="text-sm text-slate-300">🧪 Test Results</span>
      <div class="flex items-center gap-2"><span class="text-lg font-bold text-white">${passed}</span><span class="text-sm text-slate-400">/</span><span class="text-lg font-bold text-white">${total}</span><span class="text-xs text-slate-400">passed</span></div>
    </div>
    <div class="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r ${barGrad}" style="width:${pct}%"></div></div>
    ${cats ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${cats}</div>` : ''}
    ${tr.summary_note ? `<p class="text-xs text-slate-400 italic">${esc(tr.summary_note)}</p>` : ''}
  </div>`;
}

function nextStepCardHtml(step, idx) {
  const action = step?.action || '', why = step?.why || '', how = step?.how || '';
  const body = (action || why || how)
    ? `${action ? `<p class="text-sm font-semibold text-white">${esc(action)}</p>` : ''}
       ${why ? `<div><p class="text-xs text-slate-400 font-medium">Why</p><p class="text-xs text-slate-300">${esc(why)}</p></div>` : ''}
       ${how ? `<div><p class="text-xs text-slate-400 font-medium">How</p><p class="text-xs text-slate-300">${esc(how)}</p></div>` : ''}`
    : `<p class="text-sm text-slate-300">${esc(typeof step === 'string' ? step : '')}</p>`;
  return `
  <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><span class="text-xs font-bold text-emerald-400">${idx + 1}</span></div>
      <div class="flex-1 space-y-2">${body}</div>
    </div>
  </div>`;
}

/** Full-page replica of ResultsTechnicalPage for one feedback response. */
function renderFeedbackPage({ fixture, response, repeat }) {
  const t = transformFeedbackData(response);
  const parseFailed = !t || (response?.error && response?.raw) || !t.dimensions.length;
  const s = fixture.payload.execution_summary || {};
  const overall = parseFailed ? null : computeOverallScore(t);
  const score100 = overall != null ? Math.round(overall * 10) : null;
  const outcomeChip = t?.outcome && OUTCOME_CHIP[t.outcome]
    ? `<div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border ${OUTCOME_CHIP[t.outcome].cls}"><span>${OUTCOME_CHIP[t.outcome].icon}</span><span class="text-sm font-semibold">${OUTCOME_CHIP[t.outcome].label}</span></div>`
    : '';
  const hintsTotal = (t?.dimensions || []).filter(d => d?.hints_used != null).reduce((n, d) => n + (Number(d.hints_used) || 0), 0);

  const transcriptHtml = (t?.transcript || []).slice(0, 200).map((turn) => `
    <div class="text-xs ${turn.role === 'agent' ? 'text-cyan-300' : 'text-slate-300'}"><span class="font-semibold">${esc(turn.role)}:</span> ${esc(turn.text || turn.message || '')}</div>`).join('');

  const body = parseFailed ? `
    <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
      <h2 class="text-lg font-semibold text-red-300 mb-2">Feedback failed to render</h2>
      <p class="text-sm text-slate-300">This is what the user would hit: the workflow returned an unparseable/invalid feedback object.</p>
      <pre class="mt-3 text-xs text-slate-400 whitespace-pre-wrap">${esc(JSON.stringify(response, null, 2).slice(0, 3000))}</pre>
    </div>` : `
    <!-- 1. HEADER BAND -->
    <div class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Technical Interview Results</h1>
          <p class="mt-2 text-sm text-slate-400">Comprehensive analysis of your coding interview performance</p>
          <div class="mt-2 flex items-center gap-2"><span class="text-xs text-slate-400">⌨ ${esc(s.language || 'javascript')}</span></div>
        </div>
        <div class="flex items-center gap-6">${scoreCircleHtml(score100)}${outcomeChip}</div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        ${quickFact('Tests', t.testResults ? `${t.testResults.passed ?? 0}/${t.testResults.total ?? 0}` : null)}
        ${quickFact('Time', t.time ? `${t.time.taken_minutes ?? '?'} / ${t.time.budget_minutes ?? '?'} min` : null)}
        ${hintsTotal > 0 ? quickFact('Hints', `${hintsTotal} used`) : ''}
        ${quickFact('Phase', t.reachedPhase)}
        ${quickFact('Completed', t.completed != null ? (t.completed ? 'Yes' : 'No') : null)}
      </div>
      ${t.summary ? `<p class="text-sm text-slate-300 leading-relaxed">${esc(t.summary)}</p>` : ''}
    </div>

    <!-- 2. CODE (static stand-in for the interactive sandbox) -->
    ${s.code ? sectionCard('Code Review Sandbox', `
      <p class="text-xs text-slate-500 mb-2">Interactive in the app (edit + run tests). Submitted code shown below.</p>
      <pre class="text-xs bg-slate-950/70 border border-white/10 rounded-xl p-4 overflow-x-auto text-slate-200">${esc(s.code)}</pre>`) : ''}

    <!-- 3. TEST RESULTS -->
    ${testResultsPanelHtml(t.testResults)}

    <!-- 4. SKILL BREAKDOWN -->
    ${sectionCard('Skill Breakdown', `<div class="grid gap-4 md:grid-cols-2">${t.dimensions.map(dimensionCardHtml).join('')}</div>`)}

    <!-- 5-6. NARRATIVES -->
    ${sectionCard('Thinking & Logic', t.thinkingAndLogic ? `<p class="text-sm text-slate-300 leading-relaxed">${esc(t.thinkingAndLogic)}</p>` : '')}
    ${sectionCard('Code Assessment', t.codeAssessment ? `<p class="text-sm text-slate-300 leading-relaxed">${esc(t.codeAssessment)}</p>` : '')}

    <!-- 7. NEXT STEPS -->
    ${t.nextSteps.length ? sectionCard('Next Steps', `
      <div class="space-y-3">${t.nextSteps.map(nextStepCardHtml).join('')}</div>
      ${t.patternsToStudy.length ? `<div class="mt-4 pt-4 border-t border-white/10"><p class="text-xs text-slate-400 font-medium mb-2">Patterns to Study</p><div class="flex flex-wrap gap-2">${t.patternsToStudy.map((p) => `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 font-medium"># ${esc(p)}</span>`).join('')}</div></div>` : ''}`) : ''}

    <!-- 8. ENCOURAGEMENT -->
    ${t.encouragement ? `
    <div class="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">🏆</div>
        <div class="flex-1"><h3 class="text-sm font-semibold text-white mb-1">Final Words</h3><p class="text-sm text-slate-300 leading-relaxed italic">${esc(t.encouragement)}</p></div>
      </div>
    </div>` : ''}

    <!-- 9. TRANSCRIPT -->
    ${transcriptHtml ? sectionCard('Transcript', `<div class="space-y-2 max-h-80 overflow-y-auto">${transcriptHtml}</div>`) : ''}`;

  return `<!DOCTYPE html>
<html lang="en" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Feedback page — ${esc(fixture.id)} (run ${repeat})</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class'}</script>
<style>body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}</style>
</head>
<body class="bg-slate-950 text-slate-100">
  <div class="fixed top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
    <div class="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-cyan-500/10 rounded-full blur-[100px]"></div>
    <div class="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] bg-purple-500/10 rounded-full blur-[120px]"></div>
  </div>
  <div class="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-6xl space-y-6">
      <div class="text-[11px] uppercase tracking-widest text-slate-500">Eval preview — fixture <span class="text-emerald-400">${esc(fixture.id)}</span>, run ${repeat} — ${esc(fixture.description || '')}</div>
      ${body}
    </div>
  </div>
</body></html>`;
}

// ── Harness report shell (dark style, like live-report) ─────────────────────
function renderReport({ runId, summary, fixturesById, pagesRel }) {
  const fixtureBlocks = summary.fixtures.map((fid) => {
    const fx = fixturesById[fid];
    const runs = summary.results.filter((r) => r.fixtureId === fid);
    const allChecks = runs.flatMap((r) => r.checks.map((c) => ({ ...c, repeat: r.repeat })));
    const failed = allChecks.filter((c) => !c.pass);
    const verdict = failed.length === 0 ? 'PASS' : 'FAIL';
    const scores = runs[0]?.scores || {};

    const checksRows = allChecks.map((c) => `
      <tr class="${c.pass ? '' : 'fail-row'}">
        <td>${c.pass ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td>
        <td>${esc(c.name)}</td>
        <td class="detail">${esc(c.detail || '')}</td>
      </tr>`).join('');

    const scoreChips = Object.entries(scores).map(([k, v]) =>
      `<span class="chip ${v >= 8 ? 'chip-green' : v >= 5.5 ? 'chip-amber' : 'chip-red'}">${esc(k.replace(' & ', ' / '))}: <b>${v}</b></span>`).join(' ');

    const previews = runs.map((r) => {
      const rel = pagesRel[`${fid}-r${r.repeat}`];
      if (!rel) return '';
      return `
      <div class="preview-wrap">
        <div class="preview-head">
          <span>Rendered feedback page — run ${r.repeat} (exactly what the user sees)</span>
          <a href="${rel}" target="_blank">open full page ↗</a>
        </div>
        <iframe src="${rel}" loading="lazy"></iframe>
      </div>`;
    }).join('');

    return `
    <details class="scenario ${verdict === 'PASS' ? 's-pass' : 's-fail'}" ${verdict === 'FAIL' ? 'open' : ''}>
      <summary>
        <span class="badge ${verdict === 'PASS' ? 'b-pass' : 'b-fail'}">${verdict}</span>
        <span class="sid">${esc(fid)}</span>
        <span class="sdesc">${esc(fx?.description || '')}</span>
        <span class="scount">${allChecks.length - failed.length}/${allChecks.length} checks</span>
      </summary>
      <div class="body">
        <div class="scores">${scoreChips}</div>
        <table class="checks"><thead><tr><th></th><th>Check</th><th>Detail</th></tr></thead><tbody>${checksRows}</tbody></table>
        ${previews}
      </div>
    </details>`;
  }).join('');

  const orderingRows = (summary.orderingChecks || []).map((o) => `
    <tr class="${o.pass ? '' : 'fail-row'}">
      <td>${o.pass ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td>
      <td>${esc(o.dimension)}</td>
      <td>${esc(o.winner)} (${o.winnerScore?.toFixed(1) ?? '?'}) &gt; ${esc(o.loser)} (${o.loserScore?.toFixed(1) ?? '?'})</td>
    </tr>`).join('');

  const stabilityRows = (summary.stabilityChecks || []).map((s) => `
    <tr class="${s.pass ? '' : 'fail-row'}">
      <td>${s.pass ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}</td>
      <td>${esc(s.fixtureId)}</td><td>${esc(s.dimension)}</td>
      <td>mean ${s.mean.toFixed(1)}, σ ${s.stddev.toFixed(2)}, labels [${s.labels.join(', ')}]</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Technical Feedback Eval — ${esc(runId)}</title>
<style>
  :root{color-scheme:dark}
  body{background:#0b1120;color:#cbd5e1;font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;margin:0;padding:32px;line-height:1.5}
  h1{color:#f8fafc;font-size:22px;margin:0 0 4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:24px}
  .kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px}
  .kpi{background:#111a2e;border:1px solid #1e293b;border-radius:12px;padding:12px 18px;min-width:120px}
  .kpi .v{font-size:22px;font-weight:700;color:#f8fafc}
  .kpi .l{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em}
  .kpi.pass .v{color:#34d399}.kpi.fail .v{color:#f87171}
  h2{color:#e2e8f0;font-size:15px;margin:28px 0 10px;text-transform:uppercase;letter-spacing:.06em}
  .scenario{background:#0f172a;border:1px solid #1e293b;border-radius:14px;margin-bottom:14px;overflow:hidden}
  .scenario.s-fail{border-color:#7f1d1d}
  summary{cursor:pointer;padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;list-style:none}
  summary::-webkit-details-marker{display:none}
  .badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px}
  .b-pass{background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.4)}
  .b-fail{background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.4)}
  .sid{font-weight:700;color:#f8fafc;font-family:ui-monospace,monospace}
  .sdesc{color:#64748b;font-size:12px;flex:1;min-width:200px}
  .scount{color:#94a3b8;font-size:12px}
  .body{padding:0 18px 18px}
  .scores{margin:6px 0 12px;display:flex;gap:8px;flex-wrap:wrap}
  .chip{font-size:11px;padding:3px 10px;border-radius:999px;border:1px solid #334155;background:#111a2e}
  .chip-green{border-color:rgba(16,185,129,.4);color:#34d399}
  .chip-amber{border-color:rgba(245,158,11,.4);color:#fbbf24}
  .chip-red{border-color:rgba(239,68,68,.4);color:#f87171}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px}
  th{color:#64748b;text-align:left;font-weight:600;padding:6px 8px;border-bottom:1px solid #1e293b}
  td{padding:5px 8px;border-bottom:1px solid #16213a;vertical-align:top}
  td.detail{color:#64748b}
  .ok{color:#34d399}.bad{color:#f87171;font-weight:700}
  .fail-row{background:rgba(239,68,68,.06)}
  .preview-wrap{border:1px solid #1e293b;border-radius:12px;overflow:hidden;margin-top:10px}
  .preview-head{display:flex;justify-content:space-between;align-items:center;background:#111a2e;padding:8px 14px;font-size:12px;color:#94a3b8}
  .preview-head a{color:#22d3ee;text-decoration:none}
  iframe{width:100%;height:720px;border:0;background:#020617}
</style></head>
<body>
  <h1>Technical Feedback Eval Harness — Report</h1>
  <div class="sub">Run <b>${esc(runId)}</b> · webhook ${esc(summary.webhookUrl)} · ${esc(summary.ranAt)} · repeats ${summary.repeats}</div>
  <div class="kpis">
    <div class="kpi ${summary.verdict === 'PASS' ? 'pass' : 'fail'}"><div class="v">${esc(summary.verdict)}</div><div class="l">Verdict</div></div>
    <div class="kpi"><div class="v">${summary.fixtures.length}</div><div class="l">Fixtures</div></div>
    <div class="kpi ${summary.perRunFailures ? 'fail' : 'pass'}"><div class="v">${summary.perRunFailures}</div><div class="l">Check failures</div></div>
    <div class="kpi ${summary.orderingFailures ? 'fail' : 'pass'}"><div class="v">${(summary.orderingChecks || []).filter(o => o.pass).length}/${(summary.orderingChecks || []).length}</div><div class="l">Ordering ok</div></div>
    ${summary.repeats > 1 ? `<div class="kpi ${summary.stabilityFailures ? 'fail' : 'pass'}"><div class="v">${summary.stabilityFailures}</div><div class="l">Stability failures</div></div>` : ''}
  </div>

  <h2>Fixtures</h2>
  ${fixtureBlocks}

  ${orderingRows ? `<h2>Ordering constraints</h2><table><thead><tr><th></th><th>Dimension</th><th>Constraint</th></tr></thead><tbody>${orderingRows}</tbody></table>` : ''}
  ${stabilityRows ? `<h2>Stability (repeats)</h2><table><thead><tr><th></th><th>Fixture</th><th>Dimension</th><th>Result</th></tr></thead><tbody>${stabilityRows}</tbody></table>` : ''}
</body></html>`;
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const runArgIdx = args.indexOf('--run');
let runId = runArgIdx >= 0 ? args[runArgIdx + 1] : null;

if (!runId) {
  const dirs = (await readdir(RUNS_DIR)).filter((d) => existsSync(path.join(RUNS_DIR, d, 'results.json'))).sort();
  runId = dirs[dirs.length - 1];
}
if (!runId) {
  console.error('No runs with results.json found. Run runner.mjs first.');
  process.exit(2);
}

const runDir = path.join(RUNS_DIR, runId);
const summary = JSON.parse(await readFile(path.join(runDir, 'results.json'), 'utf8'));

const fixturesById = {};
for (const f of (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith('.json'))) {
  const fx = JSON.parse(await readFile(path.join(FIXTURES_DIR, f), 'utf8'));
  fixturesById[fx.id] = fx;
}

// Render one feedback page per response
const pagesDir = path.join(runDir, 'pages');
await mkdir(pagesDir, { recursive: true });
const pagesRel = {};
for (const r of summary.results) {
  const respPath = path.join(runDir, 'responses', `${r.fixtureId}-r${r.repeat}.json`);
  if (!existsSync(respPath)) continue;
  const response = JSON.parse(await readFile(respPath, 'utf8'));
  const fx = fixturesById[r.fixtureId];
  if (!fx) continue;
  const html = renderFeedbackPage({ fixture: fx, response, repeat: r.repeat });
  const fileName = `${r.fixtureId}-r${r.repeat}.html`;
  await writeFile(path.join(pagesDir, fileName), html);
  pagesRel[`${r.fixtureId}-r${r.repeat}`] = path.posix.join('runs', runId, 'pages', fileName);
}

await writeFile(OUTPUT, renderReport({ runId, summary, fixturesById, pagesRel }));
console.log(`Report:  ${path.relative(process.cwd(), OUTPUT)}`);
console.log(`Pages:   ${Object.keys(pagesRel).length} rendered under ${path.relative(process.cwd(), pagesDir)}`);
