# PRD: AI Technical Interview Simulator — Technical Track

**Status:** Draft for engineering investigation
**Scope of this document:** The technical-interview track only. The behavioural track is already built and is out of scope here except where the two share infrastructure.
**Primary audience:** Coding agent + developer, to (1) investigate the existing legacy codebase against these requirements, and (2) seed an initial question set for testing.

---

## 1. Product Vision

A platform where users practice real-world technical interviews against a voice AI that behaves like a competent human interviewer: it observes the candidate's code in real time, listens to their reasoning, stays mostly quiet, and intervenes only when useful. Its behaviour evolves over the course of the session — supportive and hands-off early, more directive as time runs short — and it provides graduated hints that never reveal the full solution. All scoring and detailed feedback happen **after** the session via a separate feedback agent.

The platform is currently more tailored to software/tech interviews, reflecting the founder's background.

### Core experience (technical session)
1. User completes a setup step: question topic/type, difficulty level, target company type.
2. The system pulls a question (currently random) from the question database and renders it on the page.
3. User presses a button to start the interview, which opens a voice conversation with an ElevenLabs conversational agent.
4. The agent receives the question context at conversation start.
5. During the session the user writes code in a text area on the platform. The agent can fetch that code on demand to understand what the user is doing.
6. The agent simulates a real interviewer: encourages the candidate's own approach, acknowledges explanations, gives well-timed graduated hints, speaks only when needed, and grows more proactive as the clock winds down.
7. After the session, a separate feedback agent analyses the full session and produces feedback.

---

## 2. Behavioural Requirements for the Interview Agent

These are product requirements, independent of implementation:

- **Minimal speech.** The agent should not talk too much. It speaks only when there is a reason to: a hint is warranted, the candidate has asked something, or an acknowledgement is appropriate after the candidate explains their methodology.
- **Encourage first, don't pre-judge.** When a candidate proposes an approach, the agent should encourage them to try it. No "I don't think this will work" at the outset, even if the approach is suboptimal. Let them explore.
- **Graduated hints.** Hints escalate in specificity only as the candidate shows repeated signs of being stuck. Start general, go progressively deeper, but **never reveal the exact/optimal solution** and **never provide solution code**.
- **Time awareness.** The agent's behaviour changes through the session. Early: hands-off, supportive, exploratory. Late (time running low): more proactive/aggressive in steering the candidate toward a working solution.
- **No live evaluation.** The agent does not score or critique during the session. All analysis is deferred to the post-interview feedback agent.

---

## 3. Architecture Decisions (Agreed)

### 3.1 Hint reasoning lives in the main agent — NOT in a subagent
**Decision:** The interview agent generates graduated hints itself, reasoning over context it already holds (the problem, the candidate's current code, elapsed/remaining time, hints already given). 

**Rationale:**
- A dedicated hint-generating LLM (behind MCP or as a tool) adds a round-trip of latency, which is highly noticeable in a *voice* conversation.
- A separate hint LLM would have *less* conversational context than the main agent, not more — so it would not produce better hints.
- No hardcoded hint ladders. Hints are generated at runtime from question metadata + live context.

### 3.2 Interview phases modelled as an ElevenLabs Workflow
**Decision:** Use ElevenLabs Agent Workflows to give each interview phase explicitly defined behaviour, rather than one monolithic prompt trying to juggle time-conditional logic.

**Phases (workflow nodes), all sharing one base prompt:**
| Phase                       | Behaviour                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Understanding** (entry)   | Listen; ask candidate to talk through approach; acknowledge; do **not** evaluate or correct; hints only if candidate misunderstands the *problem*. Mostly quiet. |
| **Implementation** (middle) | Quiet by default; fetch code periodically; offer a *general* nudge only on clear signs of being stuck; hint specificity escalates with repeated stuck signals.   |
| **Closing** (time low)      | More proactive; deeper hints; actively steer toward a working solution. Still never hand over code or name the optimal approach.                                 |

**Shared base prompt** holds: role, tone, the hint policy, and the "encourage their approach first" rule. Phase nodes **append** phase-specific instructions on top of the base; they modulate the *intensity* of the same hint policy rather than redefining it.

**Transitions (edges):**
- Understanding → Implementation: LLM condition, e.g. "candidate has finished explaining their approach and begun writing code."
- Implementation → Closing: condition on a remaining-time dynamic variable crossing a threshold.
- (Optional, future) Implementation → Closing/Wrap-up early if the candidate has clearly solved it ahead of time.

**Known tradeoff:** A workflow agent is a graph (nodes, edges, conditions, per-node config). Provisioning it across many user accounts is heavier than provisioning a single-prompt agent, and graph changes require re-provisioning. **Mitigation:** the workflow-agent definition MUST be a single templated artifact deployed programmatically and identically per account — never hand-edited per user.

### 3.3 The agent is provisioned on each user's own ElevenLabs account
**Context:** The platform creates a customised ElevenLabs agent on each user's ElevenLabs account via API (so usage/billing sits with the user). Agents cannot reuse one locally-created agent.

**Implication:** Centralised control of behaviour cannot live "in the agent" alone. It comes from (a) the shared templated workflow definition, and (b) a central MCP server the agents connect to (see 3.4).

### 3.4 MCP server for tools and state — NOT for hint generation
**Decision:** Stand up a central MCP server that all provisioned agents connect to. It holds **data and state tools**, not hint logic.

**Tools:**
1. **`fetch_user_code`** — returns the candidate's current code from the platform text area, **and runs it against the question's test cases**, returning a *deliberately lossy* summary of the result (see §3.7). Returns JSON that ALSO includes session metadata: `elapsed_seconds` / `remaining_seconds`, `hint_count`, current phase. The agent calls this periodically.
2. **`log_event`** (recommended) — records hints given, code snapshots, and phase transitions in a central, schema-controlled store for the post-interview feedback agent to consume.

**Why central:** Deploy fixes once; never re-provision N agents to change tool behaviour; every session writes structured events against one schema regardless of whose account ran it.

### 3.5 ElevenLabs platform primitives in use
- **Dynamic variables** (`{{var}}`) inject per-conversation context (question, difficulty, company type, time budget) at conversation start without provisioning new agents. Tool calls can also update dynamic variables by returning JSON with the value at a specified dot-path.
- **Server tools / MCP tools** are how the agent reaches the MCP server (the code fetch).
- **Workflows + subagent nodes** implement the phases (ElevenLabs "subagent node" = a phase node that overrides/appends config; it is **not** a separate hint LLM).

### 3.6 Time synchronisation
The workflow has no clock of its own. `fetch_user_code` returns `elapsed_seconds`/`remaining_seconds`, mapped into a dynamic variable via the tool's response assignment. The Implementation→Closing edge condition reads that variable. The periodic code fetch therefore doubles as the clock sync — no extra machinery needed.

### 3.7 Code execution + two summary shapes
**Decision:** Candidate code is executed against the question's test cases by a backend runner. Neither agent ever sees raw harness output — a script summarises the run before it reaches an agent. Crucially, there are **two different summary shapes for two different consumers**:

- **Live summary (to the interview agent, via `fetch_user_code`):** deliberately *lossy* and non-leaking. May include: pass/fail counts, and a *category* of failure ("fails on an edge case", "times out on large inputs", "wrong output on basic case"). It MUST NOT include the actual failing inputs or expected outputs, because the live agent's job is to avoid giving away the solution — surfacing a hidden test case through the agent would leak part of the problem. The summary gives the agent enough signal to decide *whether and how hard to hint*, nothing more.
- **Feedback summary (to the post-session feedback agent):** fully detailed. After the session ends, the final code is auto-submitted for a complete run against the full test set, and the detailed results (which cases passed/failed, inputs, expected vs actual) are sent to the feedback agent. There is nothing left to protect post-session, so this can be complete.

Same runner and same raw results feed both; only the summarisation differs. Both summaries should be compact JSON, not raw runner metadata.

**Runner requirement:** this implies a sandboxed code-execution environment (language(s) matching what the platform's code area accepts), with per-run time limits (so "times out" is a real signal). Phase 1 investigation should assess whether any execution capability exists today or whether this is net-new.

---

## 4. Phase 1 Deliverables (this PRD)

### 4.1 Legacy code investigation
Audit the existing codebase and report on fit against the architecture above. Specifically:

1. **Agent provisioning path.** How are ElevenLabs agents currently created on user accounts via API? Is it a single templated definition or hand-assembled? Can it be extended to provision a *workflow* agent (graph: nodes, edges, conditions) rather than a single-prompt agent?
2. **Context injection.** How is question info currently passed to the agent at start (today: a system message)? Can it migrate to **dynamic variables** for question, difficulty, company type, and time budget?
3. **Code fetch tool.** How is the current "fetch the user's typed code" tool implemented and wired? Is it a server tool hitting the platform, or something else? Document the contract so it can move behind the central MCP server and be extended to also return session metadata (time, hint count, phase).
4. **MCP readiness.** Is there an existing MCP server (the platform already has an n8n connector and a Google Drive connector)? Assess effort to stand up / extend a central MCP server exposing `fetch_user_code` and `log_event`.
5. **Session state.** Where does session timing live today (if anywhere)? Identify the source of truth for `elapsed_seconds` so the code-fetch tool can return it reliably.
6. **Event logging for feedback.** What does the post-interview feedback agent currently read? Define the gap to a structured `log_event` store.
7. **Code runner.** Does any sandboxed code-execution capability exist today? Assess effort to build/integrate a runner that executes candidate code against `test_cases` with per-run time limits, and produces the two summary shapes in §3.7. Identify supported language(s) (must match the platform code area).
8. **Question DB schema.** Document the current question schema (the DB is **not** yet seriously seeded — redesign is on the table; see §5).

Output of the investigation: a written gap analysis mapping each requirement above to "exists / partial / missing," with effort estimates.

### 4.2 Seed an initial question set for testing
Before building the workflow, seed a small set of questions so the end-to-end flow can be tested.

**Proposed question schema** (redesign from scratch, since DB is unseeded). No hardcoded hint ladders — the live agent generates hints from this metadata:

| Field                  | Purpose                                                                       | Shown live?                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `id`                   | Identifier                                                                    | —                                                                           |
| `title`                | Short name                                                                    | Yes                                                                         |
| `statement`            | Full problem statement                                                        | Yes (rendered on page)                                                      |
| `constraints`          | Input sizes, edge conditions                                                  | Yes                                                                         |
| `example_cases`        | 2–3 sample input/output pairs illustrating the problem                        | Yes (rendered with statement)                                               |
| `topic` / `type`       | For setup filtering                                                           | —                                                                           |
| `difficulty`           | For setup filtering                                                           | —                                                                           |
| `company_type`         | For setup filtering                                                           | —                                                                           |
| `test_cases`           | Full set of input/output pairs incl. edge cases, used to validate correctness | **No** — feedback agent only                                                |
| `canonical_approaches` | 2–3 optimal approaches, with names                                            | **No** — feedback agent only                                                |
| `complexity_targets`   | Target time/space complexity                                                  | **No** — feedback agent only                                                |
| `common_pitfalls`      | Typical misconceptions / mistakes                                             | **No** — feeds the agent's *general* hints so they're relevant, not generic |

The `common_pitfalls` field is what lets the agent give a *relevant* early hint (e.g. "have you considered duplicates?") rather than a generic one, without ever exposing the solution.

**Test cases — two kinds, different visibility:**
- `example_cases` are shown live alongside the statement (like a real interview's sample I/O). They help the candidate understand the problem.
- `test_cases` are the full validation set including edge cases. They are **not** shown live — revealing every edge case would give away part of the problem. They feed the feedback agent so it can assess whether the candidate's code would actually have passed. (The live agent may *draw on* the existence of an uncovered edge case to shape a hint — "what happens with an empty input?" — but never recites the hidden cases.)

**Seeding task:** populate ~5–10 questions across at least 2 difficulty levels and a couple of topics, fully filled out (including the not-shown-live fields and a complete `test_cases` set per question), enough to exercise setup → render → interview → feedback end to end.

---

## 5. Phase 2 (Next, after Phase 1) — Build the Workflow + Automated Provisioning

Out of scope to *implement* in Phase 1, but Phase 1 investigation must not block it:

1. **Build the ElevenLabs workflow** (3 phase nodes + base prompt + edges) — to be done collaboratively.
2. **Automated provisioning pipeline.** The workflow agent must be created automatically on each user's account. Two candidate approaches:
   - **Direct API** from the platform backend.
   - **n8n orchestration** (already connected): a visual, debuggable pipeline for the multi-step "create agent → attach MCP server → configure workflow nodes/edges → set dynamic variables" sequence.
   - **Open decision / Phase 1 to validate:** which path. n8n is attractive given it's already in use, but either way the workflow definition must be a single templated artifact deployed identically per account.
3. **Connect everything** (provisioned workflow agent ↔ central MCP server ↔ platform code area + session timing ↔ event log) and **run a real end-to-end test session.**

---

## 6. Open Items / To Decide Later
- Exact time refresh cadence for the code-fetch tool and the precise threshold for Implementation→Closing.
- Whether Closing is reachable by time only, or also by early completion (wrap-up branch).
- Direct API vs n8n for provisioning (Phase 1 to inform).
- Feedback agent's exact consumption contract from `log_event`.
- Exact failure *categories* the live summary (§3.7) exposes, and how the runner classifies a failing run into one — needs to be expressive enough to guide hinting but coarse enough not to leak.
- Supported execution language(s) and sandbox/runner technology.
- Whether the live runner runs against the *full* test set or a reduced subset each fetch (latency vs. signal quality during the live session).

---

## 7. Glossary (disambiguation)
- **Subagent (our earlier usage):** a separate hint-generating LLM. **Decision: not used.**
- **Subagent node (ElevenLabs):** a phase node in a workflow that appends/overrides config. **Decision: this is what implements our phases.**
- **MCP server:** central, self-hosted tool host the provisioned agents connect to. Holds data/state tools (`fetch_user_code`, `log_event`), not hint logic.