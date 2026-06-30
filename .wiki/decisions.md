---
title: "Mockly — Decisions"
type: decision
updated: 2026-06-23
sources:
  - Pi session 2026-06-23
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/prisma/schema.prisma
tags: [mockly, decisions, architecture]
---

# Mockly — Key Decisions

Recorded decisions that affect future work. Each entry: what was decided,
why, and what it forecloses.

## DB schema: one technical + one behavioural agent per user

**Decided 2026-06-23.** Added `InterviewType` enum (`Technical` | `Behavioural`)
to the `Agent` Prisma model, plus `@@unique([userId, type])`.

**Why:** A user needs both interview modes available simultaneously; the old
schema's implicit "one agent per user" couldn't model that.

**Forecloses:** Multiple agents of the same type per user (e.g., separate
agents for different roles) would require a new schema iteration.

**Migration:** `20260613230000_add_agent_type` — applied + existing agents
backfilled.

## Test suite: live WebSocket harness over simulation API

**Decided 2026-06-23.** Built `test-suite/live/` — a custom WS-based harness
— alongside the original `test-suite/runner.mjs` (simulation-based).
Simulation runner is retained but not the primary path.

**Why:** ElevenLabs simulation API does not expose MCP tools to the agent
under test, and ignores `starting_workflow_node_id`. Both are required to
exercise the actual agent behavior. Live WS does both.

**Forecloses:** Pure-simulation regression in CI without an ElevenLabs
platform key + active MCP server. Tests require live infrastructure.

## Sim-user + judge models: DeepSeek

**Decided 2026-06-23.** Sim-user runs `deepseek-chat` (V3) at temperature 0.3.
Judge runs `deepseek-v4-pro` with `think-high` reasoning at temperature 0.0.

**Why:** Previously used Gemini; ran into API key issues. DeepSeek is cheaper
and the V4-pro reasoning model is sufficient for criteria evaluation.

**Forecloses:** Easy swap back to Gemini would require re-validating judge
behavior on existing scenarios.

## Agent tool surface: MCP-only (no webhook client tools)

**Decided 2026-06-23.** Removed webhook client tools (`get_current_code`,
`run_code_against_tests` as webhook endpoints) from the agent config. Only
`skip_turn` system tool + MCP tools via `mcp_server_ids` remain.

**Why:** Webhook tools and MCP tools with the same names conflicted — the
agent called the broken webhook tools (`localhost:3000`) instead of the
working MCP tools. Removing the duplicates resolved the conflict.

**Forecloses:** Running the agent without an active MCP server. The MCP
server at `mcaiiVJDVZFS5dB7RFN2` is now a hard dependency.

## Test agent vs production agents

**Decided 2026-06-24** (supersedes the earlier "branch IS production" note).

- **Test agent** `agent_2201ktp0n7mwek6avkphs4x6394m` on branch
  `agtbrch_1301ktp0n97rfn4tkjz5626383hm` is the **eval sandbox**. The test
  harness PATCHes it freely; real users never connect to it.
- **Production** is the per-user agents that `apps/backend/routes/interviewRoutes.js`
  provisions via the n8n `agent-create` webhook on first session and updates via
  `agent-config` on template-version drift (Batch 2 — pending implementation).
- The `agent-config` n8n workflow holds the canonical template prompt + workflow
  definition. Promotion = update that template + bump
  `TECHNICAL_AGENT_TEMPLATE_VERSION` env var; existing user agents lazily
  re-PATCH on their next session.

**Why:** This separation lets prompt changes be evaluated end-to-end against
the real ElevenLabs + MCP stack without any production user being exposed to
candidate behaviour.

**Forecloses:** Treating the test agent as production-grade for any user-facing
workflow. Anyone running real interview sessions through the test agent will
see whatever the latest in-progress prompt is.

## Phase tracking: scenario `target_phase`, not API `workflow_node_id`

**Decided 2026-06-23.** Scenarios declare `target_phase` (1–4); the harness
displays phase labels from a static node-ID-to-label map.

**Why:** ElevenLabs returns `workflow_node_id: null` in transcripts (both
simulation and live WS). The phase has to be tracked client-side.

**Forecloses:** Detecting unexpected phase transitions automatically. The
harness only knows what scenario it asked for.

## See also

- [overview](overview.md)
- [status](status.md)
- [test-suite](test-suite.md)
- [lessons](lessons.md)
