---
title: "Mockly — Decisions"
type: decision
updated: 2026-07-06
sources:
  - Pi session 2026-06-23
  - Pi session 2026-07-06 (feedback eval harness + question seeding)
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/feedback/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/prisma/schema.prisma
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/apps/backend/routes/interviewRoutes.js
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

## Feedback grader: n8n stateless pipeline with backend fact enforcement

**Decided 2026-07-06.** Built `test-suite/feedback/` — a pure-function eval
harness for the technical feedback grader (n8n workflow `pbjDnkI5TDO9bto5`).
The grader is a 5-node, fully stateless pipeline; no database, no session
state, no WebSocket. Harness design mirrors the live agent harness but is
simpler: fixture → webhook call → deterministic schema + fact checks (no
sim-user, no judge, no turn-by-turn).

**Why:** The feedback generator is a pure function — same input always
produces same output (modulo LLM variance captured by stability gates). A
WS harness would add complexity without benefit.

**Forecloses:** Testing multi-session progression or user feedback capture —
those would require a different harness shape.

**Auto-patching:** `scripts/patch-workflow.py` applies idempotent fixes to
the live workflow (backs up first, verifies each fix by re-fetch). Not a
migration system — a development utility that prevents manual n8n UI drudgery.

## Fact enforcement: LLM judges, backend owns facts

**Decided 2026-07-06.** The response JSON has two categories: (1) **facts**
(test counts, time, phase, hints_used) that the backend already knows from
the execution summary, and (2) **judgments** (scores, patterns, coaching)
that the LLM produces. `enforceFactFields()` in `interviewRoutes.js`
overwrites category-1 fields from the execution summary post-generation.
The LLM only judges; echo errors on facts are structurally eliminated.

**Why:** The grader repeatedly hallucinated test counts (LLM arithmetic
bugs — 5/6 + 3/4 → 9/10), miscounted hints (conversational nudge vs real
hint), and copied phase from the prompt example. Fixing these as prompt
rules is fragile. Structural overwrite is deterministic.

**Forecloses:** The LLM cannot correct or reinterpret facts — if the
backend's summary is wrong, the report will be wrong. This is acceptable
because the summary is computed from the execution engine.

## Answer key flow: per-question optimal solutions reach the grader

**Decided 2026-07-06.** The DB Question model has `solutions.optimal` (jsonb
with approach + time + space + code). This must reach the grader for
meaningful code assessment. The initial Format prompt node rendered
`q.solutions` as `[object Object]` — the model never saw canonical
solutions for any of the first 5 questions. Fixed with `JSON.stringify`.

**Why:** The grader was scoring code quality without reference — a blind
stylistic check. With the answer key, it contrasts the candidate's
approach against the optimal solution, spots missing optimizations,
identifies pattern gaps.

**Forecloses:** Questions without populated `solutions.optimal` will produce
degraded code assessments. All 15 seeded questions now have this field.

## Question bank seeding: 15 DSA problems across 12 patterns

**Decided 2026-07-06.** Seeded 10 new questions via `seed_more_questions.js`
(upsert pattern following existing scripts) bringing the bank to 15.
Patterns now covered: binary search, fast/slow pointers, BST validation,
stack, two pointers, heap/priority queue (3 variants), expand-around-center,
graph BFS, hash map, sliding window, cyclic sort, prefix sum.

**Why:** 5 questions gave the grader almost no pattern diversity. The grader
works best when it can map candidate behavior to known DSA patterns and
recommend related follow-up problems.

**Forecloses:** Hand-graded gold standards for middle-band calibration
are deferred but easier now — pick 5 representative sessions from the
15-problem bank.

## selective staging workflow for mixed working trees

**Decided 2026-07-06.** The project's working tree contains unrelated
uncommitted work (auth/security refactor, schema changes, docker-compose).
Use `git add <specific-files>` with explicit paths + `git commit` to stage
only the feedback harness work. Reserve `git add -A` for clean-tree moments.

**Why:** Avoided checkout conflicts and accidental commits of in-progress
work. Restored staging mistakes (once committed wrong file set, backed it
out and restaged).

**Forecloses:** Quick `git add .` shortcuts — not safe until the tree is
cleaned up.

## primary_focus: the #1 coaching headline users act on

**Decided 2026-07-06.** Added a `primary_focus` field to the feedback JSON —
a single imperative sentence backed by the strongest signal in the session
(worst dimension, biggest missed pattern, clearest repeated mistake).
Rendered as a prominent 🎯 gradient band at the very top of every feedback
page, above the score circle. If the model omits the field (LLM formatting
flake), a Parse-node fallback injects a placeholder so the page never ships
broken.

**Why:** Six equal-dimension cards is a report, not coaching. Users act on
one thing — the highest-leverage weakness with the strongest evidence.

**Forecloses:** The single-headline constraint biases toward one piece of
advice. Multi-weakness candidates (e.g., "needs algorithm work AND better
communication") will have one dimension picked — the one with the most
decisive evidence. Acceptable because the dimension cards are still present
below the fold.

## See also

- [overview](overview.md)
- [status](status.md)
- [test-suite](test-suite.md)
- [lessons](lessons.md)
