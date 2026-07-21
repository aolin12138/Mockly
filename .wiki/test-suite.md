---
title: "Mockly — Test Suite"
type: concept
updated: 2026-07-21
sources:
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/live/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/feedback/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/behavioural/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/behavioural/feedback-eval/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/smoke/
  - E:/OneDrive - The University of Auckland/Desktop/Mockly/Mockly/test-suite/QA-AUDIT.md
  - Pi session 2026-06-23
  - Pi session 2026-07-06 (technical feedback eval harness)
  - Pi session 2026-07-21 (behavioural harnesses + smoke + quality criteria)
tags: [mockly, test-suite, elevenlabs, agent-testing, ci-cd]
---

# Mockly — Test Suite

Comprehensive multi-harness test infrastructure for Mockly. Five harnesses
across three tiers: **smoke** (pipeline integrity), **eval** (output quality),
**Playwright** (UI state transitions — planned).

## Test hierarchy

```
Tier 1 — Smoke (pipeline)          Tier 2 — Eval (output quality)       Tier 3 — UI (state)
─────────────────────────          ──────────────────────────────       ──────────────────
test-suite/smoke/                  test-suite/live/                     (Playwright — planned)
  ↑ fastest, run on every push       test-suite/feedback/
                                    test-suite/behavioural/
                                    test-suite/behavioural/feedback-eval/
                                      ↑ medium, run on PR / nightly
```

## Architecture

```
test-suite/
├── live/                           # Live WebSocket harness (technical)
│   ├── runner.mjs                  # Orchestrator
│   ├── ws-client.mjs               # ElevenLabs WS client
│   ├── sim-user.mjs                # DeepSeek-simulated candidate
│   └── judge.mjs                   # Per-criterion evaluation
├── feedback/                       # Technical feedback eval harness
│   ├── runner.mjs                  # Pure-function: POST → checks
│   ├── lib/schema-checks.mjs       # 22 tier-1 field validations
│   └── lib/fact-checks.mjs         # Per-fixture ground-truth
├── behavioural/                    # Behavioural interview eval harness
│   ├── runner.mjs                  # Two-stage: prompt builder + live WS
│   ├── research.mjs                # Tavily research pack generator
│   ├── feedback-eval/              # Behavioural feedback eval harness
│   │   ├── runner.mjs              # Pure-function + 23 quality criteria
│   │   └── fixtures/               # 9 real + 3 synthetic cases
│   └── scripts/                    # Workflow patches, aggregate reports
├── smoke/                          # CI/CD pipeline smoke tests
│   └── smoke-test.mjs              # 6 workflows, SSE wait, retry logic
├── lib/                            # Shared: config, api-client, checkpoint
├── QA-AUDIT.md                     # Surface audit methodology
└── SKILL.md                        # CI/CD pattern reference
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

## Behavioural interview eval harness (two-stage)

Tests the behavioural interview pipeline end-to-end: prompt generation
AND conversational behaviour. 9 test cases across 3 persona types × 4
role configurations (FAANG grad/mid/senior + quant junior + startup AI).

### Architecture

```
Fixture (case JSON: persona + CV + stage1_checks + stage2_criteria)
  → Stage 1: Generate interview prompt (n8n or direct LLM)
    → Deterministic checks: identity, CV grounding, fabrication, style rules
  → Stage 2: Install prompt on test agent → Live WS conversation
    → Judge: flow arc, drill-down, measurement probe, gap visibility
      → Per-case JSON results + aggregate HTML report
```

### Key components

- `test-suite/behavioural/runner.mjs` — two-stage orchestrator with `--direct`, `--research`, `--stage1-only` flags
- `test-suite/behavioural/research.mjs` — Tavily research pack generator; caches to `fixtures/research/<case-id>.json`
- `test-suite/behavioural/review-report.mjs` — standalone review of run results
- `test-suite/behavioural/scripts/aggregate-report.mjs` — scans all runs

### Test agent

`agent_7401kxffy3hmf2drqtptznj9j9cq` — text-only, `turn_timeout: 60`, research-enriched prompts via prompt builder v2.

### Persona types

| Persona | Ground truth | What it tests |
|---|---|---|
| **aligned** | knowledge ≡ CV | Good candidate gets probed to depth |
| **undersold** | knowledge > CV (`gems[]`) | Interviewer surfaces hidden strengths |
| **oversold** | CV > knowledge (`hollow_claims[]`) | Two-level probing cracks inflated claims |

### Research enrichment

Prompt builder v2 accepts `background_knowledge` (3K chars of domain context)
injected above behavioural instructions. Keyword-driven Tavily queries produce
research packs cached per case. Research is REFERENCE MATERIAL, not a question
bank — the interviewer listens first, draws on knowledge for follow-ups.

### Oversold escalation (3-level crack)

The sim-user cracks under probing, not by describing knowledge gaps, but by
escalating through scripted weak answers: vague → deflect to team → admit
lack of involvement. Two-level measurement probing: "how was that measured?"
→ "what specific tool?"

### Baseline (2026-07-21)

9/9 cases run across multiple batches. Key metrics:
- Oversold `asks_how_measured`: passes (3-level escalation visible)
- `gap_visible`: passes for startup-senior-ai-oversold
- `gap_visible`: still fails for faang-senior-dist-oversold (sim-user too competent, needs script tightening)

### Running

```bash
cd test-suite/behavioural
node runner.mjs --case faang-grad-aligned --direct --research    # single case
node runner.mjs --all --direct --research                        # all 9 cases
node research.mjs --all --force                                  # regenerate research packs
```

## Behavioural feedback eval harness (pure function)

Tests the coaching feedback generator — a pure-function DeepSeek call that
consumes behavioural interview transcripts and produces 13-field coaching
reports. 12 test cases (9 real + 3 synthetic edge cases).

### Architecture

```
Fixture (transcript + CV + persona)
  → DeepSeek API call with canonical prompt
    → Schema checks: 13 required fields, types, ranges
    → STAR quality checks: original_answer ≥50c, why specific,
      all 4 elements present, rewrite > original
    → Quality checks: 23 criteria across 10 sections
    → Cross-field consistency: oversold tech ≤5, aligned avg > oversold avg
      → Per-case JSON + HTML report + feedback pages
```

### Key files

- `test-suite/behavioural/feedback-eval/runner.mjs` — orchestrator with `--all`, `--fixture`, `--no-research` flags
- `apps/backend/prompts/behavioural_feedback.md` — **canonical prompt** (single source of truth, read by both backend and eval)
- `apps/backend/lib/feedbackResearch.mjs` — web research enrichment (shared by backend and eval)
- `test-suite/behavioural/feedback-eval/fixtures/` — 3 synthetic edge cases (short, empty, one-word transcripts)

### 23 quality criteria

Checks across 10 sections verify substance, not just schema presence:

| Section | Checks | Examples |
|---|---|---|
| `overall_assessment` | ≥100c, specific nouns, no filler flattery | `hasSpecificNoun()` regex + `hasFillerFlattery()` patterns |
| `dimension_scores` | note≥20c, evidence anchors, spread≥2 | 6 dims × 2 checks + cross-dim spread |
| `strengths` | per-item: ≥30c + specific noun | Catches generic "improve communication" |
| `areas_for_improvement` | per-item: ≥30c + specific noun | Same as strengths |
| `gap_analysis` | summary≥100c, CV refs, missing_skills short labels | Advisory on label length |
| `project_suggestions` | title≥20c, technologies real, why≥30c | Tech allowlist (89 entries, advisory) |
| `roadmap` | per-item: ≥15c | 3 tiers (immediate/short_term/medium_term) |
| `interview_tips` | obs≥40c, sug≥40c, category valid | 4 valid categories |
| `praise_worthy` | per-item: ≥30c + specific noun | No quantity floors |
| Cross-field | oversold tech_depth≤5, aligned avg > oversold avg | Per-run ordering check |

### Helpfulness proxy

The `hasSpecificNoun()` heuristic detects substance vs. fluff:
- Proper nouns (capitalised mid-sentence)
- Numbers/percentages/metrics
- Known tech keywords (89-entry allowlist)

A section with zero specific nouns is generic fluff regardless of length.

### Baseline (2026-07-21)

- **0/1118 check failures** — 100% pass across 12 cases
- Cross-field ordering: aligned avg 7.4 > oversold avg 4.0 ✅
- Research enrichment: 52% gold resources (GitHub/YouTube/Coursera), 0% junk
- 9 feedback pages generated at `feedback-eval/feedback-pages/<case-id>.html`

### Running

```bash
cd test-suite/behavioural/feedback-eval
node runner.mjs --all                           # all 12 cases
node runner.mjs --fixture faang-grad-aligned   # single case
node runner.mjs --all --no-research             # skip Tavily enrichment
```

## Smoke test harness (pipeline)

Fast CI/CD pipeline tests that verify the end-to-end plumbing works.
6 workflows, runs on every push.

### Architecture

```
test-suite/smoke/
├── smoke-test.mjs      # Orchestrator
└── README.md           # Workflow documentation
```

### Workflows

| Workflow | What it tests | Duration |
|---|---|---|
| `full` | Register → create session → 6 turns → generate feedback → verify | ~3 min |
| `reopen` | Resume existing session → verify transcript preserved | ~1 min |
| `incomplete` | 2-turn session → verify insufficient_data flag → hidden from dashboard | ~1 min |
| `dashboard` | Fetch user interviews → verify only completed sessions returned | ~10s |
| `e2e` | Full lifecycle: login → create → interview → feedback → verify | ~3 min |
| `realistic` | Uses behavioural eval fixture for persona-aware 6-turn interview | ~3 min |

### Key features

- Retry logic: retries `generate-feedback` 3×5s when transcript not ready
- SSE wait: after 202, waits for `feedback-ready` event with 180s timeout + poll fallback
- `MIN_TURNS=4` configurable threshold for completed sessions
- Test user: `smoketest@mockly.com` / `SecurePass123!`

### Running

```bash
cd test-suite/smoke
node smoke-test.mjs --workflow full     # single workflow
node smoke-test.mjs --workflow e2e      # full lifecycle
```

## QA Audit methodology

`test-suite/QA-AUDIT.md` documents a surface audit approach for QA engineering
thinking — systematically scanning the test infrastructure from the outside
to find blind spots, stale assumptions, and untested surfaces.

### Audit pillars

1. **Harness coverage**: every pipeline → at least one test harness
2. **Persona completeness**: aligned + undersold + oversold per surface
3. **Edge case coverage**: empty inputs, minimal data, overflow, error states
4. **Drift detection**: canonical prompt vs eval prompt vs backend prompt
5. **Quantitative verification**: counts, dates, versions matched against filesystem

Applied during this session to discover the canonical prompt drift (eval and
backend used different prompt strings) and the empty transcript edge case.

## See also

- [overview](overview.md)
- [status](status.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [eval-harness-engineering](eval-harness-engineering.md)
- [coaching-feedback](coaching-feedback.md)
