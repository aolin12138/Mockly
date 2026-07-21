#!/usr/bin/env node
/**
 * Renders coaching feedback using the same layout structure as ResultsPage.jsx.
 * Reads from feedback-eval/runs/<latest>/ and produces a preview.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, 'runs');

const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory()).sort().reverse();
const latestDir = join(RUNS_DIR, dirs[0].name);
const files = readdirSync(latestDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

const results = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(join(latestDir, f), 'utf8'));
  if (d.feedback) results.push(d);
}
results.sort((a, b) => {
  const o = { aligned: 0, oversold: 1, undersold: 2 };
  return (o[a.persona] ?? 9) - (o[b.persona] ?? 9) || (a.caseId || '').localeCompare(b.caseId || '');
});

function e(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function star(n) { return '★'.repeat(n||0)+'☆'.repeat(5-(n||0)); }

const cases = results.map((r, ci) => {
  const fb = r.feedback;
  const ga = fb.gap_analysis || {};
  const rm = fb.roadmap || {};
  const proj = fb.project_suggestions || [];
  const tips = fb.interview_tips || [];
  const dims = fb.dimension_scores || {};
  const dimKeys = Object.keys(dims);
  const avg = dimKeys.length ? (dimKeys.reduce((s,k)=>s+(dims[k]?.score||0),0)/dimKeys.length).toFixed(1) : '?';
  const colors = {aligned:'emerald',oversold:'amber',undersold:'sky'};
  const c = colors[r.persona]||'slate';

  return `
<!-- CASE ${ci+1}: ${e(r.caseId)} -->
<div class="min-h-screen py-8 px-4" style="background:#f8fafc">
<div class="max-w-5xl mx-auto space-y-8">

  <!-- Hero Banner -->
  <div class="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
    <div class="flex flex-col md:flex-row md:items-center gap-6">
      <div class="flex-shrink-0">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" stroke-width="8"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="#10b981" stroke-width="8"
            stroke-dasharray="${Math.round(avg*26.4)} 264" stroke-dashoffset="66" stroke-linecap="round"
            transform="rotate(-90 50 50)"/>
          <text x="50" y="50" text-anchor="middle" dy="5" font-size="16" font-weight="700" fill="#1e293b">${avg}</text>
          <text x="50" y="65" text-anchor="middle" font-size="9" fill="#64748b">/5</text>
        </svg>
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-${c}-50 border border-${c}-200 text-${c}-700">${(r.persona||'').toUpperCase()}</span>
          <span class="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">${e(r.role)}</span>
          <span class="text-xs text-slate-400">${r.transcriptLen||0} turns</span>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 capitalize">${e(r.caseId?.replace(/_/g,' '))}</h1>
        <p class="mt-2 text-slate-600 leading-relaxed">${e(fb.overall_assessment)}</p>
      </div>
    </div>
  </div>

  <!-- Skill Assessment (DimensionRadar equivalent) -->
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-4">📊 Skill Assessment</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
      ${dimKeys.map(k=>{
        const ds=dims[k];
        return `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm font-semibold capitalize text-slate-700">${k.replace(/_/g,' ')}</span>
            <span class="text-sm text-amber-500">${star(ds?.score||0)}</span>
          </div>
          <p class="text-xs text-slate-500">${e(ds?.note)}</p>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- Gap Analysis -->
  ${ga ? `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
      <span>🔍</span> Gap Analysis
    </h2>
    ${ga.summary ? `<p class="text-slate-600 mb-5 leading-relaxed">${e(ga.summary)}</p>` : ''}
    <div class="grid gap-5 md:grid-cols-2">
      ${Array.isArray(ga.missing_skills) && ga.missing_skills.length ? `
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-amber-800 mb-3">⚠ Missing Skills</h3>
        <ul class="space-y-2">${ga.missing_skills.map(s=>`<li class="flex items-start gap-2 text-sm text-amber-700"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0"></span>${e(s)}</li>`).join('')}</ul>
      </div>` : ''}
      ${Array.isArray(ga.under_communicated_strengths) && ga.under_communicated_strengths.length ? `
      <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-emerald-800 mb-3">💎 Under-communicated Strengths</h3>
        <ul class="space-y-2">${ga.under_communicated_strengths.map(s=>`<li class="flex items-start gap-2 text-sm text-emerald-700"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>${e(s)}</li>`).join('')}</ul>
      </div>` : ''}
    </div>
    ${ga.market_context ? `<div class="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4"><h3 class="text-sm font-semibold text-slate-700 mb-2">📈 Market Context</h3><p class="text-sm text-slate-600 leading-relaxed">${e(ga.market_context)}</p></div>` : ''}
  </div>` : ''}

  <!-- Project Suggestions -->
  ${proj.length ? `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2"><span>🚀</span> Project Suggestions</h2>
    <p class="text-sm text-slate-500 mb-5">Concrete projects to close the gaps above. Each gives you something specific to talk about in your next interview.</p>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${proj.map(p=>{
        const tColors={open_source:'emerald',side_project:'blue',portfolio_piece:'violet',course:'amber',certification:'rose'};
        const tc=tColors[p.type]||'slate';
        return `<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-${tc}-50 border border-${tc}-200 text-${tc}-700 w-fit mb-3">${e((p.type||'').replace(/_/g,' '))}</span>
          <h3 class="text-sm font-semibold text-slate-900 mb-2">${e(p.title)}</h3>
          <p class="text-xs text-slate-600 mb-3 flex-1 leading-relaxed">${e(p.why)}</p>
          ${Array.isArray(p.technologies)&&p.technologies.length?`<div class="flex flex-wrap gap-1.5 mb-3">${p.technologies.map(t=>`<span class="text-xs font-mono text-slate-600 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">${e(t)}</span>`).join('')}</div>`:''}
          ${p.outcome?`<div class="mt-auto pt-3 border-t border-slate-200"><p class="text-xs text-emerald-700 leading-relaxed"><strong>After:</strong> ${e(p.outcome)}</p></div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- Roadmap -->
  ${rm ? `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2"><span>🗺️</span> Roadmap</h2>
    <div class="grid gap-3 md:grid-cols-3">
      ${[{key:'immediate',label:'⚡ This Week',color:'amber',items:rm.immediate},{key:'short_term',label:'📅 This Month',color:'blue',items:rm.short_term},{key:'medium_term',label:'🎯 3 Months',color:'violet',items:rm.medium_term}].map(ph=>{
        const items=Array.isArray(ph.items)?ph.items:[];
        return `<div class="border-l-2 border-${ph.color}-400 bg-${ph.color}-50/40 rounded-r-lg p-4">
          <h3 class="text-sm font-semibold text-${ph.color}-800 mb-3">${ph.label}</h3>
          ${items.length?`<ul class="space-y-2">${items.map(s=>`<li class="flex items-start gap-2 text-sm text-slate-700"><span class="w-1.5 h-1.5 rounded-full bg-${ph.color}-500 mt-1.5 flex-shrink-0"></span>${e(s)}</li>`).join('')}</ul>`:`<p class="text-xs text-slate-400 italic">Nothing planned</p>`}
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- Interview Tips -->
  ${tips.length ? `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2"><span>💡</span> Interview Tips</h2>
    <p class="text-sm text-slate-500 mb-5">Based on specific moments from your transcript. Actionable changes for your next interview.</p>
    <div class="space-y-3.5">
      ${tips.map(t=>{
        const catColors={delivery:'blue',structure:'amber',content:'emerald',positioning:'violet'};
        const cc=catColors[t.category]||'slate';
        return `<div class="bg-${cc}-50/60 border border-${cc}-200 rounded-xl p-4">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-${cc}-50 border border-${cc}-200 text-${cc}-700 mb-3 inline-block">${e(t.category)}</span>
          <div class="space-y-2 mt-2">
            <p class="text-sm text-slate-700"><span class="font-semibold text-slate-500 text-xs uppercase">You did:</span> ${e(t.observation)}</p>
            <p class="text-sm text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-lg p-3"><span class="font-semibold text-emerald-800 text-xs uppercase">Try instead:</span> ${e(t.suggestion)}</p>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>` : ''}

  <!-- Praise -->
  ${Array.isArray(fb.praise_worthy)&&fb.praise_worthy.length ? `
  <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
    <h2 class="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><span>🌟</span> What Went Well</h2>
    <ul class="space-y-3">${fb.praise_worthy.map(s=>`<li class="flex items-start gap-2 text-sm text-slate-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0"></span>${e(s)}</li>`).join('')}</ul>
  </div>` : ''}

</div>
</div>
`;
}).join('<hr class="border-slate-200 my-0">');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coaching Feedback Preview — ResultsPage Layout</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;line-height:1.6}
hr{border:none;border-top:1px solid #e2e8f0;margin:0}
.bg-emerald-50{background:#ecfdf5}
.bg-emerald-50\\/40{background:rgba(236,253,245,0.4)}
.bg-amber-50{background:#fffbeb}
.bg-amber-50\\/40{background:rgba(255,251,235,0.4)}
.bg-sky-50{background:#f0f9ff}
.bg-blue-50{background:#eff6ff}
.bg-blue-50\\/40{background:rgba(239,246,255,0.4)}
.bg-blue-50\\/60{background:rgba(239,246,255,0.6)}
.bg-violet-50{background:#f5f3ff}
.bg-violet-50\\/40{background:rgba(245,243,255,0.4)}
.bg-rose-50{background:#fff1f2}
.bg-slate-50{background:#f8fafc}
.bg-white{background:white}
.border-emerald-200{border-color:#a7f3d0}
.border-amber-200{border-color:#fde68a}
.border-amber-400{border-color:#fbbf24}
.border-sky-200{border-color:#bae6fd}
.border-blue-200{border-color:#bfdbfe}
.border-blue-400{border-color:#60a5fa}
.border-violet-200{border-color:#ddd6fe}
.border-violet-400{border-color:#a78bfa}
.border-slate-200{border-color:#e2e8f0}
.text-emerald-700{color:#047857}
.text-emerald-800{color:#065f46}
.text-amber-500{color:#f59e0b}
.text-amber-700{color:#b45309}
.text-amber-800{color:#92400e}
.text-blue-700{color:#1d4ed8}
.text-blue-800{color:#1e40af}
.text-violet-700{color:#6d28d9}
.text-violet-800{color:#5b21b6}
.text-rose-700{color:#be123c}
.text-slate-400{color:#94a3b8}
.text-slate-500{color:#64748b}
.text-slate-600{color:#475569}
.text-slate-700{color:#334155}
.text-slate-900{color:#0f172a}
.bg-amber-500{background:#f59e0b}
.bg-blue-500{background:#3b82f6}
.bg-violet-500{background:#8b5cf6}
.bg-emerald-500{background:#10b981}
.bg-emerald-600{background:#059669}
</style>
</head>
<body>
${cases}
<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.85rem">
  ${results.length} cases · Coaching feedback schema: gap analysis + project suggestions + roadmap + interview tips
</div>
</body>
</html>`;

const outPath = join(__dirname, 'coaching-preview.html');
writeFileSync(outPath, html);
console.log(`Preview: ${outPath} (${results.length} cases)`);
