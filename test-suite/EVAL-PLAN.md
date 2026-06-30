# Mockly Interview Agent — Evaluation Plan

**Status:** draft — awaiting approval on §H decisions
**Author:** pi agent, 2026-06-24
**Subject:** `agent_2201ktp0n7mwek6avkphs4x6394m` on branch `agtbrch_1301ktp0n97rfn4tkjz5626383hm`
**Harness:** `test-suite/live/` (DeepSeek sim-user + DeepSeek V4-pro judge over real WS)

---

## A. Goal of the evaluation program

Decide, on every proposed agent change, **two things**:

1. **Behaviour gate** — does the change keep all currently-PASS scenarios PASS and move ≥1 currently-FAIL scenario to PASS, with no new regressions?
2. **Compatibility gate** — does the change touch only fields that are safe to mutate, so that promotion is literally `PATCH agent.workflow + sys-prompt` and nothing else in the runtime (backend routes, MCP server, n8n workflow contract, callback shapes, voice/ASR config) breaks?

If both gates pass, the change is promotable. If either fails, the change is rejected and the old agent config is restored from the run's checkpoint.

---

## B. Test-case design

### B.1 Coverage matrix (axes)

A scenario is a cell in this matrix:

| Axis | Values |
|---|---|
| **Phase** | 1 Understanding · 2 Implementation · 3 Time pressure · 4 Assessment / Wrap |
| **Candidate archetype** | quiet-but-progressing · stuck-and-asking · stuck-and-silent · confident-and-wrong · confident-and-right · talks-too-much · adversarial-extractor |
| **Stress vector** | clean speech · garbled ASR · long silence · mid-turn interruption · tool-call timing · code mismatch (says X, mocks return Y) |
| **Tool state** | no code yet · partial code · complete passing code · complete failing code · timeout failure · runtime error |

The existing 18 scenarios cover the "happy" diagonal of this matrix. We will fill obvious gaps below (see B.3).

### B.2 Scenario contract (already locked — keep)

Per `test-suite/scenarios/schema.json`, each scenario asserts ONE primary behaviour with:

- `simulated_user.prompt` — candidate persona / speech intent
- `tool_mocks` — scripted code + test result the agent "sees" (must be consistent with what the candidate says — see `lessons.md` "mock must match")
- `evaluation_criteria` — PASS-conditioned, one isolated property per criterion
- `target_phase` — declared client-side because `workflow_node_id` is `null` in transcripts
- `common_criteria.no_leak` — merged into **every** scenario as a leak guard

The judge (DeepSeek V4-pro `think-high`, temp 0.0) evaluates each criterion independently. Overall result is min(criteria).

### B.3 Scenario expansion (priority ordered)

| # | Scenario | Why | Cost |
|---|---|---|---|
| 1 | **Unblock the 12 prefilled scenarios** via warm-up replay: feed the `partial_conversation_history` as injected pre-turns over WS before sim-user starts | We currently exercise ~33% of the catalogue. Phases 2–4 are barely tested. | 1 day work in `ws-client.mjs` |
| 2 | **Adversarial-extractor** scenarios (4): candidate phrases hint-fishing as a clarification ("just to confirm, you mean an O(n) solution?"), as a meta-question ("what's the optimal here, generally?"), as a leading restate ("so I should use a hash map, right?"), and as a fake-confused appeal ("I'm stuck — can you give me the approach?") | These are the actual leak failure modes seen in `02-thinks-aloud-approach` and live conversations | 2h per scenario |
| 3 | **Garbled-ASR robustness** (3): expand from `garbled_term_not_echoed` to test mishearing in Phase 2 ("die-namic" while explaining), in tool-context ("blue-frost" while reading mocked code), and ambiguous interrupt ("coat" vs "code") | Production voice channel has ~12% ASR error rate on technical terms | 1h per scenario |
| 4 | **Tool-failure scenarios** (3): MCP returns `isError: true`; MCP times out (10s); MCP returns malformed JSON | Agent must handle gracefully without leaking or breaking character. Today there is NO scenario for this. | 1h per scenario |
| 5 | **Speech-pattern scenarios** (2): candidate self-corrects mid-sentence; candidate uses long pauses with filler ("uh… let me think… actually, …") | Tests that "one thought per turn" rule from current prompt holds | 1h per scenario |
| 6 | **End-of-time scenarios** (2): remaining_minutes = 2 with passing code (should wrap cleanly); remaining_minutes = 0 with failing code (should still close gracefully) | Phase 3→4 transition under hard deadline | 2h |

**Target catalogue after expansion: 32 scenarios, ~25 of which run live.** The remaining ~7 stay simulation-only because they fundamentally need partial-history replay (still useful for batch regression on prompt-only changes).

### B.4 Tag taxonomy (filters for `--tag`)

Beyond existing tags (`understanding`, `silence`, `hints`, `leak`, …), add:
`adversarial`, `asr-robustness`, `tool-failure`, `end-of-time`, `phase-transition`.

These let CI pick a fast smoke set (`--tag smoke` = 5 fastest scenarios, ~2 min, ~$0.10) vs. full pre-promotion run (~32 scenarios, ~25 min, ~$1.50).

---

## C. Edge-case handling

| Class | Specific case | Already covered? | Mitigation |
|---|---|---|---|
| ASR | Technical term mishearing | Partial — 1 scenario | Add 3 scenarios (B.3 #3) |
| ASR | Empty / silence-only candidate turn | No | Add to existing `filler_stays_silent` |
| Candidate | Adversarial hint extraction | No | Add 4 scenarios (B.3 #2) |
| Candidate | Self-contradiction (says hash map, mocks show array) | Implicit | Promote to explicit scenario in `tool-failure` group |
| Tool | MCP error response | No | Add 1 scenario (B.3 #4) |
| Tool | MCP timeout | No | Add 1 scenario (B.3 #4) |
| Tool | MCP malformed JSON | No — see `lessons.md` double-wrap | Add 1 scenario (B.3 #4) |
| Network | WS dropout mid-conversation | No | Out of scope for behaviour eval — belongs in infra test |
| Phase | Phase 1→2→3→4 cleanly | Partial | Will get full coverage once warm-up replay is implemented |
| Phase | Skipping Phase 2 (candidate refuses to code) | No | Add to adversarial group |
| Time | `remaining_minutes` near zero | No | B.3 #6 |
| Leak | Optimal complexity name | Yes, via `no_leak` | Keep as universal criterion |
| Leak | Specific hidden test input | Yes, via `no_leak` | Keep |
| Leak | Pseudo-code that maps 1:1 to solution | Partial — judge prompt may need sharpening | Add explicit pseudocode-leak criterion in adversarial scenarios |

### Edge cases we explicitly DO NOT test in this harness

- **TTS / voice quality** — not behavioural; separate audio QA
- **ElevenLabs platform outages** — infra concern, monitored elsewhere
- **DB / Prisma errors** — backend integration test territory
- **n8n provisioning workflow** — covered by a separate smoke test (see G.3)

---

## D. Result logging

Every run produces an **artefact bundle** at `test-suite/runs/<run-id>/`:

```
test-suite/runs/2026-06-24T10-15-22-<short-sha>/
├── manifest.json            ← run-id, timestamp, agent_id, branch, version_id,
│                              git SHA of prompt/scenario sources, scenario list,
│                              total cost, pass/fail counts
├── agent-config.json        ← full ElevenLabs agent config at run start
│                              (= today's checkpoint, but renamed and co-located)
├── scenarios/
│   └── <scenario-id>.json   ← transcript, tool calls, per-criterion judge
│                              rationale, latency per turn, raw WS frames
├── report.html              ← human-readable rollup (today's live-report.html)
└── summary.md               ← machine + human readable: PASS/FAIL grid,
                               regression delta vs previous run on same branch
```

Changes from today:

1. **One folder per run, not loose files.** Today checkpoints live in `test-suite/checkpoints/` and reports in repo root. Co-locate.
2. **`manifest.json` is the index.** A single `jq`-friendly file per run for trend analysis. Example fields: `agent.version_id`, `prompt.sha`, `results.{passed,failed,skipped}`, `regressions: [scenario-ids that flipped pass→fail]`.
3. **Trend file** `test-suite/runs/INDEX.md` — one line per run with date, version_id, pass rate, regressions. Updated by the runner.
4. **`summary.md` includes diff to last run on same branch** — the gate decision (B.behaviour) is computed from this.

`git ignore` the `runs/` tree by default; archive interesting runs by removing them from gitignore (or pushing to S3 — out of scope here).

---

## E. Versioning & revert

Three independent layers, each restoring a different scope:

### E.1 ElevenLabs version (server-side, authoritative)

Every `PATCH /v1/convai/agents/<id>` already creates a new `version_id` on the branch. We just need to **record it before and after each change**.

- `manifest.json` records `version_before` and `version_after`.
- Add `test-suite/scripts/revert-agent.mjs <version_id>` that PATCHes the agent back to a prior version's `workflow + prompt + tool config`. We already have all of this captured in `agent-config.json` per run.

### E.2 Local prompt source (git-tracked)

The current pattern (`current-prompt.txt` → `build-prompt.mjs` mutates → `updated-prompt.txt` → manual push to agent) is fine **if** we formalise it:

- Promote `test-suite/current-prompt.txt` to `test-suite/prompts/system.md` as the canonical source.
- Phase-level overrides go in `test-suite/prompts/phase-{1,2,3,4}.md` (today injected by `update-phases.mjs`).
- A single script `test-suite/scripts/push-agent.mjs` reads these files and PATCHes the agent. No more `build-prompt.mjs` + `update-phases.mjs` divergence.
- Every push is a git commit. `git revert <sha>` + re-push = full revert.

### E.3 Checkpoint snapshot (already exists, repurposed)

Today's `test-suite/checkpoints/*.json` captures `full_config` before each test run. Keep this as the **emergency revert** path:

- `test-suite/scripts/revert-agent.mjs --from-checkpoint <checkpoint-id>` PATCHes back the entire `full_config`.
- Use case: ElevenLabs version history was lost / corrupted, or the change spans multiple PATCHes.

### Revert decision matrix

| Situation | Use |
|---|---|
| One bad PATCH, want to undo to immediately prior state | E.1 — revert to `version_before` from last `manifest.json` |
| Want to roll back to "last known good" (last run that fully passed) | E.1 with `version_id` looked up from `INDEX.md` |
| Want to recreate a prompt from scratch from git history | E.2 — `git revert` + `push-agent.mjs` |
| Agent is in inconsistent state, want full reset to a captured snapshot | E.3 — `revert-agent.mjs --from-checkpoint` |

---

## F. Quality gates (computed automatically by the runner)

Promotion is **blocked** if any of these is true after a run:

1. **Critical regression**: any previously-PASS scenario flips to FAIL.
2. **Leak**: any scenario fails the universal `no_leak` criterion.
3. **Tool break**: any tool-failure scenario flips to FAIL (means agent now mishandles MCP errors).
4. **Coverage drop**: number of executed scenarios < the previous run's executed count (catches silent skip bugs).
5. **Phase coverage**: at least one PASS scenario per phase. (Once warm-up replay is in.)

Promotion is **allowed** when all of the above hold AND at least one of:

- Net new PASS (a previously-FAIL scenario now PASSes), or
- Explicit `--allow-no-improvement` flag (for refactors that don't change behaviour).

These are runner-enforced exit codes:
- `0` — gates passed, promotable
- `1` — behaviour regression
- `2` — harness error (API down, MCP unreachable)
- `3` — leak detected (always loudest)

---

## G. Integration into the live workflow (the "config-only change" contract)

This is the part the user asked about most. The constraint: **approved changes propagate to production by only changing the agent's config, nothing else in the system breaks.**

### G.1 Where production reads agent behaviour from

The wiki (`decisions.md`) confirms `agtbrch_1301ktp0n97rfn4tkjz5626383hm` IS production. Backend (`apps/backend/routes/interviewRoutes.js`) holds **no prompt or workflow content** itself — it calls the n8n webhook `TECHNICAL_AGENT_WEBHOOK_URL` (`localhost:5678/webhook/84281349-…`) for provisioning, then stores the returned `agent_id` per user in `Agent` table.

So there are **two surfaces holding agent behaviour**:

| Surface | What it holds | Who reads |
|---|---|---|
| ElevenLabs branch `agtbrch_1301…` on `agent_2201…` | System prompt, per-phase prompts, workflow nodes/edges, tool list, MCP refs | The test harness AND production (if production agents inherit from this branch) |
| n8n workflow `84281349-1d93-47cd-ad3d-dfcc7013ad3b` | The template applied when n8n provisions a new per-user agent | Backend on `POST /api/technical/session` for users without an agent |

**Open question for the user (see §H.1)**: when a user already has an `Agent` row, the backend reuses it and skips n8n. So existing users' agents diverge from any template change unless we also re-PATCH them. This is the single biggest risk to the "config-only, no breakage" promise.

### G.2 The mutable / immutable / forbidden contract

For a change to qualify as "config-only", it must touch ONLY these fields:

**Mutable (safe to change via PATCH)**
- `prompt.prompt` (system prompt text)
- `workflow.nodes.<node>.additional_prompt` (per-phase prompt overrides)
- `workflow.nodes.<node>.label` (display only)
- `prompt.temperature`, `prompt.llm` (model-level knobs)
- Internal phrasing of any string field

**Forbidden (changing these breaks the workflow contract)**
- `agent_id` — backend stores this per user
- `mcp_server_ids` — backend's MCP server depends on this
- Tool names (`get_current_code`, `run_code_against_tests`, `skip_turn`, `log_event`) — MCP server handlers and `tool_mocks` are keyed by these
- Workflow node IDs (`node_01ksvy7n…` etc.) — `PHASE_NODE_IDS` map in `run-one.mjs` depends on these
- Branch ID — backend has no concept of branches; PATCHing a different branch silently breaks prod
- `dynamic_variables` keys — backend injects these by name (`remaining_minutes`, `secret__session_id`, `question_*`, `company_type`, `time_budget_minutes`)
- `client_tools` shape — UI components are wired to event names
- ASR / turn / audio config (unless explicitly approved with a separate audio QA run)

**Restricted (change requires coordinated update)**
- Adding a new phase node — also needs `PHASE_NODE_IDS` + scenario `target_phase` updates
- Adding a new tool — also needs MCP server + `tool_mocks` + n8n template updates
- Adding a dynamic variable — needs backend payload + n8n template updates

The runner's **compatibility gate** (gate 2 from §A) is mechanical: it diffs `agent-config.json` of the candidate run against the last known-good run and fails if any forbidden field changed. This is enforced by `test-suite/scripts/diff-config.mjs` (new — small, one afternoon).

### G.3 Promotion procedure (per approved change)

```
1. Edit `test-suite/prompts/system.md` or `phase-*.md` in a branch.
2. Run `node test-suite/live/runner.mjs --all --yes`.
3. Inspect `runs/<run-id>/report.html` + `summary.md`.
4. If gates pass:
   a. Commit the prompt change to git.
   b. Run `node test-suite/scripts/push-agent.mjs --confirm` to PATCH the
      production ElevenLabs agent on branch agtbrch_1301….
   c. Run `node test-suite/scripts/smoke-n8n.mjs` to confirm the n8n
      template still provisions a working agent end-to-end (one synthetic
      session, 3 turns, must complete).
   d. If existing-user-agent propagation is enabled (§H.1), run
      `node test-suite/scripts/repatch-user-agents.mjs --dry-run` first,
      then `--confirm`.
5. If gates fail: stop. No promotion. Either iterate on prompt or revert.
```

The runtime workflow (frontend → backend → ElevenLabs WS → MCP server → callback) is **untouched** at every step. Only the agent's prompt content changes. The backend doesn't restart, MCP server doesn't restart, n8n workflow doesn't change.

### G.4 What we will NOT do (preserves "no breakage" guarantee)

- Will not add or remove tools.
- Will not rename phase nodes or change node IDs.
- Will not add new MCP servers (the `mcaiiVJDVZFS5dB7RFN2` dependency stays).
- Will not change ASR / voice / audio config in eval-driven PRs.
- Will not change `dynamic_variables` schema.
- Will not change branch.

Any of those needs a separate, explicit RFC and a paired backend change. The eval harness will flag any of them automatically.

---

## H. Locked decisions (2026-06-24)

- **H.1 — LOCKED: versioned template + n8n split + lazy reprovision.**
  Add `Agent.templateVersion Int @default(0)` Prisma column. Env var
  `TECHNICAL_AGENT_TEMPLATE_VERSION` holds the current template version.
  Split the existing n8n webhook into two: **agent-create** (provisions a
  new agent, returns agent_id + templateVersion) and **agent-config**
  (PATCHes an existing agent to a target_version, returns agent_id +
  templateVersion). Backend on `POST /api/technical/session`: if user has
  agent and `agent.templateVersion < env.TECHNICAL_AGENT_TEMPLATE_VERSION`,
  call agent-config. Existing users get the new template lazily on next
  session. (Batch 2.)
- **H.2 — LOCKED: per-scenario live/sim decision.** 5 sim-suitable scenarios
  (Phase 1 verbal-only, no tool dependency), 25 live-required. The 12
  "prefilled" scenarios get rewritten as live-native (longer sim-user
  prompts that naturally drive into target phase). No warm-up replay needed.
  See `EVAL-CATALOGUE.md` for the full table.
- **H.3 — LOCKED: direct PATCH of test agent.** No candidate branch. The test
  agent IS the sandbox by design; real users are isolated on per-user agents.
  Eval runs PATCH the test agent freely; gate exit codes block promotion to
  the n8n template (Batch 2).

## H-archived. Original open decisions (kept for context)

### H.1 How do existing-user agents pick up the new behaviour?
The backend reuses an existing per-user `Agent` row and skips n8n. So updates to the template branch do NOT automatically reach users who already have an agent. Options:

- **A. Re-PATCH all existing user agents on every promotion** (write `repatch-user-agents.mjs`). Pro: every user gets the improvement immediately. Con: more API calls, blast radius is all users.
- **B. Mark existing user agents stale and re-provision on next session start** (add `templateVersion` column to `Agent`, compare to current). Pro: gradual rollout. Con: schema change.
- **C. Do nothing — only new users get the new prompt; existing users keep what they have until they reset.** Pro: simplest. Con: bug fixes don't reach affected users.

### H.2 Scenario warm-up replay — build it or skip it?
12 of 18 scenarios are currently skipped because they need `partial_conversation_history` and the live WS doesn't accept it. We have two paths:

- **A. Build warm-up replay** (~1 day): inject prior turns by simulating them at the start of the WS session before sim-user takes over. Unblocks 12 scenarios. Risk: replay may not perfectly reproduce the original phase state.
- **B. Rewrite those 12 as live-native scenarios**: longer sim-user prompts that drive the agent through earlier phases naturally before testing the target behaviour. Slower per scenario (more turns) but more faithful.
- **C. Drop them — focus on the 6 live-runnable + the 14 new ones from §B.3 (≈20 live scenarios total).** Accept that the eval is Phase-1-heavy.

### H.3 Promotion lever — direct PATCH or separate candidate branch?
Today the test agent and the prod branch are the same (`agtbrch_1301…`). Two options:

- **A. Keep one branch — every PATCH is a deploy.** Pro: zero overhead, matches what's documented in decisions.md. Con: between PATCH and gate verdict, real users hit the new prompt.
- **B. Create a `candidate` branch** for eval runs; promote to main by copying `workflow + prompt` over once gates pass. Pro: no user impact during eval. Con: branch management complexity; have to verify ElevenLabs branch isolation actually works for our agent.

---

## I. Implementation roadmap (once §H is decided)

| Order | Task | Effort |
|---|---|---|
| 1 | `test-suite/scripts/diff-config.mjs` — compatibility gate | 0.5d |
| 2 | Run-folder restructure + `manifest.json` + `INDEX.md` | 0.5d |
| 3 | `test-suite/scripts/revert-agent.mjs` (both modes) | 0.5d |
| 4 | `test-suite/prompts/` canonicalisation + `push-agent.mjs` | 0.5d |
| 5 | Quality-gate exit codes in runner | 0.5d |
| 6 | (If H.2=A) warm-up replay in `ws-client.mjs` | 1d |
| 7 | (If H.1=A) `repatch-user-agents.mjs` + dry-run | 0.5d |
| 8 | (If H.1=B) Prisma migration for `Agent.templateVersion` | 0.5d |
| 9 | Adversarial-extractor scenarios (×4) | 1d |
| 10 | ASR-robustness scenarios (×3) | 0.5d |
| 11 | Tool-failure scenarios (×3) | 0.5d |
| 12 | Speech-pattern + end-of-time scenarios (×4) | 1d |
| 13 | Smoke-n8n script | 0.5d |
| 14 | `EVAL-PLAN.md` → `.wiki/test-suite.md` update + runbook | 0.25d |

**Total:** ~7 days end-to-end, ~5 days if H.1=C and H.2=C.

---

## J. See also

- `.wiki/test-suite.md` — current harness state
- `.wiki/decisions.md` — why branch=production and why MCP-only
- `.wiki/lessons.md` — `starting_workflow_node_id` injection, MCP double-wrap, sim≠WS
- `test-suite/live/CONFIG.md` — phase node IDs
- `test_scenarios_library.md` (repo root) — original scenario catalogue source
- `test_suite_harness_plan.md` (repo root) — original harness design intent
