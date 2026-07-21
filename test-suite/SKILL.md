# Mockly Test Suite — Skill & CI/CD Pattern

## Core Principle

**Every change type has a corresponding harness. Test in the harness first. Sync to production after verification.**

```
┌──────────────────────────────────────────────────┐
│                  PROPOSED CHANGE                  │
│                                                    │
│  ┌─────────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Prompt text? │ │ Pipeline?│ │ New component? │  │
│  │    ↓         │ │    ↓     │ │      ↓         │  │
│  │ Eval harness │ │Smoke test│ │ Visual diff    │  │
│  └─────────────┘ └──────────┘ └───────────────┘  │
│         │              │              │            │
│         └──────────────┼──────────────┘            │
│                        ↓                            │
│              ALL PASS? ───→ Sync to production     │
│              FAIL?     ───→ Fix in harness first   │
└──────────────────────────────────────────────────┘
```

## When to use which harness

| You're changing... | Use harness | Command |
|---|---|---|
| Interview prompt builder (meta-prompt) | `behavioural` | `node test-suite/behavioural/runner.mjs --direct --research --stage1-only` |
| Interviewer behaviour (sim-user scripts, judge criteria) | `behavioural` | `node test-suite/behavioural/runner.mjs --direct --research` |
| Coaching feedback prompt (transcript → coaching JSON) | `feedback-eval` | `node test-suite/behavioural/feedback-eval/runner.mjs` |
| Technical code grading prompt | `feedback` | `node test-suite/feedback/runner.mjs --all` |
| Backend pipeline (API, n8n, DB, SSE, ElevenLabs) | `smoke` | `node test-suite/smoke/smoke-test.mjs` |
| ElevenLabs WebSocket scenarios | `live` | `node test-suite/live/runner.mjs --scenario <id>` |

## Harness Catalog

### 1. Smoke Test (`test-suite/smoke/`)
**What:** Full pipeline integration test. Real backend, real n8n, real ElevenLabs, real DB.

**Covers:** login, session creation, n8n callback, ElevenLabs conversation, feedback generation, SSE streaming, results page rendering.

**When:** Any backend change (routes, middleware, config, n8n workflow URLs). Run before merging to develop.

**Independence:** Uses isolated test user (`smoketest@mockly.com`) — never pollutes real user data.

### 2. Behavioural Eval (`test-suite/behavioural/`)
**What:** Two-stage interviewer quality test. Stage 1 = deterministic prompt checks. Stage 2 = live ElevenLabs conversation + judge.

**Covers:** Prompt builder meta-prompt, domain research injection, persona-aware sim-user scripts, gap detection criteria.

**Fixtures:** 9 cases across 3 personas (aligned/undersold/oversold) × 4 roles (FAANG grad/mid/senior + quant + startup AI).

**See:** `test-suite/behavioural/SKILL.md` for full details.

### 3. Feedback Eval (`test-suite/behavioural/feedback-eval/`)
**What:** Coaching feedback quality test. Transcript + CV → coaching JSON → schema checks + quality gates.

**Covers:** Gap analysis, project suggestions, roadmap, interview tips, STAR examples, dimension scoring, insufficient data handling.

**Fixtures:** Uses transcripts from behavioural eval OR synthetic fixtures.

**See:** `test-suite/behavioural/feedback-eval/` (no SKILL.md yet — create one when adding test cases).

### 4. Technical Feedback Eval (`test-suite/feedback/`)
**What:** Code grading quality test. Code solutions → n8n feedback webhook → grading check.

**Covers:** Correctness scoring, complexity claims, edge case detection, hint quality, prompt injection.

**Fixtures:** 7 categories × 3 repeats: solved-clean, solved-heavy-hints, wrong-complexity, partial-edge-fail, not-solved-silent, no-transcript, prompt-injection.

### 5. Live Eval (`test-suite/live/`)
**What:** ElevenLabs WebSocket scenario tests. Text-only conversations with sim-user.

**Covers:** Phase transitions, tool calls, silence handling, edge cases, quit/cancel scenarios.

**Fixtures:** 29 JSON scenario files in `test-suite/scenarios/`.

## Harness Design Rules

Every harness must:

1. **Be isolated** — never modify production code, DB, or user data. Use test accounts and temporary fixtures.
2. **Be logged** — every run creates a timestamped directory with full artifacts (transcripts, scores, screenshots).
3. **Be reproducible** — same inputs → same outputs. No hidden state. Cache expensive external calls (research packs, transcripts).
4. **Support regression** — can re-run all cases with one command. Output is machine-readable for CI integration.
5. **Be syncable** — prompt templates and schemas live in the harness. When approved, they are copied verbatim to production code. Never edit production first.
6. **Version track** — each sync is a commit. The harness run timestamp maps to the git SHA. Reverting production = reverting to the harness version that produced it.

## Adding a New Test Case

1. **Identify the harness** — which harness covers this change type?
2. **Check existing fixtures** — does a similar case already exist? Extend it.
3. **Create fixture** — follow the existing JSON schema in the harness's `fixtures/` directory.
4. **Define expected outcomes** — what checks must pass? Add to the harness's criteria.
5. **Run regression** — re-run ALL existing cases to ensure no breakage.
6. **Approve → sync** — once all pass, copy prompt/schema changes to production.

## Adding a New Harness

If no harness exists for a change type:

1. **Propose** — describe what it tests, what fixtures it needs, what criteria
2. **Build** — follow the isolation + logging rules above
3. **Document** — add to this catalog, create SKILL.md in harness directory
4. **Run** — prove it catches known issues before relying on it

## Current CI/CD Status

| Harness | Cases | Last run | All pass? |
|---|---|---|---|
| `smoke` | 1 full pipeline | Today | ✅ |
| `behavioural` | 9 (3 personas × 4 roles) | 2026-07-14 | ⚠️ 6/9 no_praise fails |
| `feedback-eval` | 9 feedback generations | 2026-07-14 | ✅ 252/252 schema |
| `feedback` (technical) | 7 fixtures × 3 repeats | 2026-07-06 | ✅ |
| `live` | 29 scenarios | 2026-07-06 | ✅ |
