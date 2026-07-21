/**
 * Feedback Research Enrichment
 * 
 * After DeepSeek generates coaching feedback (gap_analysis, project_suggestions, etc.),
 * this module runs targeted Tavily web searches to find real resources — GitHub repos,
 * tutorials, courses, interview guides — and enriches the feedback with clickable links.
 *
 * Query strategy:
 *   1. missing_skills     → "{skill} project tutorial github 2024"
 *   2. project_suggestions → "{project_title} tutorial github {technologies}"
 *   3. interview_tips      → "{company_type} {role} behavioral interview preparation"
 *   4. roadmap items       → "best {item} course tutorial 2024"
 *
 * Max 5 queries per feedback generation to stay within Tavily free tier limits.
 */

const TAVILY_URL = 'https://api.tavily.com/search';

/**
 * Extract { role, company, seniority } consistently from a session/case object.
 * Shared by the production backend AND the eval harness so both build identical
 * research queries. Handles three sources, in priority order:
 *   1. Explicit fields (role/company/seniority or *_preset / position_title)
 *   2. Combined role string "Software Engineer (New Grad) @ faang (grad)"
 *   3. The interviewPrompt text: "interviewer for a {ROLE} role at a {COMPANY} company"
 */
export function extractSessionConfig(source = {}) {
  let role = source.role || source.position_title || source.role_title || '';
  let company = source.company || source.company_preset || '';
  let seniority = source.seniority || source.experience_level || source.seniority_label || '';

  // 2. Parse combined role string: "Software Engineer (New Grad) @ faang (grad)"
  if (role && role.includes('@')) {
    const m = role.match(/^(.*?)\s*@\s*(\S+)\s*(?:\((.*?)\))?/);
    if (m) {
      role = m[1].trim();
      if (!company) company = (m[2] || '').trim();
      if (!seniority) seniority = (m[3] || '').trim();
    }
  }

  // 3. Fall back to parsing the interviewPrompt text
  const prompt = source.interviewPrompt || '';
  if ((!role || !company) && prompt) {
    const m = prompt.match(/interviewer for an?\s+(.+?)\s+role at an?\s+([A-Za-z][\w-]*)/i);
    if (m) {
      if (!role) role = m[1].trim();
      if (!company) company = m[2].trim();
    }
  }

  return {
    role: (role || '').replace(/\s+/g, ' ').trim(),
    company: (company || '').trim(),
    seniority: (seniority || '').trim(),
  };
}
const MAX_QUERIES = 5;
const MAX_RESULTS_PER_QUERY = 3;

// Domains that return dictionary/encyclopedia noise instead of learning resources
const JUNK_DOMAINS = [
  'dictionary.com', 'merriam-webster.com', 'vocabulary.com', 'thefreedictionary.com',
  'en.wikipedia.org', 'britannica.com', 'reddit.com', 'quizlet.com', 'wordnik.com',
];

/**
 * Run a single Tavily search query.
 */
async function tavilySearch(query) {
  const resp = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS_PER_QUERY,
      search_depth: 'basic',
      include_domains: [],
      exclude_domains: [],
    }),
  });
  if (!resp.ok) {
    console.error(`[feedback-research] Tavily error ${resp.status}: ${await resp.text().catch(() => '')}`);
    return { results: [] };
  }
  return resp.json();
}

/**
 * Build search queries from feedback gaps.
 * Returns array of { query, reason } — max MAX_QUERIES.
 */
function buildQueries(feedback, sessionConfig) {
  const queries = [];
  const { role = '', company = '', seniority = '' } = sessionConfig || {};

  // Clean a skill string: strip long descriptions down to core keywords
  const cleanSkill = (s) => {
    return s
      .replace(/^(no|limited|lack of|weak in|insufficient|missing)\s+(demonstrated |experience in |experience with |knowledge of |understanding of |evidence of |mention of )/i, '')
      .replace(/\(.*?\)/g, '') // remove parentheticals
      .replace(/[.,;:]/g, ' ')  // remove punctuation
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  };

  const roleCtx = role ? role.replace(/\(.*?\)/g, '').trim() : 'software engineering';

  // 1. Project suggestions (highest value — real repos matching the exact project)
  //    target: { section: 'project', index } → attaches to project_suggestions[index].resources
  const projects = feedback.project_suggestions || [];
  for (const [index, proj] of projects.slice(0, 2).entries()) {
    const techs = (proj.technologies || []).slice(0, 2).join(' ');
    queries.push({
      query: `${proj.title} tutorial github ${techs}`.trim().replace(/\s+/g, ' ').slice(0, 200),
      reason: `project: ${proj.title}`,
      target: { section: 'project', index },
    });
  }

  // 2. Missing skills → attaches to gap_analysis.resources
  const missingSkills = (feedback.gap_analysis?.missing_skills || []).map(cleanSkill).filter(Boolean);
  for (const skill of missingSkills.slice(0, 2)) {
    if (skill.length < 5 || queries.length >= MAX_QUERIES) continue;
    queries.push({
      query: `${skill} hands-on tutorial github example ${roleCtx}`.replace(/\s+/g, ' ').trim(),
      reason: `missing skill: ${skill}`,
      target: { section: 'gap' },
    });
  }

  // 3. Interview preparation → attaches to interview_prep_resources (near Interview Tips / STAR)
  if (queries.length < MAX_QUERIES) {
    const companyLabel = company?.replace(/_/g, ' ') || '';
    queries.push({
      query: `${companyLabel} ${role} ${seniority} behavioral interview STAR method examples`.replace(/\s+/g, ' ').trim(),
      reason: `interview prep: ${company} ${role}`,
      target: { section: 'interview' },
    });
  }

  return queries.slice(0, MAX_QUERIES);
}

/**
 * Format a single Tavily result set into clean resource cards.
 * Filters out dictionary/encyclopedia noise and caps per-query.
 */
function formatResults(result, seen, max = 3) {
  const out = [];
  for (const item of (result.results || [])) {
    if (!item.url || !item.title) continue;
    const urlLower = item.url.toLowerCase();
    if (JUNK_DOMAINS.some(d => urlLower.includes(d))) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push({
      title: item.title.slice(0, 120),
      url: item.url,
      snippet: (item.content || item.snippet || '').slice(0, 200),
    });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Enrich feedback with web research.
 * 
 * @param {object} feedback - The DeepSeek-generated coaching feedback
 * @param {object} sessionConfig - { role, company, seniority, cv }
 * @returns {object} feedback with added `resources` array
 */
export async function enrichWithResearch(feedback, sessionConfig = {}) {
  if (!process.env.TAVILY_API_KEY) {
    console.warn('[feedback-research] No TAVILY_API_KEY set — skipping research enrichment');
    return feedback;
  }

  const queries = buildQueries(feedback, sessionConfig);
  if (!queries.length) return feedback;

  console.log(`[feedback-research] Running ${queries.length} research queries...`);
  queries.forEach((q, i) => console.log(`  ${i + 1}. [${q.reason}] ${q.query}`));

  try {
    const settled = await Promise.allSettled(
      queries.map(q => tavilySearch(q.query).then(r => ({ ...r, target: q.target })))
    );

    // Deep-clone the parts we mutate so we don't touch the caller's object
    const enriched = {
      ...feedback,
      project_suggestions: (feedback.project_suggestions || []).map(p => ({ ...p })),
      gap_analysis: { ...(feedback.gap_analysis || {}) },
    };

    const seen = new Set();
    const flat = [];        // flat fallback list (back-compat)
    let attached = 0;

    for (const s of settled) {
      if (s.status !== 'fulfilled') continue;
      const { target } = s.value;
      const resources = formatResults(s.value, seen, 3);
      if (!resources.length) continue;
      flat.push(...resources);

      if (target?.section === 'project' && enriched.project_suggestions[target.index]) {
        enriched.project_suggestions[target.index].resources = resources;
        attached += resources.length;
      } else if (target?.section === 'gap') {
        enriched.gap_analysis.resources = [...(enriched.gap_analysis.resources || []), ...resources];
        attached += resources.length;
      } else if (target?.section === 'interview') {
        enriched.interview_prep_resources = [...(enriched.interview_prep_resources || []), ...resources];
        attached += resources.length;
      }
    }

    // Keep flat array for back-compat / any section without a home
    enriched.research_resources = flat;
    console.log(`[feedback-research] Attached ${attached} resources across sections (${flat.length} total unique)`);
    return enriched;
  } catch (err) {
    console.error('[feedback-research] Search failed:', err.message);
    return feedback;
  }
}
