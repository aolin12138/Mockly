#!/usr/bin/env node
/**
 * Fixture review report — renders the behavioural eval fixtures
 * (cases + CVs + persona ground truth + checks) into a single HTML
 * page for human review, BEFORE any runner exists.
 *
 * Usage: node review-report.mjs   → writes fixtures-review.html
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(HERE, 'fixtures', 'cases');
const OUT = join(HERE, 'fixtures-review.html');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal markdown → HTML (headers, bold, lists, paragraphs) for CV rendering. */
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  let html = '', inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const inline = (t) => esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
    if (/^# /.test(line)) { closeList(); html += `<h1>${inline(line.slice(2))}</h1>`; }
    else if (/^## /.test(line)) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>`; }
    else if (/^### /.test(line)) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>`; }
    else if (/^- /.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.slice(2))}</li>`; }
    else if (line === '') { closeList(); }
    else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

const badge = (text, cls) => `<span class="badge ${cls}">${esc(text)}</span>`;

function personaCard(p) {
  let h = `<div class="persona-head"><strong>${esc(p.name)}</strong> ${badge(p.type, p.type)}</div>`;
  h += `<p class="summary">${esc(p.summary)}</p>`;
  if (p.project_knowledge?.length) {
    h += `<h4>What they actually know</h4>`;
    for (const pk of p.project_knowledge) {
      h += `<div class="pk"><div class="pk-item">${esc(pk.cv_item)} ${badge(pk.actual_depth, 'depth')}</div>`;
      if (pk.can_explain?.length) h += `<ul>${pk.can_explain.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      if (pk.cannot_explain?.length) h += `<ul class="cannot">${pk.cannot_explain.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      h += `</div>`;
    }
  }
  if (p.gems?.length) {
    h += `<h4>💎 Gems — real, but NOT on the CV (${p.gems.length})</h4>`;
    for (const g of p.gems) {
      h += `<div class="card gem"><div class="card-title">${esc(g.id)}</div>
        <p>${esc(g.hidden_fact)}</p>
        <p class="meta"><b>CV says:</b> ${esc(g.cv_status)}</p>
        <p class="meta"><b>Reveals when:</b> ${esc(g.reveal_when)}</p></div>`;
    }
  }
  if (p.hollow_claims?.length) {
    h += `<h4>🕳️ Hollow claims — on the CV, can't back them (${p.hollow_claims.length})</h4>`;
    for (const c of p.hollow_claims) {
      h += `<div class="card hollow"><div class="card-title">"${esc(c.cv_claim)}"</div>
        <p><b>Reality:</b> ${esc(c.reality)}</p>
        <p><b>Under probing:</b> ${esc(c.under_probing)}</p>
        <p class="meta"><b>Deflection:</b> ${esc(c.deflection_style)}</p></div>`;
    }
  }
  h += `<h4>Answering style (sim-user brief)</h4><p class="style">${esc(p.answering_style)}</p>`;
  return h;
}

function stage1Table(s1) {
  const rows = [];
  rows.push(['Identity guard (catches prompt-swap)', `must contain any of: ${s1.identity_must_contain_any.map(x => `<code>${esc(x)}</code>`).join(', ')}<br>must NOT contain: ${s1.identity_must_not_contain.map(x => `<code>${esc(x)}</code>`).join(', ')}`]);
  rows.push([`CV grounding (≥${s1.min_entity_references} required)`, s1.must_reference_entities.map(x => `<code>${esc(x)}</code>`).join(', ')]);
  rows.push(['Fabrication canaries (must NOT appear)', s1.must_not_mention.map(x => `<code>${esc(x)}</code>`).join(', ')]);
  rows.push(['Style rules (one alternative per group)', s1.style_rules_must_contain_any.map(g => g.map(x => `<code>${esc(x)}</code>`).join(' <i>or</i> ')).join('<br>')]);
  if (s1.note) rows.push(['Note', esc(s1.note)]);
  return `<table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
}

function stage2Table(criteria) {
  return `<table class="crit">${criteria.map(c =>
    `<tr><th>${esc(c.name)}<div class="cid">${esc(c.id)}</div></th><td>${esc(c.conversation_goal_prompt)}</td></tr>`).join('')}</table>`;
}

const caseFiles = readdirSync(CASES_DIR).filter(f => f.endsWith('.json')).sort();
const cases = caseFiles.map(f => {
  const c = JSON.parse(readFileSync(join(CASES_DIR, f), 'utf-8'));
  c._file = f;
  c._cv = readFileSync(resolve(CASES_DIR, c.cv_file), 'utf-8');
  return c;
});

const sections = cases.map(c => `
<section class="case" id="${esc(c.id)}">
  <h2 class="case-title">${esc(c.id)} ${badge(c.persona.type, c.persona.type)}
    <span class="cfg">${esc(c.config.company_preset)} · ${esc(c.config.seniority_label || c.config.seniority)} · ${esc(c.config.role_title)} · ${c.config.duration_min}min</span></h2>
  <p class="desc">${esc(c.description)}</p>
  <div class="cols">
    <div class="col">
      <h3>📄 CV (what the prompt builder sees)</h3>
      <div class="cv">${mdToHtml(c._cv)}</div>
    </div>
    <div class="col">
      <h3>🎭 Persona ground truth (what the sim-user knows — builder never sees this)</h3>
      ${personaCard(c.persona)}
    </div>
  </div>
  <h3>Stage 1 — checks on the generated interviewer prompt</h3>
  ${stage1Table(c.stage1_checks)}
  <h3>Stage 2 — judge criteria on the live conversation</h3>
  ${stage2Table(c.stage2_criteria)}
  ${c.feedback_expectations ? `<h3>Harness 3 (later) — feedback expectations</h3>
    <table><tr><th>Note</th><td>${esc(c.feedback_expectations.note)}</td></tr>
    ${c.feedback_expectations.must_recommend_cv_additions_for ? `<tr><th>Must recommend adding to CV</th><td>${c.feedback_expectations.must_recommend_cv_additions_for.map(esc).join('; ')}</td></tr>` : ''}
    ${c.feedback_expectations.must_flag_gaps_for ? `<tr><th>Must flag gaps</th><td>${c.feedback_expectations.must_flag_gaps_for.map(esc).join('; ')}</td></tr>` : ''}
    ${c.feedback_expectations.must_not_flag ? `<tr><th>Must NOT flag (false-positive guard)</th><td>${c.feedback_expectations.must_not_flag.map(esc).join('; ')}</td></tr>` : ''}
    </table>` : ''}
  <p class="filepath">source: <code>fixtures/cases/${esc(c._file)}</code> · CV: <code>${esc(c.cv_file)}</code></p>
</section>`).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Behavioural Eval — Fixture Review (faang/grad)</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --ink:#1a1e26; --mut:#5b6472; --line:#e3e7ee; --bg:#f7f8fa; --acc:#3454d1; }
  * { box-sizing: border-box; }
  body { font: 15px/1.55 -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--ink); background: var(--bg); margin: 0; padding: 32px 20px 80px; }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .sub { color: var(--mut); margin-bottom: 8px; }
  .review-ask { background: #fff8e6; border: 1px solid #f0dfad; border-radius: 10px; padding: 14px 18px; margin: 18px 0 30px; }
  .review-ask h3 { margin: 0 0 8px; font-size: 15px; }
  .review-ask li { margin: 3px 0; }
  nav a { margin-right: 14px; color: var(--acc); text-decoration: none; font-weight: 600; }
  section.case { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 26px 30px; margin: 26px 0; box-shadow: 0 1px 3px rgba(20,30,50,.05); }
  .case-title { margin: 0 0 4px; font-size: 20px; }
  .cfg { font-size: 13px; color: var(--mut); font-weight: 500; margin-left: 10px; }
  .desc { color: var(--mut); margin: 4px 0 18px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
  .col h3, section.case > h3 { font-size: 14px; text-transform: uppercase; letter-spacing: .04em; color: var(--mut); margin: 22px 0 10px; }
  .cv { border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; background: #fcfcfd; font-size: 13.5px; }
  .cv h1 { font-size: 18px; margin: 0 0 4px; } .cv h2 { font-size: 14px; margin: 14px 0 4px; color: var(--acc); }
  .cv ul { margin: 4px 0 8px; padding-left: 20px; } .cv p { margin: 4px 0; }
  .badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 20px; vertical-align: middle; text-transform: uppercase; letter-spacing: .05em; }
  .badge.aligned { background: #e3f2e6; color: #1d7a34; }
  .badge.undersold { background: #e4edfb; color: #2456b8; }
  .badge.oversold { background: #fbe7e4; color: #b83a24; }
  .badge.depth { background: #eef0f4; color: var(--mut); }
  .persona-head { font-size: 16px; margin-bottom: 6px; }
  .summary { color: var(--mut); font-size: 13.5px; }
  h4 { margin: 16px 0 8px; font-size: 13px; }
  .pk { border-left: 3px solid #cdd6e4; padding: 4px 12px; margin: 8px 0; font-size: 13px; }
  .pk-item { font-weight: 600; }
  .pk ul { margin: 4px 0; padding-left: 18px; color: #33507a; }
  .pk ul.cannot { color: #a33; }
  .card { border-radius: 10px; padding: 10px 14px; margin: 8px 0; font-size: 13px; }
  .card.gem { background: #f0f7ff; border: 1px solid #cfe3fa; }
  .card.hollow { background: #fdf3f1; border: 1px solid #f3d5cd; }
  .card-title { font-weight: 700; margin-bottom: 4px; }
  .card p { margin: 4px 0; }
  .meta { color: var(--mut); font-size: 12.5px; }
  .style { font-size: 13px; background: #f4f5f8; border-radius: 8px; padding: 10px 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 12px; border: 1px solid var(--line); vertical-align: top; }
  th { background: #f4f6fa; width: 240px; font-weight: 600; }
  table.crit th { width: 260px; }
  .cid { font-weight: 400; font-size: 11.5px; color: var(--mut); font-family: monospace; }
  code { background: #eef0f4; border-radius: 4px; padding: 1px 5px; font-size: 12.5px; }
  .filepath { color: var(--mut); font-size: 12px; margin-top: 16px; }
</style></head>
<body><div class="wrap">
  <h1>Behavioural Eval — Fixture Review</h1>
  <div class="sub">Config: <b>faang / grad / SWE New Grad</b> · 3 personas · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · two-stage pipeline (prompt checks → live behaviour)</div>
  <nav>${cases.map(c => `<a href="#${esc(c.id)}">${esc(c.id)}</a>`).join('')}</nav>
  <div class="review-ask">
    <h3>👀 What to review (your domain — faang/grad)</h3>
    <ul>
      <li><b>CV realism</b> — do these read like real grad CVs (one strong, one thin, one inflated)?</li>
      <li><b>Gems</b> — are these 4 things a FAANG grad loop would actually value surfacing? Would a real interviewer's probing plausibly uncover ≥2?</li>
      <li><b>Hollow claims + deflections</b> — is this how a real overselling candidate behaves under drill-down?</li>
      <li><b>Thresholds</b> — ≥2/4 gems surfaced, ≥2/4 claims probed: too strict / too lenient?</li>
      <li><b>Flow arc</b> — greeting → get-to-know → CV deep-dive → deeper probing → wrap: matches the arc you want?</li>
    </ul>
  </div>
  ${sections}
</div></body></html>`;

writeFileSync(OUT, html);
console.log('wrote', OUT, `(${cases.length} cases)`);
