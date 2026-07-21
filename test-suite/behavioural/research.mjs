/**
 * Research harness v2 — simplified extractor + keyword-based search.
 *
 * Flow:
 *   CV → extract top 2 projects + keywords + search queries
 *      → parallel Tavily searches (keyword-driven, not LLM-guessed)
 *      → compress into background knowledge
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './_env.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const env = loadEnv();

const TAVILY_KEY = env.TAVILY_API_KEY;
const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const CASES_DIR = join(HERE, 'fixtures', 'cases');

// ── LLM helper ──────────────────────────────────────────────────────
async function callLLM(systemMsg, userMsg, opts = {}) {
  const body = {
    model: opts.model || 'deepseek-chat',
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ],
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens || 4096,
    response_format: opts.json ? { type: 'json_object' } : undefined,
  };
  const resp = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices[0].message.content;
}

// ── Tavily search ────────────────────────────────────────────────────
async function tavilySearch(query) {
  const resp = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TAVILY_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, max_results: 4, include_answer: true }),
  });
  if (!resp.ok) throw new Error(`Tavily ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ── Stage 1: Extract top 2 projects + search queries ────────────────
const EXTRACTOR_SYSTEM = `You extract the top 2 most dive-worthy projects from a CV and formulate web search queries to learn about them.

Rules:
- Pick only projects/jobs the candidate personally built, led, or contributed to.
- Tech stack = ONLY terms explicitly named in the CV. Never guess.
- Skip if the CV has no substantial projects (e.g., only tutoring/IT support).

For each project, generate 2 search queries. Queries must be:
- Formed from the tech terms extracted from the CV — never invent terms.
- Focused on architecture decisions, common tradeoffs, and production challenges in that area.
- Concise (5-12 words).`;

async function extractProjects(cvText) {
  const userMsg = `Extract the top 2 dive-worthy projects from this CV. For each: name, description (one line), tech_stack (exact terms from CV), and 2 search_queries for web research.

CV:
${cvText}

Return JSON: { "projects": [{ "name":"...", "description":"...", "tech_stack":[...], "search_queries":["...","..."] }] }`;

  const raw = await callLLM(EXTRACTOR_SYSTEM, userMsg, { temperature: 0.1, max_tokens: 2048 });
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : raw).projects || [];
  } catch (e) {
    console.error('Extraction parse failed, trying raw:', e.message);
    return [];
  }
}

// ── Stage 2: Research per project (parallel searches) ───────────────
async function researchProject(project) {
  const rawNotes = [];
  const sources = [];

  const results = await Promise.allSettled(
    (project.search_queries || []).map(q => tavilySearch(q))
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const data = r.value;
      if (data.answer) rawNotes.push(data.answer);
      for (const item of (data.results || []).slice(0, 3)) {
        rawNotes.push(`${item.title}: ${item.content}`);
        if (item.url) sources.push(item.url);
      }
    } else {
      console.error(`  Search failed: ${r.reason?.message || r.reason}`);
    }
  }

  return {
    ...project,
    raw_notes: rawNotes.join('\n\n'),
    sources: [...new Set(sources)],
  };
}

// ── Stage 3: Compress research into background knowledge ────────────
const COMPRESSOR_SYSTEM = `You compress web research into a compact "background knowledge" section for an AI interviewer.

This is REFERENCE MATERIAL — not a question bank. The interviewer reads it, then during the interview draws on it to ask smarter FOLLOW-UP questions AFTER the candidate describes their work in their own words.

Rules:
- 3-6 bullet points per project. Keep it tight.
- Architecture-level only: patterns, tradeoffs, common challenges, production pitfalls, recent changes in the field.
- NEVER code-level details (no API parameters, no syntax, no function names).
- NEVER write interview questions — write facts the interviewer can use to formulate questions.
- NEVER invent anything not in the research or the CV.
- Group by project, label clearly.`;

async function compressResearch(researchedProjects) {
  const blocks = researchedProjects
    .filter(p => p.raw_notes)
    .map(p => `### ${p.name}\nTech: ${p.tech_stack.join(', ')}\n\nResearch:\n${p.raw_notes}`)
    .join('\n\n---\n\n');

  if (!blocks) return null;

  const userMsg = `Compress into BACKGROUND KNOWLEDGE for an interviewer prompt. 3-6 bullets per project. Architecture-level only.

${blocks}`;

  const raw = await callLLM(COMPRESSOR_SYSTEM, userMsg, { temperature: 0.2, max_tokens: 2048 });
  return raw;
}

// ── Generate or load cached pack ───────────────────────────────────
const RESEARCH_DIR = join(HERE, 'fixtures', 'research');

async function getOrGeneratePack(caseId) {
  const cacheFile = join(RESEARCH_DIR, `${caseId}.json`);
  try {
    const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
    if (cached.background_knowledge) {
      console.error(`  [cached] Research pack loaded (${(cached.background_knowledge || '').length} chars)`);
      return cached;
    }
  } catch { /* not cached, generate */ }

  return await generatePack(caseId);
}

async function generatePack(caseId) {
  const caseFile = join(CASES_DIR, `${caseId}.json`);
  const caseDef = JSON.parse(readFileSync(caseFile, 'utf-8'));
  const cvPath = join(CASES_DIR, caseDef.cv_file);
  const cvText = readFileSync(cvPath, 'utf-8');

  console.error(`\nResearch pack: ${caseId}`);
  console.error(`CV: ${caseDef.cv_file}\n`);

  // Stage 1
  console.error('── Stage 1: Extract ──');
  const projects = await extractProjects(cvText);
  console.error(`Found ${projects.length} projects:`);
  for (const p of projects) {
    console.error(`  ${p.name}`);
    console.error(`    Tech: ${p.tech_stack.join(', ')}`);
    console.error(`    Queries: ${p.search_queries.join(' | ')}`);
  }

  // Stage 2
  console.error('\n── Stage 2: Search ──');
  const startTime = Date.now();
  const researched = await Promise.all(projects.map(async p => {
    const r = await researchProject(p);
    console.error(`  ${p.name}: ${r.sources.length} sources, ${(r.raw_notes || '').length} chars`);
    return r;
  }));
  console.error(`  Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Stage 3
  console.error('\n── Stage 3: Compress ──');
  const bgKnowledge = await compressResearch(researched);
  console.error(`  ${(bgKnowledge || '').length} chars`);

  // Output
  const pack = {
    case_id: caseId,
    generated_at: new Date().toISOString(),
    projects: researched.map(p => ({
      name: p.name,
      description: p.description,
      tech_stack: p.tech_stack,
      search_queries: p.search_queries,
      sources: p.sources,
    })),
    background_knowledge: bgKnowledge,
  };

  // Save to cache
  const cacheFile = join(RESEARCH_DIR, `${caseId}.json`);
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(RESEARCH_DIR, { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(pack, null, 2));
  console.error(`  Saved to ${cacheFile}`);

  return pack;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const caseId = process.argv[2];
  if (!caseId) { console.error('Usage: node research.mjs <case-id>'); process.exit(1); }

  const force = process.argv.includes('--force');
  if (force) {
    const pack = await generatePack(caseId);
    console.log(JSON.stringify(pack, null, 2));
  } else {
    const pack = await getOrGeneratePack(caseId);
    console.log(JSON.stringify(pack, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
