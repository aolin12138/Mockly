#!/usr/bin/env node
/**
 * Behavioural Feedback Eval Harness
 * 
 * Tests the coaching feedback generator: transcript + CV + role context → coaching report.
 * Pure-function archetype — no WebSocket, no agent, stateless DeepSeek call.
 *
 * Usage:
 *   node runner.mjs --all                        Run all available transcripts
 *   node runner.mjs --case startup-senior-ai-aligned  Run one case
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../_env.mjs';
import { enrichWithResearch, extractSessionConfig } from '../../../apps/backend/lib/feedbackResearch.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HERE = __dirname;
const RUNS_DIR = join(HERE, '..', 'runs');
const FIXTURES_DIR = join(HERE, 'fixtures');
// Single source of truth — same prompt the production backend uses.
const CANONICAL_PROMPT = join(HERE, '..', '..', '..', 'apps', 'backend', 'prompts', 'behavioural_feedback.md');
const FEEDBACK_PROMPT = readFileSync(CANONICAL_PROMPT, 'utf8');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, fb) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fb;
};

if (!flag('all') && !opt('case', null) && !opt('fixture', null)) {
  console.log('Usage: node runner.mjs --all | --case <id> | --fixture <name>');
  process.exit(2);
}

// ── Helpers ──

function md2html(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '\n<li>')
    .replace(/\n/g, '<br>')
    .replace(/<li>/g, '</p><ul><li>')
    .replace(/(<li>.*?)(?=<br>(?!<li>)|$)/g, '$1</li></ul><p>')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

async function callDeepSeek(systemPrompt, userMessage, temperature = 0.3) {
  const key = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY;
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature,
      max_tokens: 8192
    })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

function stripThinking(text) {
  if (!text) return '';
  // Strip <｜end▁of▁thinking｜>/thinking tags
  let out = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  out = out.replace(/<response>|<\/response>/gi, '');
  // Strip leading thinking patterns
  const patterns = [
    /The candidate has (explained|described|provided|shared|chosen|demonstrated)/,
    /This (is|wraps up|aligns with|conversation|interview)/,
    /The (interviewer|conversation|transcript|session)/
  ];
  for (const p of patterns) {
    const idx = out.search(p);
    if (idx > 0 && idx < 100) out = out.substring(0, idx).trim();
  }
  return out.trim();
}

// ── Checks ──

function runSchemaChecks(feedback, label, personaType) {
  const checks = [];
  const isInsufficient = feedback.insufficient_data === true;
  
  // Required top-level fields
  const required = ['overall_assessment', 'dimension_scores', 'gap_analysis', 'project_suggestions', 'roadmap', 'interview_tips', 'praise_worthy', 'insufficient_data', 'star_examples'];
  for (const f of required) {
    checks.push({
      id: `schema_${f}`,
      name: `${label}: has "${f}"`,
      pass: feedback[f] !== undefined && feedback[f] !== null,
      detail: feedback[f] === undefined ? 'missing' : 'present'
    });
  }
  
  // dimension_scores must have all 6 dimensions
  const dims = ['clarity', 'structure', 'technical_depth', 'ownership', 'impact_framing', 'concise'];
  if (feedback.dimension_scores) {
    for (const d of dims) {
      const ds = feedback.dimension_scores[d];
      const scoreOk = ds && typeof ds.score === 'number' && ds.score >= 1 && ds.score <= 10;
      const noteOk = ds && typeof ds.note === 'string' && ds.note.length >= 3;
      checks.push({
        id: `dim_${d}`,
        name: `${label}: dimension "${d}" valid`,
        pass: scoreOk && noteOk,
        detail: !ds ? 'missing' : !scoreOk ? `bad score: ${ds.score}` : `note too short: "${ds.note}"`
      });
    }
  }
  
  // gap_analysis substructure
  if (feedback.gap_analysis) {
    const ga = feedback.gap_analysis;
    checks.push({ id: 'gap_summary', name: `${label}: gap summary non-empty`, pass: typeof ga.summary === 'string' && ga.summary.length >= 20, detail: ga.summary?.length || 0 });
    checks.push({ id: 'gap_missing', name: `${label}: missing_skills is array`, pass: Array.isArray(ga.missing_skills), detail: ga.missing_skills?.length || 0 });
    checks.push({ id: 'gap_market', name: `${label}: market_context non-empty`, pass: typeof ga.market_context === 'string' && ga.market_context.length >= 20, detail: ga.market_context?.length || 0 });
  }
  
  // project_suggestions
  if (feedback.project_suggestions) {
    checks.push({ id: 'projects_count', name: `${label}: ≥1 project suggestion`, pass: Array.isArray(feedback.project_suggestions) && (feedback.project_suggestions.length >= 1 || feedback.insufficient_data === true), detail: feedback.project_suggestions?.length || 0 });
    for (let i = 0; i < (feedback.project_suggestions || []).length; i++) {
      const p = feedback.project_suggestions[i];
      checks.push({
        id: `proj_${i}`,
        name: `${label}: project[${i}] has title+why+technologies+outcome`,
        pass: p.title && p.why && Array.isArray(p.technologies) && p.outcome,
        detail: `title="${p.title?.slice(0, 40)}", techs=${p.technologies?.length || 0}`
      });
    }
  }
  
  // roadmap
  if (feedback.roadmap) {
    const rm = feedback.roadmap;
    checks.push({ id: 'rm_immediate', name: `${label}: roadmap.immediate is array`, pass: Array.isArray(rm.immediate), detail: rm.immediate?.length || 0 });
    checks.push({ id: 'rm_short', name: `${label}: roadmap.short_term is array`, pass: Array.isArray(rm.short_term), detail: rm.short_term?.length || 0 });
  }
  
  // interview_tips
  if (feedback.interview_tips) {
    checks.push({ id: 'tips_count', name: `${label}: ≥1 interview tip`, pass: Array.isArray(feedback.interview_tips) && (feedback.interview_tips.length >= 1 || feedback.insufficient_data === true), detail: feedback.interview_tips?.length || 0 });
    for (let i = 0; i < (feedback.interview_tips || []).length; i++) {
      const t = feedback.interview_tips[i];
      checks.push({
        id: `tip_${i}`,
        name: `${label}: tip[${i}] has category+observation+suggestion`,
        pass: t.category && t.observation && t.suggestion,
        detail: `cat="${t.category}", obs="${t.observation?.slice(0, 40)}"`
      });
    }
  }
  
  // praise_worthy
  if (feedback.praise_worthy) {
    checks.push({ id: 'praise_count', name: `${label}: ≥1 praise item`, pass: Array.isArray(feedback.praise_worthy) && (feedback.praise_worthy.length >= 1 || feedback.insufficient_data === true), detail: feedback.praise_worthy?.length || 0 });
  }

  // insufficient_data
  checks.push({
    id: 'insufficient_data_type',
    name: `${label}: insufficient_data is boolean`,
    pass: typeof feedback.insufficient_data === 'boolean',
    detail: typeof feedback.insufficient_data
  });

  // star_examples
  if (feedback.star_examples) {
    checks.push({
      id: 'star_array',
      name: `${label}: star_examples is array`,
      pass: Array.isArray(feedback.star_examples),
      detail: `length=${feedback.star_examples?.length || 0}`
    });
    for (let i = 0; i < (feedback.star_examples || []).length; i++) {
      const s = feedback.star_examples[i];
      const hasCore = s.question && typeof s.worth_rewriting === 'boolean';
      // rewritten_star only required when worth_rewriting is true
      const hasRewrite = s.worth_rewriting ? !!s.rewritten_star : true;
      checks.push({
        id: `star_${i}_fields`,
        name: `${label}: star[${i}] has question+worth_rewriting${s.worth_rewriting ? '+rewritten_star' : ''}`,
        pass: hasCore && hasRewrite,
        detail: `worth=${s.worth_rewriting}, has_rewrite=${!!s.rewritten_star}`
      });

      // --- QUALITY checks (STAR content, not just schema) ---

      // 1. original_answer must have substance when worth_rewriting=true
      if (s.worth_rewriting) {
        const origLen = (s.original_answer || '').length;
        const hasSubstance = origLen >= 50 || isInsufficient;
        checks.push({
          id: `star_${i}_original`,
          name: `${label}: star[${i}] original_answer ≥ 50 chars`,
          pass: hasSubstance,
          detail: `${origLen}c${isInsufficient?' (insufficient data — OK)':''}`
        });
      }

      // 2. "why" must be specific — not a generic "lacks STAR structure"
      if (s.why) {
        const genericPatterns = [
          /lacks?\s*(STAR|star|structure|framework)\s*$/i,
          /^(needs|requires)\s*(restructur|better\s*structure)\s*$/i,
        ];
        const isGeneric = genericPatterns.some(p => p.test(s.why));
        checks.push({
          id: `star_${i}_why`,
          name: `${label}: star[${i}] "why" is specific (not generic)`,
          pass: !isGeneric,
          detail: s.why.slice(0, 60)
        });
      }

      // 3. Rewrite must have all 4 STAR elements when worth_rewriting=true
      if (s.worth_rewriting && s.rewritten_star) {
        const starValues = ['Situation', 'Task', 'Action', 'Result'].map(l => {
          const re = new RegExp(`${l}:\\s*(.+)`, 'i');
          const m = s.rewritten_star.match(re);
          return m ? (m[1].trim().length >= 10) : false;
        });
        const allFour = starValues.filter(Boolean).length;
        checks.push({
          id: `star_${i}_star_elements`,
          name: `${label}: star[${i}] has all 4 STAR elements (≥10 chars each)`,
          pass: allFour === 4,
          detail: `${allFour}/4 elements`
        });
      }

      // 4. Rewrite should be meaningfully different from original
      if (s.worth_rewriting && s.rewritten_star && s.original_answer) {
        const rewriteLonger = s.rewritten_star.length > s.original_answer.length;
        checks.push({
          id: `star_${i}_rewrite_quality`,
          name: `${label}: star[${i}] rewrite is longer than original (meaningful rewrite)`,
          pass: rewriteLonger,
          detail: `original=${s.original_answer.length}c rewrite=${s.rewritten_star.length}c`
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUALITY CHECKS — verifies substance, not just schema presence
  // ═══════════════════════════════════════════════════════════════

  // ── helpers ──

  const hasSpecificNoun = (text) => {
    if (!text) return false;
    const properNouns = text.match(/\b(?<![\.!?]\s)[A-Z][a-z]+\b|\b[A-Z]{3,}\b/g) || [];
    const numbers = text.match(/\d+(?:\.\d+)?%?/g) || [];
    const techPattern = /\b(?:python|javascript|typescript|react|node\.?js|docker|kubernetes|aws|gcp|azure|postgres(?:ql)?|redis|kafka|mongodb|sql|graphql|rest|api|git|github|ci\/cd|terraform|linux|llm|gpt|langchain|vector|embedding|pgvector|pinecone|qdrant|faiss|ml|machine.learning|tensorflow|pytorch|huggingface|mcp|grpc|http|tcp|websocket|protobuf|k8s|prometheus|grafana|clickhouse|elasticsearch|cassandra|spark|airflow|dbt|snowflake|fastapi|flask|django|rails|spring|go|rust|c\+\+|java|scala|swift|kotlin|flutter|tailwind|next\.?js|vite|webpack|pandas|numpy|scipy|scikit|matplotlib|plotly|jupyter|quantlib|backtrader|streamlit|langgraph|langsmith|openai|anthropic|gemini|deepseek)\b/gi;
    return properNouns.length > 0 || numbers.length > 0 || techPattern.test(text);
  };

  const hasFillerFlattery = (text) => {
    if (!text) return false;
    const patterns = [
      /\b(great candidate|excellent candidate|strong candidate|outstanding)\b/i,
      /\b(would hire|definitely hire|hire them|recommend hiring)\b/i,
      /\b(excellent communication|great communication|strong communication)\b(?!.*\b(specific|example|instance|when|during|such as)\b)/i,
    ];
    return patterns.some(p => p.test(text));
  };

  const KNOWN_TECHS = new Set((
    'python,javascript,typescript,react,node.js,nodejs,docker,kubernetes,aws,gcp,azure,' +
    'postgresql,postgres,redis,kafka,mongodb,sql,graphql,rest,api,git,github,ci/cd,terraform,' +
    'linux,llm,gpt,langchain,vector,embedding,pgvector,pinecone,qdrant,faiss,ml,machine learning,' +
    'tensorflow,pytorch,huggingface,mcp,grpc,http,tcp,websocket,protobuf,k8s,prometheus,grafana,' +
    'clickhouse,elasticsearch,cassandra,spark,airflow,dbt,snowflake,fastapi,flask,django,rails,' +
    'spring,go,rust,c++,java,scala,swift,kotlin,flutter,tailwind,next.js,nextjs,vite,webpack,' +
    'pandas,numpy,scipy,scikit,matplotlib,plotly,jupyter,quantlib,backtrader,streamlit,langgraph,' +
    'langsmith,openai,anthropic,gemini,deepseek'
  ).split(',').map(s=>s.trim()).filter(Boolean));

  // ── 1. overall_assessment ──
  if (!isInsufficient && feedback.overall_assessment) {
    const a = feedback.overall_assessment;
    checks.push({ id: 'qual_assmt_len', name: `${label}: overall_assessment ≥ 100 chars`, pass: a.length >= 100, detail: `${a.length}c` });
    checks.push({ id: 'qual_assmt_noun', name: `${label}: overall_assessment has specific nouns`, pass: hasSpecificNoun(a), detail: a.slice(0, 60) });
    checks.push({ id: 'qual_assmt_flatter', name: `${label}: overall_assessment no filler flattery`, pass: !hasFillerFlattery(a), detail: 'ok' });
  }

  // ── 2. dimension_scores ──
  if (feedback.dimension_scores) {
    const dims = ['clarity','structure','technical_depth','ownership','impact_framing','concise'];
    for (const d of dims) {
      const ds = feedback.dimension_scores[d];
      if (!ds) continue;
      if (!isInsufficient) {
        checks.push({ id: `qual_dim_${d}_len`, name: `${label}: ${d} note ≥ 20 chars`, pass: (ds.note||'').length >= 20, detail: `"${(ds.note||'').slice(0,30)}"` });
        if (ds.note) checks.push({ id: `qual_dim_${d}_ev`, name: `${label}: ${d} note has evidence`, pass: hasSpecificNoun(ds.note), detail: ds.note.slice(0,40) });
      }
    }
    const scores = dims.map(d => feedback.dimension_scores[d]?.score||0);
    const spread = Math.max(...scores)-Math.min(...scores);
    checks.push({ id: 'qual_dim_spread', name: `${label}: dimension scores spread ≥ 2`, pass: isInsufficient || spread >= 2, detail: `spread=${spread} (${scores})` });
  }

  // ── 3. strengths (advisory: if non-empty, each must have substance) ──
  for (let i=0; i<(feedback.strengths||[]).length; i++) {
    const s = feedback.strengths[i];
    if (typeof s === 'string' && s.length>0 && !isInsufficient)
      checks.push({ id: `qual_str_${i}`, name: `${label}: strength[${i}] ≥30c + specific`, pass: s.length>=30 && hasSpecificNoun(s), detail: `${s.length}c` });
  }

  // ── 4. areas_for_improvement ──
  for (let i=0; i<(feedback.areas_for_improvement||[]).length; i++) {
    const a = feedback.areas_for_improvement[i];
    if (typeof a === 'string' && a.length>0 && !isInsufficient)
      checks.push({ id: `qual_area_${i}`, name: `${label}: area[${i}] ≥30c + specific`, pass: a.length>=30 && hasSpecificNoun(a), detail: `${a.length}c` });
  }

  // ── 5. gap_analysis ──
  if (feedback.gap_analysis) {
    const ga = feedback.gap_analysis;
    if (!isInsufficient && ga.summary) {
      checks.push({ id: 'qual_gap_len', name: `${label}: gap summary ≥ 100 chars`, pass: ga.summary.length>=100, detail: `${ga.summary.length}c` });
      checks.push({ id: 'qual_gap_cv', name: `${label}: gap summary refs CV vs transcript (advisory)`, pass: true, detail: /\b(cv|résumé|claim|demonstrat|transcript|interview|reveal|show|gap|between|versus|vs)\b/i.test(ga.summary) ? '✅ refs found' : '❓' });
    }
    for (let i=0; i<(ga.missing_skills||[]).length; i++)
      checks.push({ id: `qual_gap_sk_${i}`, name: `${label}: missing_skill[${i}] is short label (advisory)`, pass: true, detail: `${ga.missing_skills[i].length}c ${ga.missing_skills[i].length>120?'(long, consider shortening)':'✅'}` });
  }

  // ── 6. project_suggestions ──
  for (let i=0; i<(feedback.project_suggestions||[]).length; i++) {
    const p = feedback.project_suggestions[i];
    if (p.title)
      checks.push({ id: `qual_proj_${i}_t`, name: `${label}: project[${i}] title ≥20 chars`, pass: p.title.length>=20, detail: `${p.title.length}c` });
    for (let ti=0; ti<(p.technologies||[]).length; ti++) {
      const t = p.technologies[ti].toLowerCase().replace(/\s*\(.*?\)\s*/g, '').split(/[\/,]/).map(s=>s.trim()).filter(Boolean);
      for (const sub of t) {
        checks.push({
          id: `qual_proj_${i}_t${ti}`, name: `${label}: tech "${p.technologies[ti]}" is real (advisory)`,
          pass: true, // advisory — no allowlist is complete
          detail: KNOWN_TECHS.has(sub) ? `✅ ${sub}` : `❓ "${sub}" not in allowlist`
        });
      }
    }
  }

  // ── 7. roadmap ──
  if (feedback.roadmap)
    for (const tier of ['immediate','short_term','medium_term'])
      for (let i=0; i<(feedback.roadmap[tier]||[]).length; i++)
        if (typeof feedback.roadmap[tier][i]==='string' && feedback.roadmap[tier][i].length>0)
          checks.push({ id: `qual_rm_${tier}_${i}`, name: `${label}: roadmap.${tier}[${i}] ≥15 chars`, pass: feedback.roadmap[tier][i].length>=15, detail: `${feedback.roadmap[tier][i].length}c` });

  // ── 8. interview_tips ──
  for (let i=0; i<(feedback.interview_tips||[]).length; i++) {
    const t = feedback.interview_tips[i];
    if (!isInsufficient && t.observation) checks.push({ id: `qual_tip_${i}o`, name: `${label}: tip[${i}].obs ≥40 chars`, pass: t.observation.length>=40, detail: `${t.observation.length}c` });
    if (!isInsufficient && t.suggestion) checks.push({ id: `qual_tip_${i}s`, name: `${label}: tip[${i}].sug ≥40 chars`, pass: t.suggestion.length>=40, detail: `${t.suggestion.length}c` });
    if (t.category) checks.push({ id: `qual_tip_${i}c`, name: `${label}: tip[${i}].cat valid`, pass: ['delivery','structure','content','positioning'].includes(t.category), detail: t.category });
  }

  // ── 9. praise_worthy ──
  for (let i=0; i<(feedback.praise_worthy||[]).length; i++) {
    const p = feedback.praise_worthy[i];
    if (typeof p==='string' && p.length>0 && !isInsufficient)
      checks.push({ id: `qual_praise_${i}`, name: `${label}: praise[${i}] ≥30c + specific noun`, pass: p.length>=30 && hasSpecificNoun(p), detail: `${p.length}c` });
  }

  // ── 10. Persona-specific consistency ──
  if (personaType === 'oversold' && feedback.dimension_scores?.technical_depth) {
    checks.push({
      id: 'qual_oversold_td', name: `${label}: oversold technical_depth ≤ 5`,
      pass: feedback.dimension_scores.technical_depth.score <= 5,
      detail: `td=${feedback.dimension_scores.technical_depth.score}`
    });
  }

  return checks;
}

// ── Main ──

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function generateFeedbackPage(caseId, personaType, role, fb) {
  const ga = fb.gap_analysis || {};
  const rm = fb.roadmap || {};
  const proj = fb.project_suggestions || [];
  const tips = fb.interview_tips || [];
  const dims = fb.dimension_scores || {};
  const dimKeys = Object.keys(dims);
  const avg = dimKeys.length ? (dimKeys.reduce((s,k)=>s+(dims[k]?.score||0),0)/dimKeys.length).toFixed(1) : '?';
  const scorePct = Math.round((avg / 5) * 100);
  const pColors = {aligned:'emerald',oversold:'amber',undersold:'sky'};
  const pc = pColors[personaType] || 'slate';

  const starFmt = n => '★'.repeat(Math.max(0, n||0)) + '☆'.repeat(Math.max(0, 10-(n||0)));
  const tagColors = {open_source:'emerald',side_project:'blue',portfolio_piece:'violet',course:'amber',certification:'rose'};
  const catC = {delivery:'blue',structure:'amber',content:'emerald',positioning:'violet'};

  // ScoreArc SVG (matching ScoreArc.jsx)
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (scorePct / 100) * circumference;

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coaching Feedback — ${esc(caseId)}</title>
<style>
/* ── Tailwind-like design system matching ResultsPage ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:248 250 252; --bg-card:255 255 255; --border:226 232 240; --text:30 41 59; --text-muted:100 116 139; --text-dim:148 163 184;
  --emerald-50:236 253 245; --emerald-200:167 243 208; --emerald-600:5 150 105; --emerald-700:4 120 87;
  --amber-50:255 251 235; --amber-200:253 230 138; --amber-600:217 119 6; --amber-700:180 83 9;
  --blue-50:239 246 255; --blue-200:191 219 254; --blue-600:37 99 235; --blue-700:29 78 216;
  --violet-50:245 243 255; --violet-200:221 214 254; --violet-600:124 58 237; --violet-700:109 40 217;
  --red-50:254 242 242; --red-200:254 202 202; --red-600:220 38 38; --red-700:185 28 28;
  --rose-50:255 241 242; --rose-600:225 29 72;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:2 6 23; --bg-card:15 23 42; --border:255 255 255; --text:226 232 240; --text-muted:148 163 184; --text-dim:100 116 139;
  }
}
body{
  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
  background:rgb(var(--bg)); color:rgb(var(--text)); line-height:1.6;
  min-height:100vh;
}
/* Ambient background glow */
body::before{
  content:''; position:fixed; top:-40%; left:-20%; width:140%; height:140%;
  background:radial-gradient(ellipse at 30% 20%, rgba(16,185,129,0.04) 0%, transparent 50%),
             radial-gradient(ellipse at 70% 60%, rgba(99,102,241,0.03) 0%, transparent 50%);
  pointer-events:none;z-index:0;
}
.container{max-width:900px;margin:0 auto;padding:32px 24px;position:relative;z-index:1}

/* Card — matching Card.jsx */
.card{
  background:rgb(var(--bg-card)); border:1px solid rgba(var(--border),0.5);
  border-radius:16px; padding:28px; margin-bottom:24px;
  box-shadow:0 12px 34px -24px rgba(15,23,42,0.35);
  position:relative; overflow:hidden;
}
.card::before{
  content:''; position:absolute; inset:0;
  background:linear-gradient(135deg, rgba(var(--bg),0.6), transparent);
  opacity:0; transition:opacity 0.5s; border-radius:16px; pointer-events:none;
}
.card:hover::before{opacity:1}

/* Typography */
h1{font-size:1.5rem;font-weight:700;color:rgb(var(--text));margin-bottom:4px;text-transform:capitalize}
h2{font-size:1.15rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px}
h3{font-size:0.9rem;color:rgb(var(--text-muted));margin-bottom:8px}

/* Pills — matching badge styles */
.pill{display:inline-block;padding:3px 12px;border-radius:999px;font-size:0.72rem;font-weight:700;letter-spacing:0.3px;margin-right:6px;margin-bottom:4px}
.pill-emerald{background:rgb(var(--emerald-50)/0.6);border:1px solid rgb(var(--emerald-200)/0.8);color:rgb(var(--emerald-700))}
.pill-amber{background:rgb(var(--amber-50)/0.6);border:1px solid rgb(var(--amber-200)/0.8);color:rgb(var(--amber-700))}
.pill-sky{background:rgb(var(--blue-50)/0.6);border:1px solid rgb(var(--blue-200)/0.8);color:rgb(var(--blue-700))}
.pill-role{background:rgba(var(--border),0.3);border:1px solid rgba(var(--border),0.4);color:rgb(var(--text-muted))}

/* Hero layout — matching HeroBanner */
.hero-body{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.hero-text{flex:1;min-width:0}
.hero-overall{color:rgb(var(--text-muted));font-size:0.9rem;line-height:1.7;margin-top:8px}

/* ScoreArc SVG */
.score-arc text{font-family:system-ui,sans-serif}

/* Dimension grid */
.dims-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.dim-card{background:rgba(var(--bg),0.6);border:1px solid rgba(var(--border),0.3);border-radius:12px;padding:16px}
.dim-name{font-weight:600;font-size:0.85rem;text-transform:capitalize}
.dim-stars{color:#f59e0b;float:right;letter-spacing:1px}
.dim-note{font-size:0.8rem;color:rgb(var(--text-muted));margin-top:4px}

/* Two-column boxes */
.cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.box{border-radius:12px;padding:18px}
.box-amber{background:rgb(var(--amber-50)/0.5);border:1px solid rgb(var(--amber-200)/0.6)}
.box-emerald{background:rgb(var(--emerald-50)/0.5);border:1px solid rgb(var(--emerald-200)/0.6)}
.box-slate{background:rgba(var(--bg),0.5);border:1px solid rgba(var(--border),0.3)}
.box-title{font-weight:700;font-size:0.85rem;margin-bottom:10px}
.box-amber .box-title{color:rgb(var(--amber-700))}
.box-emerald .box-title{color:rgb(var(--emerald-700))}
.box ul{padding-left:18px;font-size:0.83rem;color:rgb(var(--text-muted))}
.box li{margin-bottom:4px}
.dot{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:6px;flex-shrink:0}
.dot-amber{background:rgb(var(--amber-600))}.dot-emerald{background:rgb(var(--emerald-600))}

/* Project grid */
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.proj-card{background:rgba(var(--bg),0.6);border:1px solid rgba(var(--border),0.3);border-radius:12px;padding:18px;display:flex;flex-direction:column}
.proj-type{font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:6px;margin-bottom:10px;display:inline-block;width:fit-content}
.pt-emerald{background:rgb(var(--emerald-50)/0.7);color:rgb(var(--emerald-700))}
.pt-blue{background:rgb(var(--blue-50)/0.7);color:rgb(var(--blue-700))}
.pt-violet{background:rgb(var(--violet-50)/0.7);color:rgb(var(--violet-700))}
.pt-amber{background:rgb(var(--amber-50)/0.7);color:rgb(var(--amber-700))}
.proj-title{font-weight:700;font-size:0.88rem;margin-bottom:6px}
.proj-why{font-size:0.8rem;color:rgb(var(--text-muted));margin-bottom:8px;flex:1;line-height:1.5}
.proj-techs{margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px}
.tech-tag{background:rgba(var(--border),0.2);color:rgb(var(--text-muted));padding:2px 7px;border-radius:5px;font-size:0.7rem;font-family:'SF Mono','Fira Code',monospace}
.proj-outcome{font-size:0.78rem;color:rgb(var(--emerald-600));border-top:1px solid rgba(var(--border),0.3);padding-top:10px;margin-top:auto;line-height:1.5}

/* Roadmap */
.road-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.road-col{border-radius:12px;padding:18px;border-left:3px solid}
.road-immediate{border-color:rgb(var(--amber-600));background:rgb(var(--amber-50)/0.3)}
.road-short{border-color:rgb(var(--blue-600));background:rgb(var(--blue-50)/0.3)}
.road-medium{border-color:rgb(var(--violet-600));background:rgb(var(--violet-50)/0.3)}
.road-col h3{font-size:0.85rem;font-weight:700;margin-bottom:10px}
.road-col ul{padding-left:16px;font-size:0.82rem;color:rgb(var(--text-muted))}
.road-col li{margin-bottom:5px;line-height:1.5}

/* Tips */
.tip-card{border-radius:12px;padding:18px;margin-bottom:10px}
.tip-delivery{background:rgb(var(--blue-50)/0.4);border:1px solid rgb(var(--blue-200)/0.5)}
.tip-structure{background:rgb(var(--amber-50)/0.4);border:1px solid rgb(var(--amber-200)/0.5)}
.tip-content{background:rgb(var(--emerald-50)/0.4);border:1px solid rgb(var(--emerald-200)/0.5)}
.tip-positioning{background:rgb(var(--violet-50)/0.4);border:1px solid rgb(var(--violet-200)/0.5)}
.tip-cat{font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:6px;margin-bottom:8px;display:inline-block}
.tip-obs{font-size:0.83rem;color:rgb(var(--text-muted));margin-bottom:8px;line-height:1.5}
.tip-sug{font-size:0.83rem;color:rgb(var(--emerald-600));background:rgb(var(--emerald-50)/0.3);border:1px solid rgb(var(--emerald-200)/0.4);border-radius:10px;padding:12px;line-height:1.5}

/* Praise */
.praise-list{padding-left:18px}
.praise-list li{font-size:0.85rem;color:rgb(var(--text-muted));margin-bottom:8px;line-height:1.5}
.praise-card{background:rgb(var(--emerald-50)/0.4);border:1px solid rgb(var(--emerald-200)/0.5);border-radius:10px;padding:14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:8px}
.praise-dot{width:6px;height:6px;border-radius:50%;background:rgb(var(--emerald-600));margin-top:7px;flex-shrink:0}

@media(max-width:640px){.cols2,.road-cols,.proj-grid,.hero-body{grid-template-columns:1fr}}

/* Subtle section subtitle */
.section-sub{color:rgb(var(--text-dim));font-size:0.82rem;margin-bottom:16px}

.transcript-list{display:flex;flex-direction:column;gap:12px;max-height:600px;overflow-y:auto;padding:4px;border-radius:12px}
.transcript-turn{border-radius:10px;padding:12px 16px;max-width:90%}
.turn-agent{align-self:flex-start;background:rgb(var(--panel));border:1px solid rgb(var(--border))}
.turn-user{align-self:flex-end;background:rgba(var(--emerald-600),0.08);border:1px solid rgba(var(--emerald-600),0.2)}
.turn-role{font-size:0.65rem;text-transform:uppercase;font-weight:700;color:rgb(var(--text-dim));margin-bottom:4px;letter-spacing:0.5px}
.turn-text{font-size:0.82rem;line-height:1.5;color:rgb(var(--text))}
</style></head>
<body>
<div class="container">

  <!-- React app link -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
    <a href="http://localhost:5173/results/test?sample=${caseId}" target="_blank" style="color:#10b981;text-decoration:none;font-size:0.85rem;font-weight:600;border:1px solid rgba(var(--emerald-600),0.3);padding:6px 14px;border-radius:8px">🔗 Open in React App →</a>
  </div>

  <!-- Hero Banner — matching HeroBanner.jsx -->
  <div class="card">
    <span class="pill pill-${pc}">${(personaType||'').toUpperCase()}</span>
    <span class="pill pill-role">${esc(role)}</span>
    <h1>${esc((caseId||'').replace(/_/g,' '))}</h1>
    <div class="hero-body" style="margin-top:16px">
      <svg width="90" height="90" viewBox="0 0 100 100" class="score-arc">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(var(--border),0.3)" stroke-width="7"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--emerald-600))" stroke-width="7"
          stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"
          transform="rotate(-90 50 50)" style="transition:stroke-dashoffset 1s ease"/>
        <text x="50" y="49" text-anchor="middle" font-size="18" font-weight="700" fill="rgb(var(--text))">${avg}</text>
        <text x="50" y="66" text-anchor="middle" font-size="10" fill="rgb(var(--text-dim))">/5</text>
      </svg>
      <div>
        <div style="font-weight:600;font-size:0.9rem">Overall Assessment</div>
        <div style="color:rgb(var(--text-dim));font-size:0.8rem">6 dimensions scored</div>
      </div>
    </div>
    <p class="hero-overall">${esc(fb.overall_assessment)}</p>
  </div>

  <!-- Skill Assessment — matching DimensionRadar -->
  <div class="card">
    <h2>📊 Skill Assessment</h2>
    <div class="dims-grid">
      ${dimKeys.map(k=>`<div class="dim-card"><div class="dim-name">${k.replace(/_/g,' ')}<span class="dim-stars">${starFmt(dims[k]?.score)}</span></div><div class="dim-note">${esc(dims[k]?.note)}</div></div>`).join('')}
    </div>
  </div>

  <!-- Gap Analysis — matching StrengthsImprovements layout -->
  <div class="card">
    <h2>🔍 Gap Analysis</h2>
    ${ga.summary?`<p style="color:rgb(var(--text-muted));margin-bottom:16px;font-size:0.9rem;line-height:1.6">${esc(ga.summary)}</p>`:''}
    <div class="cols2">
      ${Array.isArray(ga.missing_skills)&&ga.missing_skills.length?`<div class="box box-amber"><div class="box-title">⚠ Missing Skills</div><ul>${ga.missing_skills.map(s=>`<li><span class="dot dot-amber"></span>${esc(s)}</li>`).join('')}</ul></div>`:''}
      ${Array.isArray(ga.under_communicated_strengths)&&ga.under_communicated_strengths.length?`<div class="box box-emerald"><div class="box-title">💎 Under-communicated Strengths</div><ul>${ga.under_communicated_strengths.map(s=>`<li><span class="dot dot-emerald"></span>${esc(s)}</li>`).join('')}</ul></div>`:''}
    </div>
    ${ga.market_context?`<div class="box box-slate" style="margin-top:14px"><div class="box-title">📈 Market Context</div><p style="font-size:0.83rem;color:rgb(var(--text-muted));line-height:1.6">${esc(ga.market_context)}</p></div>`:''}
  </div>

  <!-- Project Suggestions — matching card grid -->
  ${proj.length?`<div class="card"><h2>🚀 Project Suggestions</h2><p class="section-sub">Concrete projects to close the gaps. Each gives you something specific to talk about in your next interview.</p><div class="proj-grid">
    ${proj.map(p=>`<div class="proj-card">
      <span class="proj-type pt-${tagColors[p.type]||'blue'}">${esc((p.type||'').replace(/_/g,' '))}</span>
      <div class="proj-title">${esc(p.title)}</div>
      <div class="proj-why">${esc(p.why)}</div>
      ${Array.isArray(p.technologies)&&p.technologies.length?`<div class="proj-techs">${p.technologies.map(t=>`<span class="tech-tag">${esc(t)}</span>`).join('')}</div>`:''}
      ${p.outcome?`<div class="proj-outcome"><strong>After completing:</strong> ${esc(p.outcome)}</div>`:''}
    </div>`).join('')}
  </div></div>`:''}

  <!-- Roadmap — matching NextStepsList pattern -->
  ${rm?`<div class="card"><h2>🗺️ Roadmap</h2><div class="road-cols">
    ${[{key:'immediate',label:'⚡ This Week',items:rm.immediate,cls:'road-immediate'},{key:'short_term',label:'📅 This Month',items:rm.short_term,cls:'road-short'},{key:'medium_term',label:'🎯 3 Months',items:rm.medium_term,cls:'road-medium'}].map(ph=>{
      const items=Array.isArray(ph.items)?ph.items:[];
      return `<div class="road-col ${ph.cls}"><h3>${ph.label}</h3>${items.length?`<ul>${items.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:`<p style="font-size:0.8rem;color:rgb(var(--text-dim));font-style:italic">Nothing planned yet</p>`}</div>`;
    }).join('')}
  </div></div>`:''}

  <!-- Interview Tips — matching StrengthsImprovements card pattern -->
  ${tips.length?`<div class="card"><h2>💡 Interview Tips</h2><p class="section-sub">Based on specific moments from your transcript. Actionable changes for your next interview.</p>
    ${tips.map(t=>`<div class="tip-card tip-${t.category||'delivery'}">
      <span class="tip-cat pt-${catC[t.category]||'blue'}">${esc(t.category)}</span>
      <div class="tip-obs"><strong>You did:</strong> ${esc(t.observation)}</div>
      <div class="tip-sug"><strong>Try instead:</strong> ${esc(t.suggestion)}</div>
    </div>`).join('')}
  </div>`:''}

  <!-- Praise — matching StrengthsImprovements -->
  ${Array.isArray(fb.praise_worthy)&&fb.praise_worthy.length?`<div class="card"><h2>🌟 What Went Well</h2>
    ${fb.praise_worthy.map(s=>`<div class="praise-card"><div class="praise-dot"></div><span>${esc(s)}</span></div>`).join('')}
  </div>`:''}

  <!-- Interview Transcript -->
  ${typeof fb.transcript === 'string' && fb.transcript.trim() ? `<div class="card"><h2>📝 Interview Transcript</h2>
    <div class="transcript-list">${fb.transcript.split(/(?=INTERVIEWER:|CANDIDATE:)/).map(block => {
      const isInterviewer = block.startsWith('INTERVIEWER:');
      const role = isInterviewer ? 'Interviewer' : 'Candidate';
      const text = block.replace(/^(INTERVIEWER|CANDIDATE):\s*/,'').trim();
      return `<div class="transcript-turn ${isInterviewer?'turn-agent':'turn-user'}">
        <div class="turn-role">${role}</div>
        <div class="turn-text">${esc(text)}</div>
      </div>`;
    }).join('')}</div>
  </div>` : ''}

</div>
</body></html>`;
}

async function main() {
  const env = await loadEnv();
  // Populate process.env so shared backend modules (feedbackResearch) can read keys
  for (const [k, v] of Object.entries(env || {})) {
    if (!process.env[k]) process.env[k] = v;
  }
  
  // Find available transcripts — aggregate across ALL run directories, deduplicate by case ID
  // Priority: synthetic fixtures > most recent behavioural run
  let transcripts = [];
  const seenCases = new Set();
  
  // 1. Check for synthetic fixture transcripts
  try {
    const synthFiles = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    for (const f of synthFiles) {
      const data = JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8'));
      if (data.transcript && data.id) {
        transcripts.push({ source: 'synthetic', file: f, path: join(FIXTURES_DIR, f), id: data.id });
        seenCases.add(data.id);
      }
    }
  } catch (e) { /* fixtures dir may be empty */ }
  
  // 2. Aggregate from behavioural eval runs (all directories, latest transcript per case)
  try {
    const runDirs = readdirSync(RUNS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .sort()
      .reverse(); // newest first
    
    for (const dir of runDirs) {
      const files = readdirSync(join(RUNS_DIR, dir.name))
        .filter(f => f.endsWith('.json') && !f.startsWith('_'));
      for (const file of files) {
        const data = JSON.parse(readFileSync(join(RUNS_DIR, dir.name, file), 'utf8'));
        const caseId = data.id || file.replace('.json', '');
        // Skip empty transcripts so we fall through to an older run that has the full conversation
        const turnCount = Array.isArray(data.transcript) ? data.transcript.length : 0;
        if (!seenCases.has(caseId) && turnCount > 0) {
          transcripts.push({ source: 'behavioural_run', run: dir.name, file, path: join(RUNS_DIR, dir.name, file), id: caseId });
          seenCases.add(caseId);
        }
      }
    }
  } catch (e) {
    if (transcripts.length === 0) {
      console.error('No runs or fixtures found. Run behavioural eval first, or add synthetic fixtures.');
      console.error('Error:', e.message);
      process.exit(1);
    }
  }
  
  if (opt('case', null)) {
    const filter = opt('case');
    transcripts = transcripts.filter(t => t.id === filter || t.file.includes(filter));
    if (transcripts.length === 0) {
      console.error(`No transcript found for "${filter}". Available: ${[...seenCases].join(', ')}`);
      process.exit(1);
    }
  }
  
  if (opt('fixture', null)) {
    const filter = opt('fixture');
    transcripts = transcripts.filter(t => t.source === 'synthetic' && (t.id === filter || t.file.includes(filter)));
    if (transcripts.length === 0) {
      console.error(`No fixture found for "${filter}". Available synthetic: ${transcripts.filter(t => t.source === 'synthetic').map(t => t.id).join(', ')}`);
      process.exit(1);
    }
  }
  
  console.log(`Behavioural Feedback Eval — ${transcripts.length} case(s) [${transcripts.filter(t => t.source === 'synthetic').length} synthetic, ${transcripts.filter(t => t.source === 'behavioural_run').length} from runs]`);
  
  const allResults = [];
  
  for (const t of transcripts) {
    const caseData = JSON.parse(readFileSync(t.path, 'utf8'));
    const caseId = caseData.id || t.id || t.file?.replace('.json', '');
    const transcript = caseData.transcript || [];
    
    if (!transcript.length) {
      console.log(`⚠ ${caseId}: empty transcript — generating with no conversation data`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`CASE: ${caseId}  [${caseData.personaType || 'unknown'}]`);
    console.log(`Transcript: ${transcript.length} turns`);
    
    // Build user message
    const transcriptText = transcript
      .filter(turn => turn.who !== 'SYSTEM')
      .map(turn => `${turn.who}: ${turn.text}`)
      .join('\n\n');
    
    const researchPack = caseData.researchPack || '';
    const cvText = caseData.cvText || '';
    const role = caseData.role || '';
    const desc = caseData.description || '';

    // Normalise research pack — may be object from eval runner or string from fixture
    const researchText = typeof researchPack === 'string' ? researchPack : 
      (researchPack?.background_knowledge || researchPack?.summary || JSON.stringify(researchPack).slice(0, 500));
    
    const userMessage = [
      '## Session Config',
      `Role: ${role}`,
      `Description: ${desc}`,
      '',
      '## CV',
      cvText || '(not provided)',
      '',
      '## Domain Background',
      researchText || '(not available)',
      '',
      '## Interview Transcript',
      transcriptText
    ].join('\n');
    
    // Generate feedback
    console.log('Generating feedback...');
    const start = Date.now();
    let feedbackJson;
    try {
      const raw = await callDeepSeek(FEEDBACK_PROMPT, userMessage);
      const cleaned = stripThinking(raw);
      // Extract JSON — handle code fences and incomplete responses
      let jsonStr = cleaned;
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1];
      jsonStr = jsonStr.trim();
      // Try to recover truncated JSON
      if (!jsonStr.endsWith('}')) {
        let depth = 0, inStr = false, esc = false;
        for (const ch of jsonStr) {
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') inStr = !inStr;
          if (!inStr) { if (ch === '{') depth++; if (ch === '}') depth--; }
        }
        if (inStr) jsonStr += '"';  // close unterminated string
        jsonStr += '}'.repeat(Math.max(0, depth));
      }
      feedbackJson = JSON.parse(jsonStr);
      console.log(`  Generated in ${Date.now() - start}ms`);

      // Enrich with web research (real projects, tutorials, courses).
      // Uses the SAME extractSessionConfig() as the production backend so queries align.
      if (!flag('no-research')) {
        const sessionConfig = extractSessionConfig(caseData);
        const enriched = await enrichWithResearch(feedbackJson, sessionConfig);
        feedbackJson = enriched;
        console.log(`  Research: ${feedbackJson.research_resources?.length || 0} resources (role='${sessionConfig.role}' company='${sessionConfig.company}' seniority='${sessionConfig.seniority}')`);
      }
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
      allResults.push({
        caseId,
        persona: caseData.personaType,
        error: e.message,
        checks: [{ id: 'generation', name: 'Feedback generation succeeded', pass: false, detail: e.message }]
      });
      continue;
    }
    
    // Run checks
    const checks = runSchemaChecks(feedbackJson, caseId, caseData.personaType);
    const failed = checks.filter(c => !c.pass);
    
    console.log(`  ${failed.length === 0 ? 'ALL PASS' : `${failed.length}/${checks.length} FAIL`}`);
    for (const c of failed) console.log(`    ✗ ${c.name} — ${c.detail}`);
    
    const result = {
      caseId,
      persona: caseData.personaType,
      role,
      transcriptLen: transcript.length,
      generatedInMs: Date.now() - start,
      checks,
      failedCount: failed.length,
      totalCount: checks.length,
      feedback: feedbackJson,
      // Store truncated context for report
      cvPreview: cvText?.slice(0, 200),
      researchPreview: researchText?.slice?.(0, 200) || String(researchText).slice(0, 200)
    };
    
    allResults.push(result);

    // Generate individual coaching feedback page (ResultsPage layout)
    const feedbackDir = join(HERE, 'feedback-pages');
    mkdirSync(feedbackDir, { recursive: true });
    const pageHtml = generateFeedbackPage(caseId, caseData.personaType, result.role, feedbackJson);
    writeFileSync(join(feedbackDir, `${caseId}.html`), pageHtml);

    // Also write sample JSON for React app rendering at localhost:5173/results/test?sample=<case-id>
    const samplesDir = join(dirname(dirname(dirname(HERE))), 'public', 'samples');
    mkdirSync(samplesDir, { recursive: true });
    // Add transcript from case data (not in DeepSeek output) and normalize score to 0-100
    const sampleTranscript = (caseData.transcript || []).map(t => ({
      role: (t.who || t.speaker || t.role || '') === 'INTERVIEWER' || (t.who || t.speaker || t.role || '') === 'agent' || (t.who || t.speaker || t.role || '') === 'assistant' ? 'assistant' : 'user',
      text: t.text || t.message || ''
    }));
    const samplePayload = {
      ...feedbackJson,
      transcript: sampleTranscript,
      overall_score: (feedbackJson.overall_score || 0) * 10,
    };
    writeFileSync(join(samplesDir, `${caseId}.json`), JSON.stringify(samplePayload, null, 2));
  }
  
  // Save
  const reportDir = join(HERE, 'runs', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

  // ── Cross-case consistency: aligned avg > oversold avg ──
  const alignedCases = allResults.filter(r => r.persona === 'aligned' && r.feedback?.overall_score != null);
  const oversoldCases = allResults.filter(r => r.persona === 'oversold' && r.feedback?.overall_score != null);
  if (alignedCases.length > 0 && oversoldCases.length > 0) {
    const alignedAvg = alignedCases.reduce((s,r) => s + r.feedback.overall_score, 0) / alignedCases.length;
    const oversoldAvg = oversoldCases.reduce((s,r) => s + r.feedback.overall_score, 0) / oversoldCases.length;
    const orderingOk = alignedAvg > oversoldAvg;
    console.log(`\nCross-case ordering: aligned avg ${alignedAvg.toFixed(1)} > oversold avg ${oversoldAvg.toFixed(1)} = ${orderingOk ? '✅' : '❌'}`);
    // Add a synthetic check to each result for the report
    for (const r of allResults) {
      r.checks.push({
        id: 'cross_ordering', name: 'Cross-case: aligned avg > oversold avg',
        pass: orderingOk,
        detail: `aligned=${alignedAvg.toFixed(1)} oversold=${oversoldAvg.toFixed(1)}`
      });
    }
  }
  mkdirSync(reportDir, { recursive: true });
  for (const r of allResults) {
    writeFileSync(join(reportDir, `${r.caseId}.json`), JSON.stringify(r, null, 2));
  }
  
  // Generate HTML report
  const reportHtml = generateReport(allResults);
  writeFileSync(join(HERE, 'feedback-report.html'), reportHtml);
  
  const totalFailed = allResults.reduce((s, r) => s + (r.failedCount || 0), 0);
  const totalChecks = allResults.reduce((s, r) => s + (r.totalCount || 0), 0);
  console.log(`\nReport: feedback-report.html (${allResults.length} cases, ${totalFailed}/${totalChecks} check failures)`);
  console.log(`Results: ${reportDir}`);
  console.log('Done.');
}

function generateReport(results) {
  const rows = results.map(r => {
    const passed = (r.totalCount || 0) - (r.failedCount || 0);
    const pct = r.totalCount ? Math.round(passed / r.totalCount * 100) : 0;
    return `
    <div class="case">
      <div class="case-header">
        <span class="badge persona-${r.persona || 'unknown'}">${r.persona || '?'}</span>
        <h2>${r.caseId}</h2>
        <span class="stats">${passed}/${r.totalCount} checks (${pct}%) · ${r.transcriptLen || 0} turns · ${r.generatedInMs || 0}ms</span>
        <a href="http://localhost:5173/results/test?sample=${r.caseId}" target="_blank" class="react-link" style="margin-left:auto;font-size:0.8rem;color:#10b981;text-decoration:none;font-weight:600">🔗 React View →</a>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">📋 Schema Checks (${r.failedCount || 0} failed)</div>
        <div class="section-body">
          ${(r.checks || []).map(c => `<div class="check ${c.pass ? 'pass' : 'fail'}">${c.pass ? '✓' : '✗'} ${c.name} ${c.detail ? `<span class="detail">— ${c.detail}</span>` : ''}</div>`).join('')}
        </div>
      </div>
      
      ${r.feedback ? `
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">📝 Overall Assessment</div>
        <div class="section-body markdown">${md2html(r.feedback.overall_assessment)}</div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">📊 Dimension Scores</div>
        <div class="section-body">
          ${r.feedback.dimension_scores ? Object.entries(r.feedback.dimension_scores).map(([dim, ds]) => `
            <div class="dim-row">
              <span class="dim-name">${dim}</span>
              <span class="dim-score">${'★'.repeat(Math.max(0, ds.score || 0))}${'☆'.repeat(Math.max(0, 10 - (ds.score || 0)))} ${ds.score}/10</span>
              <span class="dim-note">${ds.note || ''}</span>
            </div>
          `).join('') : '<em>No dimension scores</em>'}
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">🔍 Gap Analysis</div>
        <div class="section-body markdown">
          <h4>Summary</h4>
          <p>${md2html(r.feedback.gap_analysis?.summary)}</p>
          <h4>Missing Skills</h4>
          <ul>${(r.feedback.gap_analysis?.missing_skills || []).map(s => `<li>${s}</li>`).join('')}</ul>
          <h4>Under-communicated Strengths</h4>
          <ul>${(r.feedback.gap_analysis?.under_communicated_strengths || []).map(s => `<li>${s}</li>`).join('')}</ul>
          <h4>Market Context</h4>
          <p>${md2html(r.feedback.gap_analysis?.market_context)}</p>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">🚀 Project Suggestions (${(r.feedback.project_suggestions || []).length})</div>
        <div class="section-body">
          ${(r.feedback.project_suggestions || []).map(p => `
            <div class="project-card">
              <h4>${p.title || 'Untitled'}</h4>
              <span class="badge">${p.type || 'project'}</span>
              <p><strong>Why:</strong> ${md2html(p.why)}</p>
              <p><strong>Technologies:</strong> ${(p.technologies || []).join(', ')}</p>
              <p><strong>Interview outcome:</strong> ${md2html(p.outcome)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">🗺️ Roadmap</div>
        <div class="section-body">
          <h4>⚡ Immediate (this week)</h4>
          <ul>${(r.feedback.roadmap?.immediate || []).map(s => `<li>${s}</li>`).join('')}</ul>
          <h4>📅 Short-term (this month)</h4>
          <ul>${(r.feedback.roadmap?.short_term || []).map(s => `<li>${s}</li>`).join('')}</ul>
          <h4>🎯 Medium-term (3 months)</h4>
          <ul>${(r.feedback.roadmap?.medium_term || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">💡 Interview Tips (${(r.feedback.interview_tips || []).length})</div>
        <div class="section-body">
          ${(r.feedback.interview_tips || []).map(t => `
            <div class="tip-card">
              <span class="badge">${t.category || 'tip'}</span>
              <p><strong>Observation:</strong> ${md2html(t.observation)}</p>
              <p><strong>Suggestion:</strong> ${md2html(t.suggestion)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="section">
        <div class="section-header" onclick="this.nextElementSibling.classList.toggle('hidden')">🌟 Praise-worthy</div>
        <div class="section-body">
          <ul>${(r.feedback.praise_worthy || []).map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
      ` : '<div class="section">⚠ Feedback generation failed</div>'}
    </div>`;
  }).join('');
  
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Feedback Eval Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; color: #1a1a2e; padding: 20px; max-width: 1100px; margin: auto; }
  h1 { font-size: 1.5rem; margin-bottom: 20px; }
  h2 { font-size: 1.15rem; }
  h4 { font-size: 0.95rem; margin: 8px 0 4px; color: #374151; }
  .case { background: white; border-radius: 10px; padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .case-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
  .persona-aligned { background: #d1fae5; color: #065f46; }
  .persona-oversold { background: #fee2e2; color: #991b1b; }
  .persona-undersold { background: #dbeafe; color: #1e40af; }
  .stats { color: #6b7280; font-size: 0.85rem; }
  .section { margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
  .section-header { background: #f9fafb; padding: 8px 12px; cursor: pointer; font-weight: 600; font-size: 0.9rem; user-select: none; }
  .section-header:hover { background: #f3f4f6; }
  .section-body { padding: 12px; }
  .section-body.hidden { display: none; }
  .check { padding: 3px 0; font-size: 0.85rem; }
  .check.pass { color: #059669; }
  .check.fail { color: #dc2626; }
  .detail { color: #9ca3af; font-size: 0.8rem; }
  .dim-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 0.9rem; }
  .dim-name { width: 140px; font-weight: 600; text-transform: capitalize; }
  .dim-score { color: #f59e0b; letter-spacing: 1px; }
  .dim-note { color: #6b7280; font-size: 0.85rem; }
  .project-card, .tip-card { background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 8px; }
  .project-card h4 { margin-top: 0; }
  .markdown p { margin: 6px 0; }
  .markdown ul { padding-left: 20px; margin: 4px 0; }
  .markdown code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
  .markdown strong { color: #1f2937; }
</style></head><body>
<h1>📊 Behavioural Feedback Eval Report</h1>
<p style="color:#6b7280;margin-bottom:20px">${results.length} case(s) · Schema validation + content review</p>
${rows}
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });
