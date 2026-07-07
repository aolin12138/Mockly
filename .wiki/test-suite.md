---
title: "Mockly — Test Suite"
type: concept
updated: 2026-07-06
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/live/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/feedback/
  - Pi session 2026-06-23
  - Pi session 2026-07-06 (feedback eval harness)
tags: [mockly, test-suite, elevenlabs, agent-testing]
---

# Mockly — Test Suite

Comprehensive scenario-based test harness for the Mockly ElevenLabs
technical interview agent.

## Overview

- **Agent under test**: `agent_2201ktp0n7mwek6avkphs4x6394m`
- **Branch**: `agtbrch_1301ktp0n97rfn4tkjz5626383hm` (main)
- **Test type**: Live WebSocket text-only conversations
- **Sim-user LLM**: DeepSeek `deepseek-chat` (V3), temperature 0.3
- **Judge LLM**: DeepSeek `deepseek-v4-pro` with `think-high`, temperature 0.0

## Architecture

```
test-suite/
├── live/                  # Live WebSocket harness
│   ├── runner.mjs         # Orchestrator — loads scenarios, runs concurrently
│   ├── run-one.mjs        # Single-scenario runner
│   ├── ws-client.mjs      # ElevenLabs WS client (text-only, no audio)
│   ├── sim-user.mjs       # DeepSeek-simulated candidate
│   ├── judge.mjs          # DeepSeek evaluation against criteria
│   ├── verify.mjs         # Preflight checks
│   └── null-audio.mjs     # Null audio interface (text-only)
├── scenarios/             # 27 scenario JSON files
├── lib/                   # Shared: config, checkpoint, report, loader
├── runner.mjs             # Original simulation runner (limited — no MCP tools)
└── live-report.html       # Latest test run output
```

## Scenarios

27 scenarios covering agent behavior across 4 interview phases (incl.
full-interview arcs, tool-failure probes, phase-transition traps, and
adversarial cases like score-fishing).

⚠ The status table below is from the 2026-06-23 run — stale. The agent has
since moved to `gemini-3.1-pro-preview` with 2 more scenarios passing (see
[decisions](decisions.md) and session 2026-07-06):

| Scenario | Phase | Status |
|----------|-------|--------|
| `clarify_problem` | 1 — Understanding | ✅ Pass (3/3) |
| `thinks_aloud_approach` | 1 | ❌ Fail (leaks solution) |
| `filler_stays_silent` | 1 | ✅ Pass (2/2) |
| `directed_request_for_time` | 1 | ❌ Fail (silent, no ack) |
| `garbled_term_not_echoed` | 1 | ✅ Pass (2/2) |
| `hint_general_first` through `closes_and_ends` | 1–4 | ⏭ 12 skipped (partial_conversation_history) |
| `transitions_phase1_understanding` | 1–2 | ❌ Fail |

## Technical discoveries

### WebSocket injection
`starting_workflow_node_id` can be injected by monkey-patching
`ws.WebSocket.prototype.send` before `Conversation.startSession()`.
The SDK's `webSocketFactory` option does not work because the SDK
uses the `ws` library's EventEmitter API (`.on()`) rather than
browser WebSocket.

### API limitations
- `workflow_node_id` is always `null` in both simulation and WebSocket transcripts
- Simulation API does not expose MCP tools to the agent
- `starting_workflow_node_id` is ignored by the simulation API

### Skip-turn detection
Detecting `client_tool_call` events with `tool_name === 'skip_turn'`
reduces conversation wait time from 120s to 3s per turn.

### MCP response format
MCP tool results are wrapped: `{ content: [{ type: "text", text: "..." }], isError }` —
the inner `text` must be JSON-parsed separately to access actual tool data.

## Running

```bash
cd test-suite
node live/runner.mjs --all --yes          # all scenarios
node live/runner.mjs --scenario clarify_problem --yes  # single
```

## Feedback eval harness

The second harness tests the **technical feedback generator** — a pure-function
n8n workflow that consumes an interview session (transcript + execution summary)
and produces a structured coaching report with scores, dimensions, and
actionable guidance.

### Why it's separate

The live harness tests an **interactive agent** (sim-user speaks, judge
evaluates). The feedback harness tests a **pure function** — fixture in,
webhook call out, deterministic checks. No WebSocket, no sim-user, no
turn-by-turn. Simpler and faster.

### Architecture

```
test-suite/feedback/
├── runner.mjs              # Orchestrator: POST fixtures, run checks, gate
├── report.mjs              # Generates feedback-report.html + per-fixture pages
├── lib/
│   ├── schema-checks.mjs   # Tier 1: 22 field validations (required, types, ranges)
│   └── fact-checks.mjs     # Tier 2: ground-truth assertions per fixture
├── fixtures/               # 7 archetype JSON fixtures
│   ├── solved-clean.json
│   ├── solved-heavy-hints.json
│   ├── partial-edge-fail.json
│   ├── not-solved-silent.json
│   ├── wrong-complexity-claim.json
│   ├── prompt-injection.json
│   └── no-transcript.json
├── scripts/
│   └── patch-workflow.py   # Idempotent n8n workflow patcher (backs up first)
├── n8n-backups/            # Immutable snapshots of the live workflow
└── runs/<timestamp>/       # Per-run: results.json + responses/ + pages/
```

### Grading pipeline

The feedback generator is a 5-node n8n workflow (ID `pbjDnkI5TDO9bto5`):

```
Webhook → Format prompt → GPT-5.2 (Message a model) → Parse & wrap → Respond
```

The backend (`/technical/end`) fetches the conversation transcript (3 attempts
× 3s), packages it with the execution summary (visible tests, hint log, time,
phase, answer key with optimal solutions + mistakes + follow-ups), and POSTs
to the n8n webhook. The LLM grades across 7 dimensions, identifies patterns,
and produces coaching advice (next_steps, patterns_to_study, encouragement,
primary_focus).

### Checks

- **Tier 1 — Schema** (22 checks): required fields, types, score ranges [0-10],
  non-trivial text (≥10 chars), array counts, outcome validity.
- **Tier 2 — Facts**: per-fixture ground-truth — e.g., `solved-clean` must have
  `outcome: solved`, score > 8, `completed: true`; `not-solved-silent` must have
  `outcome: not_solved`, `Code Quality < 8`.
- **Ordering**: 5 transitivity constraints — e.g., `solved-clean` must outscore
  `not-solved-silent` on Correctness, Independence, Technical Communication.
- **Stability**: σ < 1.0 across 3 repeats on non-advisory fixtures.

### Backend fact enforcement

`enforceFactFields()` in `interviewRoutes.js` overwrites LLM-generated facts
(test counts, time, phase, hints_used) from the execution summary post-
generation. The LLM only judges; facts are structural. One validated retry
on invalid JSON feedback.

### Running

```bash
cd test-suite/feedback
node runner.mjs --all --repeats 3   # full suite
node runner.mjs --fixture solved-clean  # single
node report.mjs                       # generate HTML report + pages
```

### Baseline (2026-07-06)

- **126/126 checks**, 42/42 stability cells, 5/5 orderings — PASS
- Max σ on gating fixtures: 0.76
- 7 fixtures, 3 repeats = 21 generated ResultsTechnicalPage replicas
- Primary defect caught: answer key `[object Object]` (fix 5 blocked optimal
  solution from reaching the grader for all prior runs)

### Discovered & patched defects

| # | Defect | Impact | Fix |
|---|--------|--------|-----|
| 1 | hints_used miscount (counted conversational nudge) | False flags on partial-edge-fail | Pin to `HINTS` list length |
| 2 | LLM arithmetic: 5/6 + 3/4 → 9/10 | Wrong percentages in reports | Precompute `TOTAL TESTS PASSED` line |
| 3 | Example-value bleed-through (reached_phase copied from prompt) | All fixtures showed same phase | Mark examples as placeholders |
| 4 | Grader read `results.by_category`/`results.failures` — fields backend never sends | Blind grading | Derive from `visibleTests.details` |
| 5 | Answer key rendered as `[object Object]` — canonical solutions never reached model | Blind grading on all 5 questions | `JSON.stringify` in Format prompt |
| 6 | No contrast between candidate code and canonical solution | Shallow code reviews | Added canonical gap rule to prompt |
| 7 | Independence rubric: do-nothing candidates scored 7–9 (0 hints used) | False confidence | Redefined as progress-without-help; cap ≤5 |
| 8 | Fabricated quotes without transcript + `"None."` coaching | Hallucinated attribution | Banned both in system prompt |
| 9 | No `primary_focus` field — 6 equal dimension cards, no single takeaway | Coaching lost in report clutter | Added imperative headline to prompt + Parse fallback |

## See also

- [overview](overview.md)
- [status](status.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
