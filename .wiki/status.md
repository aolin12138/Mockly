---
title: "Mockly — Current Status"
type: concept
updated: 2026-07-21
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/ (directory tree)
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/mcp_plan.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/behavioural/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/smoke/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/lib/feedbackResearch.mjs
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/prompts/behavioural_feedback.md
  - Pi session 2026-06-23
  - Pi sessions 2026-07-06 (feedback eval harness + question seeding)
  - Pi session 2026-07-21 (behavioural eval + coaching feedback + quality criteria)
  - seed_more_questions.js
tags: [mockly, status, assessment]
---

# Mockly — Current Status

Assessment from codebase + development sessions through 2026-07-21.

## What exists (built)

| Component | Evidence | Confidence |
|-----------|----------|------------|
| **Frontend SPA** | `apps/frontend/src/` — React 19 + Vite + Tailwind 4 | High |
| **Backend API** | `apps/backend/` — Express 5, Prisma 7, PostgreSQL, JWT auth | High |
| **Database schema** | Prisma schema + migrations; `InterviewType` (Technical/Behavioural) with unique constraint per user | High |
| **ElevenLabs BYOK** | `design-system/BYOK.md` — full workflow documented | High |
| **Company profiles** | `Mockly/presets.company_profile.json` (5.7KB) | High |
| **Role rubrics** | `Mockly/presets.role_rubric.json` (17.6KB) | High |
| **AI prompt templates** | `Mockly/prompts/` and `apps/backend/prompts/` — canonical `behavioural_feedback.md` shared by backend + eval | High |
| **MCP server** | `apps/backend/lib/mcp/` — `get_current_code`, `run_code_against_tests`, `log_event` tools | High |
| **ElevenLabs technical agent** | `agent_2201ktp0n7mwek6avkphs4x6394m` — 4-phase workflow with MCP tools | High |
| **ElevenLabs behavioural agent** | `agent_7401kxffy3hmf2drqtptznj9j9cq` — text-only, turn_timeout 60s, research-enriched prompts | High |
| **Behavioural interview eval harness** | `test-suite/behavioural/` — two-stage (prompt builder + live WS), 9 cases × 3 personas (aligned/undersold/oversold), research packs via Tavily | High |
| **Behavioural feedback eval harness** | `test-suite/behavioural/feedback-eval/` — pure-function, canonical prompt, 12 cases, 23 quality criteria, 1118 checks, 0 failures | High |
| **Coaching feedback pipeline** | Backend: 202 → fire-forget DeepSeek → DB write → SSE emit. 13-field unified schema. Research enrichment via Tavily | High |
| **Web research enrichment** | `feedbackResearch.mjs` — extracts skills/projects/gaps → Tavily queries → 15 resources distributed to relevant sections | High |
| **STAR diagnostic pipeline** | `StarPipeline.jsx` — ✓/✗ diagnostic per answer, `inferOriginalStar()` heuristic, `AnswerCard.jsx` redesign | High |
| **ResourceLinks component** | `ResourceLinks.jsx` — shared component for clickable resource cards with source badges | High |
| **Smoke test harness** | `test-suite/smoke/` — 6 workflows (full, reopen, incomplete, dashboard, e2e, realistic), SSE wait, retry logic | High |
| **CI/CD test hierarchy** | Three-tier: smoke (pipeline) → eval harnesses (output quality) → Playwright (UI state transitions) | High |
| **QA Audit methodology** | `test-suite/QA-AUDIT.md` — surface audit for QA engineering thinking | High |
| **Dark mode** | Full dark mode with Tailwind `dark:` classes across 15+ components, theme toggle on ResultsPage | High |
| **Dashboard** | Only completed sessions shown, exact timestamps, focus areas parse behavioural/technical correctly | High |
| **Live test suite** | `test-suite/live/` — 27 scenarios, WS harness, sim-user, DeepSeek judge, HTML reports | High |
| **Feedback eval harness (technical)** | `test-suite/feedback/` — 7 fixtures, tier-1/2 checks, ordering + stability gates, 10-defect table | High |
| **Technical question bank** | 15 DSA problems with full answer keys | High |
| **primary_focus coaching** | 🎯 callout band atop feedback pages | High |

## What's WIP

| Component | Evidence | Status |
|-----------|----------|--------|
| **Oversold gap detection hardening** | `faang-senior-dist-oversold` sim-user too competent — needs script tightening like AI oversold case | In progress |
| **no_praise anti-pattern hardening** | Prompt builder occasionally leaks praise patterns ("great point", "that's a great description") | Known issue |
| **Human calibration** | Grade 3 transcripts manually, compare to DeepSeek scores — periodic truth-check, deferred | Planned |
| **Playwright UI tests** | Third tier of CI/CD hierarchy — UI state transition verification; not yet built | Planned |
| **partial_conversation_history replay** | 12 live harness scenarios skipped — need prefilled conversation injection for live WS | Planned |
| **skip_turn tool enablement** | ElevenLabs agent `agent_7401kxffy3hmf2drqtptznj9j9cq` needs `skip_turn` enabled via UI (API PATCH is not deep-merge) | Blocked (UI-only) |

## What's missing

| Gap | Why it matters |
|-----|---------------|
| No README beyond one line | Project goal, setup, and architecture are undocumented for new contributors |
| No CI/CD config visible | Pipeline automation not yet set up (smoke tests exist but not triggered by CI) |
| No inter-rater reliability | Same transcript ×3 runs to measure feedback variance — not yet run |
| Audio mode for behavioural tests | Current agent is text-only; audio mode would validate production behaviour |

## Known limitations

- **ElevenLabs simulation API**: Does not support MCP tools, `workflow_node_id` is always `null`, `starting_workflow_node_id` is ignored
- **ElevenLabs WS API**: `starting_workflow_node_id` injection works via monkey-patching `ws.WebSocket.prototype.send`; the SDK's `webSocketFactory` does not work (SDK uses `ws` library `.on()` API, not browser WebSocket)
- **Tool name display**: MCP tools appear with server prefix (`MocklyMCPServer_get_current_code`) — normalised in test reports

## See also

- [overview](overview.md)
- [architecture](architecture.md)
- [requirements](requirements.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [test-suite](test-suite.md)
- [eval-harness-engineering](eval-harness-engineering.md)
- [coaching-feedback](coaching-feedback.md)
