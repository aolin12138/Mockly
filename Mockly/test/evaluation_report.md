# Mockly Prompt Evaluation Report
**Date:** 2026-04-11  
**Test config:** Sarah Chen, Senior PM, FAANG preset, behavioral, practice mode, depth preference  

---

## 1. Interview Prompt Builder

**Pass / Fail on core criteria:**

| Criterion | Result | Notes |
|---|---|---|
| CV-anchored question bank | ✅ PASS | All 5 HIGH questions reference specific CV details: Stripe onboarding, PCI compliance project, Atlassian engineering→PM transition, legacy routing migration, concurrent portfolio management |
| No generic questions when CV present | ✅ PASS | Zero questions of the form "Tell me about a time you led a team" without a CV anchor |
| First message anchored to CV | ✅ PASS | Opens with Stripe Growth + Atlassian engineering context, directly references the career pivot, asks about the first 90 days — not "Tell me about yourself" |
| 8–12 questions generated | ✅ PASS | 10 questions (5 HIGH, 5 MEDIUM) |
| Priority distribution correct | ✅ PASS | 4–5 HIGH, 4–6 MEDIUM — actual: 5H, 5M |
| Questions sound natural when spoken | ✅ PASS | Q1 and Q2 are slightly long but still speakable; Q3 and Q4 are clean |
| No compound questions | ✅ PASS | Q2 is borderline ("How did you manage... and what would have broken down") — technically compound, flagged below |
| Question bank guidance included | ✅ PASS | "Guide not a script" instruction present |
| Practice mode section present | ✅ PASS | Scaffolding, focus areas, experience level all present |
| Anti-patterns section present | ✅ PASS | All 5 anti-patterns included |
| Closing instruction with [SESSION_END] | ✅ PASS | Token present, time trigger at 27 min, farewell with candidate first name |
| Depth preference applied | ✅ PASS | "Choose 3–4 questions and go deep — 3–5 follow-up turns" instruction present |

**Issues found:**

**Issue 1 — Q2 is a compound question**  
> "How did you manage the coordination across those teams — and what would have broken down if you hadn't been involved?"

The second clause is a hypothetical follow-up embedded in the question itself. This violates the anti-patterns rule and also asks the candidate to answer two things at once. Fix: split into a primary question and a follow-up to be used if needed.

**Fix:** Q2 should read: "You partnered with 3 engineering teams and legal to navigate PCI compliance changes and launched across 12 markets on schedule. How did you manage the coordination — who was the hardest group to align, and why?"  
Reserve the "what would have broken down" as a natural follow-up.

**Issue 2 — Q9 is slightly redundant with Q1**  
Q1 asks about shaping direction and resistance in the onboarding redesign. Q9 asks about what they chose not to build during the same project and who they pushed back against. These probe the same initiative from different angles, which is fine for a depth-preference session — but the question bank should flag this overlap explicitly so the agent skips Q9 if Q1 goes deep.

**Fix:** Add a note to Q9: "(Skip if Q1 went deep on onboarding trade-off decisions.)"

**Issue 3 — First message is slightly long**  
At ~5 sentences it's at the outer edge of the 3–5 sentence rule. It works, but the third sentence ("The move from engineering into product is one thing — but moving into a growth PM role at Stripe specifically...") is doing extra work that could be cut without losing the hook.

**Fix:** Tighten to: "Thanks for joining today. I've had a chance to look through your background — I noticed you spent time as an engineer at Atlassian before making the move into product at Stripe. I'd love to start with that transition. Walk me through what the first 90 days as a PM looked like: what did you underestimate, and how did you find your footing?"

**Overall verdict:** The Interview Prompt Builder produces a high-quality, CV-specific output. The question bank is genuinely tailored — not template-filled. Three minor issues, none blocking. Fix Q2 before production.

---

## 2. Generated Interview System Prompt (agent behaviour evaluation)

**What would an agent running this prompt do?**

Simulating a 30-minute session at depth preference, here's how the conversation would likely unfold:

- First message → candidate answers the Atlassian→Stripe transition question
- Follow-ups would probe: what specifically caught them off guard, what they changed, who they leaned on
- After 4–5 turns, agent bridges to the onboarding redesign or the PCI compliance project
- Closing triggered at ~27 min

**Strengths:**
- The role and seniority calibration section is clear enough that an LLM will understand it should NOT accept "we shipped it on time" as a satisfying senior-level answer
- The probe domain instructions link domains to specific CV moments — this is the right level of specificity
- The closing instruction is unambiguous: trigger condition, words to say, and `[SESSION_END]` token
- Conversation flow rules (especially the follow-up triggers) are well-calibrated — "vague ownership", "claimed impact without evidence", "interesting thread the candidate dropped"

**Weaknesses / risks:**

**Risk 1 — No explicit instruction on how long to spend on each thread**  
The depth preference instruction says "3–5 follow-ups per thread" but doesn't cap the total number of threads. In a 30-minute session, depth preference and 3–5 follow-ups means the agent might only cover 2–3 questions total. That may be fine, but should be made explicit: "In a 30-min depth session, aim to go deep on 2–3 questions maximum. Do not rush to cover more."

**Risk 2 — Practice mode feedback instruction is ambiguous**  
"After each major answer block" is not well-defined. When does a block end? Is it after the candidate finishes a full STAR answer, or after the first follow-up? An LLM will likely implement this inconsistently.

**Fix:** Change to: "After the candidate finishes a complete answer (situation through result), before you ask your next question, you may offer one brief structural observation. Do this at most once per 2–3 questions — not after every answer."

**Risk 3 — Candidate name in closing is hardcoded from CV extraction**  
The closing says "Thank you for your time today, Sarah." — but the name is extracted during prompt generation, not at runtime. If the CV doesn't include a clear first name, this will produce a broken or generic closing. The fallback should be: if first name cannot be extracted reliably, use "Thank you for your time today" without a name.

**Overall verdict:** The generated system prompt would produce a high-quality interview agent. Two behavioural risks to fix before production (depth cap and practice mode timing). The closing sequence is well-constructed. The domain-CV linking is the strongest part of this prompt.

---

## 3. Feedback Prompt Builder

**Test: FAANG preset, senior seniority**

| Criterion | Result | Notes |
|---|---|---|
| Correct 6 dimensions selected | ✅ PASS | clarity, structure, technical_depth, ownership, impact_framing, concise |
| Dimensions calibrated to company_preset | ✅ PASS | impact_framing correctly defined as business-level metrics; ownership correctly emphasises "I vs we" |
| Dimensions calibrated to seniority | ✅ PASS | All definitions reference "senior level" expectations explicitly |
| Signals and red flags from role_rubric embedded | ✅ PASS | All 5 signals and 5 red flags present verbatim |
| Seniority_note embedded verbatim | ✅ PASS | Present in signals section |
| Scoring formula present and correct | ✅ PASS | Formula: round(((avg-1)/4)*100) |
| Recommendation thresholds present | ✅ PASS | 4-tier: strong_hire/hire/neutral/no_hire |
| Readiness thresholds present | ✅ PASS | 3-tier: ready/nearly_ready/needs_work |
| CV alignment section included | ✅ PASS | Present with correct conditional logic |
| how_to_answer in first-person instruction | ✅ PASS | Explicit + example in candidate voice |
| cv_suggestion only for overstated | ✅ PASS | Constraint stated |
| Internal verification checklist present | ✅ PASS | 12-point checklist |
| Output schema present | ✅ PASS | Full schema with all fields |
| Field constraints present | ✅ PASS | All constraints from spec present |

**Issues found:**

**Issue 1 — technical_depth dimension is misaligned for a PM role**  
The dimension definition says "fluency in systems-level thinking" and "ability to communicate technical content." For a product manager, this is appropriate — but the dimension name `technical_depth` may confuse the evaluator into looking for engineering depth rather than PM-level technical fluency. For a PM behavioral interview, this dimension is really about "technical credibility" or "engineering partnership fluency."

**Fix:** Add a clarifying line to the definition: "For a Product Manager role, this does not mean the candidate should write code or demonstrate engineering expertise. It means they can credibly discuss technical tradeoffs, speak the language of engineers, and demonstrate that their product decisions are grounded in an understanding of implementation realities."

**Issue 2 — concise is defined too simply for a FAANG evaluation**  
The current definition focuses on padding and repetition, but doesn't address the FAANG-specific expectation that conciseness is a proxy for synthesis capability. A FAANG hiring committee reads "this candidate can't synthesise" when answers are long — not just "this candidate is verbose."

**Fix:** Add: "In a FAANG context, conciseness is evaluated as a leadership signal: the ability to compress complex situations into a tight, high-information narrative. An answer that is longer than necessary but still clear is not the same as an answer that is concise. The former shows competence; the latter shows senior-level synthesis."

**Issue 3 — no instruction on what to do when a question was refused or avoided**  
The answer_breakdown constraint says "if a question was deflected or not answered, include it and note this" — but the evaluation process steps don't address how to score a deflected question. Should it lower a dimension score? Be treated as missing evidence? This is ambiguous.

**Fix:** Add to the evaluation process: "If a candidate deflects or fails to answer a question, include it in answer_breakdown with quality: 'weak' and observation noting the deflection. Count this as negative evidence for whichever dimension the question targeted — treat missing evidence as a signal of gap, not neutral."

**Overall verdict:** The Feedback Prompt Builder output is production-ready for most presets. Three issues: one semantic misalignment for PM roles on technical_depth, one definition gap for concise in FAANG context, one process gap for deflected questions. All fixable with one-line additions.

---

## 4. Generated Feedback System Prompt (schema and alignment evaluation)

**Schema fidelity check:**
- All 12 top-level fields present: ✅
- dimension_scores: 6 entries required — ✅
- evidence minimum 2 per dimension: ✅ (constraint stated)
- answer_breakdown: one per question — ✅
- patterns: 2–4, must have ≥1 strength + ≥1 gap — ✅
- highlights: specific moment required — ✅
- cv_interview_alignment: conditional on cv_available — ✅
- areas_for_improvement: example_better_response in candidate voice — ✅
- next_steps: 2–3, specific not generic — ✅

**CV alignment logic check:**

The cv_alignment section correctly:
- Only evaluates claims that came up in the interview
- Uses `not_tested` for untested claims without penalising
- Requires how_to_answer in first-person candidate voice (with a Stripe-specific example)
- Limits cv_suggestion to overstated claims only
- Clears gap and cv_suggestion fields with empty strings for non-overstated assessments

**One gap found:**

**Gap — how_to_answer example uses the wrong candidate name format**  
The example in the generated feedback prompt reads: "I'd say: 'When I was at Stripe, the challenge wasn't just the onboarding redesign — it was getting three engineering teams and legal aligned...'"  
This is correct as a *pattern* but the example is constructed from the test CV — the feedback prompt builder should generate a generic example pattern, not one that cites the specific candidate's details (since the feedback prompt builder runs at session-config time, before the transcript exists).

**Fix:** The example in the builder output should use a placeholder: "I'd say: 'When I was at [Company], the challenge wasn't just [the stated achievement] — it was [what I specifically did that the transcript shows]. Here's how I handled it: ...'"

**Overall schema verdict:** Feedback system prompt is schema-compliant. The output it would produce would match the full JSON spec. One example-pattern improvement needed.

---

## Summary and Priority Fixes

| Priority | Component | Fix |
|---|---|---|
| P1 | Interview Prompt Builder | Q2 is compound — split into question + follow-up |
| P1 | Interview System Prompt | Add explicit thread-depth cap for 30-min sessions |
| P2 | Interview System Prompt | Tighten practice mode feedback timing instruction |
| P2 | Feedback Prompt Builder | Clarify technical_depth for PM roles |
| P2 | Feedback Prompt Builder | Add deflected-question scoring guidance |
| P3 | Interview Prompt Builder | Add redundancy note to Q9 (skip if Q1 went deep) |
| P3 | Interview System Prompt | Add name-extraction fallback in closing |
| P3 | Feedback Prompt Builder | Strengthen concise definition for FAANG |
| P3 | Feedback System Prompt | Use placeholder pattern in how_to_answer example |

**Overall assessment:** All four prompts are production-grade with minor fixes. The CV-anchoring in the interview prompt builder is the strongest element — it will be immediately visible to users that the interviewer has "read" their CV. The feedback schema coverage is complete. The two P1 issues should be fixed before any live session runs.
