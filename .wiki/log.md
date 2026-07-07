---
title: "Mockly Wiki — Operations Log"
type: reference
updated: 2026-07-06
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

## 2026-07-07 lint | 6 issues, 4 auto-fixed

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
