---
title: "Mockly Wiki — Operations Log"
type: reference
updated: 2026-07-21
sources: []
tags: [meta, log]
---

# Mockly Wiki — Operations Log

Append-only operations log. Use verbs precisely: `ingest` (register + compile),
`update` (compile-only, no new source), `lint` (health check).

## 2026-07-06 ingest | Feedback eval harness + question seeding + primary_focus

**Source:** Pi session 2026-07-06 (2 sessions: eval harness iteration +
question seeding / primary_focus). Journal at
`~/.pi/runs/2026-07-06-feedback-eval-harness/journal.md`.
Session summary at `~/.pi/user/memory/sessions/2026-07-06.md`.

- **Updated:** `overview.md` — bumped updated, added feedback harness + question bank + primary_focus features, corrected Pi session count
- **Updated:** `status.md` — added feedback grader, question bank (15 DSA problems), primary_focus, feedback eval harness to "What exists"
- **Updated:** `test-suite.md` — added full "Feedback eval harness" section (architecture, pipeline, checks, baseline, defect table)
- **Updated:** `decisions.md` — added 6 decisions: n8n stateless pipeline, fact enforcement, answer key flow, question bank seeding, selective staging, primary_focus
- **Created:** `log.md` (this file)

## 2026-07-07 update | Local index created — canonical browse list moved here

Design change following the 2026-07-07 audit: the central pi index duplicated
per-page summaries and drifted immediately (said 4 pages when there were 8).

- **Created:** `index.md` — canonical page list with types, dates, summaries,
  and ⚠ staleness flags. The central pi index now holds only a one-row pointer.
- **Updated:** `test-suite.md`, `status.md` — scenario count corrected 18→27
  (ground-truth error the structural audit missed; drove new §B2 checks in
  the wiki-audit skill)

## 2026-07-21 lint | 5 issues, 4 auto-fixed

- Auto-fixed: `backlog.md` missing from `index.md` — added table entry
- Auto-fixed: `index.md` → `backlog.md` link missing — added
- Auto-fixed: `eval-harness-engineering.md` missing backlink to `decisions.md` — added bidirectional link
- Auto-fixed: `eval-harness-engineering.md` missing backlink to `lessons.md` — added bidirectional link
- INFO (not fixed): `index.md` has one-way links to all pages (expected; pages don't link back to the index)
- INFO (not fixed): `log.md` has one-way links to pages it mentions (expected; reference log)
- INFO (not fixed): `architecture.md` still ⚠ stale (2026-05-31) — predates MCP server, test suites, n8n pipeline, behavioural system, coaching feedback
- INFO (not fixed): `requirements.md` still ⚠ stale (2026-05-31) — predates feedback system, behavioural interviews

### Ground truth verification

- **File count**: index says 10 compiled pages + 11th (log) + 12th (backlog) = 12 total; matches filesystem (12 .md files) ✅
- **Date consistency**: all updated pages show 2026-07-21; `git log -1` for this directory shows recent modifications ✅
- **Link integrity**: 0 broken internal links across 12 files ✅
- **Quantitative claims**: test-suite.md says "0/1118 check failures" — verified by running the harness (100% pass) ✅
- **Staleness sweep**: 2 files still ⚠ stale (architecture, requirements) — not modified in this session, deferred
- **Lifecycle words**: no stale "planned"/"WIP"/"pending" claims in newly updated pages ✅
- **Orphan detection**: `backlog.md` was the only orphan (now in index) ✅

**Source:** Pi session 2026-07-21 (behavioural eval iteration + coaching feedback
architecture + quality criteria implementation). Journal at
`~/.pi/runs/2026-07-07-behavioural-eval-set/journal.md`.
Session summary at `~/.pi/user/memory/sessions/2026-07-21.md` (pending).

- **Updated:** `overview.md` — added behavioural interviews, coaching feedback, web research, STAR diagnostics, dark mode, CI/CD test hierarchy, updated tech stack + feature table + session count
- **Updated:** `status.md` — rebuilt "What exists" table with 20+ new entries (behavioural agent, both behavioural harnesses, smoke test, research enrichment, dark mode, dashboard fixes); updated WIP (oversold hardening, no_praise, human calibration, skip_turn); updated missing gaps
- **Updated:** `test-suite.md` — added full sections for behavioural interview eval harness (two-stage, 9 cases, research packs, oversold escalation), behavioural feedback eval harness (pure function, 23 quality criteria, 1118 checks, 0 failures), smoke test harness (6 workflows, SSE wait), QA audit methodology; added test hierarchy diagram
- **Updated:** `decisions.md` — added 8 decisions: direct DeepSeek for feedback, JWT/CSRF removal, research enrichment, canonical prompt architecture, eval-first-then-sync, dashboard DB routing, incomplete sessions hidden, three-tier test hierarchy
- **Updated:** `eval-harness-engineering.md` — added §8 on quality criteria design (helpfulness proxies, specific-noun heuristic, filler flattery, tech allowlist, cross-field consistency, what quality criteria should NOT do)
- **Updated:** `lessons.md` — added 7 new lessons: oversold escalation, PATCH non-merge, thought text leak, $ref JSON breakage, canonical prompt drift, eval-first pattern, n8n encryption key loss, dashboard heuristic routing, let shadowing
- **Created:** `coaching-feedback.md` — full architecture page: pipeline, canonical prompt, 13-field schema, research enrichment, backend pipeline (202→fire-forget→SSE), frontend rendering (ResultsPage→AnswerCard→StarPipeline→ResourceLinks), error handling matrix, JSON bloat assessment

- Auto-fixed: `lessons.md` missing backlink to `overview.md` (bidirectionality)
- Auto-fixed: `log.md` missing `## See also` section
- Auto-fixed: central pi index said "4 pages", actually 8 — count + pages table updated
- Auto-fixed: central pi index Mockly table missing decisions/lessons/test-suite/log entries
- WARNING (not fixed): `architecture.md` stale (2026-05-31) — says "MCP Server (planned)" but MCP server is implemented; missing test-suite/, n8n feedback pipeline, results components, home demos
- WARNING (not fixed): `requirements.md` stale (2026-05-31) — predates technical feedback system, question bank, primary_focus

## 2026-06-23 ingest | Initial Mockly dossier creation

**Source:** Pi session 2026-06-23 (codebase exploration).

- **Created:** `overview.md`, `architecture.md`, `status.md`, `requirements.md`, `decisions.md`, `test-suite.md`

## See also

- [overview](overview.md)
- [status](status.md)
