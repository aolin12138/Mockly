# Plan: Enable simulation-mockable tools + fix Phase 4 close

## 1. Objective

Make the ElevenLabs simulation runs actually exercise `get_current_code` and
`run_code_against_tests`, instead of only mentioning them. Today the agent has
those tools wired in via MCP (`MocklyMCPServer_get_current_code`,
`MocklyMCPServer_run_code_against_tests`), which work in real conversations
but the simulation `tool_mock_config` either does not intercept the
MCP-prefixed names or there is no working tool surface at all for the
simulator to call. Separately, Phase 4 ("Assessment & Close") loops on
"Goodbye!" because the agent has no end‑of‑call tool enabled. Both must be
fixed for the test suite to be trustworthy.

## 2. Confirmed assumptions and constraints

Verified from the live agent config (GET on `agent_2201ktp0n7mwek6avkphs4x6394m`,
branch `agtbrch_1301ktp0n97rfn4tkjz5626383hm`):

- Tools are stored at `conversation_config.agent.prompt.tools` (an array of
  tool objects), **not** `platform_settings.tools` as the brief said. The
  brief's name is wrong but the mechanism is the same.
- The only tool currently in that array is the `skip_turn` system tool. There
  are no `webhook` (client) tools yet.
- MCP integration is enabled via `conversation_config.agent.prompt.mcp_server_ids`
  → `["mcaiiVJDVZFS5dB7RFN2"]`. That is where the
  `MocklyMCPServer_*` tools come from at runtime.
- `built_in_tools.end_call` is **`null`**, i.e. the system `end_call` tool is
  not enabled. Phase 4's prompt already says "Say your closing line FIRST,
  completely, and THEN end the call" but there is literally no tool wired up
  for the LLM to call. That fully explains the "Goodbye!" loop.
- The branch the test suite hits (`agtbrch_1301ktp0n97rfn4tkjz5626383hm`) is
  the **Main** branch with `current_live_percentage: 100`. There is no
  separate test branch — modifying this branch affects production traffic.
- The Phase 4 node's `additional_prompt` already contains "Call
  get_current_code … Call run_code_against_tests" (bare names, no MCP prefix).
  That matches the simulator's expectations after the changes below.
- The test suite (`test-suite/lib/loader.mjs` → `normalizeToolMocks`) rewrites
  scenario tool-mock keys via `realToolName()` (`config.mjs` → `TOOL_NAME_MAP`)
  to the MCP-prefixed names before sending. Scenarios use bare names today,
  so flipping the map back to identity reverts to bare names.

Operational constraints:

- Must not regress real conversations on Main. Real users currently rely on
  the MCP tools.
- Must not silently change which tools the LLM picks when both an MCP tool
  and a same-named webhook tool exist.
- One scenario (`15-closes-and-ends`) and arguably all Phase-4-targeted
  scenarios depend on the close fix. Both fixes should land before re-running
  the suite.

## 3. Open questions (decide before execution)

Q1. **Webhook URL for the two client tools.** Two options, with very
different blast radius:

- **A. Dummy URL** (e.g. `https://example.invalid/mockly-noop`). Simulation
  works because the simulator never actually hits the URL — it returns the
  mocked value. But in **real conversation**, if the LLM picks the webhook
  tool over the MCP tool (likely, because the prompt says
  "Call `get_current_code`" — that string matches the webhook name
  exactly, not `MocklyMCPServer_get_current_code`), the real call fails.
- **B. Real backend URL** that proxies to the same logic as the MCP server.
  Simulation still works (mocked), and real conversation works too. Needs
  knowing/creating a real HTTP endpoint.
- **C. Remove the MCP integration** and serve both tools as webhooks.
  Cleanest long-term; same backend work as B, plus dropping the MCP server
  from `mcp_server_ids`.

Q2. **Same-name collision risk.** If we keep MCP **and** add bare-name
webhook tools (option A above), which one does the LLM call in real
conversations? This needs a test run on a non-production surface before
flipping in production. Easiest verification: spin up a non-archived branch
copy and try a real-conversation sanity check there.

Q3. **Phase 4 close — scope of this plan.** The brief mentions Phase 4 as
"this might need prompt fixes". The actual cause is that the `end_call`
built‑in tool is disabled (null). Do we (a) enable it now in the same patch
because it's clearly missing, or (b) carve it into a separate plan to keep
this one narrowly scoped to "make sim tool calls happen"?

Q4. **Backwards compatibility of `TOOL_NAME_MAP`.** After the change the map
becomes an identity map. Should we delete it (and `realToolName`) or keep it
as a forward-compat hook in case future tools need renaming?

Default proposal (used by the rest of this plan, change if Qs are resolved
otherwise):

- Q1/Q2 → **A** (dummy URL) **for the test branch only**, gated by **Q3
  resolved as (a)**, **and** Q2 verified by one real-conversation sanity test
  on a non-live branch before promoting. Long term move to B/C, tracked
  separately.
- Q4 → keep `TOOL_NAME_MAP` and `realToolName` as an identity hook; remove
  the two MCP-prefixed entries.

## 4. Step-by-step plan

### Step 0 — Spike: does `tool_mock_config` actually intercept MCP-prefixed names? (≤ 1 tool call to the API)

Reason: the whole premise of "MCP can't be mocked in sim" comes from prior
runs that mocked bare names. We never explicitly tried mocking the
MCP-prefixed name. If `tool_mock_config["MocklyMCPServer_get_current_code"]`
just works, all the agent-mutation steps below become unnecessary.

- Write `test-suite/spike-mcp-mock.mjs` that calls `simulate-conversation`
  with one tiny scenario (Phase 2, user says "I'm done, can you check?") and
  `tool_mock_config` keyed by the MCP-prefixed names.
- Pass criterion: the response transcript shows at least one
  `tool_calls[].tool_name` containing `get_current_code` **and** the
  corresponding `tool_results[].result_value` matches the mocked payload.
- If PASS → skip Steps 1–3, jump to Step 4 (Phase 4 fix) and Step 6 (verify).
- If FAIL → continue with Steps 1–5.

### Step 1 — Snapshot current agent config

- `node test-suite/snapshot-agent.mjs` (new) — GETs the agent + branch and
  writes the full JSON to
  `test-suite/checkpoints/agent-pre-clienttools-<ISO-date>.json`. This is the
  rollback point.

### Step 2 — PATCH: add two webhook (client) tools to the agent

PATCH `https://api.elevenlabs.io/v1/convai/agents/agent_2201ktp0n7mwek6avkphs4x6394m?branch_id=agtbrch_1301ktp0n97rfn4tkjz5626383hm`
with body equal to the current agent's `conversation_config` mutated so that
`conversation_config.agent.prompt.tools` contains the existing `skip_turn`
plus the two new entries below. (PATCH the smallest nested subtree the API
accepts — confirm by reading ElevenLabs `update_agent` shape: it accepts
top-level `conversation_config` and merges. Use the same pattern that
`update-phases.mjs` already uses for `workflow`, only on `conversation_config`.)

New tool entries (schema mirrored from the existing `skip_turn` object plus
the documented `webhook` fields the dashboard uses for client tools):

```jsonc
{
  "type": "webhook",
  "name": "get_current_code",
  "description": "Fetches the candidate's current code from the editor. Returns code, language, remaining_minutes, hintCount.",
  "response_timeout_secs": 20,
  "disable_interruptions": false,
  "force_pre_tool_speech": false,
  "pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "api_schema": {
    "url": "https://example.invalid/mockly-noop",
    "method": "GET",
    "request_headers": {},
    "query_params_schema": null,
    "request_body_schema": null
  }
}
```

```jsonc
{
  "type": "webhook",
  "name": "run_code_against_tests",
  "description": "Runs the candidate's code against the hidden test suite. Returns passedTests, totalTests, allPassed, failureCategory, compilationError, remainingMinutes.",
  "response_timeout_secs": 20,
  "disable_interruptions": false,
  "force_pre_tool_speech": false,
  "pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "api_schema": {
    "url": "https://example.invalid/mockly-noop",
    "method": "POST",
    "request_headers": {},
    "query_params_schema": null,
    "request_body_schema": null
  }
}
```

Field caveat: the exact webhook tool schema (`api_schema` shape, presence of
`url` vs `webhook.url`) must be confirmed against an existing webhook tool
in any other ElevenLabs agent we have access to, or against the
`POST /v1/convai/tools` documentation. If the shape differs from the
sketch above, the script must adapt — this is a "verify before PATCH"
checkpoint.

Concretely, write `test-suite/add-client-tools.mjs` that:

1. GETs the current agent (`?branch_id=…`).
2. Asserts the snapshot from Step 1 exists.
3. Computes the new `tools` array (existing tools + the two above, dedup by
   `name`).
4. If `--dry-run`, prints a diff of the `tools` array and exits.
5. Otherwise PATCHes `conversation_config` and prints the new `version_id`.

### Step 3 — Update test suite to use bare tool names

In `test-suite/lib/config.mjs`:

```js
export const TOOL_NAME_MAP = {
  // Identity. Scenarios already use bare names; client tools on the agent
  // now match these names directly. Kept as a hook for future renames.
};
```

Scenarios already use bare names (`get_current_code`,
`run_code_against_tests`) — confirmed by `rg "MocklyMCPServer_"
test-suite/scenarios | wc -l` → expect 0. No scenario edits required.

`realToolName` keeps its current semantics (`return MAP[name] || name`) so
unmapped names pass through unchanged. No other code change needed.

### Step 4 — Enable the `end_call` system tool (Phase 4 fix)

PATCH `conversation_config.agent.prompt.built_in_tools.end_call` from `null`
to a populated object mirroring the existing `skip_turn` skeleton:

```jsonc
{
  "type": "system",
  "name": "end_call",
  "description": "",
  "response_timeout_secs": 20,
  "disable_interruptions": false,
  "force_pre_tool_speech": false,
  "pre_tool_speech": "auto",
  "assignments": [],
  "tool_call_sound": null,
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "params": { "system_tool_type": "end_call" }
}
```

The Phase 4 `additional_prompt` already says "Say your closing line FIRST,
completely, and THEN end the call." No prompt edit needed yet; re-run the
suite and observe whether the agent now calls `end_call`. Only edit the
prompt if Phase 4 still loops after the tool is enabled.

This can be folded into the same PATCH as Step 2 to keep version churn low.
Recommend doing so (single new `version_id`).

### Step 5 — Smoke test on a fresh sim call

Run `test-suite/update-phases.mjs` (it already contains a minimal "I am
done, can you check?" sim with bare-name mocks). Expected:

- `allTools` includes `get_current_code` and `run_code_against_tests`.
- Final log line prints "MCP tools called? YES!" (script's name is
  misleading — it just checks for those substrings).

### Step 6 — Re-run the suite

```
node test-suite/runner.mjs --all --yes
```

Compare against the most recent checkpoint to confirm:

- Scenarios that depend on tool calls (notably the Phase 2/3 ones that mock
  `get_current_code` / `run_code_against_tests`) now actually exercise the
  tools (visible in the transcript JSON).
- Scenario `15-closes-and-ends` passes the `decisive_close` and
  `ends_after_goodbye` criteria.

### Step 7 — Rollback path (must be one command)

If the live agent misbehaves in real conversations (Q2 risk), restore from
the snapshot in Step 1:

```
node test-suite/restore-agent.mjs test-suite/checkpoints/agent-pre-clienttools-<ISO>.json
```

(Existing `lib/checkpoint.mjs` has a `restoreCheckpoint` that does a PATCH
back — confirm it handles `conversation_config`, not only `workflow`. If
not, write `restore-agent.mjs` as a thin wrapper.)

## 5. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM picks the new bare-name webhook over the MCP tool in real conversations and hits `example.invalid`. | High (prompt verbatim matches webhook name) | High — real interviews break | Verify on a non-live branch first; if confirmed, choose Q1 option B/C before flipping Main. Hold Step 2 behind that verification. |
| ElevenLabs PATCH overwrites `prompt.tools` instead of merging, dropping `skip_turn`. | Medium | Medium — `skip_turn`-based scenarios fail | Always PATCH with the full computed `tools` array (existing + new), never with a partial. Step 2 script does this. |
| `api_schema` shape for webhook tools differs from sketch. | Medium | Low (PATCH fails fast) | Pre-verify shape from API docs or by reading another agent that already has a webhook tool. PATCH returns 4xx with field hints. |
| Enabling `end_call` causes the agent to hang up earlier than intended in Phase 1/2/3 too. | Low (prompt scoping is per-phase) | Medium | Re-run full suite, not just Phase 4 scenarios. Watch for unexpected early ends. |
| Production traffic hits the modified Main mid-deploy. | Medium | Medium | Plan execution during low-traffic window; rollback ready (Step 7). |
| Scenario or runner code already has hidden coupling to `MocklyMCPServer_` prefix outside `config.mjs`. | Low | Low | `rg "MocklyMCPServer" test-suite` before and after change — expect zero matches after Step 3. |

## 6. Acceptance criteria

Observable, yes/no, no judgment required:

1. After PATCH, GET of the agent (same branch) shows
   `conversation_config.agent.prompt.tools` containing exactly three entries
   with `name` ∈ {`skip_turn`, `get_current_code`, `run_code_against_tests`}.
2. After PATCH, GET shows
   `conversation_config.agent.prompt.built_in_tools.end_call.params.system_tool_type
   === "end_call"`.
3. The Step 5 smoke sim transcript contains at least one
   `tool_calls[].tool_name === "get_current_code"` **or**
   `"run_code_against_tests"` and a matching `tool_results` entry whose
   `result_value` parses to the mocked JSON.
4. `node test-suite/runner.mjs --all --yes` exits 0 **or** the failure count
   on Phase-4-tagged scenarios is strictly lower than the previous
   checkpoint (whichever the user accepts as "done" — needs confirmation).
5. Scenario `15-closes-and-ends` has both `decisive_close` and
   `ends_after_goodbye` reported as success in the report HTML.
6. `rg "MocklyMCPServer" test-suite | wc -l` returns 0 after Step 3.
7. A real (non-simulated) conversation on a sandbox / sanity-check surface
   still succeeds in calling either the MCP or webhook variant of
   `get_current_code` without hitting `example.invalid` — see Q2.

## 7. Validation notes (what was checked, limits)

Checked (live API calls during planning):

- Agent `agent_2201ktp0n7mwek6avkphs4x6394m`, branch
  `agtbrch_1301ktp0n97rfn4tkjz5626383hm` is **Main** with
  `current_live_percentage: 100` and `protection_status:
  writer_perms_required`. Confirmed via `/v1/convai/agents/.../branches`.
- Tools live at `conversation_config.agent.prompt.tools`, current contents
  `[skip_turn]`. `mcp_server_ids = ["mcaiiVJDVZFS5dB7RFN2"]`.
- `built_in_tools.end_call === null`. Other built-ins also null.
- Phase 4 node `node_01kt35w596exs8pbna62db1zkr` already references both
  bare tool names in `additional_prompt` and instructs explicit close +
  end-of-call.
- Scenarios in `test-suite/scenarios/*.json` use bare tool names; the
  prefixed form only appears in `test-suite/lib/config.mjs` and in the
  comment of `verify-api.mjs`.
- `test-suite/lib/loader.mjs::normalizeToolMocks` rewrites scenario keys via
  `realToolName` → flipping the map to identity is a one-line change with
  no other call-site surprises (no other consumers of `realToolName` in
  `test-suite/`).

Not checked (require execution, deferred to implementation):

- Exact `api_schema` field name and validation rules for `webhook`-typed
  tools on the `update_agent` endpoint. The sketch in Step 2 follows the
  pattern other ElevenLabs agents use but must be confirmed at PATCH time
  (a 4xx response will name the field). This is the single largest
  unknown.
- Whether `tool_mock_config` keyed by the **MCP-prefixed** name already
  intercepts the call in simulation (Step 0 spike). If it does, the
  cheapest fix is to update `TOOL_NAME_MAP` consumers to also pass MCP
  names and skip Step 2 entirely. Worth 10 minutes before mutating the
  agent.
- Whether `checkpoint.mjs::restoreCheckpoint` round-trips
  `conversation_config` (it currently round-trips `workflow`). Needed for
  Step 7 rollback.
- Real-conversation behaviour after Step 2 (Q2). Cannot be tested without a
  voice client; should be done by the user on a sandbox surface or by
  staging on a non-archived branch first.

