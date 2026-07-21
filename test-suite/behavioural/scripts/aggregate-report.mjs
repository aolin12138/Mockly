#!/usr/bin/env node
/** Aggregate report builder — scans all runs, builds clean report with feedback links */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, '..', 'runs');

const allResults = [];
const seen = new Set();

const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
  .filter(x => x.isDirectory())
  .sort()
  .reverse();

for (const d of dirs) {
  for (const f of readdirSync(join(RUNS_DIR, d.name)).filter(x => x.endsWith('.json') && !x.startsWith('_'))) {
    const data = JSON.parse(readFileSync(join(RUNS_DIR, d.name, f), 'utf8'));
    if (data.id && !seen.has(data.id)) {
      allResults.push(data);
      seen.add(data.id);
    }
  }
}

const order = { aligned: 0, oversold: 1, undersold: 2 };
allResults.sort((a, b) =>
  (order[a.personaType] ?? 9) - (order[b.personaType] ?? 9) ||
  (a.id || '').localeCompare(b.id || '')
);

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rows = allResults.map(r => {
  const s1Pass = r.stage1?.filter(c => c.pass).length || 0;
  const s1Total = r.stage1?.length || 0;
  const s2Pass = r.stage2?.filter(c => c.verdict === 'PASS').length || 0;
  const s2Total = r.stage2?.length || 0;

  return `<div class="case">
    <div class="case-header">
      <h2>${r.id?.replace(/_/g, ' ')}</h2>
      <div class="badges">
        <span class="badge persona-${r.personaType}">${r.personaType}</span>
        <span class="badge role">${esc(r.role)}</span>
      </div>
      <p class="desc">${esc(r.description)}</p>
      <div class="stats">
        Stage 1: <b>${s1Pass}/${s1Total}</b> &nbsp;|&nbsp;
        Stage 2: ${r.stage2 ? `<b>${s2Pass}/${s2Total}</b>` : '<span class="na">N/A</span>'} &nbsp;|&nbsp;
        Transcript: <b>${r.transcriptLen || 0}</b> turns &nbsp;|&nbsp;
        <a href="http://localhost:5173/results/test?sample=${r.id}" target="_blank" class="fb-link">📋 Coaching Feedback →</a>
      </div>
    </div>

    ${r.stage1 ? `<details class="section"><summary>✅ Stage 1 Checks (${s1Pass}/${s1Total})</summary><div class="section-body">
      <table>${r.stage1.map(c => `<tr><td class="${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✗'}</td><td>${c.check}</td><td>${c.detail}</td></tr>`).join('')}</table>
    </div></details>` : ''}

    ${r.stage2 ? `<details class="section"><summary>🎤 Stage 2 Behaviour (${s2Pass}/${s2Total})</summary><div class="section-body">
      <table>${r.stage2.map(c => `<tr><td class="${c.verdict === 'PASS' ? 'pass' : 'fail'}">${c.verdict}</td><td>${c.id}</td><td>${c.reason || ''}</td></tr>`).join('')}</table>
    </div></details>` : `<p class="meta" style="padding:14px 24px">⏭ Stage 2 skipped or failed</p>`}

    ${r.transcript?.length > 0 ? `<details class="section"><summary>📜 Transcript (${r.transcript.length} turns)</summary><div class="section-body"><div class="transcript">
      ${r.transcript.map(t => {
        let text = t.text;
        const markers = [/The candidate has (explained|described|provided|shared)/, /This is a (good|great|clear)/, /I('ve| have) (asked|covered|now)/];
        for (const m of markers) { const idx = text.search(m); if (idx > 20) { text = text.slice(0, idx).trim(); break; } }
        return `<div class="turn ${t.speaker === 'INTERVIEWER' ? 'interviewer' : 'candidate'}"><span class="speaker">${t.speaker === 'INTERVIEWER' ? '🎙 INTERVIEWER' : '👤 CANDIDATE'}</span><span class="turn-num">turn ${t.turn || 0}</span><p>${esc(text)}</p></div>`;
      }).join('')}
    </div></div></details>` : ''}
  </div>`;
}).join('\n');

const cleanS1 = allResults.filter(r => r.stage1?.every(c => c.pass)).length;
const withS2 = allResults.filter(r => r.stage2);
const cleanS2 = withS2.filter(r => r.stage2.every(c => c.verdict === 'PASS')).length;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Behavioural Eval — Aggregate Report</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{font:14px/1.5 -apple-system,sans-serif;max-width:1100px;margin:0 auto;padding:24px;color:#1a1e26;background:#f7f8fa}
h1{font-size:22px;margin-bottom:4px}
.summary{margin:0 0 24px;color:#5b6472;font-size:13px}
.pass{color:#1d7a34;font-weight:700}.fail{color:#b83a24;font-weight:700}.na{color:#94a3b8}
.case{border:1px solid #e3e7ee;border-radius:12px;margin:24px 0;background:#fff;overflow:hidden}
.case-header{padding:20px 24px;border-bottom:1px solid #e3e7ee}
.case-header h2{margin:0 0 8px;font-size:18px;text-transform:capitalize}
.badges{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.badge{padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600}
.badge.persona-aligned{background:#d4edda;color:#1d7a34}
.badge.persona-undersold{background:#fff3cd;color:#856404}
.badge.persona-oversold{background:#f8d7da;color:#721c24}
.badge.role{background:#e2e8f0;color:#4a5568}
.desc{color:#5b6472;font-size:13px;margin:4px 0 0}
.stats{color:#5b6472;font-size:12.5px;margin-top:8px}
.meta{color:#5b6472;font-size:12.5px}
.fb-link{color:#7c3aed;font-weight:600;text-decoration:none}
.fb-link:hover{text-decoration:underline}
.section{border-bottom:1px solid #f0f1f5}
.section summary{cursor:pointer;padding:14px 24px;font-size:14px;font-weight:600;background:#fafbfc;user-select:none}
.section summary:hover{background:#f0f1f5}
.section[open] summary{background:#eef0f6}
.section-body{padding:16px 24px;max-height:500px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:13px;margin:0}
th,td{text-align:left;padding:6px 10px;border:1px solid #e3e7ee;vertical-align:top}
.transcript .turn{padding:8px 0;border-bottom:1px solid #f0f1f5}
.transcript .interviewer{background:#f7f8fd}
.transcript .candidate{background:#fdfcf7}
.speaker{font-weight:700;font-size:12.5px}
.turn-num{float:right;color:#a0aec0;font-size:11px}
.transcript p{margin:4px 0 0;font-size:13px;line-height:1.6}
</style></head><body>
<h1>🎯 Behavioural Eval — Aggregate Report</h1>
<p class="summary">${allResults.length} cases · Stage 1: ${cleanS1}/${allResults.length} clean · Stage 2: ${cleanS2}/${withS2.length} all-pass · <a href="../feedback-eval/feedback-report.html" style="color:#7c3aed">Schema validation report →</a></p>
${rows}
</body></html>`;

writeFileSync(join(__dirname, '..', 'run-report.html'), html);
console.log(`Report: ${allResults.length} cases (S1: ${cleanS1}/${allResults.length}, S2: ${cleanS2}/${withS2.length})`);
