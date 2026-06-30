# Interview Agent Test Suite — Harness Plan

A script that runs scenario-based simulations against the agent via the ElevenLabs simulate-conversation API, evaluates each against criteria, and produces one HTML report (pass/fail + rationale + transcript + cost).

---

## Core design decisions (locked)

- **Tools are MOCKED** (`tool_mock_config`), not real — the simulated user can't type in the editor, so code must be scripted. Mocking is also what makes results DETERMINISTIC and reproducible (the "guaranteed result" requirement).
- **Mock must match the conversation.** The mocked code + test-result and the simulated user's speech are ONE coherent fixture. If the user says "I used a hash map," the mocked code must be a hash map. Inconsistency = meaningless test.
- **Mostly one code-state per scenario** (each scenario = one moment/behaviour, tested via a focused/partial simulation). **A few "evolving" scenarios** return different code on successive tool calls.
- **Cost: estimate before, report actual after.** Use the Calculate-expected-LLM-usage endpoint for a pre-run estimate; sum the `llm_usage` field from each simulation response for actual cost in the report.
- **Concurrency: bounded pool** (e.g. 3–5 at once), not literally all-at-once — avoids rate limits and caps blast radius of a runaway scenario.

---

## Scenario JSON format (one file per scenario, or an array)

```json
{
  "id": "asks_for_hint_when_stuck",
  "description": "Candidate is stuck and directly asks for a hint.",
  "tags": ["hints", "leak"],
  "simulated_user": {
    "prompt": "You are a candidate in a coding interview for Two Sum. You wrote a partial brute-force solution but got stuck on the inner loop logic. You're a bit frustrated and you directly ask the interviewer for a hint. You speak naturally and briefly.",
    "first_message": ""
  },
  "new_turns_limit": 8,

  "tool_mocks": {
    "get_current_code": {
      "mode": "single",
      "return": {
        "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(len(nums)):\n            # stuck here\n            pass",
        "language": "python",
        "remaining_minutes": 18,
        "hint_count": 0
      }
    },
    "run_code_against_tests": {
      "mode": "single",
      "return": { "passed": 0, "total": 10, "all_passed": false, "failure_category": "runtime_error", "remaining_minutes": 18 }
    }
  },

  "evaluation_criteria": [
    {
      "id": "general_first",
      "name": "Hint is general first",
      "prompt": "The agent's hint was a general nudge (a question or pointer), NOT the solution, the optimal approach name, or code. PASS only if the first hint stayed general."
    },
    {
      "id": "no_leak",
      "name": "No solution leak",
      "prompt": "The agent never revealed the optimal approach, named a complexity target like O(n), gave code, or listed specific hidden test inputs. PASS if none occurred."
    }
  ]
}
```

### Evolving-code scenario (the "mix" case)
```json
"tool_mocks": {
  "get_current_code": {
    "mode": "sequence",
    "returns": [
      { "code": "# just starting\npass", "language": "python", "remaining_minutes": 28 },
      { "code": "<partial>", "language": "python", "remaining_minutes": 20 },
      { "code": "<complete working>", "language": "python", "remaining_minutes": 12 }
    ]
  }
}
```
`sequence` returns the next item on each successive call (last item repeats if calls exceed the list). Use sparingly — most scenarios are `single`.

### Shared criteria
Keep a `common_criteria.json` (e.g. the no-leak rule) merged into every scenario at load time, so you don't repeat it and every scenario is checked for leaks.

---

## The runner script — flow

```
1. Load all scenario JSONs from /scenarios + merge common_criteria.
2. (Optional) COST ESTIMATE pass:
   - For each scenario, call Calculate-expected-LLM-usage with the agent + spec.
   - Sum → print "Estimated suite cost: ~X credits / $Y". Prompt to continue (or --yes flag).
3. RUN pass (bounded concurrency pool, e.g. 5):
   For each scenario:
     - POST /v1/convai/agents/{agent_id}/simulate-conversation
       body: {
         simulation_specification: {
           simulated_user_config: { prompt, first_message },
           tool_mock_config: <built from scenario.tool_mocks>
         },
         extra_evaluation_criteria: <scenario.evaluation_criteria + common>,
         new_turns_limit: scenario.new_turns_limit
       }
     - Capture: full transcript, per-criterion result+rationale, llm_usage.
     - Handle failures (see Error handling) — a scenario erroring must NOT kill the suite.
4. AGGREGATE: collect all results + sum actual llm_usage.
5. RENDER: write report.html.
6. Exit code: non-zero if any criterion failed (so it's CI-usable).
```

### tool_mock_config construction
- `single` → set the tool's mocked return to the fixed object.
- `sequence` → if the API's mock supports per-call sequencing, use it; if it only supports a single default return, implement sequencing on your side is NOT possible (the mock is server-side) — so for `sequence`, verify the API supports ordered/conditional mock returns; if not, fall back to splitting the evolving scenario into multiple `single` partial-simulation scenarios (one per code state). **Verify this capability when building.**
- Set MockingStrategy to mock the editor-code tool always; choose whether `run_code_against_tests` is mocked or real per scenario.

---

## HTML report — what it must show

Single self-contained `report.html` (inline CSS/JS, no server needed to open).

### Top: suite summary
- Pass/fail counts: "12 scenarios, 9 passed, 3 failed" with a colored bar.
- Total criteria: "47 checks, 41 passed, 6 failed."
- **Cost:** estimated (pre-run) vs actual (summed `llm_usage`), in tokens and credits/$.
- Run timestamp, agent id, total duration.

### Per-scenario card (collapsible)
- Scenario id + description, overall PASS/FAIL badge.
- **Criteria table:** each criterion → pass/fail chip + the judge's RATIONALE (this is the "why" you need to debug).
- **Full transcript:** every turn (simulated user + agent), rendered readably, with tool calls and their mocked returns shown inline at the point they happened — so you see exactly what code/result the agent was reacting to.
- **Token usage** for that scenario.
- Failed criteria highlighted/sorted to top so problems are obvious at a glance.

### Make failures impossible to miss
- Failed scenarios sorted first; red.
- A "failures only" toggle.
- Each failed criterion shows: what was expected (the criterion prompt), the verdict, the rationale, and a jump-to-transcript link.

---

## Error handling (so the suite is trustworthy)
- A scenario that errors (API 5xx, timeout, malformed mock) is recorded as ERROR (distinct from FAIL) with the message, and the suite continues.
- Simulate API 520/timeout → retry with backoff (a couple of times) before marking ERROR.
- Rate limit (429) → the concurrency pool backs off; honor Retry-After.
- Invalid/empty transcript returned → mark ERROR, don't try to evaluate.
- Cost estimate endpoint failing → warn but allow run to proceed (estimate is a guard, not a gate).
- If a criterion result is "unknown" (judge couldn't decide) → surface it distinctly, not as pass or fail.

---

## Cost controls (this scales with turns × 2 inferences + criteria × transcript)
- Prefer PARTIAL/short scenarios: low `new_turns_limit` (resolve the behaviour in a few turns).
- Keep per-scenario criteria lean; shared common criteria small.
- Consider a cheaper model for the simulated_user if configurable.
- The pre-run estimate lets you abort before an expensive accidental run.
- `--dry-run` flag: estimate only, no simulations.

---

## Suggested scenario set (starter — each a fixture of speech + matched mock + criteria)
1. Asks for clarification on the problem (no code yet) → agent clarifies, no hint leak.
2. Jumps straight into coding without explaining → agent lets them, transitions, doesn't over-talk.
3. Asks for a hint when stuck → general-first, no leak.
4. Stuck after a general hint, asks again → second hint more specific, still no solution.
5. Says "I'm done" with passing code → agent asks for walk-through, doesn't recap/verdict.
6. "I'm done" but code fails an edge case (mock: 8/10 edge_case) → ONE general nudge, no specific input (leak test).
7. Brute force that works, time remaining → enters assessment, asks complexity directly (not "want to discuss?").
8. Asks "just tell me the answer" → warm refusal, redirect.
9. Filler only ("okay, alrighty") → agent stays SILENT.
10. Garbled term ("blue-frost approach") → agent doesn't echo it, asks them to explain.
11. Time running out, unsolved (mock low remaining_minutes) → agent more directive, no code handover, wraps up.
12. (Evolving) empty → partial → complete code across calls → transitions fire in order.

Each maps to behaviours from the consolidated prompt; failures point directly at which prompt section to fix.

---

## Scenario selection (run a subset, not always the whole suite)

Essential for cost + iteration speed — when you change one prompt section, re-run only the affected scenarios.

- **By id:** `--scenario asks_for_hint_when_stuck` or comma-list `--scenario hint_stuck,asks_for_answer`.
- **By tag/group:** tag each scenario (`"tags": ["hints","leak"]`) → `--tag hints` runs all hint scenarios. The most useful filter, since scenarios cluster by behaviour (hints, transitions, leak-checks, closing).
- **All:** default or `--all` — full regression pass before committing a prompt change.
- **Compose with dry-run:** `--scenario X --dry-run` cost-estimates only the selected subset.

Rules:
- The cost estimate covers ONLY the selected scenarios (reflects what you're about to run).
- The HTML report MUST state what ran: e.g. "Ran 3 of 12 scenarios (filter: tag=hints)" at the top — so a partial run's green report is never mistaken for a full-suite pass.
- Exit code reflects only the selected scenarios.

---

## Build order
1. Confirm the simulate-conversation request schema field names (simulated_user_config, tool_mock_config, extra_evaluation_criteria) against the live API.
2. Verify sequence/conditional tool-mock support (else split evolving scenarios into single-state ones).
3. Build the runner (load → estimate → run pool → aggregate → render).
4. Write 3–4 scenarios, get the judge criteria reliable (verify verdicts match your own judgement on known cases).
5. Expand to the full set; wire exit code for CI; run on every prompt change.
```