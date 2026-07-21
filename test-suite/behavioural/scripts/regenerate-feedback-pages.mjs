#!/usr/bin/env node
/** Regenerate feedback pages — faithful to actual ResultsPage components */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, '..', 'feedback-eval', 'runs');
const PAGES_DIR = join(__dirname, '..', 'feedback-eval', 'feedback-pages');

const dirs = readdirSync(RUNS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory()).sort().reverse();
const latestDir = join(RUNS_DIR, dirs[0].name);

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtd = name => String(name||'').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());

function scoreColor(s) {
  if (s >= 7) return { t: 'emerald', ti: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/5', b: 'border-emerald-200 dark:border-emerald-500/20', grad: 'from-emerald-500 to-emerald-400', arc: '#10b981' };
  if (s >= 5) return { t: 'amber', ti: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/5', b: 'border-amber-200 dark:border-amber-500/20', grad: 'from-amber-500 to-amber-400', arc: '#f59e0b' };
  return { t: 'red', ti: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/5', b: 'border-red-200 dark:border-red-500/20', grad: 'from-red-500 to-red-400', arc: '#ef4444' };
}

function scoreArc(score, maxScore, size = 130) {
  const sw = 8, radius = (size - sw) / 2;
  const circum = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const arcLen = circum * 0.75;
  const filled = arcLen * pct;
  const rot = 135;
  const c = pct >= 0.7 ? ['#10b981','#06b6d4'] : pct >= 0.5 ? ['#f59e0b','#f97316'] : ['#ef4444','#f97316'];
  return `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs><linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${c[0]}"/><stop offset="100%" stop-color="${c[1]}"/></linearGradient></defs>
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="rgba(148,163,184,0.25)" stroke-width="${sw}" stroke-dasharray="${arcLen} ${circum-arcLen}" stroke-linecap="round" transform="rotate(${rot} ${size/2} ${size/2})"/>
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="url(#ag)" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${filled} ${circum-filled}" transform="rotate(${rot} ${size/2} ${size/2})" style="transition:stroke-dasharray 1.2s ease"/>
    </svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <span style="font-size:1.5rem;font-weight:700;color:rgb(var(--text))">${score}</span>
      <span style="font-size:0.7rem;color:rgb(var(--text-dim));margin-top:-2px">/ ${maxScore}</span>
    </div>
  </div>`;
}

const CSS = `/* Tailwind-reset + design system */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:248 250 252;--bg-card:255 255 255;--border:226 232 240;--text:15 23 42;--text-muted:71 85 105;--text-dim:148 163 184;
  --em-50:236 253 245;--em-200:167 243 208;--em-600:5 150 105;--em-700:4 120 87;
  --am-50:255 251 235;--am-200:253 230 138;--am-600:217 119 6;--am-700:180 83 9;
  --rd-50:254 242 242;--rd-200:254 202 202;--rd-600:220 38 38;--rd-700:185 28 28;
  --bl-50:239 246 255;--bl-200:191 219 254;--bl-600:37 99 235;
  --vi-50:245 243 255;--vi-200:221 214 254;--vi-600:124 58 237;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:2 6 23;--bg-card:15 23 42;--border:51 65 85;--text:226 232 240;--text-muted:148 163 184;--text-dim:100 116 139;
  }
}
body{font-family:system-ui,-apple-system,sans-serif;background:rgb(var(--bg));color:rgb(var(--text));line-height:1.6;min-height:100vh}
body::before{content:'';position:fixed;top:-40%;left:-20%;width:140%;height:140%;background:radial-gradient(ellipse at 30% 20%,rgba(16,185,129,0.04) 0%,transparent 50%),radial-gradient(ellipse at 70% 60%,rgba(99,102,241,0.03) 0%,transparent 50%);pointer-events:none;z-index:0}
.main{max-width:900px;margin:0 auto;padding:32px 24px;position:relative;z-index:1}
/* Card — matches Card.jsx */
.card{background:rgb(var(--bg-card));border:1px solid rgba(var(--border),0.5);border-radius:16px;padding:28px;margin-bottom:24px;box-shadow:0 12px 34px -24px rgba(15,23,42,0.35);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(var(--bg),0.6),transparent);opacity:0;transition:opacity 0.5s;border-radius:16px;pointer-events:none}
.card:hover::before{opacity:1}
h1{font-size:1.5rem;font-weight:700;text-transform:capitalize}
h2{font-size:1.15rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.pill{display:inline-block;padding:3px 12px;border-radius:999px;font-size:0.7rem;font-weight:700;letter-spacing:0.3px;margin:0 6px 4px 0}
.pl-em{background:rgb(var(--em-50)/0.7);border:1px solid rgb(var(--em-200)/0.8);color:rgb(var(--em-700))}
.pl-am{background:rgb(var(--am-50)/0.7);border:1px solid rgb(var(--am-200)/0.8);color:rgb(var(--am-700))}
.pl-bl{background:rgb(var(--bl-50)/0.7);border:1px solid rgb(var(--bl-200)/0.8);color:rgb(var(--bl-600))}
.pl-ro{background:rgba(var(--border),0.3);border:1px solid rgba(var(--border),0.4);color:rgb(var(--text-muted))}
.hero{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-top:16px}
.hero-t{flex:1;min-width:0}
.hero-p{color:rgb(var(--text-muted));font-size:0.9rem;line-height:1.7;margin-top:8px}
/* Dimension cards — matches DimensionDetailCard */
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.dcard{border-radius:14px;padding:18px}
.dcard-em{background:rgb(var(--em-50)/0.6);border:1px solid rgb(var(--em-200)/0.6)}
.dcard-am{background:rgb(var(--am-50)/0.6);border:1px solid rgb(var(--am-200)/0.6)}
.dcard-rd{background:rgb(var(--rd-50)/0.6);border:1px solid rgb(var(--rd-200)/0.6)}
.dhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.dname{font-weight:600;font-size:0.88rem}
.dscore{font-weight:700;font-size:0.85rem}
.dsc-em{color:rgb(var(--em-700))}.dsc-am{color:rgb(var(--am-700))}.dsc-rd{color:rgb(var(--rd-700))}
.bar{width:100%;height:6px;background:rgb(var(--border)/0.3);border-radius:999px;overflow:hidden;margin-bottom:8px}
.bar-fill{height:100%;border-radius:999px;transition:width 0.8s ease}
.bf-em{background:linear-gradient(90deg,#10b981,#34d399)}.bf-am{background:linear-gradient(90deg,#f59e0b,#fbbf24)}.bf-rd{background:linear-gradient(90deg,#ef4444,#f87171)}
.dnote{font-size:0.8rem;color:rgb(var(--text-muted));line-height:1.4}
/* Two-column */
.c2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.box{border-radius:14px;padding:18px}
.box-am{background:rgb(var(--am-50)/0.5);border:1px solid rgb(var(--am-200)/0.5)}
.box-em{background:rgb(var(--em-50)/0.5);border:1px solid rgb(var(--em-200)/0.5)}
.box-sl{background:rgba(var(--bg),0.5);border:1px solid rgba(var(--border),0.3)}
.btitle{font-weight:700;font-size:0.85rem;margin-bottom:10px}
.box-am .btitle{color:rgb(var(--am-700))}.box-em .btitle{color:rgb(var(--em-700))}
.box ul{padding-left:16px;font-size:0.83rem;color:rgb(var(--text-muted))}
.box li{margin-bottom:4px}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:8px;flex-shrink:0;vertical-align:middle}
.dot-am{background:rgb(var(--am-600))}.dot-em{background:rgb(var(--em-600))}
/* Project grid */
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.pcard{background:rgba(var(--bg),0.6);border:1px solid rgba(var(--border),0.3);border-radius:14px;padding:18px;display:flex;flex-direction:column}
.ptype{font-size:0.66rem;font-weight:700;padding:2px 8px;border-radius:6px;margin-bottom:10px;display:inline-block;width:fit-content}
.pt-em{background:rgb(var(--em-50)/0.7);color:rgb(var(--em-700))}.pt-bl{background:rgb(var(--bl-50)/0.7);color:rgb(var(--bl-600))}
.pt-vi{background:rgb(var(--vi-50)/0.7);color:rgb(var(--vi-600))}.pt-am{background:rgb(var(--am-50)/0.7);color:rgb(var(--am-700))}
.ptitle{font-weight:700;font-size:0.88rem;margin-bottom:6px}
.pwhy{font-size:0.8rem;color:rgb(var(--text-muted));margin-bottom:8px;flex:1;line-height:1.5}
.ptags{margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px}
.ttag{background:rgba(var(--border),0.2);color:rgb(var(--text-muted));padding:1px 7px;border-radius:5px;font-size:0.68rem;font-family:'SF Mono',monospace}
.pout{font-size:0.78rem;color:rgb(var(--em-600));border-top:1px solid rgba(var(--border),0.3);padding-top:10px;margin-top:auto;line-height:1.5}
/* Roadmap */
.rc{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.rcol{border-radius:14px;padding:18px;border-left:3px solid}
.rim{border-color:rgb(var(--am-600));background:rgb(var(--am-50)/0.3)}
.rsh{border-color:rgb(var(--bl-600));background:rgb(var(--bl-50)/0.3)}
.rmd{border-color:rgb(var(--vi-600));background:rgb(var(--vi-50)/0.3)}
.rcol h3{font-size:0.85rem;font-weight:700;margin-bottom:10px}
.rcol ul{padding-left:16px;font-size:0.82rem;color:rgb(var(--text-muted))}
.rcol li{margin-bottom:5px;line-height:1.5}
/* Tips */
.tip{border-radius:14px;padding:18px;margin-bottom:10px}
.ti-bl{background:rgb(var(--bl-50)/0.4);border:1px solid rgb(var(--bl-200)/0.5)}
.ti-am{background:rgb(var(--am-50)/0.4);border:1px solid rgb(var(--am-200)/0.5)}
.ti-em{background:rgb(var(--em-50)/0.4);border:1px solid rgb(var(--em-200)/0.5)}
.ti-vi{background:rgb(var(--vi-50)/0.4);border:1px solid rgb(var(--vi-200)/0.5)}
.tcat{font-size:0.66rem;font-weight:700;padding:2px 8px;border-radius:6px;margin-bottom:8px;display:inline-block}
.tobs{font-size:0.83rem;color:rgb(var(--text-muted));margin-bottom:8px;line-height:1.5}
.tsug{font-size:0.83rem;color:rgb(var(--em-600));background:rgb(var(--em-50)/0.3);border:1px solid rgb(var(--em-200)/0.4);border-radius:10px;padding:12px;line-height:1.5}
/* Praise */
.pzp{background:rgb(var(--em-50)/0.4);border:1px solid rgb(var(--em-200)/0.5);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:8px}
.pzdot{width:6px;height:6px;border-radius:50%;background:rgb(var(--em-600));margin-top:7px;flex-shrink:0}
.sub{color:rgb(var(--text-dim));font-size:0.82rem;margin-bottom:16px}
@media(max-width:640px){.c2,.rc,.pgrid,.hero{grid-template-columns:1fr}}`;

const tagColors = { open_source: 'em', side_project: 'bl', portfolio_piece: 'vi', course: 'am', certification: 'am' };
const catCol = { delivery: 'bl', structure: 'am', content: 'em', positioning: 'vi' };

function renderPage(data) {
  const fb = data.feedback;
  const ga = fb.gap_analysis || {};
  const rm = fb.roadmap || {};
  const proj = fb.project_suggestions || [];
  const tips = fb.interview_tips || [];
  const dims = fb.dimension_scores || {};
  const dimKeys = Object.keys(dims);
  const dimArr = dimKeys.map(k => ({ name: k, score: dims[k]?.score || 0, note: dims[k]?.note || '' }));
  const avgScore = dimArr.length ? Math.round(dimArr.reduce((s, d) => s + d.score, 0) / dimArr.length) : 0;

  // Hero (matches HeroBanner)
  const hero = `<div class="card">
    <span class="pill pl-${data.persona === 'aligned' ? 'em' : data.persona === 'oversold' ? 'am' : 'bl'}">${esc((data.persona||'').toUpperCase())}</span>
    <span class="pill pl-ro">${esc(data.role)}</span>
    <h1>${esc((data.caseId||'').replace(/_/g,' '))}</h1>
    <div class="hero">
      ${scoreArc(avgScore, 5, 130)}
      <div class="hero-t">
        <div style="font-weight:600;font-size:0.95rem">Interview Summary</div>
        <div style="color:rgb(var(--text-dim));font-size:0.78rem;margin-top:2px">6 dimensions · ${dimArr.filter(d=>d.score>=4).length} strong</div>
      </div>
    </div>
    <p class="hero-p">${esc(fb.overall_assessment)}</p>
  </div>`;

  // Dimension detail cards (matches DimensionDetailCard)
  const dimSection = `<div class="card">
    <h2>📊 Skill Breakdown</h2>
    <div class="dgrid">
      ${dimArr.map(d => {
        const c = scoreColor(d.score * 2); // normalize to 0-10
        return `<div class="dcard dcard-${c.t}">
          <div class="dhead"><span class="dname">${fmtd(d.name)}</span><span class="dscore dsc-${c.t}">${d.score}/5</span></div>
          <div class="bar"><div class="bar-fill bf-${c.t}" style="width:${(d.score/5)*100}%"></div></div>
          <div class="dnote">${esc(d.note)}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // Gap Analysis
  const gap = `<div class="card">
    <h2>🔍 Gap Analysis</h2>
    ${ga.summary ? `<p style="color:rgb(var(--text-muted));margin-bottom:16px;font-size:0.9rem;line-height:1.6">${esc(ga.summary)}</p>` : ''}
    <div class="c2">
      ${Array.isArray(ga.missing_skills) && ga.missing_skills.length ? `<div class="box box-am"><div class="btitle">⚠ Missing Skills</div><ul>${ga.missing_skills.map(s => `<li><span class="dot dot-am"></span>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      ${Array.isArray(ga.under_communicated_strengths) && ga.under_communicated_strengths.length ? `<div class="box box-em"><div class="btitle">💎 Under-communicated Strengths</div><ul>${ga.under_communicated_strengths.map(s => `<li><span class="dot dot-em"></span>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    </div>
    ${ga.market_context ? `<div class="box box-sl" style="margin-top:14px"><div class="btitle">📈 Market Context</div><p style="font-size:0.83rem;color:rgb(var(--text-muted));line-height:1.6">${esc(ga.market_context)}</p></div>` : ''}
  </div>`;

  // Projects
  const ps = proj.length ? `<div class="card">
    <h2>🚀 Project Suggestions</h2>
    <p class="sub">Concrete projects to close the gaps above.</p>
    <div class="pgrid">
      ${proj.map(p => `<div class="pcard">
        <span class="ptype pt-${tagColors[p.type]||'bl'}">${esc((p.type||'').replace(/_/g,' '))}</span>
        <div class="ptitle">${esc(p.title)}</div>
        <div class="pwhy">${esc(p.why)}</div>
        ${Array.isArray(p.technologies)&&p.technologies.length ? `<div class="ptags">${p.technologies.map(t=>`<span class="ttag">${esc(t)}</span>`).join('')}</div>` : ''}
        ${p.outcome ? `<div class="pout"><strong>After completing:</strong> ${esc(p.outcome)}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>` : '';

  // Roadmap
  const rs = rm ? `<div class="card">
    <h2>🗺️ Roadmap</h2>
    <div class="rc">
      ${[{k:'immediate',l:'⚡ This Week',i:rm.immediate,c:'rim'},{k:'short_term',l:'📅 This Month',i:rm.short_term,c:'rsh'},{k:'medium_term',l:'🎯 3 Months',i:rm.medium_term,c:'rmd'}].map(p => {
        const items = Array.isArray(p.i) ? p.i : [];
        return `<div class="rcol ${p.c}"><h3>${p.l}</h3>${items.length ? `<ul>${items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>` : `<p style="font-size:0.8rem;color:rgb(var(--text-dim));font-style:italic">—</p>`}</div>`;
      }).join('')}
    </div>
  </div>` : '';

  // Tips
  const ts = tips.length ? `<div class="card">
    <h2>💡 Interview Tips</h2>
    <p class="sub">Based on specific moments from your transcript.</p>
    ${tips.map(t => `<div class="tip ti-${catCol[t.category]||'bl'}">
      <span class="tcat pt-${catCol[t.category]||'bl'}">${esc(t.category)}</span>
      <div class="tobs"><strong>Observation:</strong> ${esc(t.observation)}</div>
      <div class="tsug"><strong>Suggestion:</strong> ${esc(t.suggestion)}</div>
    </div>`).join('')}
  </div>` : '';

  // Praise (matches StrengthsImprovements card style)
  const praise = Array.isArray(fb.praise_worthy) && fb.praise_worthy.length ? `<div class="card">
    <h2>🌟 What Went Well</h2>
    ${fb.praise_worthy.map(s => `<div class="pzp"><div class="pzdot"></div><span style="font-size:0.85rem">${esc(s)}</span></div>`).join('')}
  </div>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coaching Feedback — ${esc(data.caseId)}</title><style>${CSS}</style></head><body><div class="main">${hero}${dimSection}${gap}${ps}${rs}${ts}${praise}</div></body></html>`;
}

// Main
const files = readdirSync(latestDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
mkdirSync(PAGES_DIR, { recursive: true });
for (const f of files) {
  const data = JSON.parse(readFileSync(join(latestDir, f), 'utf8'));
  writeFileSync(join(PAGES_DIR, data.caseId + '.html'), renderPage(data));
  console.log('✓', data.caseId);
}
console.log(`\n${files.length} pages — matches ScoreArc + DimensionDetailCard + Card.jsx design`);
