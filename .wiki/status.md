---
title: "Mockly — Current Status"
type: concept
updated: 2026-07-06
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/ (directory tree)
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/package.json
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/mcp_plan.md
  - Pi session 2026-06-23
  - Pi session 2026-07-06 (feedback eval harness + question seeding)
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/seed_more_questions.js
tags: [mockly, status, assessment]
---

# Mockly — Current Status

Assessment from codebase + recent development sessions.

## What exists (built)

| Component | Evidence | Confidence |
|-----------|----------|------------|
| **Frontend SPA** | `apps/frontend/src/` exists with test directory | High |
| **Backend API** | `apps/backend/` with server.js, routes, middleware, prisma schema | High |
| **Database schema** | Prisma schema + migrations + seed scripts; now includes `InterviewType` (Technical/Behavioural) with unique constraint per user | High |
| **ElevenLabs BYOK** | `design-system/BYOK.md` — full workflow documented | High |
| **Company profiles** | `Mockly/presets.company_profile.json` (5.7KB) | High |
| **Role rubrics** | `Mockly/presets.role_rubric.json` (17.6KB) | High |
| **AI prompt templates** | `Mockly/prompts/` and `apps/backend/prompts/` directories | High |
| **Build output** | `dist/` directory exists | High |
| **Docker setup** | `docker-compose.yaml` exists | Medium |
| **Design system** | `design-system/` directory with mockly-setup | Medium |
| **MCP server** | `apps/backend/lib/mcp/` — working server with `get_current_code`, `run_code_against_tests`, `log_event` tools | High |
| **ElevenLabs agent** | `agent_2201ktp0n7mwek6avkphs4x6394m` with 4-phase workflow (Understanding → Coding → Assessment → Wrap) + MCP tool integration | High |
| **Live test suite** | `test-suite/` — 27 scenarios, WS harness, sim-user, DeepSeek judge, HTML reports, checkpoint system | High |
| **Feedback eval harness** | `test-suite/feedback/` — 7 fixtures, tier-1/2 checks, ordering + stability gates, report generator with per-fixture page rendering | High |
| **Feedback grader (n8n)** | Workflow `pbjDnkI5TDO9bto5` — 5-node stateless pipeline: Webhook → Format prompt → GPT-5.2 → Parse & wrap → Respond. 10 defects found and patched via `scripts/patch-workflow.py` (idempotent, backs up first) | High |
| **Technical question bank** | 15 DSA problems with full answer keys: 5 original (hash/sliding window/cyclic sort/prefix sum) + 10 new (binary search, linked list, BST, stack, two pointers, heap, DP, BFS). All have optimal solutions with code, common_mistakes, follow_ups, pattern_tags, hint_framework | High |
| **primary_focus coaching** | n8n system prompt emits a single imperative headline backed by strongest signal; Parse node fallback prevents broken pages. Rendered as 🎯 callout band atop every feedback page | High |

## What's WIP

| Component | Evidence | Status |
|-----------|----------|--------|
| **Prompt tuning** | 3 of 6 runnable scenarios fail (behavioural: premature solution naming, silent-timeout instead of acknowledgment) | In progress |
| **partial_conversation_history replay** | 12 scenarios skipped — need prefilled conversation injection for live WS | Planned |
| **DB schema for dual agents** | Migration applied, routes updated, backfill done | Complete |

## What's missing

| Gap | Why it matters |
|-----|---------------|
| No README beyond one line | Project goal, setup, and architecture are undocumented for new contributors |
| No CI/CD config visible | `.github/` exists but contents not inspected |
| Frontend code editor auto-sync | 2s debounced sync to `POST /api/code/sync` implemented; needs frontend verification |

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
