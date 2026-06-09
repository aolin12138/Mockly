# Technical Interview Session — Implementation Spec

**Audience:** the coding agent implementing the backend + integration.
**Assumption:** the MCP server tools are already implemented on their side (logic done). This spec covers how everything connects, the session lifecycle, dynamic variables, tool contracts, and error handling. No assumptions, no ambiguity.

---

## 0. Mental model (read first)

There are TWO lifecycles, do not confuse them:

1. **Agent provisioning + versioning** — a single workflow called EVERY time the user clicks "start interview" (after setup, before the interview page). It ensures the user has an up-to-date agent: creates one if they have none, returns the existing one if current, updates in the background if stale. Returns an `agent_id`. **Dynamic variables are NOT set here.** (Full logic in §1.)

2. **Interview session** — happens EVERY interview, on the interview page. Uses the `agent_id` from step 1. This is where dynamic variables get their actual values, where the signed URL is minted, and where the live conversation runs.

> Key rule: the agent is the template; the session is the instance. Per-interview data (question, time, session id) lives on the session, never on the agent. Config changes are handled by versioning in step 1, never by touching the session.

---

## 1. Agent provisioning + versioning (single workflow, called every "start interview")

**Key change from a naive design:** there is ONE workflow, called every time the user clicks "start interview" (after setup, before the interview page). It checks/creates/updates the agent and returns an `agent_id`. It degrades gracefully — a stale-but-working agent is always an acceptable fallback. Only one path has no fallback (first-time creation); that path fails hard, everything else fails soft.

### Versioning model
- `AGENT_CONFIG_VERSION` — a deploy-time constant in the codebase/env. It bumps in the SAME commit that changes the prompt/workflow template, so the version and the actual config always move together.
- `agent_config_version` — stored per user alongside `agent_id`. Written ONLY after a confirmed successful create/update.
- Optional: distinguish minor (prompt-only → PATCH) vs major (workflow structure change → recreate) bumps.

### The workflow (one entry point: `provision-or-update-agent`)

Input: `{ user_id, elevenlabs_api_key, voice_id }`

```
1. Look up user's agent_id + agent_config_version.

2. NO agent_id  → CREATE branch (no fallback exists):
     - POST /v1/convai/agents/create with latest templated config.
     - On success: store agent_id + AGENT_CONFIG_VERSION. Return agent_id.
     - On failure (after limited retry): HARD ERROR. There is nothing to fall back to.
       Return an error the frontend shows as "couldn't set up your interviewer, please retry."

3. HAS agent_id, version == AGENT_CONFIG_VERSION  → return agent_id immediately. Done.

4. HAS agent_id, version != AGENT_CONFIG_VERSION  → STALE branch (fallback exists):
     - Return the STORED agent_id immediately so the user proceeds with zero latency
       (the stored agent works fine — it's just slightly old).
     - Fire the update in the BACKGROUND (PATCH for minor, recreate for major):
         - On success: store new agent_id (if recreated) + AGENT_CONFIG_VERSION;
           if recreated, DELETE the old agent on the user's account (no orphans).
         - On failure/timeout: log it, leave agent_config_version UNCHANGED (so it
           retries next time). User already proceeded on the stored agent — no impact.
```

### Failure semantics (the two distinct cases — do NOT use one generic catch)
| Case                                | Has fallback?      | Behaviour                                                                 |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| CREATE fails (first-time user)      | No                 | HARD error → frontend shows retryable error, no interview until resolved. |
| UPDATE fails/times out (stale user) | Yes (stored agent) | SOFT → log, proceed on stored agent, version stays stale to retry later.  |

### Non-negotiable rules for this workflow
- Write `agent_config_version` ONLY on confirmed API success. Never optimistically.
- Bound the update with a TIMEOUT (a few seconds), not just retries — slow must degrade like failure, not stall the user.
- For the STALE branch, returning the stored agent_id is immediate; the update is background. The ONLY blocking path is CREATE (unavoidable — no agent exists yet).
- Idempotency: never create a second agent for a user who already has one.

### Where this runs
This is an n8n workflow (or backend code calling EL directly — same logic). Triggered by the backend when the user clicks "start interview," BEFORE routing them to the interview page. The agent body it sends is the version-controlled template (prompts + 4-phase workflow + tool_ids + built_in_tools). Dynamic variables are NOT set here (see §0, §4) — only at session start.

### Backend → workflow → backend
```
Backend POSTs: { user_id, elevenlabs_api_key, voice_id }
Workflow returns (success): { agent_id, version, updated: true|false }
Workflow returns (create failure): { error: "creation_failed", retryable: true }
```
On create failure the backend surfaces a retryable error to the frontend and does NOT route to the interview page. On any success (including stale-proceed), route to the interview page.

---

## 2. Interview session lifecycle (every interview)

### Step 2.1 — Backend: start-interview endpoint
`POST /interview/start` (frontend calls this when user clicks "start").

Input: `user_id`, the chosen `question_id` (or selection criteria to pick one), setup choices (difficulty, company_type).

Backend does, in order:
1. Look up the user's `agent_id` and their ElevenLabs API key.
2. Load the question from DB.
3. Create an **interview_session** record (see §3) with a unique `session_id`, `started_at = now`, `time_budget_minutes`, `question_id`, `user_id`, `language_id`.
4. Build the `dynamic_variables` object (§4).
5. Mint a signed URL from ElevenLabs (§2.2), passing the dynamic variables.
6. Return the signed URL (and `session_id`) to the frontend.

### Step 2.2 — Mint signed URL (server-side, with the user's key)
```
GET https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id={agent_id}
Header: xi-api-key: {user's EL key}
```
Returns a signed WebSocket URL (valid ~15 min — mint at click time, not on page load).

The dynamic variables are attached to the **conversation initiation** config (sent when the session opens). Depending on SDK/flow, they're passed either in the signed-url request's initiation data or in the client's `startSession` overrides. **Confirm which against the current API during ngrok testing** — but they are set HERE, at session start, NOT at agent creation.

### Step 2.3 — Frontend opens the session
Frontend receives the signed URL → opens the voice conversation. The user's API key NEVER reaches the frontend; only the signed URL does.

### Step 2.4 — During the conversation
- The agent calls the MCP tools (§5). Each tool call carries `secret__session_id` in a header so the MCP server knows which session it is.
- The agent fetches code / runs tests; tool responses refresh `remaining_minutes` (§4, Tier 3).
- Phase transitions fire based on time (web timer via tool responses) and completion (test results).

### Step 2.5 — Session end
- The agent (Phase 4) speaks its closing line, then calls the `end_call` system tool.
- The frontend catches the **call-ended event** → notifies the backend `POST /interview/end` with `session_id`.
- Backend triggers the post-interview pipeline (§6).

---

## 3. interview_session record (backend DB)

Created at session start, read by the MCP tools, finalized at end.
```
interview_session {
  session_id        TEXT PRIMARY KEY   // also passed as secret__session_id
  user_id           TEXT
  question_id       TEXT
  language_id       INT                // Judge0 language id
  started_at        TIMESTAMP
  time_budget_minutes INT
  status            TEXT               // 'active' | 'ended'
  ended_at          TIMESTAMP NULL
  // latest code: either stored here or in a separate latest_code store keyed by session_id
}
```

**Remaining time is computed, never stored as a countdown:** `remaining_minutes = time_budget_minutes - minutes_since(started_at)`. The server clock is the single source of truth. The MCP tools compute this fresh on every call.

---

## 4. Dynamic variables — the complete list

Set at **session start** (Step 2.1/2.2), in the conversation initiation `dynamic_variables` object.

### Tier 1 — per-interview context (from DB + setup)
| Variable              | Source                                   | Example                  |
| --------------------- | ---------------------------------------- | ------------------------ |
| `question_title`      | question.title                           | "Two Sum"                |
| `question_statement`  | question.problem_statement               | "Given an array..."      |
| `constraints`         | question.constraints                     | "1 <= n <= 10^4"         |
| `example_cases`       | question.examples (visible only)         | "Input: ... Output: ..." |
| `difficulty`          | question.difficulty                      | "medium"                 |
| `company_type`        | setup choice                             | "big-tech"               |
| `time_budget_minutes` | derived from question.estimated_time_min | 35                       |
| `remaining_minutes`   | initial = time_budget_minutes            | 35                       |

### Tier 2 — session id (secret)
| Variable             | Notes                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| `secret__session_id` | The `session_id`. Prefix `secret__` → goes only in tool-call headers, NEVER to the LLM. |

### Tier 3 — refreshed DURING the conversation (NOT set fresh at start beyond the initial value)
| Variable            | How it updates                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `remaining_minutes` | Every MCP tool response includes the current value; the tool config maps it back to this variable. |

**Initiation object shape:**
```json
{
  "dynamic_variables": {
    "question_title": "Two Sum",
    "question_statement": "Given an integer array nums and an integer target...",
    "constraints": "2 <= nums.length <= 10^4",
    "example_cases": "Input: nums=[2,7,11,15], target=9 -> Output: [0,1]",
    "difficulty": "medium",
    "company_type": "big-tech",
    "time_budget_minutes": 35,
    "remaining_minutes": 35,
    "secret__session_id": "sess_abc123"
  }
}
```

> CRITICAL: `remaining_minutes` must be given an initial value at start (= budget) so it is never empty before the first tool call. Otherwise the time-based edge conditions have nothing to read early in the interview.

---

## 5. Tool contracts (what the agent calls; MCP server already implements the logic)

Both tools resolve the session from the `secret__session_id` header — they take no session argument.

### 5.1 `get_current_code`
- **Purpose:** read the candidate's current code (read-only, fast). Agent calls it freely to track progress.
- **Returns (compact JSON):**
```json
{
  "code": "def two_sum(nums, target): ...",
  "language": "python",
  "elapsed_seconds": 612,
  "remaining_seconds": 588,
  "remaining_minutes": 9,
  "hint_count": 1
}
```

### 5.2 `run_code_against_tests`
- **Purpose:** run candidate code against hidden tests; return a LOSSY summary. Agent calls it when the candidate seems done or to gauge hinting.
- **Returns (compact JSON, NO failing inputs ever):**
```json
{
  "passed": 8,
  "total": 10,
  "all_passed": false,
  "failure_category": "edge_case",
  "remaining_minutes": 8
}
```
- `failure_category` ∈ `basic_case | edge_case | timeout | runtime_error | compile_error`.
- **HARD RULE (enforce server-side):** never include failing inputs, expected outputs, or actual outputs in this response. The live agent must never receive specific hidden-test data.

### 5.3 Tool config in ElevenLabs (the part to verify on ngrok)
- Each tool's response must MAP `remaining_minutes` back into the `remaining_minutes` dynamic variable (dot-path assignment in the tool's response config).
- `secret__session_id` must be sent as a request HEADER on every tool call.
- Server-to-server auth: a shared-secret header the MCP server validates.
- On the slow `run_code_against_tests`, set `pre_tool_speech: force` so the agent says something before the Judge0 wait instead of going silent.

---

## 6. Post-interview pipeline (on session end)

Triggered by `POST /interview/end` (frontend caught the `end_call` event):
1. Mark `interview_session.status = 'ended'`, set `ended_at`.
2. Submit the final code for a FULL Judge0 run against all hidden tests — DETAILED results this time (inputs, expected, actual — nothing to protect post-session).
3. Hand to the feedback agent: transcript + detailed test results + question's `solutions` / `follow_ups` / `common_mistakes` + bonus-round performance.
4. Store/return the feedback.

> Note: the lossy vs detailed split is intentional — same Judge0 runner, two summary shapes. Live = lossy (§5.2); post-session = detailed.

---

## 7. Error handling & logging (required, for traceability)

### Logging — every step, keyed by `session_id`
Log with a correlation id = `session_id` so a whole interview is traceable end-to-end:
- session start (with question_id, user_id, time_budget)
- signed URL minted (success/failure, NOT the URL itself or the key)
- each tool call received by MCP (tool name, session_id, timestamp, latency)
- each tool result returned (category/counts for test runs — safe to log; the lossy summary has no secrets)
- phase transitions if observable
- session end + pipeline steps (Judge0 submit, feedback generation)
Never log: the EL API key, the signed URL, raw hidden-test inputs.

### Error handling — explicit per failure point
| Failure                                             | Handling                                                                                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CREATE agent fails (first-time user, no fallback)   | HARD error after limited retry → frontend shows retryable "couldn't set up interviewer"; do NOT route to interview page.                                                |
| UPDATE agent fails/times out (stale user)           | SOFT → user already proceeded on stored agent; log; leave `agent_config_version` unchanged so it retries next time.                                                     |
| Recreate (major version) succeeds                   | Store new agent_id + version; DELETE the old agent on the user's account (no orphans).                                                                                  |
| User has no `agent_id` at session start             | Should not happen if §1 ran; if it does, error — don't try to start a session without an agent.                                                                         |
| Signed-URL mint fails (401)                         | User's EL key invalid/expired → surface a clear error to frontend; don't open a dead session.                                                                           |
| Signed-URL mint fails (other)                       | Retry once, then fail with the EL error message logged.                                                                                                                 |
| Tool call arrives with unknown/expired `session_id` | MCP returns a structured error; log it; agent should degrade gracefully (it just won't get code/results).                                                               |
| Judge0 timeout/unavailable (live run)               | Return a `failure_category` of `runner_error` or similar so the agent can say "couldn't run that just now" rather than hanging. Bound every Judge0 call with a timeout. |
| Judge0 fails (post-session run)                     | Retry with backoff; if it still fails, hand the feedback agent the transcript-only and flag missing test results.                                                       |
| `remaining_minutes` missing from a tool response    | This breaks time transitions — treat as a bug, alert. Tool responses must ALWAYS include it.                                                                            |
| end_call event not caught by frontend               | Have a server-side fallback: if a session is `active` past `started_at + budget + grace`, mark it ended and run the pipeline anyway, so sessions don't hang forever.    |

### Timeouts
- Bound every Judge0 submission (cpu/wall/memory limits) so `timeout` is a real, bounded signal.
- Bound the live `run_code_against_tests` overall so the agent never waits indefinitely.

---

## 8. End-to-end sequence (the whole happy path, no ambiguity)

1. User finishes setup, clicks "start interview" → backend calls the **provision-or-update-agent** workflow (§1) with `{user_id, elevenlabs_api_key, voice_id}`.
2. Workflow: no agent → create (blocking, hard-fail on error); current → return id; stale → return stored id now + update in background. Returns `agent_id`.
   - If create FAILED (first-time user, no fallback): backend shows retryable error, STOP. Do not route to interview page.
3. On success → backend routes user to the interview page.
4. User clicks the actual call-start → frontend → `POST /interview/start`.
5. Backend: load question, create `interview_session` (session_id, started_at, budget), build `dynamic_variables`, mint signed URL with the user's key + variables attached.
6. Backend → frontend: signed URL + session_id.
7. Frontend opens voice session with signed URL.
8. Agent greets (first_message with `{{question_statement}}`), runs the 4-phase interview.
9. Agent calls `get_current_code` / `run_code_against_tests` with `secret__session_id` header; MCP resolves session, computes `remaining_minutes`, returns compact (lossy for tests) JSON; tool config maps `remaining_minutes` back to the variable; time/completion edges fire.
10. Phase 4: agent gives closing line → calls `end_call`.
11. Frontend catches call-ended → `POST /interview/end` with session_id.
12. Backend: mark ended, full detailed Judge0 run, feedback agent, store feedback.

> The chain: setup click → provision/update (§1) → interview page → call-start → session+signed URL (§2) → live interview + tools (§5) → end_call → post-interview pipeline (§6). Provisioning and session are separate links; dynamic variables enter only at the session link.

---

## 9. The three things to VERIFY during ngrok testing (don't assume)
1. **Where dynamic variables attach** — in the signed-url initiation data vs. client startSession overrides. Set them, confirm the agent actually receives `{{question_statement}}` etc.
2. **Whether edge conditions can read `remaining_minutes`** — run the timer down (or mock a low value) and confirm the 2→3 transition fires. If it doesn't, the time value must be surfaced into the conversation for the edge to see it.
3. **`remaining_minutes` round-trip** — confirm a tool returning `remaining_minutes` actually updates the dynamic variable for the next turn.
```