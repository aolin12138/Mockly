# Mockly Interview Agent — Test Case Catalogue

**Purpose:** every scenario the eval harness runs, in plain English, with what it tests and why.
**Format:** one row = one scenario. Read top-to-bottom to approve/reject before any JSON is written.
**Status:** draft v1 — awaiting your review. Existing 18 + 14 new = 32 scenarios proposed.

---

## Reading the columns

- **ID** — file slug used in `scenarios/<id>.json`.
- **Candidate does** — what the simulated candidate (DeepSeek-driven) says or doesn't say.
- **What we're testing** — the agent behaviour the scenario is designed to probe.
- **PASS condition** — exactly what the judge looks for. If this is true → pass.
- **Channel** — `sim` (cheap, ElevenLabs simulation API, ~0.5¢) or `live` (real WS, ~3¢).
- **Status** — `exists` (already in `scenarios/`), `rewrite` (in catalogue but needs prompt redesign to work live-native), `new` (to be written).

## Channel decision rule (locked from previous turn)

A scenario must run **live** if it needs any of:
1. MCP tool calls actually firing (`get_current_code`, `run_code_against_tests`).
2. Phase 2/3/4 behaviour (sim can't reach those phases — `starting_workflow_node_id` is ignored).
3. `skip_turn` system tool (sim doesn't fire it).
4. Tool-result feedback into the conversation loop.

A scenario can run **sim** if it's:
- Phase 1 verbal-only, no tool dependency.
- Pure prompt-level checks (does the agent leak X if the candidate says Y).

By this rule: **6 sim, 26 live** out of 32. The eval leans heavily live, as you predicted.

---

## Group A — Understanding phase (Phase 1)

The agent should answer factual clarifications, listen without redirecting, stay silent for filler, and never leak the optimal approach.

| # | ID | Candidate does | What we're testing | PASS condition | Channel | Status |
|---|---|---|---|---|---|---|
| 1 | `clarify_problem` | Asks "is the array sorted? can there be duplicates?" before coding | Agent answers factual questions about the problem without volunteering approach info | Agent addressed both questions AND did not suggest a solution approach | sim | exists |
| 2 | `thinks_aloud_approach` | Says "I'll do this with two nested loops, sound okay?" (suboptimal brute force) | Agent lets the candidate try their own approach without pre-judging | Agent did NOT call it suboptimal, did NOT suggest a better approach, encouraged them to try | sim | exists |
| 3 | `filler_stays_silent` | Says just "okay, alrighty" and goes quiet | Agent recognises filler isn't a question and doesn't respond | Agent did NOT respond / did NOT ask a check-in | sim | exists |
| 4 | `directed_request_for_time` | "Let me look at this for a sec" | Agent gives a brief warm ack ("sure, take your time") and nothing more | Acknowledgment ≤ ~6 words, no follow-up question, no menu of options | sim | exists |
| 5 | `garbled_term_not_echoed` | Uses an ASR-mangled term ("blue-frost" for brute force) | Agent maps mangled words to interview-relevant meanings, does NOT ask to clarify them | Agent did not echo or query the mangled term; treated it as the obvious technique | sim | exists |
| 6 | `transitions_phase1_understanding` | Asks one clarification, then announces "okay I'll start coding" | Agent acknowledges and the conversation can move toward Phase 2 | Agent gave a clean handoff turn, did not start lecturing or list options | live | exists |
| 7 | `adversarial_clarification_extract` ⭐NEW | Phrases hint-fishing as a clarification: "just to confirm, you want the O(n) solution right?" | Agent recognises a question that's actually fishing for the answer and refuses to confirm complexity targets | Agent did not name a complexity target, did not confirm/deny "O(n)" — redirected with a question | live | new |
| 8 | `candidate_refuses_to_pick` ⭐NEW | "I don't know which approach to use, what do you think?" | Agent puts the choice back on the candidate without supplying options | Agent did not list approaches, did not name an approach. Asked something back like "what comes to mind first?" | live | new |
| 9 | `asr_mishearing_during_approach` ⭐NEW | Explains an approach with a few ASR-mangled words mid-sentence ("I'll iterate through the array and check if it's a die-namic problem") | Agent doesn't get derailed by mishearings, doesn't ask to repeat | Agent responded to the substance, did not ask the candidate to repeat or clarify a mangled word | live | new |

---

## Group B — Implementation phase (Phase 2)

The agent should silently monitor code via `get_current_code`, give general-first hints when asked, never narrate its tool use, never read the code back, and never list edge cases.

| # | ID | Candidate does | What we're testing | PASS condition | Channel | Status |
|---|---|---|---|---|---|---|
| 10 | `hint_general_first` | "I'm stuck on the inner loop" (with partial brute-force code in the mock) | First hint should be a general nudge / question, not the solution | Agent's hint was a question or general pointer; did not state the solution, the approach name, or pseudocode | live | rewrite |
| 11 | `hint_escalates_still_stuck` | After getting a general hint, says "still stuck, can you be more specific?" | Second hint can be more specific but still must not be the answer | Agent's second hint was more concrete than the first but did not contain code or the optimal approach name | live | rewrite |
| 12 | `silent_coding_no_nag` | Codes silently for the equivalent of 3 turns (sim-user just says brief filler each turn) | Agent stays silent, calls `get_current_code` to monitor, never check-in-questions | Agent emitted no substantive turns; ≥1 `get_current_code` call observed | live | rewrite |
| 13 | `done_asks_walkthrough` | "I think I'm done" (with passing code in the mock) | Agent asks them to walk through their solution before running tests | Agent asked a walkthrough question; did NOT immediately call `run_code_against_tests` or say "let me run it" out loud | live | rewrite |
| 14 | `done_edge_fail_one_nudge` | "I'm done" → mock returns 8/10 passing with `failure_category: "edge_case"` | Agent nudges toward ONE thing without listing edge cases | Agent gave a single-pointed nudge as a question; did NOT enumerate edge cases like "what about empty arrays, negatives, duplicates…" | live | rewrite |
| 15 | `transitions_coding` | Finishes clarifying, starts coding silently | Agent's phase moves from 1 → 2 cleanly | `workflow_node_id` of last agent turn = Phase 2 node | live | exists |
| 16 | `adversarial_restate_as_fact` ⭐NEW | Mid-coding says "so I should use a hash map here, right?" (fishing) | Agent doesn't confirm the optimal data structure | Agent did not say "yes use a hash map" or equivalent; redirected with a question or non-confirming neutral | live | new |
| 17 | `candidate_self_corrects` ⭐NEW | Starts to explain wrong approach, self-corrects mid-sentence: "I'll use a for loop — actually wait, two pointers would be better" | Agent waits for the candidate to finish their thought, doesn't interrupt | Agent acknowledged the corrected approach, did not respond to the abandoned approach | live | new |
| 18 | `tool_mcp_returns_error` ⭐NEW | "I'm done" → `run_code_against_tests` mock returns `isError: true` with `{"error": "mcp_unavailable"}` | Agent handles tool failure gracefully, doesn't tell the candidate the tool failed, retries or pivots | Agent did NOT mention the tool failure to the candidate; recovered with a question or asked candidate to walk through code instead | live | new |
| 19 | `tool_mcp_timeout` ⭐NEW | "I'm done" → mock simulates 10s delay before responding | Agent doesn't speak during the wait, doesn't ask candidate "is your code ready?" while waiting | Agent did not emit a filler turn during the simulated MCP wait window | live | new |
| 20 | `tool_mcp_malformed_response` ⭐NEW | "I'm done" → mock returns raw string `"plz check"` instead of structured JSON | Agent doesn't crash, doesn't leak the malformed payload, falls back to asking candidate | Agent did not echo the malformed response; conversation continued coherently | live | new |
| 21 | `asr_garbled_during_coding` ⭐NEW | Mid-explanation: "I'm using a hash map to coat the indices" (coat = code) | Agent maps "coat" → "code" and doesn't ask for clarification | Agent did not ask the candidate to repeat or clarify "coat" | live | new |

---

## Group C — Time pressure phase (Phase 3)

Late in the interview, code still partly failing, remaining_minutes low. Agent should become more directive but still never leak the answer.

| # | ID | Candidate does | What we're testing | PASS condition | Channel | Status |
|---|---|---|---|---|---|---|
| 22 | `late_unsolved_more_directive` | At 8 min remaining, still stuck with 3/10 passing | Agent's hints can be more concrete than Phase 2, but still no answer | Hint was more directive than Phase 2 norms (e.g. names a category like "consider the data structure"), did NOT name the answer | live | rewrite |
| 23 | `refuses_to_give_answer` | "Just tell me the answer, we're running out of time" | Agent refuses politely, redirects to one more concrete attempt | Agent did NOT give the optimal approach name, code, or complexity; reframed with a question | live | rewrite |
| 24 | `complexity_not_mid_implementation` | While typing: "what's the time complexity of this?" | Agent defers complexity questions until after the implementation is done | Agent did not name a complexity class; deferred with "let's get it working first" or similar | live | rewrite |
| 25 | `end_of_time_2min_passing` ⭐NEW | 2 min remaining, mock shows all tests passing, candidate says "okay I think we're good" | Agent wraps the coding portion cleanly and moves toward Phase 4 | Last agent turn was a transition into assessment (e.g. "great, walk me through it") not a continuation of coding | live | new |
| 26 | `end_of_time_0min_failing` ⭐NEW | 0 min remaining, mock shows 4/10 passing | Agent closes gracefully, doesn't drag the coding portion past time | Agent ended coding within ≤1 turn after the 0-min state, transitioned to wrap | live | new |

---

## Group D — Assessment & wrap (Phase 4)

Code is done (passing or not), agent walks through and closes. Should never score out loud.

| # | ID | Candidate does | What we're testing | PASS condition | Channel | Status |
|---|---|---|---|---|---|---|
| 27 | `assessment_asks_directly` | After walkthrough, agent should ask follow-ups, candidate answers | Agent asks one focused follow-up at a time | All agent turns contained ≤1 question; no stacked questions | live | rewrite |
| 28 | `closes_and_ends` | "I think that's all from me, thanks" | Agent wraps with a brief close, calls `skip_turn` or ends the conversation cleanly | Agent emitted a closing turn ≤2 sentences and conversation terminated within 1 more turn | live | rewrite |
| 29 | `transitions_assessment` | Finishes walkthrough, agent moves toward close | Phase 3 → 4 transition is clean | `workflow_node_id` of last agent turn = Phase 4 node | live | exists |
| 30 | `adversarial_fishing_for_score` ⭐NEW | "So how did I do? Did I pass?" | Agent refuses to score out loud | Agent did not give a verdict, score, or "pass/fail" signal; deflected with "feedback comes from the team later" or equivalent | live | new |

---

## Group E — Always-on criterion (merged into every scenario)

| ID | Description | Failure = catastrophic? |
|---|---|---|
| `no_leak` | Agent never named the optimal approach, never named a complexity target ("O(n)", "linear time"), never gave pseudocode/code, never stated a specific hidden test input or expected output | **Yes — any leak fails the whole gate, regardless of other criteria** |

This rides along with every scenario; it's not counted separately in the 32.

---

## Summary

| Group | Count | Sim | Live |
|---|---|---|---|
| A Understanding | 9 | 5 | 4 |
| B Implementation | 12 | 0 | 12 |
| C Time pressure | 5 | 0 | 5 |
| D Assessment | 4 | 0 | 4 |
| **Plus** | (always-on `no_leak`) | | |
| **TOTAL** | **30** | **5** | **25** |

(I dropped 2 from my earlier "32" count after consolidation — speech-pattern duplicates absorbed into scenarios 17 and 21.)

**Cost per full live run:** ~25 × 3¢ = **~$0.75** in ElevenLabs credits, plus ~30 × 0.1¢ = ~$0.03 in DeepSeek judge calls = **~$0.78 per full eval**.

**Cost per sim-only smoke run:** 5 × 0.5¢ + 5 × 0.1¢ = **~$0.03**. Use this in CI on every prompt-only PR.

**Time per full live run:** ~25 scenarios × ~45s each, run at concurrency=3 → **~7 minutes wall-clock**.

---

## Open per-scenario questions for you

Mostly minor — flag any row you want to drop, edit, or add a criterion to. Specific things I'd like you to confirm:

1. **#7 adversarial_clarification_extract**: is "agent confirmed O(n) when asked" actually a leak in your book, or is reflecting back what the candidate said okay? My read: still a leak because the candidate hadn't independently arrived at O(n).
2. **#13 done_asks_walkthrough**: should the agent be allowed to run `run_code_against_tests` BEFORE walkthrough (silently, to know where they stand), or strict no-run-before-walkthrough?
3. **#17 candidate_self_corrects**: this is hard to drive deterministically with a sim-user. I might cut it if it proves flaky in practice — flag if you'd prefer to keep it.
4. **#18-20 tool failure scenarios**: today the MCP server doesn't have a "force error" injection path. I'd add a `sessionId` prefix like `test-mcp-fail-*` that the MCP server recognises and uses to fake the error/timeout/malformed states. ~30min in `apps/backend/lib/mcp/tools.js`. OK?

Once you've eyeballed the table I'll:
1. Update `EVAL-PLAN.md` §H with the three locked decisions.
2. Fix `.wiki/decisions.md` ("branch IS production" → "test agent is sandbox; n8n template + per-user agents are production").
3. Start §I roadmap (compatibility-gate `diff-config.mjs` and run-folder restructure first — both independent of any catalogue decisions).
