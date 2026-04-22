# Question Bank Authoring Spec — Instructions for Copilot / LLM

This is the brief to hand to Copilot (or any LLM coding assistant) when populating the Mockly technical question bank. Paste it as a system/user message at the start of an authoring session.

---

## HOW TO USE THIS FILE

You have two choices for populating the bank:

**Option A — One-shot batch.** Hand this entire file to Copilot with: *"Produce 30 questions following this spec. Aim for the difficulty + topic mix described in the Bootstrap Target section. Output each as a separate JSON file."*

**Option B — Iterative (recommended for quality).** Use the authoring workflow below. Have Copilot produce one question at a time, review, then move on. Technical hint_framework fields are easy to get wrong and benefit from review.

Either way, paste everything from "BEGIN COPILOT BRIEF" down into the assistant.

---

## BEGIN COPILOT BRIEF

You are helping populate the Mockly technical interview question bank. Each question is a structured JSON record, stored in our database, and injected into three different agents at session time (interview agent, hint subagent, feedback agent). The quality of your output directly determines the quality of the interview.

Produce records that follow the schema below exactly. Every field matters — do not skip fields, do not abbreviate, do not invent new fields.

---

## SCHEMA

```json
{
  "id": "kebab-case-unique-id",
  "title": "Human-readable title",
  "difficulty": "easy | medium | hard",
  "topics": ["arrays", "two-pointers"],
  "pattern_tags": ["sorted-array-sweep"],
  "languages_supported": ["python", "js", "java", "cpp", "go"],
  "estimated_time_min": 20,

  "problem_statement": "Clear, concise problem statement in markdown. 2–4 sentences.",

  "examples": [
    {
      "input": "nums = [2, 7, 11, 15], target = 9",
      "output": "[0, 1]",
      "explanation": "Because nums[0] + nums[1] == 9."
    }
  ],

  "constraints": [
    "1 <= nums.length <= 10^4",
    "-10^9 <= nums[i] <= 10^9",
    "-10^9 <= target <= 10^9",
    "Only one valid answer exists."
  ],

  "hidden_tests": [
    { "input": "...", "expected_output": "...", "description": "basic case" },
    { "input": "...", "expected_output": "...", "description": "empty / minimal edge" },
    { "input": "...", "expected_output": "...", "description": "negatives" },
    { "input": "...", "expected_output": "...", "description": "large input at constraint max" }
  ],

  "solutions": {
    "brute_force": {
      "approach": "nested loop over all pairs",
      "time": "O(n^2)",
      "space": "O(1)",
      "code": "def two_sum(nums, target): ..."
    },
    "optimal": {
      "approach": "hashmap of complement lookup in one pass",
      "time": "O(n)",
      "space": "O(n)",
      "code": "def two_sum(nums, target): ..."
    }
  },

  "hint_framework": {
    "key_insights": [
      "The brute-force is O(n^2). Can we look up complements instead of searching?",
      "For each element, we know what its pair value must be (target - current)."
    ],
    "common_misdirections": [
      { "approach": "sorting first + two-pointer", "note": "breaks the index requirement" },
      { "approach": "binary search per element", "note": "still O(n log n), not optimal for this problem" }
    ],
    "tier_targets": {
      "1": "Nudge them to think about what information they could store to avoid re-scanning the array, without naming hashmap.",
      "2": "Name the hashmap / dictionary technique without stating what to store or in what order.",
      "3": "Describe the lookup-before-insert pattern: for each element, check if (target - current) is already in the map, and only insert after checking."
    },
    "never_reveal": [
      "The exact code for the optimal solution",
      "The final time/space complexity before the candidate derives it",
      "The self-pairing bug fix phrased as a direct instruction"
    ],
    "expected_path": "brute-force nested loop → realise repeated searching → use a hashmap for lookup → realise one-pass is possible → final O(n) time, O(n) space"
  },

  "common_mistakes": [
    "Inserting into the hashmap before checking for the complement (self-pair bug when target == 2 * current)",
    "Returning values instead of indices",
    "Off-by-one on the order of returned indices when problem specifies ordering"
  ],

  "follow_ups": [
    { "variant": "What if the input array were sorted?", "angle": "two-pointer O(1) space solution becomes available", "difficulty_delta": "same" },
    { "variant": "What if you needed to find all pairs summing to target, not just one?", "angle": "result collection and duplicate handling", "difficulty_delta": "harder" },
    { "variant": "Generalise to three numbers (3Sum)", "angle": "fixing one element + two-pointer on the rest", "difficulty_delta": "harder" }
  ],

  "meta": {
    "source": "classic | original | adapted",
    "author": "",
    "created": "YYYY-MM-DD"
  }
}
```

---

## FIELD-BY-FIELD AUTHORING RULES

### `problem_statement`
- 2–4 sentences, markdown allowed.
- State the input, what to return, and any constraint that affects approach (e.g., "the array is sorted" if load-bearing).
- DO NOT hint at approach. "Find the pair efficiently" is bad; "return the indices of the two numbers that add to target" is good.

### `examples`
- 2–4 minimum.
- At least one non-trivial example that exercises an edge case — but don't explain it as an edge case in the `explanation` field.
- Input format must be unambiguous enough that a candidate can parse without asking.

### `constraints`
- Always include input-size bounds.
- Always include value-range bounds.
- State uniqueness, sortedness, or null-handling expectations explicitly.
- Use `1 <= n <= 10^4` format, not "up to 10,000".

### `hidden_tests`
- 5–10 tests.
- MUST include: basic case, minimal/edge case (empty, single element, all same), at least one performance case at or near the constraint max.
- Test inputs should exercise the approach, not just vary values.
- Outputs must be deterministic. If multiple valid outputs exist, normalise (e.g., sort results) or explicitly state ordering in `problem_statement`.
- Each test has a short `description` — one or two words on what it's probing.

### `solutions`
- ALWAYS provide both `brute_force` AND `optimal`, even if brute-force is trivial. The interview agent uses the brute-force to calibrate whether the candidate's first idea is baseline-or-below.
- `code` is in Python by default. Must be runnable — actually execute against `hidden_tests` to verify.
- `time` and `space` use formal Big-O: `O(n)`, `O(n log n)`, `O(n^2)`, `O(1)`. Not "fast", "slow", "constant extra memory".

### `hint_framework` (the most important section — get this right)

This drives the hint subagent. Poor authoring here produces hints that are either too generic or that leak the answer.

**`key_insights`**
- 2–4 items.
- Ordered: the realisations a candidate must have, in the order they should have them.
- These are NOT hints — they're the cognitive checkpoints. The hint subagent uses them as anchors for what to nudge toward.

**`common_misdirections`**
- 2–4 items.
- Wrong or suboptimal approaches that real candidates take.
- Each has a one-line `note` explaining why the approach is wrong or suboptimal.
- Used by the hint subagent to recognise what the candidate is doing and redirect.

**`tier_targets`**
- Exactly three keys: `"1"`, `"2"`, `"3"`.
- Each describes what a hint at that tier *should* point toward, phrased as "do X without doing Y".
- **Tier 1** — nudge toward a property or direction; must NOT name the technique.
- **Tier 2** — name the technique or data structure; must NOT state implementation mechanics.
- **Tier 3** — walk through mechanics in prose; must NOT write code or state final complexity.

Test each tier: "could the hint subagent produce a hint at this tier that respects this target without violating `never_reveal`?" If no, revise.

**`never_reveal`**
- List specific content no hint at any tier should contain.
- Always include: "the exact code", "the final complexity before derivation".
- Add problem-specific reveals (e.g., "the off-by-one fix stated as an instruction").

**`expected_path`**
- One sentence describing the canonical progression from brute to optimal.
- Used by both the hint subagent (to locate where the candidate is on the path) and the feedback agent (to judge approach quality).

### `common_mistakes`
- 3–6 concrete bugs real candidates make on this problem.
- Specific enough that a code-analyzer subagent could pattern-match candidate code against them.
- "Forgetting edge cases" is too vague. "Inserting into hashmap before checking for complement, causing self-pair bug when target = 2 * current" is specific enough.

### `follow_ups`
- 2–4 variants.
- Each changes ONE thing meaningfully — adds or relaxes a constraint, generalises the problem, or shifts the objective.
- Each has:
  - `variant` — the question as it would be asked
  - `angle` — what new thinking this forces
  - `difficulty_delta` — `same` | `easier` | `harder` relative to base

---

## DIFFICULTY CALIBRATION

- **easy** — canonical single-pattern problem, ~15 min target. Examples: Two Sum, Valid Parentheses, Reverse Linked List, Best Time to Buy and Sell Stock (single pass).
- **medium** — requires combining 2 patterns, OR a non-obvious insight, OR careful edge-case handling. ~25–30 min target. Examples: Longest Substring Without Repeating Characters, Binary Tree Level Order Traversal, LRU Cache, Kth Largest Element.
- **hard** — novel insight required, OR non-trivial optimisation, OR complex state. ~40+ min target. Examples: Median of Two Sorted Arrays, Regular Expression Matching, Trapping Rain Water, Word Ladder.

If your question doesn't cleanly fit one of the three, it's probably the wrong size — simplify or split.

---

## `pattern_tags` — use ONLY this standard list

```
arrays, strings, hashmaps, two-pointers, sliding-window, binary-search, sorting,
linked-lists, stacks, queues, trees, graphs, dfs, bfs, dynamic-programming,
greedy, backtracking, bit-manipulation, heap, trie, union-find, monotonic-stack,
prefix-sum, recursion, divide-and-conquer, topological-sort, matrix, math,
intervals, design
```

Tag 1–3 patterns per question — the ones that are actually core to the optimal solution. Do not tag a pattern the candidate could use but shouldn't (e.g., don't tag `sorting` for Two Sum just because one could sort first).

If you believe a question needs a tag not on this list, propose it separately and flag for review — don't invent tags inline.

---

## AUTHORING WORKFLOW (recommended, one question at a time)

1. Write `id`, `title`, `difficulty`, `topics`, `pattern_tags`, `languages_supported`, `estimated_time_min`.
2. Write `problem_statement`, `examples`, `constraints`. Stop and verify: does this read like a real LeetCode-style problem? Is the input format unambiguous? Are there hints of approach leaking in? Fix if so.
3. Write `hidden_tests`. Verify coverage: basic, edge, performance.
4. Write `solutions.brute_force` and `solutions.optimal`. Run both against `hidden_tests` — if they don't pass, fix the solutions OR fix the tests.
5. Write `hint_framework`. This is the hardest section. For each tier, mentally simulate: "the candidate has done X; what hint at this tier would help without violating `never_reveal`?" If you can't produce one, the tier target is too strict or too loose — revise.
6. Write `common_mistakes` based on what real candidates fail at. If you're not sure, think about the most common wrong approaches and what bugs they lead to.
7. Write `follow_ups`.
8. Fill `meta`.
9. Run the quality checks below. Fix anything that fails.

---

## QUALITY CHECKS (run before submitting each question)

- [ ] Both `brute_force` and `optimal` solutions compile AND pass all `hidden_tests` in the stated `language`.
- [ ] `hidden_tests` covers basic / edge / performance.
- [ ] `hint_framework.tier_targets` has three distinct, non-overlapping targets.
- [ ] Each `tier_target` can be satisfied without violating `never_reveal`.
- [ ] `never_reveal` is non-empty and concrete (not "the answer" — specific content).
- [ ] `expected_path` has 3+ checkpoints from brute to optimal.
- [ ] `pattern_tags` are from the standard list, and 1–3 in count.
- [ ] `difficulty` matches the calibration section above.
- [ ] `follow_ups` has ≥ 2 items.
- [ ] `problem_statement` does not hint at approach.
- [ ] JSON is syntactically valid.

---

## BOOTSTRAP TARGET (MVP bank)

Produce ~30 questions at launch, spread across topics so any reasonable setup filter returns a non-empty set:

**Easy (12)** — at least 2 each from: arrays, strings, hashmaps, two-pointers, linked-lists, stacks, trees-basics.

**Medium (12)** — spread across: sliding-window, binary-search, BFS/DFS, DP (1D), backtracking, intervals, graphs, heap.

**Hard (6)** — spread across: DP (2D or harder), graphs (non-trivial), advanced strings, intervals (complex), design-style.

Avoid stacking up multiple near-duplicates of the same canonical problem. If you have Two Sum, don't also add Three Sum as a base question — Three Sum is better as a `follow_up` on Two Sum.

---

## OUTPUT FORMAT

One JSON object per question. Either:
- Return each question as its own file, named `{id}.json`, OR
- Return a JSON array of question objects if the user asks for batch output.

Validate JSON syntax before returning.

---

## END COPILOT BRIEF
