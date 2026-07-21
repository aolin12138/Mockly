---
title: "Mockly — Project Overview"
type: concept
updated: 2026-07-21
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/README.md
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/feedback/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/behavioural/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/smoke/
  - Pi sessions 2026-07-06 (eval harness, question seeding, primary_focus)
  - Pi session 2026-07-21 (behavioural eval + coaching feedback + quality criteria)
tags: [mockly, overview, interview, ai]
---

# Mockly — Project Overview

A web app that allows people to practice interviews through mocked sessions
powered by AI agents. Supports both **technical** (DSA/coding) and
**behavioural** (competency/STAR) interviews with AI-generated coaching
feedback after each session.

## Quick facts

| Attribute | Value |
|-----------|-------|
| Repository | `E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/` |
| Goal | AI-powered interview practice with mocked agent sessions |
| Version | 0.0.0 (private) |
| Type | Monorepo (frontend + backend) |
| Interview modes | Technical (DSA coding), Behavioural (STAR competency) |
| Last modified | 2026-07-21 |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, Framer Motion |
| Backend | Express 5, Prisma 7, PostgreSQL |
| AI models | DeepSeek V3 (prompts), DeepSeek V4 Pro + reasoning (judging/feedback) |
| 3D | Three.js, React Three Fiber |
| Voice | ElevenLabs (JS SDK + React conversational agents) |
| Code execution | Monaco editor, Judge0 |
| Charts | Recharts |
| Document parsing | mammoth (DOCX), pdf-parse |
| Auth | bcrypt, jsonwebtoken (JWT — no CSRF needed) |
| Container | Docker Compose |
| Research | Tavily web search (feedback enrichment) |
| Workflow | n8n (prompt builder, agent provisioning) |
| Testing | Playwright (UI), Node.js test runners

## Key features (from codebase evidence)

| Feature | Evidence |
|---------|----------|
| Interview simulation | README: "practice interview through mocked sessions powered by agents" |
| ElevenLabs voice with BYOK | `design-system/BYOK.md` — full workflow for user-provided API keys with AES-256-GCM encryption |
| Company profiles & role rubrics | `Mockly/presets.company_profile.json` (5.7KB), `Mockly/presets.role_rubric.json` (17.6KB) |
| MCP server for interview tools | `mcp_plan.md` (11.4KB) — detailed plan for tool-calling during interviews |
| Code interview support | Monaco editor dependency, Judge0 for code execution |
| Resume/ doc upload | mammoth + pdf-parse + multer dependencies |
| Analytics dashboard | Recharts dependency; shows only completed sessions with exact timestamps |
| AI prompt templates | `Mockly/prompts/` and `apps/backend/prompts/` directories |
| **Behavioural (STAR) interviews** | `test-suite/behavioural/` — two-stage harness, 9 cases × 3 personas, research-enriched prompts |
| **Coaching feedback pipeline** | Direct DeepSeek calling with async 202 → fire-forget → SSE pattern; 13-field unified schema |
| **Web research enrichment** | `feedbackResearch.mjs` — Tavily queries for real GitHub repos, tutorials, courses attached to feedback |
| **STAR diagnostic pipeline** | `StarPipeline.jsx` — per-answer ✓/✗ diagnostic, `inferOriginalStar()` heuristic, restructured versions |
| **Resource distribution** | `ResourceLinks.jsx` — research results injected into relevant sections (projects, gaps, interview tips) |
| Live test suite | `test-suite/live/` — 27 scenarios, WS harness, sim-user, DeepSeek judge |
| Feedback eval harness | `test-suite/feedback/` — 7 fixtures, tier-1/2 checks, ordering + stability gates |
| Behavioural eval harness | `test-suite/behavioural/` — 9 cases, prompt builder + live WS, research packs |
| Behavioural feedback eval | `test-suite/behavioural/feedback-eval/` — 12 cases, 23 quality criteria, 0/1118 failures |
| Smoke test harness | `test-suite/smoke/` — 6 workflows, SSE wait, retry logic, 180s timeout |
| CI/CD test hierarchy | smoke (pipeline) → eval harnesses (quality) → Playwright (UI state transitions) |
| Technical question bank | 15 DSA problems with full answer keys (optimal solutions, patterns, mistakes, follow-ups) |
| primary_focus coaching | Single imperative headline rendered as 🎯 callout atop feedback pages |
| Dark mode | Full dark mode with Tailwind `dark:` classes across 15+ components |

## Pi session history

12 Pi sessions recorded spanning 2026-04-22 to 2026-07-21. Major milestones:
- 2026-06-23: Initial codebase exploration, MCP server, live test harness
- 2026-07-06: Technical feedback eval harness, question bank seeding, primary_focus
- 2026-07-07: Behavioural interview eval harness, research enrichment, n8n restore
- 2026-07-21: Coaching feedback pipeline, quality criteria, smoke tests, dark mode

See [status](status.md), [decisions](decisions.md), [test-suite](test-suite.md),
[eval-harness-engineering](eval-harness-engineering.md) for session artifacts.

## See also

- [architecture](architecture.md)
- [status](status.md)
- [requirements](requirements.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [test-suite](test-suite.md)
- [eval-harness-engineering](eval-harness-engineering.md)
- [coaching-feedback](coaching-feedback.md)
