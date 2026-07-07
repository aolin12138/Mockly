#!/usr/bin/env node

/**
 * Interactive review HTML — same dark style as live-report but with:
 *   - Three-layer criteria display
 *   - Sim-user prompt + first message
 *   - Warm-up turns
 *   - Per-scenario comments (clearable)
 *   - Phase grouping + filters
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCENARIOS_DIR = join(ROOT, 'scenarios');
const RUNS_DIR = join(ROOT, 'runs');
const CATALOGUE_PATH = join(ROOT, 'EVAL-CATALOGUE.md');
const OUTPUT = join(ROOT, 'review-report.html');

const PHASE_NODE_LABELS = {
  'node_01ksvy7ntre8gsanne5tj7kmca': 'Phase 1',
  'node_01ksvyddppe8gsannvqqc66p4w': 'Phase 2',
  'node_01ksvyftate8gsanp9mkqw49tf': 'Phase 3',
  'node_01kt35w596exs8pbna62db1zkr': 'Phase 4',
};

// ─── Escape ────────────────────────
function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }

// ─── Loaders ───────────────────────
function loadScenarios() {
  const files = readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('schema'));
  return files.map(f => JSON.parse(readFileSync(join(SCENARIOS_DIR, f), 'utf-8'))).filter(Boolean);
}

function loadCatalogue() {
  if (!existsSync(CATALOGUE_PATH)) return [];
  const cat = readFileSync(CATALOGUE_PATH, 'utf-8');
  const re = /\| (\d+) \| `([a-z_0-9]+)` (?:⭐NEW )?\| (.+?) \| (.+?) \| (.+?) \| (sim|live) \| (exists|rewrite|new) \|/g;
  const entries = [];
  let m;
  while ((m = re.exec(cat)) !== null) {
    entries.push({ number: parseInt(m[1]), id: m[2], candidate: m[3].trim(), testing: m[4].trim(), passCondition: m[5].trim(), channel: m[6].trim(), status: m[7].trim() });
  }
  return entries;
}

function loadRun() {
  const runs = readdirSync(RUNS_DIR).filter(f => f.startsWith('2026-')).sort().reverse();
  for (const r of runs) {
    const sd = join(RUNS_DIR, r, 'scenarios');
    if (existsSync(sd) && readdirSync(sd).filter(f => f.endsWith('.json')).length >= 1) return r;
  }
  return null;
}

function loadRunResults(runIds) {
  if (!runIds || !runIds.length) return {};
  const res = {};
  for (const runId of runIds) {
    if (!runId) continue;
    const sd = join(RUNS_DIR, runId, 'scenarios');
    if (!existsSync(sd)) continue;
    for (const f of readdirSync(sd).filter(f => f.endsWith('.json'))) {
      try { const d = JSON.parse(readFileSync(join(sd, f), 'utf-8')); res[d.scenarioId] = d; } catch {}
    }
  }
  return res;
}

function loadMultipleRuns() {
  // Accept comma-separated run IDs via --runs flag, or auto-detect the 2 latest runs
  const runsIdx = process.argv.indexOf('--runs');
  if (runsIdx >= 0) {
    return process.argv[runsIdx + 1].split(',').map(r => r.trim()).filter(Boolean);
  }
  // Auto-detect: last 2 runs that have scenarios
  const runs = readdirSync(RUNS_DIR).filter(f => f.startsWith('2026-')).sort().reverse();
  const found = [];
  for (const r of runs) {
    const sd = join(RUNS_DIR, r, 'scenarios');
    if (existsSync(sd) && readdirSync(sd).filter(f => f.endsWith('.json')).length >= 1) {
      found.push(r);
      if (found.length >= 2) break;
    }
  }
  return found;
}

function getPhaseNumber(scenarioId, scenario) {
  // Full interview scenarios go in their own section (phase 0)
  if (scenarioId && /full_interview/.test(scenarioId)) return 0;
  return scenario?.target_phase || 1;
}

function getPhaseLabel(phaseNum, scenarioId) {
  if (phaseNum === 0) return 'Full Interview';
  const names = { 1: 'Phase 1 — Understanding', 2: 'Phase 2 — Implementation', 3: 'Phase 3 — Time Pressure', 4: 'Phase 4 — Assessment & Close' };
  return names[phaseNum] || `Phase ${phaseNum}`;
}

// ─── Transcript rendering (matches report.mjs style) ────────
function renderTurn(t, i, isHistory) {
  const role = t.role || '?';
  const cls = role === 'agent' ? 't-agent' : role === 'user' ? 't-user' : 't-sys';
  const msg = t.message || '';

  let phaseBadge = '';
  const nodeId = t.workflowNodeId || t.agent_metadata?.workflow_node_id;
  if (nodeId) {
    const label = PHASE_NODE_LABELS[nodeId] || String(nodeId).slice(-8);
    phaseBadge = `<span class="phase-badge">⚙ ${label}</span>`;
  }

  let toolHtml = '';
  const tools = t.toolCalls || t.tool_calls || [];
  const toolResults = t.toolResults || t.tool_results || [];
  for (const tc of tools) {
    const tname = tc.toolName || tc.tool_name;
    toolHtml += `<div class="tool-call">→ <b>${esc(tname)}</b></div>`;
  }
  for (const tr of toolResults) {
    const tname = tr.toolName || tr.tool_name;
    let val = tr.result_value || tr.result || tr.output || '';
    try {
      const p = typeof val === 'string' ? JSON.parse(val) : val;
      if (p.content?.[0]?.text) { val = p.content.length > 1 ? `(${p.content.length} results)` : esc(p.content[0].text.slice(0, 300)); }
      else if (p.passed !== undefined) { val = `<span class="test-badge ${p.all_passed ? 'tp' : 'tf'}">${p.passed}/${p.total} passed</span>${p.failure_category ? ` <span class="meta">(${esc(p.failure_category)})</span>` : ''}`; }
      else if (p.code !== undefined) { val = `<span class="meta">${esc(p.language||'?')} · ${p.elapsed_seconds||0}s coding</span>`; }
      else val = esc(JSON.stringify(p).slice(0, 200));
    } catch { val = esc(String(val).slice(0, 300)); }
    toolHtml += `<div class="tool-result">← <b>${esc(tname)}</b>: ${val}</div>`;
  }

  const histTag = isHistory ? '<span class="history-tag">CONTEXT</span>' : '';
  const msgHtml = msg ? `<div class="t-msg">${esc(msg)}</div>` : '';

  return `<div class="turn ${cls}${isHistory?' t-hist':''}">
    <span class="t-role">${role.toUpperCase()}</span><span class="t-n">#${i+1}</span>${histTag}${phaseBadge}${toolHtml}${msgHtml}
  </div>`;
}

function renderCriteriaTable(criteria) {
  if (!criteria.length) return '<div class="empty">No criteria</div>';
  return `<table class="ct"><thead><tr><th></th><th>Criterion</th><th>Rationale</th></tr></thead><tbody>${
    criteria.map(c => {
      const chip = c.result === 'success' ? '<span class="chip pass">✓</span>' : c.result === 'failure' ? '<span class="chip fail">✗</span>' : '<span class="chip unk">?</span>';
      return `<tr class="${c.result==='failure'?'row-fail':''}"><td>${chip}</td><td class="cid">${esc(c.id)}</td><td>${esc(c.rationale)}</td></tr>`;
    }).join('')
  }</tbody></table>`;
}

// ─── Generate ───────────────────────
function generateHtml(merged) {
  const phases = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const s of merged) phases[s.phase].push(s);

  let cards = '';
  for (const [phaseNum, items] of Object.entries(phases)) {
    if (!items.length) continue;
    const phaseNames = { 0: '🧪 Full Interview', 1: 'Phase 1 — Understanding', 2: 'Phase 2 — Implementation', 3: 'Phase 3 — Time Pressure', 4: 'Phase 4 — Assessment & Close' };
    cards += `<div class="phase-section"><h2 class="phase-h2">${phaseNames[phaseNum]} (${items.length})</h2>`;
    for (const s of items) {
      const badge = s.runResult === 'pass' ? 'PASS' : s.runResult === 'fail' ? 'FAIL' : s.runResult === 'error' ? 'ERROR' : 'NEW';
      const bc = s.runResult || 'new';
      const isBad = s.runResult === 'fail' || s.runResult === 'error';
      const pColor = {0:'#f59e0b',1:'#58a6ff',2:'#bc8cff',3:'#eab308',4:'#22c55e'}[s.phase]||'var(--muted)';

      // Transcript
      const histCount = s.warmUp?.length || 0;
      const transcriptHtml = s.runTranscript?.map((t,i) => renderTurn(t, i, i < histCount)).join('') || '<div class="empty">No transcript</div>';

      // Latest-run tag
      const latestTag = s.isLatest ? '<span class="latest-tag">🏃 LATEST</span>' : '';

      // Criteria
      const criteriaHtml = renderCriteriaTable(s.runCriteria || []);

      cards += `<div class="card${isBad?' card-bad':''}">
  <div class="card-hd" onclick="this.parentElement.classList.toggle('folded')">
    <div class="card-hd-row">
      <span class="badge ${s.runResult||'new'}">${badge}</span>
      <span class="phase-tag" style="border-color:${pColor};color:${pColor}">${esc(s.phaseLabel)}</span>
      <span class="card-title">${esc(s.id)}</span>
      ${latestTag}
      <span class="card-meta">${s.runTurnsUsed||0}/${s.runTurnLimit||'?'} turns</span>
    </div>
    <div class="card-desc">${esc(s.description)}</div>
  </div>
  <div class="card-bd">
    ${s.simUserPrompt ? `<h4>Sim-User Prompt</h4><div class="sim-block">${esc(s.simUserPrompt)}</div>` : ''}
    ${s.simUserFirstMessage ? `<h4>Sim-User First Message</h4><div class="sim-block">${esc(s.simUserFirstMessage)}</div>` : ''}
    ${s.warmUp?.length ? `<h4>Warm-up Turns (${s.warmUp.length})</h4>${s.warmUp.map((w,i) => `<div class="warmup-line">🔵 ${esc(w)}</div>`).join('')}` : ''}
    ${s.runCriteria?.length ? `<h4>Criteria (${s.runCriteria.length})</h4>${criteriaHtml}` : ''}
    ${s.runTranscript?.length ? `<h4>Transcript</h4><div class="transcript">${transcriptHtml}</div>` : (s.runMessage ? `<div class="err-msg">${esc(s.runMessage)}</div>` : '')}
    <h4>💬 Comments</h4>
    <textarea class="comment-box" id="cmt-${esc(s.id)}" placeholder="Leave feedback..." onfocus="this._dirty=false" oninput="this._dirty=true;debounceSave()" onblur="flushSave()"></textarea>
    <span class="comment-saved" id="svd-${esc(s.id)}">✓ Saved</span>
  </div>
</div>`;
    }
    cards += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mockly — Test Case Review</title>
<style>
:root{--bg:#0d1117;--card:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;--g:#22c55e;--r:#ef4444;--y:#eab308;--b:#58a6ff;--p:#bc8cff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;font-size:16px}
.container{max-width:1000px;margin:0 auto;padding:24px 20px}
h1{font-size:20px;text-align:center;margin-bottom:4px}
.subtitle{text-align:center;color:var(--muted);font-size:13px;margin-bottom:24px}

/* Toolbar */
.toolbar{display:flex;justify-content:center;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.toolbar button{padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);cursor:pointer;font-size:13px}
.toolbar button:hover{background:#21262d}
.toolbar button.active{background:var(--b);color:#fff;border-color:var(--b);font-weight:700}
.toolbar .danger{color:var(--r);border-color:var(--r)}
.toolbar .danger:hover{background:rgba(239,68,68,.12)}

/* Phase sections */
.phase-section{margin-bottom:28px}
.phase-h2{font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}

/* Cards — matches report.mjs */
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
.card-bad{border-left:3px solid var(--r)}
.card-hd{cursor:pointer;user-select:none;transition:background .1s}
.card-hd:hover{background:rgba(255,255,255,.02)}
.card-hd-row{display:flex;align-items:center;gap:12px;padding:14px 18px}
.badge{font-size:11px;font-weight:700;padding:4px 12px;border-radius:14px;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap}
.badge.pass{background:rgba(34,197,94,.12);color:var(--g)}
.badge.fail{background:rgba(239,68,68,.12);color:var(--r)}
.badge.error{background:rgba(234,179,8,.12);color:var(--y)}
.badge.new{background:rgba(88,166,255,.12);color:var(--b)}
.card-title{font-weight:600;font-size:15px;flex:1;min-width:0}
.latest-tag{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;background:rgba(245,158,11,.15);color:#f59e0b;white-space:nowrap;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.card-desc{font-size:13px;color:var(--muted);padding:8px 18px 10px;border-top:1px solid var(--border)}
.phase-tag{font-size:10px;font-weight:600;padding:3px 10px;border-radius:12px;border:1px solid;white-space:nowrap;letter-spacing:.3px;text-transform:uppercase}
.card-meta{font-size:12px;color:var(--muted);white-space:nowrap}
.card-bd{padding:0 18px 18px}
.card.folded .card-bd{display:none}

/* Criteria table — matches report.mjs */
.ct{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px}
.ct th{text-align:left;padding:8px 12px;color:var(--muted);font-size:11px;text-transform:uppercase;border-bottom:1px solid var(--border)}
.ct td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.03);vertical-align:top}
.row-fail{background:rgba(239,68,68,.04)}
.cid{font-family:monospace;font-size:12px;color:var(--p);white-space:nowrap}
.chip{display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;font-size:12px;font-weight:700}
.chip.pass{background:rgba(34,197,94,.18);color:var(--g)}
.chip.fail{background:rgba(239,68,68,.18);color:var(--r)}
.chip.unk{background:rgba(188,140,255,.18);color:var(--p)}

/* Transcript — matches report.mjs */
.transcript{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:16px}
.turn{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.03);font-size:14px}
.turn:last-child{border-bottom:none}
.t-hist{opacity:.55;border-left:3px solid var(--border)}
.t-user{background:rgba(88,166,255,.03)}
.t-agent{background:rgba(188,140,255,.03)}
.t-role{font-size:10px;font-weight:700;text-transform:uppercase;margin-right:10px;padding:3px 7px;border-radius:4px}
.t-user .t-role{background:rgba(88,166,255,.2);color:var(--b)}
.t-agent .t-role{background:rgba(188,140,255,.2);color:var(--p)}
.t-n{font-size:10px;color:var(--muted);margin-right:8px}
.history-tag{font-size:9px;font-weight:600;padding:2px 6px;border-radius:3px;background:rgba(139,148,158,.15);color:var(--muted);margin-right:8px;text-transform:uppercase;letter-spacing:.3px}
.phase-badge{font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(234,179,8,.15);color:var(--y);margin-right:8px;font-family:monospace}
.t-msg{margin-top:8px;color:var(--text);line-height:1.6}
.tool-call{font-size:13px;color:var(--y);padding:4px 0 4px 16px;border-left:2px solid rgba(234,179,8,.3);margin:4px 0 4px 8px}
.tool-result{font-size:13px;color:var(--g);padding:4px 0 4px 16px;border-left:2px solid rgba(34,197,94,.3);margin:4px 0 4px 8px}
.mock-code{background:rgba(255,255,255,.04);padding:8px 12px;border-radius:4px;font-family:monospace;font-size:12px;margin:4px 0;white-space:pre-wrap;line-height:1.5}
.meta{font-size:11px;color:var(--muted);margin-left:8px}
.test-badge{font-weight:600;font-size:13px}
.test-badge.tp{color:var(--g)}.test-badge.tf{color:var(--r)}
.empty{color:var(--muted);font-style:italic;padding:14px}
h4{font-size:12px;margin:18px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}

/* New: sim-user block, warmup, comments */
.sim-block{background:rgba(88,166,255,.04);border:1px solid var(--border);border-radius:6px;padding:12px 16px;font-size:14px;line-height:1.6;white-space:pre-wrap;margin-bottom:12px}
.warmup-line{font-size:13px;color:var(--y);padding:4px 8px;margin:2px 0;border-left:3px solid rgba(234,179,8,.3);background:rgba(234,179,8,.04)}
.comment-box{width:100%;min-height:60px;margin-top:4px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;resize:vertical}
.comment-box:focus{outline:none;border-color:var(--b)}
.comment-saved{font-size:12px;color:var(--g);display:none}
.err-msg{background:rgba(234,179,8,.06);border:1px solid rgba(234,179,8,.2);padding:12px 16px;border-radius:6px;margin-bottom:14px;font-size:14px;color:var(--y)}
.footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}
</style></head><body>
<div class="container">
<h1>Mockly — Test Case Review</h1>
<div class="subtitle">${merged.length} scenarios · Click card headers to expand/collapse</div>

<div class="toolbar">
  <button class="active" onclick="filter('all',this)">All</button>
  <button onclick="filter('latest',this)">🏃 Latest</button>
  <span style="color:var(--border)">|</span>
  <button onclick="filter(0,this)">🧪 Full</button>
  <button onclick="filter(1,this)">Phase 1</button>
  <button onclick="filter(2,this)">Phase 2</button>
  <button onclick="filter(3,this)">Phase 3</button>
  <button onclick="filter(4,this)">Phase 4</button>
  <span style="color:var(--border)">|</span>
  <button onclick="filter('pass',this)">✅ Pass</button>
  <button onclick="filter('fail',this)">❌ Fail</button>
  <button onclick="filter('new',this)">⏳ New</button>
  <button class="danger" onclick="clearComments()">🗑 Clear All Comments</button>
</div>

${cards}

<div class="footer">Mockly Test Case Review · Comments saved to browser localStorage · Export via Export button</div>
</div>
<script>
const comments=JSON.parse(localStorage.getItem('mc-review')||'{}');
let saveTimer=null;

function debounceSave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(flushSave,800);
}

function flushSave(){
  clearTimeout(saveTimer);
  document.querySelectorAll('.comment-box').forEach(b=>{
    if(!b._dirty) return;
    b._dirty=false;
    const id=b.id.replace('cmt-','');
    if(b.value.trim()) comments[id]=b.value; else delete comments[id];
  });
  localStorage.setItem('mc-review',JSON.stringify(comments));
  // Flash saved indicator briefly
  document.querySelectorAll('.comment-saved').forEach(el=>el.style.display='inline');
  setTimeout(()=>document.querySelectorAll('.comment-saved').forEach(el=>el.style.display='none'),1200);
}

function clearComments(){
  if(!confirm('Delete ALL comments?')) return;
  localStorage.removeItem('mc-review');
  document.querySelectorAll('.comment-box').forEach(b=>{b.value='';b._dirty=false});
  Object.keys(comments).forEach(k=>delete comments[k]);
}

let af='all';
function filter(v,btn){
  af=v;
  document.querySelectorAll('.toolbar button:not(.danger)').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.card').forEach(c=>{
    const phaseMatch = c.closest('.phase-section')?.querySelector('.phase-h2')?.textContent;
    const phaseNum = phaseMatch?.startsWith('🧪 Full') ? 0 : phaseMatch?.match(/Phase (\d)/)?.[1];
    const result=c.querySelector('.badge')?.classList.contains(v);
    const isLatest=c.querySelector('.latest-tag') !== null;
    c.style.display=(af==='all')?'':
      (af==='latest')?(isLatest?'':'none'):
      (af===0||af===1||af===2||af===3||af===4)?(String(phaseNum)===String(af)?'':'none'):
      (result?'':'none');
  });
  document.querySelectorAll('.phase-section').forEach(s=>{
    s.style.display=[...s.querySelectorAll('.card')].some(c=>c.style.display!=='none')?'':'none';
  });
}

// Restore comments
const commentBoxes=document.querySelectorAll('.comment-box');
commentBoxes.forEach(b=>{
  const id=b.id.replace('cmt-','');
  if(comments[id]) b.value=comments[id];
  b._dirty=false;
});

// Export
const expBtn=document.createElement('button');
expBtn.textContent='⬇ Export';
expBtn.style.cssText='padding:6px 14px;border:1px solid var(--g);border-radius:6px;background:rgba(34,197,94,.12);color:var(--g);cursor:pointer;font-size:13px;font-weight:700';
expBtn.onclick=()=>{
  const blob=new Blob([JSON.stringify(comments,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='review-comments.json';a.click();
};
document.querySelector('.toolbar').appendChild(expBtn);
</script>
</body></html>`;
}

// ─── Merge ──────────────────────────
function merge(built, catalogue, runResults, latestRunIds) {
  const done = new Set(built.map(s => s.id));
  const latestSet = new Set(latestRunIds || []);
  const out = [];

  for (const s of built) {
    const run = runResults[s.id];
    const cat = catalogue.find(e => e.id === s.id);
    const phase = getPhaseNumber(s.id, s);
    out.push({
      id: s.id,
      description: s.description || cat?.testing || '',
      phase,
      phaseLabel: getPhaseLabel(phase, s.id),
      simUserPrompt: s.simulated_user?.prompt || '',
      simUserFirstMessage: s.simulated_user?.first_message || '',
      warmUp: s.warm_up?.candidate_turns || [],
      runResult: run?.result || null,
      runTranscript: run?.transcript || [],
      runTurnsUsed: run?.turnsUsed || 0,
      runTurnLimit: run?.turnLimit || 0,
      runCriteria: run?.criteria || [],
      runMessage: run?.message || null,
      isLatest: latestSet.has(s.id),
    });
  }

  for (const cat of catalogue) {
    if (done.has(cat.id)) continue;
    const phase = cat.number <= 9 ? 1 : cat.number <= 21 ? 2 : cat.number <= 23 ? 3 : 4;
    out.push({
      id: cat.id, description: cat.testing, phase,
      phaseLabel: `Phase ${phase}`,
      simUserPrompt: `[From catalogue] Candidate does: ${cat.candidate}`,
      simUserFirstMessage: '(not yet written)',
      warmUp: [], runResult: null, runTranscript: [], runTurnsUsed: 0, runTurnLimit: 0,
      runCriteria: [], runMessage: null,
    });
  }
  return out;
}

// ─── Main ──────────────────────────
const runIds = loadMultipleRuns();
console.log('Runs:', runIds.join(', ') || '(none)');

// Determine latest-run scenario IDs (from the most recent run folder)
const latestIdx = process.argv.indexOf('--latest');
let latestRunIds = [];
if (latestIdx >= 0 && runIds.length > 0) {
  // Use the last run as the "latest"
  const latestRun = runIds[runIds.length - 1];
  const sd = join(RUNS_DIR, latestRun, 'scenarios');
  if (existsSync(sd)) {
    latestRunIds = readdirSync(sd).filter(f => f.endsWith('.json')).map(f => {
      try { return JSON.parse(readFileSync(join(sd, f), 'utf-8')).scenarioId; } catch { return null; }
    }).filter(Boolean);
  }
  console.log('Latest run:', latestRun, '(' + latestRunIds.length + ' scenarios)');
}

const merged = merge(loadScenarios(), loadCatalogue(), loadRunResults(runIds), latestRunIds);
console.log('Scenarios:', merged.length);
writeFileSync(OUTPUT, generateHtml(merged), 'utf-8');
console.log('Report:', OUTPUT);
