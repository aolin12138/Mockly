# Live Test Harness Plan

Status: Draft v1 — awaiting approval
Author: planner agent
Date: 2026-06-16

---

## 1. Objective

Build a Node.js test harness (`test-suite/live/`) that runs real ElevenLabs
conversations in **text-only mode** against the Mockly interview agent
(`agent_2201ktp0n7mwek6avkphs4x6394m`, branch `agtbrch_1301ktp0n97rfn4tkjz5626383hm`),
captures the per-turn `workflow_node_id`, client + MCP tool calls, and agent
messages, then evaluates each scenario against the same criteria the existing
simulate-based suite uses.

It **complements** the simulate-based suite, it does not replace it. Two runners
side by side: `runner.mjs` (simulate, fast/cheap) and `live/runner.mjs` (live,
covers what simulate cannot).

The simulate suite has known limitations the live suite fixes:

| Capability | simulate | live |
| --- | --- | --- |
| Returns per-turn `workflow_node_id` | ❌ always null | ✅ via GET transcript |
| Triggers real MCP tools | ❌ | ✅ via real MCP server |
| Verifies edge transitions | ❌ | ✅ |
| Mocks client tools (`get_current_code`, `run_code_against_tests`) | ✅ | ✅ (SDK `ClientTools.register`) |
| Runs `extra_evaluation_criteria` inline | ✅ judge LLM in API | ✅ local judge LLM call |
| Supports `partial_conversation_history` prefill | ✅ first-class | ⚠ replayed turn-by-turn (state drift risk — see §5) |
| Cost per scenario | Lower (one API call) | Comparable LLM cost, no TTS cost (text-only saves audio credits) |

---

## 2. Confirmed assumptions & constraints

Verified by reading code in `node_modules/@elevenlabs/elevenlabs-js/` and
`node_modules/@elevenlabs/types/`:

1. **Text-only mode exists at the WS protocol level.**
   `ConversationConfigOverrideConversation.text_only?: boolean`
   (`@elevenlabs/types/dist/generated/types/asyncapi-types.d.ts:66`). Passed via
   the `conversation_initiation_client_data` WS event under
   `conversation_config_override.conversation.text_only = true`. TTS is skipped;
   `agent_response` events still stream with text.

2. **A Node SDK `Conversation` class already exists.**
   `@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/Conversation.{d.ts,js}`.
   Connects to `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=...`.
   Public API: `startSession()`, `sendUserMessage(text)`,
   `sendContextualUpdate(text)`, `endSession()`, `getConversationId()`,
   callbacks for `agentResponse`, `userTranscript`, `messageReceived` (raw
   events). Supports `conversationConfigOverride`, `dynamicVariables`,
   `clientTools` (Node-side mock handlers). Already installed in
   `node_modules/`.

3. **Per-turn workflow_node_id is available after the call.**
   `GET /v1/convai/conversations/{conversation_id}` returns a
   `GetConversationResponseModel` whose `transcript[].agentMetadata.workflowNodeId`
   is populated per turn
   (`api/types/ConversationHistoryTranscriptCommonModelOutput.d.ts:4`,
   `api/types/AgentMetadata.d.ts:4`). Same payload also exposes:
   - `transcript[].toolCalls` (`toolName`, `paramsAsJson`, `toolHasBeenCalled`)
     for both client tools and MCP tools
   - `transcript[].toolResults`
   - `analysis.evaluationCriteriaResults` (only for criteria configured on the
     agent itself; ad-hoc criteria need a local judge — see §5)
   - `metadata` (call_duration_secs, cost in credits)

4. **The Node SDK requires an `audioInterface`.** Even with `text_only: true`,
   `Conversation._onWebSocketOpen` calls `this.audioInterface.start(...)`. We
   provide a `NullAudioInterface` whose `start`/`stop`/`output`/`interrupt`
   are all no-ops. (See `interfaces/ConversationClient.d.ts`.)

5. **Client tools route through the SDK already.** The agent emits
   `client_tool_call`; the SDK calls our registered handler via
   `ClientTools.register(name, handler)` and ships back a `client_tool_result`.
   Existing `tool_mocks` from `test-suite/scenarios/*.json` plug straight in.

6. **MCP tools route to the real MCP server.** The agent has
   `mcaiiVJDVZFS5dB7RFN2 Mockly MCP Server` attached at
   `https://bobcat-nacho-sustainer.ngrok-free.dev/mcp`. Live calls hit the
   real server (the running ngrok-proxied Mockly backend) — this is the
   point. `mcp_tool_call` events stream live with `service_id`, `tool_name`,
   `parameters`, `state` ∈ {loading, awaiting_approval, success, failure},
   and the result on success.

7. **Credentials.** `ELEVENLABS_PLATFORM_KEY` in `.env`
   (`fdb1ed31791beb50b4b9a0e1dc4ad2032a713e289a634371e918599638c66b08`) is the
   same key the existing simulate runner uses; reused as-is. For private
   workspace agents the SDK will route through `GET /v1/convai/conversation/get_signed_url`
   (already in `conversations.getSignedUrl()`).

8. **No new top-level dependencies needed.** `@elevenlabs/elevenlabs-js` and
   `ws` are already installed (root `package.json`). The test-suite directory
   may need `"elevenlabs-js": "*"` added to its own `package.json` or to
   resolve from the root `node_modules`.

9. **A simulated-user LLM is required.** For each scenario, after starting
   the WS session and receiving the agent's opening message, something must
   produce the candidate's next message. The existing simulate API does this
   server-side with `simulated_user_config.prompt` + `gpt-4o`. We replicate
   it client-side: per turn, call OpenAI's `chat.completions` with the
   scenario's `simulated_user.prompt` + running transcript, get the next
   user message, send via `sendUserMessage(text)`. (OpenAI key is **not**
   currently in `.env` — see open question Q1.)

---

## 3. Open questions

Each is a real branching decision. Sensible defaults in the plan; flag for the
user before execution.

**Q1. Simulated-user LLM provider.** Simulate uses `gpt-4o`. We have:
   - `VITE_GEMINI_API_KEY` in `.env` — Gemini is available.
   - No `OPENAI_API_KEY` in `.env`.
   Default in this plan: **Gemini `gemini-2.0-flash` as sim-user and judge**,
   using the existing `VITE_GEMINI_API_KEY`. Cheap, fast, no new key needed.
   Alternative: add `OPENAI_API_KEY` and match simulate exactly. Acknowledged
   trade-off: judging behaviour may shift slightly between simulate (gpt-4o
   judge) and live (gemini-2.0-flash judge); we mitigate by validating
   against a small calibration set in step 7.

**Q2. Starting workflow node for non-Phase-1 scenarios.** The simulate API
   accepts `conversation_initiation_client_data.starting_workflow_node_id`.
   The public WS init protocol (in `@elevenlabs/types`) exposes
   `conversation_config_override`, `custom_llm_extra_body`, `dynamic_variables`
   — **but not** an explicit `starting_workflow_node_id` field. Three options
   in priority order:
   1. **Try** putting it at the top level of `conversation_initiation_client_data`
      alongside the documented fields — the field is accepted by the public
      simulate REST endpoint, so the orchestrator may accept it on WS too.
      First implementation step is a 1-turn smoke test to confirm.
   2. If not accepted: stuff it inside `custom_llm_extra_body.starting_workflow_node_id`.
   3. If neither works: drive the agent forward to the right phase by
      replaying a short "warm-up" history via `sendUserMessage` calls before
      issuing the scenario's `first_message`. Costs ~3-5 extra turns of
      LLM credit per non-Phase-1 scenario.

**Q3. `partial_conversation_history` handling.** Live WS cannot inject
   prefilled turns the way simulate can. Options:
   1. **Skip** scenarios with prefilled history in live mode (default). 8 of
      18 scenarios have prefilled history (07, 10, 13, 15, 16a-c, and others).
      That still leaves ~10 scenarios runnable live — covers the
      transition-tracking goal.
   2. **Replay**: send each prior user turn via `sendUserMessage`, accept
      whatever the agent says, and only assert on turns AFTER the scenario's
      `first_message`. Drifts the agent's actual state away from the canonical
      scenario state but lets us cover all 18.
   3. **Contextual update**: send the prior turns as one `sendContextualUpdate`
      block ("Previously in this conversation: …"). Cheapest, leakiest.
   Default in this plan: **option 1 (skip)** for the MVP, with a follow-up
   to revisit replay once basic flow works.

**Q4. Integration with the existing runner.** Three shapes:
   1. **Separate runner** at `test-suite/live/runner.mjs`, with its own
      `--all/--tag/--scenario/--dry-run/--yes` flags. Reuses `lib/loader.mjs`
      to load scenarios, reuses `lib/report.mjs` to write the report (with a
      `--output live-report.html`). Default.
   2. Add `--mode=live` to the existing `runner.mjs`. More magic in one
      file, but harder to evolve independently.
   3. Run both back-to-back and produce a comparison report. Useful but
      out-of-scope for MVP.
   Default in this plan: **option 1**.

---

## 4. Step-by-step plan

Each step is sized to ≤ 3-5 tool calls and is independently verifiable.

### Step 0 — confirm open questions
Resolve Q1-Q4 with the user. Do not start step 1 until at least Q1, Q2-default
acceptance, and Q3-default acceptance are confirmed.

### Step 1 — null audio interface + minimum-viable text WS client
Files: `test-suite/live/null-audio.mjs`, `test-suite/live/ws-client.mjs`.
- `null-audio.mjs`: exports `NullAudioInterface` with no-op `start`,
  `stop`, `output`, `interrupt`, `interrupt_or_close`. Matches the shape
  expected by `Conversation` (read it from `AudioInterface.d.ts`).
- `ws-client.mjs`: thin wrapper around `Conversation` that
  - takes `{ apiKey, agentId, dynamicVariables, clientToolMocks, textOnly: true, startingNodeId? }`,
  - registers each tool mock via `ClientTools.register(name, () => mock_value)`,
  - sets `conversation_config_override.conversation.text_only = true`,
  - exposes async `start()`, `sendUser(text)`, `awaitAgentReply({ timeoutMs })`,
    `endSession()`, `getConversationId()`,
  - logs every incoming raw message to memory (for replay/debugging),
  - emits `agent_response_done` after a quiescent period (e.g. 800 ms with no
    new `agent_response` or `agent_chat_response_part` events).
- **Verification:** call against the real agent with an empty scenario;
  expect at least one `agent_response` back. Inspect raw event log for the
  `conversation_initiation_metadata` event with a non-empty `conversation_id`.

### Step 2 — Q2 spike: confirm `starting_workflow_node_id` over WS
Single one-off `spike.mjs` script.
- Open a WS session with `starting_workflow_node_id` placed at three
  candidate locations (one per run): (a) top-level of init payload,
  (b) inside `custom_llm_extra_body`, (c) inside `conversation_config_override.agent`.
- After one `sendUserMessage("hello")`, end session, GET the conversation,
  inspect `transcript[0].agentMetadata.workflowNodeId` — does it match
  `phaseNodeIds[2]` (Phase 2 node) or the default Phase 1 node?
- Record the working location in `test-suite/live/CONFIG.md`.
- **Verification:** at least one of the three options produces a transcript
  whose first turn's `workflowNodeId` matches the requested phase node.

### Step 3 — simulated-user LLM driver
File: `test-suite/live/sim-user.mjs`.
- `SimulatedUser({ provider, model, scenarioPrompt, firstMessage })`
  with method `next(transcript)` → returns the next user utterance.
- Default provider: Gemini via `@google/genai` (already a transitive dep) or
  raw `fetch` to `https://generativelanguage.googleapis.com/v1beta/models/...`.
- Reuses `CONFIG.simUserPrefix` from the existing test suite.
- If the simulated user produces an empty/whitespace reply or a goodbye, the
  driver returns `null` and the runner ends the session.
- **Verification:** instantiate with scenario 01's prompt; call `next([])`
  with no history → expect the `first_message` verbatim. Call again with one
  agent reply → expect a plausible next candidate utterance, ≤ 3 sentences,
  not containing code blocks.

### Step 4 — single-scenario live runner (the inner loop)
File: `test-suite/live/run-one.mjs`.
- Function `runLive(scenario, opts) → { transcript, rawEvents, conversationId, durationMs }`.
- Algorithm:
  1. Resolve `startingNodeId` from `scenario.target_phase` via existing
     `CONFIG.phaseNodeIds`.
  2. Start `ws-client` with text-only, scenario `tool_mocks`, scenario
     `dynamic_variables` merged onto `CONFIG.defaultDynamicVariables`.
  3. Wait for `conversation_initiation_metadata` and for the agent's opening
     message (if any).
  4. Loop up to `scenario.new_turns_limit` turns:
     - sim-user produces next user message; send via `sendUser`.
     - await agent reply (one `agent_response`).
  5. End session, fetch transcript via
     `GET /v1/convai/conversations/{conversation_id}` (with 1-3 retries to
     handle eventual consistency — the conversation row may take a few
     hundred ms to appear).
- Returns merged structure: server transcript (with workflow_node_id, tool
  calls) PLUS raw WS event log (in case server is missing fields).
- **Verification:** run scenario 01 end-to-end. Expect:
  (a) `transcript.length >= 2`, (b) `transcript[0].agentMetadata.workflowNodeId`
  populated, (c) at least one `toolCalls` entry for `get_current_code`,
  (d) `conversation_id` retrievable.

### Step 5 — local judge + assertion layer
File: `test-suite/live/judge.mjs`, `test-suite/live/verify.mjs`.
- `judge.mjs`: for each `evaluation_criteria` entry, call Gemini with a
  prompt: scenario goal + criterion text + transcript → produce
  `{ result: "success"|"failure"|"unknown", rationale: string }`.
  - Use deterministic settings (temperature 0).
  - Prompt structure mirrors what simulate's judge appears to use: criterion
    is graded against the **transcript** in isolation; no agent prompt is
    revealed.
  - Cache prompts cheaply (one batch per scenario covers all criteria with
    structured output).
- `verify.mjs`: structural assertions independent of the judge:
  - `verifyToolCalls(transcript, requiredToolNames)` — pass if all are present.
  - `verifyPhaseProgression(transcript, expectedPhases)` — pass if
    workflow_node_id values move through the expected order.
  - `verifyNoForbiddenTools(transcript, forbiddenNames)`.
- **Verification:** judge a known-good transcript (saved from a prior
  simulate run, e.g. scenario 01) → at least one criterion returns `success`
  with non-empty rationale.

### Step 6 — multi-scenario runner with concurrency, retries, report
File: `test-suite/live/runner.mjs`.
- Mirror the existing `runner.mjs` CLI shape: `--all`, `--tag`, `--scenario`,
  `--dry-run`, `--yes`, `--concurrency` (default 2 — lower than simulate's 5
  because each live conversation holds a WS open longer and we want to avoid
  rate-limiting), `--timeout`, `--output live-report.html`.
- Skip scenarios with non-empty `partial_conversation_history` (per Q3
  default); print one line per skipped scenario.
- Per scenario: `runLive` → judge + verify → result row.
- Reuse `lib/pool.mjs` for the concurrency primitive (read it first; it may
  need a minor extension for per-scenario soft-fail).
- Reuse `lib/report.mjs` to render the HTML; pass an extra column showing
  workflow node IDs walked and tool calls observed (live runner's value-add).
- Save checkpoint via `lib/checkpoint.mjs` (separate "live" checkpoint
  directory — do not commingle with simulate checkpoints).
- **Verification:** `node live/runner.mjs --scenario clarify_problem,thinks_aloud_approach --yes`
  finishes; HTML report has 2 rows; each row has `workflow_node_id` column
  populated and at least one tool-call row.

### Step 7 — calibration against simulate
- For 3 scenarios that the simulate suite reliably passes (e.g. 01, 02, 14),
  run both suites and diff results.
- Tolerance: live should pass the same criteria simulate passes. If a
  criterion that passes in simulate fails in live, log it in
  `test-suite/live/CALIBRATION.md` and review the judge prompt + transcript.
- **Verification:** ≥ 2 of 3 calibration scenarios match across suites.
  Any divergence is documented (not necessarily fixed in MVP).

### Step 8 — docs + package wiring
- `test-suite/live/README.md`: when to use live vs simulate, how to run,
  cost model, known limitations (Q3 skip list).
- `test-suite/package.json`: add scripts `"test:live"`, `"test:live:dry"`,
  `"test:live:scenario"`.
- Update top-level `.wiki/status.md` with a one-line entry pointing here.

---

## 5. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| `starting_workflow_node_id` not accepted on WS init (Q2) | medium | high — phase-transition scenarios become un-startable | Step 2 spike. Fallback: warm-up replay (Q2 option 3). |
| Live MCP server (ngrok URL) is down during a run | medium | high — MCP-dependent scenarios time out | Pre-flight check: GET `/health` (or equivalent) on MCP_PUBLIC_URL before the run; abort with a clear message. |
| WS session times out between turns (sim-user too slow) | medium | low | Call `registerUserActivity()` while the sim-user is thinking. |
| Sim-user LLM produces off-script behaviour (writes code, asks to share screen) | medium | medium — corrupts scenario | Reuse `CONFIG.simUserPrefix`. Add a post-generation regex filter for code blocks; if matched, reroll once, otherwise fail the scenario with "sim_user_drift". |
| Judge LLM (Gemini) disagrees with simulate's gpt-4o judge on subjective criteria | medium | low | Step 7 calibration. Document divergence in CALIBRATION.md. Do not auto-fix. |
| Real MCP tool calls have side effects on the user's database (writes a real session, etc.) | medium | medium — test pollution | Pre-flight: confirm MCP `secret__session_id: "live-test-suite-session-{uuid}"` is wired through so test traffic is isolated and prunable. Default value updated in `defaultDynamicVariables`. |
| `partial_conversation_history` scenarios silently skipped → false coverage signal | high | medium | The skipped scenarios are printed and counted in the report's "Skipped" section, not the "Passed" section. Report header makes this explicit. |
| Rate limiting (429s) at higher concurrency | medium | low | Default concurrency 2. Existing `apiFetch` retry/backoff helper from `lib/api-client.mjs` reused for GET transcript. WS-side: SDK already handles 429 via signed-url retry. |
| Cost overrun on a `--all` run | low | medium | `--dry-run` estimates: existing simulate heuristic (≈ 500 tok/turn) is the floor; live likely 30 % more (no internal eval but two extra LLM calls: sim-user + judge). Print estimate and require `--yes` to proceed. |
| Token leakage in journal / git: `ELEVENLABS_PLATFORM_KEY`, Gemini key | low | high | Reuse `.env` loader from `lib/config.mjs`; never log key values; redact API keys in any saved `rawEvents`. |

---

## 6. Acceptance criteria

Observable yes/no. Each is checked at the end of the corresponding step.

1. `test-suite/live/runner.mjs --scenario clarify_problem --yes` exits 0 and
   writes `live-report.html` with one row. (Step 6.)
2. The report row contains a non-empty `workflow_node_id` column for the
   agent's first turn. (Step 4 verification.)
3. The report row contains at least one tool call observed under
   `tool_calls` (the agent calls `get_current_code` early). (Step 4
   verification.)
4. `runner.mjs --scenario transitions_phase1_understanding --yes` runs without
   error and the first turn's `workflow_node_id` matches
   `CONFIG.phaseNodeIds[1]`. (Step 2 result confirmed.)
5. Re-running the same scenario twice produces equal pass/fail verdicts on
   ≥ 90 % of criteria (judge determinism check). (Step 5 verification.)
6. For at least 2 of 3 calibration scenarios (01, 02, 14), live and simulate
   agree on overall pass/fail. (Step 7.)
7. `--dry-run` prints an estimated token + USD cost and exits without making
   any conversation calls. (Step 6.)
8. No `partial_conversation_history` scenario is silently counted as passed.
   The report's "Skipped (live limitation)" section lists each by id. (Step 6.)
9. No secret values appear in `live-report.html`, in any saved raw-event log,
   or in the journal. (Spot-checked via `grep -r 'sk_\|ELEVENLABS_PLATFORM_KEY'`
   on artifacts after a run.)
10. The MVP touches no file under `apps/`, `prisma/`, or the existing
    `test-suite/lib/`. All new code is under `test-suite/live/`. Existing
    `lib/loader.mjs`, `lib/report.mjs`, `lib/pool.mjs`, `lib/checkpoint.mjs`
    are imported as-is; modifications to them, if any, are isolated to one
    additive helper. (Quality/regression criterion.)

---

## 7. Validation notes — what was checked, what was not

**Checked (code-level, on disk):**
- ElevenLabs Node SDK ships a Conversation class with `sendUserMessage`:
  `node_modules/@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/Conversation.{d.ts,js}` (read top + bottom).
- `text_only` exists in the public WS protocol types:
  `node_modules/@elevenlabs/types/dist/generated/types/asyncapi-types.d.ts:66`.
- `workflow_node_id` per turn in the GET transcript:
  `api/types/AgentMetadata.d.ts:4`, surfaced on
  `ConversationHistoryTranscriptCommonModelOutput.agentMetadata`.
- MCP tool call events stream live with state machine
  (loading → awaiting_approval → success/failure): same types file lines 174-216.
- Existing test suite structure: `runner.mjs`, `lib/api-client.mjs`,
  `lib/config.mjs`, `lib/loader.mjs`, 18 scenarios under `scenarios/`.
- `.env` contains `ELEVENLABS_PLATFORM_KEY` and `VITE_GEMINI_API_KEY` but
  no `OPENAI_API_KEY`.
- MCP server URL `https://bobcat-nacho-sustainer.ngrok-free.dev/mcp` and
  shared secret in `.env`.

**Not verified (open questions / runtime-dependent):**
- Whether the WS init accepts `starting_workflow_node_id` (Q2 spike resolves
  in Step 2).
- Whether `partial_conversation_history` is accepted on the WS init at all
  (likely not; default plan skips those scenarios).
- Exact judge-LLM divergence between gpt-4o (simulate) and gemini-2.0-flash
  (live). Step 7 calibration produces the evidence.
- Whether the real MCP server is reliably reachable during runs (operational
  concern, mitigated by pre-flight health check in Step 6).
- Whether the SDK's `audioInterface` is truly optional with a Null
  implementation, or whether it asserts on platform-specific audio APIs at
  construction time. Looked OK from the code path — `_onWebSocketOpen` calls
  `audioInterface.start(inputCallback)`, no other coupling — but Step 1
  smoke test confirms.

**Limits of this plan:**
- This plan is implementation-ready but **not implementation itself**.
- Cost estimates above are heuristic; first real `--dry-run` against the
  Gemini cost endpoint (if reachable) will refine them.
- The plan does **not** include retro-fitting the existing simulate runner
  with live-mode behaviour; that's an explicit non-goal (Q4 default).

---

## Summary

Build `test-suite/live/` with: null audio adapter, text-only WS client wrapping
`@elevenlabs/elevenlabs-js`'s Conversation, Gemini-powered simulated user and
judge, post-call transcript fetch for workflow_node_id + tool calls, and a
runner mirroring the existing CLI. Resolves Q1-Q4 with the user, then proceeds
through 8 sized steps with observable acceptance criteria. Risks are tracked
with mitigations; scope is the MVP that complements (not replaces) the
simulate suite.
