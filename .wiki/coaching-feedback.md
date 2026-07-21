---
title: "Mockly — Coaching Feedback Architecture"
type: concept
updated: 2026-07-21
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/routes/interviewRoutes.js
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/lib/feedbackResearch.mjs
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/prompts/behavioural_feedback.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/frontend/src/component/page/ResultsPage.jsx
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/frontend/src/component/results/AnswerCard.jsx
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/frontend/src/component/results/StarPipeline.jsx
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/frontend/src/component/results/ResourceLinks.jsx
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/behavioural/feedback-eval/runner.mjs
tags: [mockly, coaching, feedback, architecture]
---

# Coaching Feedback Architecture

End-to-end architecture of the behavioural coaching feedback system — from
transcript to rendered report with research-enriched resources.

## Pipeline overview

```
POST /api/interview/:id/generate-feedback
  → 202 Accepted (immediate)
    → fetchConversationTranscript() from ElevenLabs
    → gate: candidateTurns < 2 → insufficient_data, score 10
    → build prompt (canonical + transcript + CV)
    → DeepSeek API call (~15s)
    → enrichWithResearch() — Tavily queries → 15 resources
    → DB write (feedback JSONB)
    → SSE emit "feedback-ready" to waiting clients
      → Frontend reloads → ResultsPage renders
```

The user navigates away after 202; the fire-and-forget `.then()` callback
completes asynchronously regardless of frontend state.

## Canonical prompt

`apps/backend/prompts/behavioural_feedback.md` is the **single source of
truth**. Both backend and eval harness read the same file — no drift.

### Output schema (13 fields)

```json
{
  "overall_assessment": "string (≥100 chars recommended)",
  "overall_score": "number 1-10",
  "insufficient_data": "boolean (code-gated: turns<2)",
  "dimension_scores": {
    "clarity": { "score": 7, "note": "..." },
    "structure": { "score": 6, "note": "..." },
    "technical_depth": { "score": 5, "note": "..." },
    "ownership": { "score": 8, "note": "..." },
    "impact_framing": { "score": 7, "note": "..." },
    "concise": { "score": 7, "note": "..." }
  },
  "strengths": ["string", "string"],
  "areas_for_improvement": ["string", "string"],
  "gap_analysis": {
    "summary": "string",
    "missing_skills": ["short label ≤120c"],
    "resources": [{ "title": "...", "url": "...", "source": "github", "snippet": "..." }]
  },
  "project_suggestions": [
    {
      "title": "string ≥20c",
      "technologies": ["react", "node.js"],
      "why": "string",
      "resources": [...]
    }
  ],
  "roadmap": {
    "immediate": ["string"],
    "short_term": ["string"],
    "medium_term": ["string"]
  },
  "interview_tips": [
    { "observation": "string ≥40c", "suggestion": "string ≥40c", "category": "delivery|structure|content|positioning" }
  ],
  "interview_prep_resources": [...],
  "praise_worthy": ["string"],
  "star_examples": [
    {
      "question": "string",
      "original_answer": "string (verbatim, ≥50c)",
      "why": "string (specific, reference actual project/tech)",
      "rewritten_star": "string (Situation/Task/Action/Result, all ≥10c)",
      "worth_rewriting": true
    }
  ],
  "transcript": [{ "role": "user|agent", "text": "string" }],
  "research_resources": [...]
}
```

The prompt MUST emit all 13 fields — never omit any (use empty arrays/objects).
Different field subsets break frontend rendering.

## Research enrichment

`feedbackResearch.mjs` enriches feedback with real web resources.

### Query construction

```js
extractSessionConfig(session) → { role, company, seniority }
  // Parses from 3 sources: explicit fields, combined role string,
  // interviewPrompt text — for consistent queries

cleanSkill(skill) → "bullmq"  // Strips "Experience with BullMQ for job queues"
  // Removes long descriptions, returns short tech terms

buildQueries(config, feedback) → [
  { query: "...", target: "project[0]" },   // 3 per project
  { query: "...", target: "gap" },           // 6 for gap analysis
  { query: "...", target: "interview" },     // 2-3 for interview prep
]
```

### Query quality rules

- No `"learn"` prefix (attracts dictionary definitions)
- Anchored with `"hands-on tutorial github {role}"`
- Max 5 queries per feedback generation
- Filter: `JUNK_DOMAINS` = `[dictionary.com, wikipedia.org, reddit.com, britannica.com]`

### Resource distribution

Results are distributed to relevant feedback sections, not flat-dumped:

| Target | Section | Count |
|--------|---------|-------|
| `project[i]` | `project_suggestions[i].resources` | 3 per project |
| `gap` | `gap_analysis.resources` | ~6 |
| `interview` | `interview_prep_resources` | ~2 |

A flat `research_resources` field is also kept for backwards compatibility.

## Backend pipeline

### `POST /api/interview/:id/generate-feedback`

```js
// interviewRoutes.js
router.post('/:id/generate-feedback', async (req, res) => {
  res.status(202).json({ status: 'in_progress' });
  // Fire and forget:
  generateBehaviouralFeedback(sessionId).then(async (feedback) => {
    await prisma.session.update({ data: { feedback } });
    emitFeedbackReady(sessionId, feedback);  // SSE to waiting clients
  }).catch(err => console.error('Feedback generation failed:', err));
});
```

### `generateBehaviouralFeedback()`

1. Fetches ElevenLabs transcript via `fetchConversationTranscript()`
2. Code gate: `candidateTurns < 2 && transcript.length < 100` → `insufficient_data: true`
3. Reads canonical prompt from `apps/backend/prompts/behavioural_feedback.md`
4. Calls DeepSeek with prompt + transcript + CV
5. Parses JSON (with recovery for truncated responses)
6. Calls `enrichWithResearch()` for Tavily resources
7. Returns complete feedback object

### Error handling matrix

| Condition | Response | Behaviour |
|-----------|----------|-----------|
| Transcript unavailable | 202 → error in `.then()` | Feedback never saved; SSE error emitted |
| DeepSeek 503 | retries once, then error | Same as above |
| Bad JSON from DeepSeek | JSON recovery → degraded feedback | Partial feedback saved |
| Config missing (no ElevenLabs key) | 500 | Immediate error |
| Too few candidate turns | `insufficient_data: true`, score 10 | Saved normally; dashboard shows "Incomplete" |

## SSE feedback delivery

### Architecture

```js
// interviewCallbackRoutes.js — exported for async use
const feedbackSseClients = new Map();  // sessionId → Set<Response>
const feedbackEventStore = new Map();  // sessionId → { feedback, timestamp }

function emitFeedbackReady(sessionId, feedback) {
  const clients = feedbackSseClients.get(sessionId);
  clients?.forEach(client => {
    client.write(`event: feedback-ready\ndata: ${JSON.stringify({ status: 'complete' })}\n\n`);
  });
  feedbackEventStore.set(sessionId, feedback);
}
```

The frontend waits for SSE `feedback-ready` event or polls `GET /api/interview/:id/status`
as a fallback.

## Frontend rendering

### `ResultsPage.jsx`

Top-level component that routes to behavioural or technical results based on
`interviewType` from the database.

### `transformFeedbackData(feedback)` → component props

Maps all 13 fields to React component props:
- `dimensionScores` → `DimensionRadar` + `HeroBanner`
- `strengths` / `areas_for_improvement` → `StrengthsImprovements`
- `gap_analysis` → `GapAnalysis` (with `ResourceLinks`)
- `project_suggestions` → `ProjectSuggestions` (with `ResourceLinks`)
- `roadmap` → `Roadmap`
- `interview_tips` → `InterviewTips` (with `ResourceLinks`)
- `star_examples` → `AnswerCard` array with STAR diagnostic pipeline
- `transcript` → `TranscriptCard`
- `insufficientData` → amber "⚠ Limited data" banner

### `AnswerCard.jsx` — STAR diagnostic pipeline

Each answer displays:
1. **Diagnostic pipeline** (`StarPipeline.jsx`): ✓/✗ for each STAR element
   based on ORIGINAL answer quality (via `inferOriginalStar()` heuristic)
2. **"Your answer" box**: verbatim original quote from transcript
3. **"Restructured version"**: full STAR text with labeled paragraphs
   (Situation / Task / Action / Result)
4. **Quality badge**: worth_rewriting status
5. **Observation**: why the answer was flagged or praised

### `inferOriginalStar()` heuristic

Parses the `why` field text to determine which STAR elements were missing
in the original answer:

```js
if (why.includes('lacks a clear Situation')) → S = ✗
if (why.includes('missing metrics'))         → R = ✗
if (worth_rewriting && no specific flag)     → all = ✗
```

### `ResourceLinks.jsx` — shared component

Clickable resource cards with:
- Source badge (GitHub/YouTube/Course/Paper/Article)
- Title + snippet
- External URL
- Embedded inline in `ProjectSuggestions`, `GapAnalysis`, `InterviewTips`

## Quality assurance

### Feedback eval harness

`test-suite/behavioural/feedback-eval/runner.mjs` runs 12 test cases through
the same pipeline (canonical prompt + DeepSeek + research enrichment) and
validates 1118 checks with 0 failures.

### 23 quality criteria

See [eval-harness-engineering §8](eval-harness-engineering.md#§8-quality-criteria-design-beyond-schema-checks)
for the full criteria design, including the specific-noun heuristic, filler
flattery detection, and cross-field consistency checks.

### JSON bloat assessment

Max 33KB per feedback JSON (DeepSeek output ~6KB + resources ~2KB + transcript
embedding). Negligible for PostgreSQL JSONB — well within column size limits.

## See also

- [overview](overview.md)
- [status](status.md)
- [decisions](decisions.md)
- [test-suite](test-suite.md)
- [eval-harness-engineering](eval-harness-engineering.md)
