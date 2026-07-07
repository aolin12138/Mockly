---
title: "Mockly Wiki — Index"
type: reference
updated: 2026-07-07
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
| [overview](overview.md) | concept | 2026-07-06 | AI-powered interview practice — React 19, Express, ElevenLabs, monorepo; feature evidence table |
| [architecture](architecture.md) | concept | 2026-05-31 | Directory tree, component graph, dependencies — ⚠ stale: predates MCP server, test suites, n8n feedback pipeline |
| [status](status.md) | concept | 2026-07-06 | What exists (MCP server, both test suites, 15-question bank, primary_focus), WIP, known limitations |
| [requirements](requirements.md) | reference | 2026-05-31 | 14 functional + 4 non-functional requirements — ⚠ stale: predates feedback system |
| [decisions](decisions.md) | decision | 2026-07-06 | 12 recorded decisions: dual-agent schema, live WS harness, DeepSeek judges, MCP-only tools, n8n feedback pipeline, fact enforcement, question seeding, primary_focus |
| [lessons](lessons.md) | concept | 2026-06-23 | ElevenLabs API parity traps, ws monkey-patching, MCP double-wrapping, skip-turn detection |
| [test-suite](test-suite.md) | concept | 2026-07-06 | Live agent WS harness (27 scenarios) + feedback eval harness (7 fixtures, tier-1/2 checks, ordering + stability gates, 10-defect table) |
| [log](log.md) | reference | 2026-07-07 | Append-only wiki operations log (ingest / update / lint entries) |

## Maintenance notes

- **Staleness flags** (⚠) are set during audits; clear them by recompiling the
  page from current sources and bumping `updated:`.
- After any large merge, check whether pages citing changed paths need
  recompiling (see the audit checklist's ground-truth step).
- Keep this table in sync when adding/removing pages — the audit's
  index↔filesystem check runs against **this file**, not the central index.

## See also

- [overview](overview.md) — start here for project orientation
- [log](log.md) — what changed in the wiki and when
