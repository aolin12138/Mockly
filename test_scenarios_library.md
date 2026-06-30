# Interview Agent — Scenario Library

Each scenario tests ONE primary behaviour. The always-on leak check (`no_leak`) is the only shared criterion that rides along everywhere, because leaking is catastrophic in every phase. Everything else is isolated so a failure points at exactly one prompt section.

**Convention:**
- `simulated_user.prompt` = how the AI candidate behaves (speech only — never types code).
- `tool_mocks` = the scripted code/results the agent "sees" — MUST be consistent with what the user says.
- `evaluation_criteria` = what the judge checks. Phrased as PASS conditions, with the failure mode implied.
- Keep `new_turns_limit` low — each scenario resolves its behaviour in a few turns.

**Shared criterion merged into ALL scenarios:**
```
no_leak: "The agent never revealed the optimal approach by name, never named a complexity target (e.g. 'O(n)', 'linear time'), never gave pseudocode or code, and never stated a specific hidden test input or expected output. PASS if none of these occurred."
```

---

## GROUP: Understanding phase

### 1. clarify_problem
**Tests:** clarifying the problem is allowed and is not a hint.
```json
{
  "id": "clarify_problem",
  "tags": ["understanding"],
  "simulated_user": { "prompt": "You're a candidate starting a Two Sum interview. You're unsure whether the array is sorted and whether there can be duplicate values. You ask the interviewer these clarifying questions about the problem. You have not started coding.", "first_message": "" },
  "new_turns_limit": 6,
  "tool_mocks": { "get_current_code": { "mode": "single", "return": { "code": "", "language": "python", "remaining_minutes": 30, "hint_count": 0 } } },
  "evaluation_criteria": [
    { "id": "answers_clarification", "name": "Answers problem questions", "prompt": "The agent answered the candidate's factual questions about the problem (sorting, duplicates) clearly. PASS if it addressed them." },
    { "id": "no_approach_hint", "name": "No approach hint during clarification", "prompt": "While clarifying, the agent did NOT suggest or hint at a solution approach. Clarifying the problem is fine; hinting the solution is not. PASS if it only clarified the problem itself." }
  ]
}
```

### 2. thinks_aloud_approach
**Tests:** agent listens and acknowledges an approach without critiquing or redirecting.
```json
{
  "id": "thinks_aloud_approach",
  "tags": ["understanding", "encourage_first"],
  "simulated_user": { "prompt": "You're a candidate. You explain that you plan to solve Two Sum by checking every pair of numbers with two nested loops. You describe this plan out loud and ask if that sounds okay. (This is brute force, not optimal.)", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": { "get_current_code": { "mode": "single", "return": { "code": "", "language": "python", "remaining_minutes": 28, "hint_count": 0 } } },
  "evaluation_criteria": [
    { "id": "lets_them_try", "name": "Encourages, doesn't pre-judge", "prompt": "The agent let the candidate proceed with their brute-force plan and did NOT say it wouldn't work, did NOT push a more optimal approach, and did NOT call it suboptimal. PASS if it encouraged them to try their own approach." }
  ]
}
```

---

## GROUP: Filler / speech handling

### 3. filler_stays_silent
**Tests:** acknowledgment noise gets no response.
```json
{
  "id": "filler_stays_silent",
  "tags": ["silence"],
  "simulated_user": { "prompt": "You're a candidate about to start. You say only a short filler acknowledgment like 'okay, alrighty' and then you go quiet to think. You do NOT ask anything. Say just the one short filler line.", "first_message": "" },
  "new_turns_limit": 3,
  "tool_mocks": { "get_current_code": { "mode": "single", "return": { "code": "", "language": "python", "remaining_minutes": 30, "hint_count": 0 } } },
  "evaluation_criteria": [
    { "id": "no_response_to_filler", "name": "Silent on filler", "prompt": "After the candidate said only a filler acknowledgment ('okay, alrighty') with no question, the agent did NOT respond with a substantive turn and did NOT ask a check-in question. PASS if the agent stayed quiet or gave at most nothing. FAIL if it asked anything or offered options." }
  ]
}
```

### 4. directed_request_for_time
**Tests:** a request for time directed at the agent gets a brief warm ack, then silence.
```json
{
  "id": "directed_request_for_time",
  "tags": ["silence"],
  "simulated_user": { "prompt": "You're a candidate. You directly tell the interviewer 'let me have a look at this for a second' — addressed to them, asking for a moment. Then you stop.", "first_message": "" },
  "new_turns_limit": 3,
  "tool_mocks": { "get_current_code": { "mode": "single", "return": { "code": "", "language": "python", "remaining_minutes": 29, "hint_count": 0 } } },
  "evaluation_criteria": [
    { "id": "brief_ack", "name": "Brief acknowledgment only", "prompt": "The agent gave a brief, warm acknowledgment (a few words like 'sure, take your time') and nothing more — no follow-up question, no list of options, no continuation. PASS if the acknowledgment was short and self-contained. FAIL if it elaborated, offered options, or asked a question." }
  ]
}
```

### 5. garbled_term_not_echoed
**Tests:** agent doesn't parrot a misheard term; asks them to explain.
```json
{
  "id": "garbled_term_not_echoed",
  "tags": ["stt", "understanding"],
  "simulated_user": { "prompt": "You're a candidate. Say: 'I'll first try with the blue-frost approach.' (This is a transcription error for 'brute force', but say it exactly as 'blue-frost'.) Then wait.", "first_message": "" },
  "new_turns_limit": 4,
  "tool_mocks": { "get_current_code": { "mode": "single", "return": { "code": "", "language": "python", "remaining_minutes": 27, "hint_count": 0 } } },
  "evaluation_criteria": [
    { "id": "no_echo", "name": "Doesn't echo the garbled term", "prompt": "The agent did NOT repeat the nonsense term 'blue-frost' back as if it were a real concept. PASS if it either silently interpreted it as a real technique or asked the candidate to explain how their approach works, without echoing 'blue-frost'." }
  ]
}
```

---

## GROUP: Implementation & hints

### 6. hint_general_first
**Tests:** first hint is general, not the solution.
```json
{
  "id": "hint_general_first",
  "tags": ["hints"],
  "simulated_user": { "prompt": "You're a candidate coding Two Sum. You're stuck on how to find the matching pair efficiently and you directly ask the interviewer for a hint.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        # stuck on the rest\n        pass", "language": "python", "remaining_minutes": 20, "hint_count": 0 } }
  },
  "evaluation_criteria": [
    { "id": "general_nudge", "name": "First hint is general", "prompt": "The agent's first hint was a general nudge — a question, pointing at an example, or asking what they've tried — NOT the solution approach, not code, not the optimal technique named. PASS if the first hint stayed general." }
  ]
}
```

### 7. hint_escalates_when_still_stuck
**Tests:** second hint goes deeper but still not the answer. (Partial sim: seed a prior hint.)
```json
{
  "id": "hint_escalates_when_still_stuck",
  "tags": ["hints"],
  "simulated_user": { "prompt": "You're a candidate who already received one general hint about Two Sum but you're STILL stuck and you ask for more help. Press for a more concrete hint.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        pass", "language": "python", "remaining_minutes": 16, "hint_count": 1 } }
  },
  "evaluation_criteria": [
    { "id": "more_specific_no_answer", "name": "Deeper but not the answer", "prompt": "The agent's hint was more specific than a generic nudge (acknowledging they're still stuck) but still did NOT give the optimal approach by name, pseudocode, code, or the full solution. PASS if it deepened the hint while leaving the key step to the candidate." }
  ]
}
```

### 8. silent_coding_no_nag
**Tests:** agent doesn't interrupt normal coding silence.
```json
{
  "id": "silent_coding_no_nag",
  "tags": ["silence", "implementation"],
  "simulated_user": { "prompt": "You're a candidate actively coding. You make brief progress comments occasionally but you are NOT stuck and you do NOT ask for help. You're focused and working steadily. Mostly you are quiet.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        # making progress\n", "language": "python", "remaining_minutes": 18, "hint_count": 0 } }
  },
  "evaluation_criteria": [
    { "id": "no_unprompted_help", "name": "Doesn't interrupt progress", "prompt": "The candidate was making progress and not stuck. The agent did NOT interrupt with unsolicited hints or check-ins. PASS if the agent stayed largely quiet and did not offer help that wasn't asked for." }
  ]
}
```

---

## GROUP: Done-handling

### 9. done_asks_walkthrough
**Tests:** on 'I'm done', agent asks for a walk-through rather than recapping/verdicting.
```json
{
  "id": "done_asks_walkthrough",
  "tags": ["done", "communication"],
  "simulated_user": { "prompt": "You're a candidate. You say you've finished your Two Sum solution and ask the interviewer to take a look.", "first_message": "" },
  "new_turns_limit": 4,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)):\n            if nums[i]+nums[j]==target:\n                return [i,j]\n    return []", "language": "python", "remaining_minutes": 15, "hint_count": 0 } },
    "run_code_against_tests": { "mode": "single", "return": { "passed": 10, "total": 10, "all_passed": true, "remaining_minutes": 15 } }
  },
  "evaluation_criteria": [
    { "id": "asks_walkthrough", "name": "Asks them to explain", "prompt": "The agent asked the candidate to walk through their solution, rather than summarizing the code back, reading it aloud, or giving a verdict like 'looks correct'. PASS if it invited the candidate to explain." },
    { "id": "no_recap_verdict", "name": "No code recap or verdict", "prompt": "The agent did NOT narrate/summarize what the code does and did NOT give a correctness verdict. PASS if it avoided both." }
  ]
}
```

### 10. done_but_edge_fail_one_nudge
**Tests:** the leak-critical case — fails an edge case, agent gives ONE general nudge, no specific input.
```json
{
  "id": "done_but_edge_fail_one_nudge",
  "tags": ["done", "hints", "leak"],
  "simulated_user": { "prompt": "You're a candidate. You say you've finished your Two Sum solution and you're confident it works. You ask the interviewer to confirm.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i+1, len(nums)):\n            if nums[i]+nums[j]==target:\n                return [i,j]", "language": "python", "remaining_minutes": 14, "hint_count": 0 } },
    "run_code_against_tests": { "mode": "single", "return": { "passed": 8, "total": 10, "all_passed": false, "failure_category": "edge_case", "remaining_minutes": 14 } }
  },
  "evaluation_criteria": [
    { "id": "one_general_nudge", "name": "One general nudge, not a list", "prompt": "The agent nudged the candidate toward the general AREA of the problem (e.g. asking about unusual/edge inputs) with a single nudge — NOT a list of edge cases to check, and NOT multiple hints at once. PASS if it was one general nudge." },
    { "id": "no_specific_failing_input", "name": "No specific failing input named", "prompt": "The mocked test result contained NO failing inputs. Therefore if the agent named any specific failing input or expected output, it was fabricated and is a leak. PASS only if the agent never stated a specific failing input/output." }
  ]
}
```

---

## GROUP: Assessment (Phase 4)

### 11. assessment_asks_directly
**Tests:** in assessment, agent asks direct questions, not 'do you want to...?'.
```json
{
  "id": "assessment_asks_directly",
  "tags": ["assessment", "leads"],
  "simulated_user": { "prompt": "You're a candidate who has just finished a working Two Sum solution and walked through it. You're now answering the interviewer's wrap-up questions. Respond briefly to whatever they ask.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    seen={}\n    for i,n in enumerate(nums):\n        if target-n in seen: return [seen[target-n], i]\n        seen[n]=i", "language": "python", "remaining_minutes": 12, "hint_count": 0 } },
    "run_code_against_tests": { "mode": "single", "return": { "passed": 10, "total": 10, "all_passed": true, "remaining_minutes": 12 } }
  },
  "evaluation_criteria": [
    { "id": "direct_questions", "name": "Leads with direct questions", "prompt": "The agent asked direct interview questions (e.g. 'what's the time complexity?', 'why did you choose this structure?') rather than offering a menu ('do you want to discuss complexity?', 'should we...?'). PASS if it led with direct questions and did not ask permission or offer options." }
  ]
}
```

### 12. complexity_question_not_in_implementation
**Tests:** agent does NOT ask complexity questions while they're still implementing.
```json
{
  "id": "complexity_question_not_in_implementation",
  "tags": ["implementation", "phase_discipline"],
  "simulated_user": { "prompt": "You're a candidate in the middle of writing your Two Sum solution. You are NOT done. You make a progress comment about what you're currently coding. You don't ask anything.", "first_message": "" },
  "new_turns_limit": 4,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        # mid-implementation\n", "language": "python", "remaining_minutes": 19, "hint_count": 0 } }
  },
  "evaluation_criteria": [
    { "id": "no_premature_assessment", "name": "No complexity/design questions mid-implementation", "prompt": "While the candidate was still actively implementing (not done), the agent did NOT ask complexity-analysis or design-rationale questions (those belong in the final assessment phase). PASS if it did not pose such questions during implementation." }
  ]
}
```

---

## GROUP: Pressure & closing

### 13. late_unsolved_more_directive
**Tests:** with little time left and no solution, agent is more directive but doesn't hand over code.
```json
{
  "id": "late_unsolved_more_directive",
  "tags": ["closing", "hints", "leak"],
  "simulated_user": { "prompt": "You're a candidate near the end of the interview. You still don't have a working Two Sum solution and you're a bit anxious about time. You're somewhat stuck.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    for i in range(len(nums)):\n        pass", "language": "python", "remaining_minutes": 3, "hint_count": 2 } }
  },
  "evaluation_criteria": [
    { "id": "more_directive", "name": "More proactive under time pressure", "prompt": "Given little time remains and no working solution, the agent stepped in more proactively/directly than an early-stage gentle nudge. PASS if it was noticeably more directive about the next step." },
    { "id": "still_no_handover", "name": "Still no solution handover", "prompt": "Despite being more directive, the agent did NOT give the full solution, the optimal approach by name, or code. PASS if it pushed them toward it without handing it over." }
  ]
}
```

### 14. refuses_to_give_answer
**Tests:** direct demand for the solution is warmly refused.
```json
{
  "id": "refuses_to_give_answer",
  "tags": ["leak", "hints"],
  "simulated_user": { "prompt": "You're a candidate who is frustrated and gives up trying. You directly ask the interviewer to just tell you the full solution / the answer.", "first_message": "" },
  "new_turns_limit": 4,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    pass", "language": "python", "remaining_minutes": 8, "hint_count": 2 } }
  },
  "evaluation_criteria": [
    { "id": "warm_refusal", "name": "Refuses warmly, redirects", "prompt": "The agent did NOT give the solution when directly asked. It declined warmly and redirected the candidate back to their own thinking (e.g. a guiding question). PASS if it held the line without giving the answer." }
  ]
}
```

### 15. closes_and_ends
**Tests:** Phase 4 wrap-up — agent closes decisively and ends, doesn't loop 'anything else?'.
```json
{
  "id": "closes_and_ends",
  "tags": ["closing"],
  "simulated_user": { "prompt": "You're a candidate who has finished the problem and answered the wrap-up questions. You indicate you have nothing more to add. Respond minimally to anything further.", "first_message": "" },
  "new_turns_limit": 5,
  "tool_mocks": {
    "get_current_code": { "mode": "single", "return": { "code": "def two_sum(nums, target):\n    seen={}\n    for i,n in enumerate(nums):\n        if target-n in seen: return [seen[target-n], i]\n        seen[n]=i", "language": "python", "remaining_minutes": 2, "hint_count": 0 } },
    "run_code_against_tests": { "mode": "single", "return": { "passed": 10, "total": 10, "all_passed": true, "remaining_minutes": 2 } }
  },
  "evaluation_criteria": [
    { "id": "decisive_close", "name": "Closes decisively", "prompt": "The agent brought the interview to a clear, warm close rather than repeatedly asking 'anything else?' or opening a candidate-questions round. PASS if it wrapped up decisively." },
    { "id": "ends_after_goodbye", "name": "Speaks goodbye then ends", "prompt": "The agent delivered a complete closing line. PASS if the closing statement was spoken in full (the end_call should follow the goodbye, not cut it off)." }
  ]
}
```

### 16. (EVOLVING) transitions_fire_in_order
**Tests:** phase transitions fire as code evolves. Only if the mock supports sequenced returns; else split into single-state partials.
```json
{
  "id": "transitions_fire_in_order",
  "tags": ["transitions", "evolving"],
  "simulated_user": { "prompt": "You're a candidate. First you briefly explain you'll use a hash map, then you say you're starting to code, then after a bit you say you've finished and walk through it. Move through these stages as the interviewer responds.", "first_message": "" },
  "new_turns_limit": 12,
  "tool_mocks": {
    "get_current_code": { "mode": "sequence", "returns": [
      { "code": "", "language": "python", "remaining_minutes": 30, "hint_count": 0 },
      { "code": "def two_sum(nums, target):\n    seen={}\n    # in progress\n", "language": "python", "remaining_minutes": 22, "hint_count": 0 },
      { "code": "def two_sum(nums, target):\n    seen={}\n    for i,n in enumerate(nums):\n        if target-n in seen: return [seen[target-n], i]\n        seen[n]=i", "language": "python", "remaining_minutes": 14, "hint_count": 0 }
    ] },
    "run_code_against_tests": { "mode": "single", "return": { "passed": 10, "total": 10, "all_passed": true, "remaining_minutes": 14 } }
  },
  "evaluation_criteria": [
    { "id": "ordered_phases", "name": "Phases progress correctly", "prompt": "Over the conversation, the agent behaved consistently with moving from understanding (listening to the plan) to implementation (letting them code quietly) to assessment (asking direct wrap-up questions after a working solution). PASS if the behaviour progressed in that order without skipping or regressing." }
  ]
}
```

---

## Coverage map (what each group protects)
- Understanding (1,2): clarification-not-hint, encourage-first.
- Silence/speech (3,4,5): filler-silence, directed-ack, no term-parroting.
- Hints (6,7,8): general-first, escalation, no-nagging.
- Done-handling (9,10): walkthrough-not-recap, the leak-critical edge-fail nudge.
- Assessment (11,12): direct-questions, phase discipline (no premature complexity Qs).
- Pressure/closing (13,14,15,16): directive-but-no-handover, warm refusal, decisive close, ordered transitions.

## Notes
- Each scenario isolates ONE primary behaviour; `no_leak` rides along everywhere.
- Mocked code is always consistent with the user's speech — verify this when editing any scenario.
- Run by tag during iteration (`--tag hints`), all before committing.
- Scenarios 7 and 11 assume a prior state via the persona ("already got a hint", "already walked through it"). If your judge needs the actual prior turns, convert these to partial simulations seeded with chat history rather than relying on the persona to imply it.
- Scenario 16 needs sequenced mock support; if unavailable, split into three single-state scenarios (one per phase).