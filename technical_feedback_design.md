# Technical Interview Feedback Agent — Design & Prompt

## Architecture: one LLM node, fed with ground truth

A single LLM node (strong REASONING model, reasoning ON — this is offline, latency doesn't matter) handles the qualitative synthesis. But it does NOT derive hard facts — those are computed by your pipeline and handed in. The model interprets; your data supplies truth.

**Deterministic facts (from your pipeline, NOT the LLM's judgment):**
- Did the final code pass all tests → from the detailed post-session Judge0 run.
- Which test categories passed/failed → Judge0.
- Hints given (count + progression) → event log.
- Time taken, phase reached → event log.

**Qualitative judgment (the LLM's job):** problem-solving approach, communication, complexity reasoning, code quality, coachability, and the actionable next steps.

> Why not multi-agent: the analysis is one coherent task. Splitting it adds complexity without better output. The only "split" that matters is data-vs-judgment, handled by feeding facts in.

---

## Inputs to the node (assemble all of this before calling)

```json
{
  "transcript": "<full conversation>",
  "final_code": "<candidate's final code>",
  "language": "python",
  "test_results_detailed": {
    "passed": 9, "total": 10,
    "by_category": { "basic": "pass", "edge": "1 fail", "performance": "pass" },
    "failures": [ { "input": "...", "expected": "...", "actual": "..." } ]
  },
  "completed": true,
  "reached_phase": 4,
  "hint_log": [
    { "phase": 2, "depth": "general", "topic": "edge cases" },
    { "phase": 3, "depth": "specific", "topic": "off-by-one" }
  ],
  "hint_count": 2,
  "time_taken_minutes": 32,
  "time_budget_minutes": 35,
  "followup_answers_summary": "<from Phase 4, if reached>",
  "question": {
    "title": "...", "difficulty": "medium", "statement": "...",
    "solutions": "<canonical approaches + complexity targets>",
    "common_mistakes": "<known pitfalls>",
    "follow_ups": "<expected follow-up Q&A>",
    "pattern_tags": ["hash map", "two pointers"],
    "topics": ["arrays"]
  }
}
```

The `solutions` / `follow_ups` / `common_mistakes` are the ANSWER KEY — without them the model can't judge whether the candidate's complexity analysis or follow-up answers were correct. The detailed test failures are safe to include here (post-session, nothing to protect).

---

## The dimensions evaluated

1. **Correctness & completeness** — solved fully / partially / not (from test results — ground truth).
2. **Problem-solving & thinking** — did they clarify, consider examples, pick a reasonable approach, recognize and improve on inefficiency?
3. **Technical communication** — did they think out loud and explain clearly? (Interview-specific, heavily weighted.)
4. **Complexity & optimization awareness** — did they know their complexity and reason about improvements? (Mostly from Phase 4 answers.)
5. **Code quality** — readability, structure, naming, edge handling in the code itself (separate from pass/fail).
6. **Independence** — how much help did they need? (From hint_count + depth.)
7. **Coachability** — when hinted, did they take it and progress? (Transcript + code evolution.)

---

## The prompt (system prompt for the node)

```
You are an expert technical interviewer writing post-interview feedback for a candidate who just completed a practice coding interview. Your job is to assess their performance honestly and help them improve. Your tone is HONEST BUT COACHING: name weaknesses directly and specifically — never falsely reassure — but always orient toward how they can get better. A candidate preparing for real interviews is hurt more by vague praise than by honest, actionable critique.

You will be given: the interview transcript, the candidate's final code, detailed test results, how much help they needed (hints), timing, which phase they reached, their follow-up answers, and the question's answer key (canonical solutions, expected complexity, known pitfalls, expected follow-ups).

# Ground rules
- The test results, completion status, hint count, and timing are FACTS given to you — use them as-is. Do NOT re-judge whether the code passes by reading it; trust the provided test results.
- Judge complexity analysis and follow-up answers against the provided answer key (canonical solutions / expected follow-ups). If the candidate claimed a complexity, check it against the canonical.
- Be specific and evidence-based. Every rating must cite something that actually happened ("when you said X", "your code does Y", "you needed a hint to see Z"). No generic filler.
- Weight communication and reasoning heavily — this is an interview, not just a coding test. A working but silent, unexplained solution is NOT a top performance. A slightly flawed but well-reasoned, well-communicated one can be strong.
- Distinguish "solved it alone" from "solved it with escalating help" — independence matters. Reflect the hint count and depth honestly.
- If they did not complete the task, be honest about that and focus next-steps on the gap, without harshness.
- The MOST important section is the actionable next steps. Make them concrete: specific patterns to study, specific TYPES of problems to practice, specific habits to build. Tie them to the actual weaknesses you observed and to the question's pattern_tags/topics.

# Output
Respond with ONLY a valid JSON object in the exact schema provided. No preamble, no markdown, no text outside the JSON.
```

(The schema below is appended to the prompt or enforced via the node's structured-output setting.)

---

## Output JSON schema

```json
{
  "summary": "2-4 sentence honest overall assessment of how the interview went.",
  "completed": true,
  "outcome": "solved | partially_solved | not_solved",
  "test_results": {
    "passed": 9,
    "total": 10,
    "notes": "Passed all but one edge case (empty input)."
  },
  "overall_signal": "strong | solid | mixed | needs_work",
  "dimensions": [
    {
      "name": "Correctness & Completeness",
      "rating": "strong | adequate | needs_work",
      "what_went_well": "Specific, evidence-based.",
      "what_to_improve": "Specific, evidence-based."
    },
    {
      "name": "Problem-Solving & Thinking",
      "rating": "...",
      "what_went_well": "...",
      "what_to_improve": "..."
    },
    {
      "name": "Technical Communication",
      "rating": "...",
      "what_went_well": "...",
      "what_to_improve": "..."
    },
    {
      "name": "Complexity & Optimization",
      "rating": "...",
      "what_went_well": "...",
      "what_to_improve": "..."
    },
    {
      "name": "Code Quality",
      "rating": "...",
      "what_went_well": "...",
      "what_to_improve": "..."
    },
    {
      "name": "Independence",
      "rating": "...",
      "what_went_well": "...",
      "what_to_improve": "...",
      "hints_used": 2
    }
  ],
  "thinking_and_logic": "A focused paragraph on HOW they approached and reasoned about the problem — the thought process, not just the result.",
  "code_assessment": "A focused paragraph on the code itself — structure, readability, correctness details, edge handling.",
  "next_steps": [
    {
      "action": "Concrete, actionable step.",
      "why": "Tied to a specific weakness observed.",
      "how": "Specific patterns/problem types to practice, e.g. 'practice hash-map lookup problems like Two Sum, Group Anagrams, Subarray Sum'."
    }
  ],
  "patterns_to_study": ["hash map", "complexity analysis"],
  "encouragement": "One honest, motivating closing line — real, not hollow."
}
```

---

## Workflow placement (n8n, post-interview pipeline)

Triggered by `POST /interview/end` (the `end_call` event):
1. Mark session ended.
2. Run the FULL detailed Judge0 run on the final code (all hidden tests, non-lossy).
3. Assemble the node input (§ inputs) from: session record, event log, transcript, final code, detailed test results, question's answer-key fields.
4. Call the feedback LLM node (single node, structured JSON output).
5. Parse + store the JSON; render it in the UI.

### Error handling (matches the existing pipeline notes)
- Judge0 fails on the final run → retry with backoff; if still failing, call the node WITHOUT test_results and have it note that automated results were unavailable (flag in output). Don't block feedback entirely.
- LLM node Error 520 / timeout (transient, payload-sensitive with long transcript + large JSON) → retry-on-fail with ~60s delay. Large combined payloads raise timeout risk; the retry is the first mitigation.
- Malformed JSON from the node → one re-ask with "return valid JSON only"; if it fails again, store raw + flag for review.

---

## Notes on what makes THIS feedback valuable (vs a LeetCode score)
- Dimensions 3 (communication), 6 (independence), 7 (coachability) cannot come from a code judge — they come from the transcript + your hint/phase event log. This is the product's differentiation. Make sure the event log actually captures hint depth and phase transitions, or these dimensions degrade to guesswork.
- The answer key (`solutions`, `follow_ups`) is what lets the agent grade complexity reasoning correctly. If a question is seeded without these, the complexity dimension will be weak — enforce them at seeding.
```