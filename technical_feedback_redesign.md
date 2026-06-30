# Technical Feedback — Agent + Page Redesign Plan

Covers: (1) what to pass the feedback agent, (2) the new prompt with numeric scoring + example output, (3) the overall-score fix, (4) the feedback page redesign including the post-interview editable code sandbox.

---

## PART 1 — Inputs to the feedback agent (assemble before the call)

```json
{
  "transcript": "<full conversation>",
  "final_code": "<candidate's submitted code>",
  "language": "python",
  "language_id": 71,

  "test_results_detailed": {
    "passed": 9,
    "total": 10,
    "by_category": { "basic": "pass", "edge": "1 fail", "performance": "pass" },
    "failures": [
      { "category": "edge", "input": "[]", "expected": "[]", "actual": "error" }
    ]
  },

  "completed": true,
  "outcome_hint": "solved | partially_solved | not_solved",
  "reached_phase": 4,
  "time_taken_minutes": 32,
  "time_budget_minutes": 35,

  "hint_log": [
    { "phase": 2, "depth": "general",  "topic": "consider edge cases" },
    { "phase": 3, "depth": "specific", "topic": "off-by-one in loop" }
  ],
  "hint_count": 2,

  "followup_answers_summary": "<Phase 4 Q&A, if reached>",

  "question": {
    "title": "Two Sum",
    "difficulty": "medium",
    "statement": "...",
    "constraints": "...",
    "solutions": "<canonical approaches + complexity targets>",   // ANSWER KEY
    "common_mistakes": "<known pitfalls>",                          // ANSWER KEY
    "follow_ups": "<expected follow-up Q&A>",                       // ANSWER KEY
    "pattern_tags": ["hash map"],
    "topics": ["arrays"]
  }
}
```

**Critical:** `final_code`, the detailed test failures (with categories), `hint_log` with DEPTH not just count, `reached_phase`, and the `solutions`/`follow_ups`/`common_mistakes` answer key are the pieces that make grading specific rather than guesswork. The answer key lets the agent verify complexity claims; the code enables code-quality judgment; hint depth enables the independence judgment.

---

## PART 2 — Scoring model (fixes the "35/10" bug)

### Per-dimension: NUMBER is source of truth, label is DERIVED
- Each dimension scored **0–10** (number).
- The tag is computed from the number, never independently:
  - `8.0–10.0` → "strong"
  - `5.5–7.9` → "adequate"
  - `0–5.4` → "needs work"
- The agent outputs the number; your code (or the agent, told the thresholds) derives the label. Keep them consistent — if the agent emits both, instruct it to derive the label from its own number.

### Overall score: WEIGHTED AVERAGE of dimensions (bounded 0–10 by construction)
Never sum. Compute a weighted mean so it's always 0–10.

Suggested weights (tune later — they encode what THIS product values; communication/reasoning weighted up because that's the interview differentiator):
| Dimension                  | Weight |
| -------------------------- | ------ |
| Correctness & Completeness | 0.25   |
| Problem-Solving & Thinking | 0.20   |
| Technical Communication    | 0.15   |
| Complexity & Optimization  | 0.15   |
| Code Quality               | 0.15   |
| Independence               | 0.10   |

`overall = Σ(dimension_score × weight)` → always 0–10. Compute this in YOUR CODE from the dimension numbers, not in the LLM (LLMs do arithmetic unreliably). The LLM produces dimension scores; the backend computes the weighted overall. This guarantees it's never 35/10.

> Coachability folds into Problem-Solving/Independence narrative rather than its own weighted score, to keep weights clean. Adjust if you want it separate.

---

## PART 3 — The prompt (feedback LLM node, structured JSON)

```
You are an expert technical interviewer writing post-interview feedback for a candidate who just finished a practice coding interview. Assess honestly and help them improve. Tone: HONEST BUT COACHING — name weaknesses directly and specifically, never falsely reassure, but always point toward how to improve. Vague praise hurts someone preparing for real interviews more than honest, actionable critique does.

You are given: the transcript, the candidate's final code, detailed test results, how much help they needed (hints, with depth), timing, which phase they reached, their follow-up answers, and the question's ANSWER KEY (canonical solutions, expected complexity, known pitfalls, expected follow-ups).

# Ground rules
- Test results, completion, hint count/depth, timing, and phase reached are FACTS given to you. Use them as-is. Do NOT re-judge whether the code passes by reading it — trust the provided test results.
- Grade complexity claims and follow-up answers against the ANSWER KEY. If the candidate said "this is O(n)", verify against the canonical complexity.
- Be specific and evidence-based. Every score must be justified by something that actually happened ("when you said X", "your code does Y", "you needed a specific hint to see Z"). No generic filler.
- Weight communication and reasoning heavily — this is an interview, not just a coding test. A correct but silent, unexplained solution is NOT top marks. A slightly flawed but well-reasoned, well-communicated one can score well.
- Distinguish solving it alone from solving it with escalating help — reflect hint count AND depth honestly in Independence.
- If they did not complete the task, be honest and focus next steps on the gap, without harshness.
- The MOST important section is next_steps. Make them concrete: specific patterns to study, specific TYPES of problems to practice, specific habits to build — tied to the actual weaknesses you observed and to the question's pattern_tags/topics.

# Scoring
- Score each dimension 0–10 (a number, one decimal allowed).
- Derive each dimension's label from its number: 8.0–10 = "strong", 5.5–7.9 = "adequate", 0–5.4 = "needs work". The label MUST match the number.
- Do NOT compute the overall score — the system computes it from your dimension scores. Omit any overall number.

# Output
Respond with ONLY a valid JSON object in the exact schema. No preamble, no markdown fences, no text outside the JSON.
```

(Append the schema + the example below to the prompt, or enforce via structured-output config.)

---

## PART 4 — Output JSON schema + worked example

Give the model THIS as a concrete example so it knows the shape and the level of specificity expected:

```json
{
  "summary": "You reached a working brute-force solution and communicated your thinking clearly throughout, but needed a nudge to handle empty input and couldn't initially analyze the time complexity. Solid problem-solving; the main gaps are complexity awareness and optimizing beyond the first idea.",
  "outcome": "partially_solved",
  "completed": true,
  "reached_phase": 4,
  "test_results": {
    "passed": 9,
    "total": 10,
    "by_category": { "basic": "pass", "edge": "1 fail", "performance": "pass" },
    "summary_note": "Passed all basic and performance cases; failed one edge case (empty input)."
  },
  "time": { "taken_minutes": 32, "budget_minutes": 35 },
  "dimensions": [
    {
      "name": "Correctness & Completeness",
      "score": 7.5,
      "label": "adequate",
      "what_went_well": "Your solution returned correct results for all standard and large inputs.",
      "what_to_improve": "It failed on empty input — you returned an error instead of an empty list. Always sanity-check boundary inputs."
    },
    {
      "name": "Problem-Solving & Thinking",
      "score": 8.0,
      "label": "strong",
      "what_went_well": "You restated the problem, walked through an example before coding, and chose a reasonable first approach.",
      "what_to_improve": "You committed to brute force without pausing to consider whether a more efficient approach existed up front."
    },
    {
      "name": "Technical Communication",
      "score": 8.5,
      "label": "strong",
      "what_went_well": "You narrated your reasoning continuously, which made your thought process easy to follow.",
      "what_to_improve": "When you got stuck, you went quiet — verbalize where you're stuck; in a real interview that lets the interviewer help."
    },
    {
      "name": "Complexity & Optimization",
      "score": 4.5,
      "label": "needs work",
      "what_went_well": "Once prompted, you correctly identified the nested loop as the bottleneck.",
      "what_to_improve": "You initially couldn't state the time complexity. This is O(n^2); the expected optimal is O(n) using a hash map. Be able to state and justify complexity without prompting."
    },
    {
      "name": "Code Quality",
      "score": 7.0,
      "label": "adequate",
      "what_went_well": "Readable variable names and a clean loop structure.",
      "what_to_improve": "No handling for the empty-input edge case, and no early return guard. Add input validation."
    },
    {
      "name": "Independence",
      "score": 6.0,
      "label": "adequate",
      "hints_used": 2,
      "what_went_well": "You acted on hints quickly and made progress each time.",
      "what_to_improve": "You needed a specific hint to spot the edge case and to begin complexity analysis — aim to surface these yourself."
    }
  ],
  "thinking_and_logic": "You approached methodically: clarified the problem, used an example to ground your understanding, then implemented. Your instinct to get something working first is good. The gap is the second half of strong problem-solving — after a working solution, proactively evaluating efficiency and edge cases rather than waiting to be asked.",
  "code_assessment": "The final code is a clean O(n^2) double loop. It's readable and correct for typical inputs. Two concrete issues: it errors on empty input rather than returning [], and there's no guard clause for trivial cases. The optimal approach for this problem stores seen values in a hash map for O(n) time — refactoring toward that is the main code-level growth area.",
  "next_steps": [
    {
      "action": "Practice the hash-map lookup pattern.",
      "why": "You solved this with brute force and couldn't reach the O(n) optimization on your own.",
      "how": "Do Two Sum, Group Anagrams, and Subarray Sum Equals K, focusing on recognizing when a hash map turns an O(n^2) scan into O(n)."
    },
    {
      "action": "Build the habit of stating complexity out loud after every solution.",
      "why": "You couldn't analyze complexity until prompted.",
      "how": "After solving any problem, say the time and space complexity and why, before moving on. Make it automatic."
    },
    {
      "action": "Always test boundary inputs before declaring done.",
      "why": "Your code failed on empty input.",
      "how": "Build a mental checklist: empty, single element, duplicates, negatives — run them in your head before saying you're finished."
    }
  ],
  "patterns_to_study": ["hash map", "complexity analysis", "edge-case handling"],
  "encouragement": "Your communication and structured approach are genuine strengths that many candidates lack — tighten up complexity analysis and edge cases and you'll be in good shape."
}
```

Note: no `overall_score` in the LLM output — the backend computes it (Part 2) and adds it before storing/rendering. `outcome` and the label fields must be consistent with the numbers/facts.

---

## PART 5 — Feedback page redesign

Current problems: overall shows 35/10 (sum bug), not all data rendered (test results, code), code_assessment empty. Redesign:

### Layout (top to bottom)
1. **Header band**
   - Overall score (the backend-computed weighted average, e.g. "7.1 / 10") with a derived overall label/band.
   - Outcome chip: Solved / Partially solved / Not solved.
   - Quick facts row: tests passed (9/10), time (32/35 min), hints used (2), phase reached.

2. **Code review sandbox (top, interactive)** — the new section you described.
   - Shows the candidate's SUBMITTED code, editable.
   - "Run tests" button → runs the FULL test set, results shown (pass/fail per case — protection is over post-interview).
   - Lets the user fix and re-run to confirm they understand.
   - IMPORTANT: edits here are TEMPORARY (session-local). The DB keeps the originally submitted version untouched. Show a subtle note: "Edits here are for practice and aren't saved — your interview submission is preserved." A "reset to submission" button restores the original.

3. **Test results panel**
   - passed/total, breakdown by category, which case(s) failed. Sourced from the stored detailed run (not the sandbox re-runs).

4. **Dimension scores**
   - One card per dimension: numeric score (0–10) + derived label + a bar/ring + what_went_well / what_to_improve.

5. **Thinking & Logic** — render `thinking_and_logic`.

6. **Code Assessment** — render `code_assessment`. (Was empty before — ensure the field is populated and actually rendered; if missing, that's a render/agent bug to fix, not a blank section.)

7. **Next Steps** — render `next_steps` as action cards (action / why / how) + `patterns_to_study` as tags, ideally linking to practice questions of those patterns.

8. **Encouragement** — the closing line.

### Data flow for the page
- Stored feedback JSON (with backend-computed `overall_score`) → renders sections 1, 3–8.
- The sandbox (section 2) is live: editable code + a run-tests endpoint that executes against the full test set and returns visible results. Submitted code is read from the DB (immutable); sandbox state is client-side/temp only.

### The temp-edit rule (important, don't get wrong)
- DB stores the interview submission permanently. The sandbox NEVER overwrites it.
- Sandbox runs use the same Judge0 runner but return DETAILED visible results (post-interview, nothing to hide).
- "Reset" restores the submitted version.

---

## PART 6 — Error handling (consistent with the pipeline)
- Backend computes `overall_score` from dimension numbers; if any dimension score is missing/non-numeric, flag and don't render a broken overall.
- LLM returns invalid JSON → one re-ask ("valid JSON only"); if still bad, store raw + flag.
- LLM node 520/timeout (long transcript + big JSON) → retry-on-fail ~60s; consider trimming transcript or summarizing if payloads grow.
- Judge0 unavailable for the page sandbox → show "couldn't run tests right now," keep the rest of the page working.
- code_assessment / any section empty → treat as a bug: verify the agent populated it AND the page renders it; never ship a silently blank section.

---

## PART 7 — Upstream dependencies (so the feedback is actually good)
- Event log must capture hint DEPTH and phase-transition timestamps, not just a count — three dimensions (communication, independence, coachability) depend on it.
- Questions must be seeded WITH the answer key (solutions, follow_ups, common_mistakes) or complexity grading degrades.
- Store the submitted code + the detailed test run at session end so the page has immutable ground truth to show.
```