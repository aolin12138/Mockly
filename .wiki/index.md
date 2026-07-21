---
title: "Mockly Wiki — Index"
type: reference
updated: 2026-07-21
sources: []
tags: [meta, index]
---

# Mockly Wiki — Index

**Canonical browse list** for the Mockly project wiki. The central pi index
(`~/.pi/llm-wiki/index.md`) links here and holds no per-page detail — this
file is the single source of truth for what pages exist.

## Pages

| Page | Type | Updated | Summary |
|------|------|---------|---------|
| [overview](overview.md) | concept | 2026-07-21 | AI-powered interview practice — React 19, Express, ElevenLabs, monorepo; dual-interview modes (technical + behavioural), coaching feedback, CI/CD test hierarchy |
| [architecture](architecture.md) | concept | 2026-05-31 | Directory tree, component graph, dependencies — ⚠ stale: predates MCP server, test suites, n8n feedback pipeline, behavioural system |
| [status](status.md) | concept | 2026-07-21 | What exists (20+ components including behavioural agent, both behavioural harnesses, smoke tests, dark mode, research enrichment), WIP, known limitations |
| [requirements](requirements.md) | reference | 2026-05-31 | 14 functional + 4 non-functional requirements — ⚠ stale: predates feedback system |
| [decisions](decisions.md) | decision | 2026-07-21 | 20 recorded decisions: dual-agent schema, live WS harness, DeepSeek judges, MCP-only tools, n8n feedback pipeline, direct DeepSeek for behavioural feedback, CSRF removal, research enrichment, canonical prompts, dashboard DB routing, three-tier test hierarchy |
| [lessons](lessons.md) | concept | 2026-07-21 | ElevenLabs API traps, oversold escalation, canonical prompt drift, let shadowing, PATCH non-merge, n8n encryption key loss, dashboard heuristic routing |
| [test-suite](test-suite.md) | concept | 2026-07-21 | Five harnesses across three tiers: live agent (27 scenarios), technical feedback eval (7 fixtures), behavioural eval (9 cases, two-stage), behavioural feedback eval (12 cases, 23 quality criteria, 0/1118 failures), smoke test (6 workflows) |
| [eval-harness-engineering](eval-harness-engineering.md) | reference | 2026-07-21 | Three harness archetypes, fixture design, oversold escalation, 10 common mistakes, new-harness build guide, quality criteria design §8 |
| [coaching-feedback](coaching-feedback.md) | concept | 2026-07-21 | Coaching feedback pipeline: canonical prompt, research enrichment, backend 202→SSE, frontend STAR diagnostic rendering (AnswerCard + StarPipeline + ResourceLinks) |
| [log](log.md) | reference | 2026-07-21 | Append-only wiki operations log (ingest / update / lint entries) |
| [backlog](backlog.md) | reference | 2026-07-07 | Edge cases, quality items, deferred work — non-urgent improvement queue |

## Maintenance notes

- **Staleness flags** (⚠) are set during audits; clear them by recompiling the
  page from current sources and bumping `updated:`.
- After any large merge, check whether pages citing changed paths need
  recompiling (see the audit checklist's ground-truth step).
- Keep this table in sync when adding/removing pages — the audit's
  index↔filesystem check runs against **this file**, not the central index.

## See also

- [overview](overview.md) — start here for project orientation
- [eval-harness-engineering](eval-harness-engineering.md) — how to build the next harness
- [log](log.md) — what changed in the wiki and when
