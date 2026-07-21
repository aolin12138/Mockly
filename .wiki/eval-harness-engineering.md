# Eval Harness Engineering

> **When to load:** building a new eval harness for any Mockly subsystem (behavioural interviewer, technical interviewer, feedback generator, etc.). The three archetypes below cover every surface we've tested so far.

## §1. Three harness archetypes

We built three. Each has a different shape, but they share a skeleton. When you start a new harness, pick the archetype first:

| Archetype | When | Example |
|---|---|---|
| **Live agent** | Testing turn-by-turn conversational behaviour against a real AI endpoint | Technical interviewer, behavioural interviewer |
| **Pure function** | Testing a stateless pipeline (input → LLM → output) | Feedback generator |
| **Two-stage** | Testing prompt generation AND conversational behaviour in one harness | Behavioural interviewer (prompt builder + live WS) |

### Live agent (technical interviewer)

```
Fixture (JSON scenario)
  → LiveConversationClient (WebSocket to ElevenLabs)
    → Sim-user (LLM playing candidate, driven by scenario.sim_user)
      → Judge (DeepSeek, per-scenario criteria)
        → HTML report
```

Shared code: `test-suite/live/ws-client.mjs`, `test-suite/live/sim-user.mjs`, `test-suite/live/judge.mjs`

### Pure function (feedback generator)

```
Fixture ({id, payload, expectations, ordering[], stabilityAdvisory})
  → POST to n8n webhook
    → Schema checks (tier 1: types, ranges, required fields)
    → Fact checks (tier 2: ground-truth per fixture)
    → Ordering constraints (fixture A must beat fixture B on dimension X)
    → Stability (σ < 1.0 stddev across N repeats)
      → JSON results + HTML report
```

No WebSocket, no sim-user, no turn-by-turn. The simplest harness — build this first when unsure.

### Two-stage (behavioural interviewer)

```
Fixture (case JSON with persona + stage1_checks + stage2_criteria)
  → Stage 1: Generate prompt (n8n or direct LLM call)
    → Deterministic checks (identity, CV grounding, fabrication, style rules)
  → Stage 2: Install prompt on test agent → Live WS conversation
    → Judge (flow arc, drill-down, measurement probe, gap visibility, etc.)
      → HTML report (both stages side-by-side)
```

Stage 1 catches prompt-level defects (hallucination, wrong identity). Stage 2 catches behavioural defects (bad questions, praise, arc breaks). Stage 1 is cheap (3 min for 9 cases); Stage 2 is expensive (5 min per case).

## §2. Fixture design

### The three persona types

Every conversational harness needs personas:

| Persona | Ground truth | What it tests |
|---|---|---|
| **aligned** | knowledge ≡ CV | Good candidate gets probed to depth without false flags |
| **undersold** | knowledge > CV (`gems[]`) | Interviewer surfaces hidden strengths not on sparse CV |
| **oversold** | CV > knowledge (`hollow_claims[]`) | Two-level probing cracks inflated claims |

Never just test aligned cases. If you only test aligned cases, you'll miss:
- Oversold: interviewer takes bold claims at face value
- Undersold: interviewer never asks about things that aren't on the CV

### Oversold escalation pattern (THE key lesson)

The sim-user must crack under probing. Our first version gave specific-sounding answers that a human judge couldn't distinguish from real expertise. The fix is a three-level escalation in `answering_style`:

```
"answering_style": "Opens confidently. 
ESCALATION UNDER PROBING (FAST):
- First follow-up: VAGUE. No specific tools named. 'Standard evaluation pipeline.'
- Second follow-up: deflect to team. 'Infra team handled the benchmarks.'
- Third follow-up: admit it. 'I wasn't directly involved in those measurements.'"
```

And each `hollow_claims[].under_probing` must script exact weak answers, NOT just describe what the candidate doesn't know:

```
// BAD (describes knowledge gap, sim-user invents specifics):
"under_probing": "Cannot describe the index structure or distance metric."

// GOOD (scripts the answer, sim-user stays vague):
"under_probing": "When asked for index specifics: 'Standard HNSW-type approach, tuned for our workload.' Does NOT name parameters. When pressed: 'Infra team validated the latency targets.' Cannot explain how."
```

### CV design

- CVs should reflect market reality (polished, quantified bullets, buzzwords)
- BUT polish is NOT the persona differentiator — **knowledge-backing is**
- Each CV must be cross-referenced in the fixture: entity references (`must_reference_entities`), fabrication canaries (`must_not_mention`), and claim IDs (`hollow_claims[].cv_claim`)

### Stage 1 checks (for two-stage harness)

Deterministic, run instantly, no LLM needed:

1. **identity_present**: prompt identifies as interviewer, not evaluator/grader
2. **not_evaluator**: no JSON output instructions leaked from other templates
3. **cv_grounding**: ≥N CV entities referenced in prompt
4. **no_fabrication**: canary terms NOT on CV absent from prompt
5. **style_rules**: one question at a time, no praise, etc.

### Judge criteria design

Criteria must be **observable from transcript alone**. Never require the judge to infer internal state:

| BAD | GOOD |
|---|---|
| "The interviewer understood the candidate's weaknesses" | "The interviewer asked at least one measurement-probe and received either a concrete answer or a deflection" |
| "The gap became visible" | "At least one exchange shows: interviewer asks for specifics → candidate gives vague answer or deflects to team" |

When a criterion depends on the SIM-USER's behaviour (not the system's), rename it to what the system controls. Example: `gap_visible` → `gap_probe_attempted` (interviewer asked the right question, regardless of candidate's answer).

## §3. Common mistakes & fixes

### #1: Sim-user too competent

**Symptom:** Oversold candidate gives specific-sounding answers that pass the judge.  
**Root cause:** `under_probing` describes what the candidate CAN'T do, so the LLM invents plausible answers.  
**Fix:** Script the exact weak answers. "When asked X, say Y" — not "Cannot explain X." See §2 escalation pattern.

### #2: Judge criteria require inference

**Symptom:** Criteria fail for the wrong reason — judge can't tell if something "happened."  
**Root cause:** Criteria written as "the interviewer should understand..."  
**Fix:** Rewrite as observable events. "Transcript must contain: 'how was that measured?' or 'what tool did you use?'"

### #3: Fabrication (LLM invents technology not on CV)

**Symptom:** "React" appears in UI/backend prompts even when absent from CV.  
**Root cause:** LLM pattern-completes — sees "frontend" → fills in "React."  
**Fix:** Prompt builder must include explicit anti-fabrication rules. Stage 1 catches these.

### #4: Prompt builder leaks evaluator identity

**Symptom:** Feedback grader prompt template contaminates interviewer prompt template.  
**Root cause:** Shared prompt directory, similar field names.  
**Fix:** Stage 1 `not_evaluator` check catches "score each dimension" / "output a single JSON."

### #5: const shadowing (transcript silently empty)

**Symptom:** Transcript shows 0 turns despite conversation succeeding.  
**Root cause:** `const transcript = []` inside a callback shadows outer `let transcript = []`. Callback fills the inner, outer stays empty.  
**Fix:** Never shadow mutable accumulators. Use distinct names or `result.push()` on a single reference.

### #6: WS close after conversation end crashes runner

**Symptom:** `[SESSION_END]` arrives, then WS close event triggers an uncaught error.  
**Root cause:** `sendUser()` called outside try-catch after conversation end.  
**Fix:** Move `sendUser` inside the try-catch that handles conversation lifecycle.

### #7: API PATCH is not deep-merge

**Symptom:** PATCHing ElevenLabs agent with partial config clears other fields (tools).  
**Root cause:** The API replaces `conversation_config` entirely — partial payload = deleted fields.  
**Fix:** Either GET → merge → PUT the full config, or set fixed fields (tools) via UI only.

### #8: Thinking text leaks into transcript

**Symptom:** Transcript shows "The candidate has described their work on..." mid-conversation.  
**Root cause:** DeepSeek's reasoning tokens leak into text output in text-only mode.  
**Fix:** Strip thinking markers before transcript storage AND before judge views it. Regex: `/The (candidate has|interview is|conversation has)/`, etc.

### #9: n8n node configuration requires UI

**Symptom:** Can't create DeepSeek Chat Model sub-node via n8n API.  
**Root cause:** n8n API supports top-level nodes but not sub-node config for LangChain nodes.  
**Fix:** Wire sub-nodes via n8n UI drag-and-drop; script handles only top-level node params.

### #10: Timer logic differs between text-only and production

**Symptom:** Text-only tests need time pressure but real sessions are 30 min.  
**Root cause:** Text-only runs finish in 45s; the 3-min-remaining contextual update never fires.  
**Fix:** Cap timer at 45s for text-only tests. Use `client.sendContextualUpdate()` to simulate the backend's timer message.

## §4. How to build a new harness

### Step 1: Classify the surface

- **Live conversational agent?** → Live agent archetype. Reuse ws-client.mjs + sim-user.mjs.
- **Stateless function?** → Pure function archetype. POST fixtures, check output.
- **Both prompt + behaviour?** → Two-stage archetype. Generate prompts in Stage 1, test behaviour in Stage 2.

### Step 2: Design fixtures

- Minimum: 3 persona types × 1-2 configs = 3-6 cases
- Each fixture needs: ground truth (what SHOULD happen), stage-1 checks (if applicable), stage-2 criteria (if applicable)
- Write CVs first, then persona sheets, then checks/criteria
- Research packs (Tavily) for domain enrichment if LLM needs background knowledge

### Step 3: Build the runner

- State file: `_env.mjs` for env loading (reuse the pattern)
- WebSocket client: extend `test-suite/live/ws-client.mjs` or build new
- Sim-user: reuse `test-suite/live/sim-user.mjs` pattern (persona-driven)
- Judge: reuse DeepSeek pattern, per-criterion prompts
- Report: HTML with collapsible sections showing all artifacts (prompts, transcript, research, verdicts)

### Step 4: Run base cases first

- Start with aligned persona only — simplest, least moving parts
- Verify the harness works before adding oversold/undersold complexity
- Run Stage 1 first (cheap), only run Stage 2 when Stage 1 passes

### Step 5: Identify defects, iterate

- Each defect goes in a numbered table (see feedback harness's 10-defect table)
- Fix at the right level: prompt fix for LLM behaviour, code fix for harness bugs
- Re-run after each fix round

## §5. Harness comparison

| | Live (technical) | Pure function (feedback) | Two-stage (behavioural) |
|---|---|---|---|
| **Speed** | 2-5 min/case | 15-60s/case | Stage 1: 20s, Stage 2: 3-5 min |
| **Complexity** | High (WS, sim-user, judge, tools) | Low (HTTP POST + checks) | Medium (two phases, but each is simpler than full WS harness) |
| **What it catches** | Agent behaviour, tool use, phase transitions | Output schema, factual accuracy, ordering | Prompt quality + agent behaviour |
| **Depends on** | ElevenLabs WS, DeepSeek, MCP server | n8n webhook, LLM endpoint | ElevenLabs WS, DeepSeek, n8n (optional) |
| **Flakiness** | Moderate (network, agent timeouts) | Low (stateless) | Moderate (Stage 2 only) |
| **Good first harness?** | No — complex | **Yes** — simplest | Yes — Stage 1 alone is fast and valuable |

## §6. Files to touch when building a harness

```
test-suite/<new-harness>/
├── _env.mjs              # Reuse pattern from other harnesses
├── runner.mjs            # Main orchestrator
├── fixtures/             # Test case JSON files
│   └── README.md         # Schema documentation
├── scripts/              # Workflow patches, data generation
├── runs/                 # Output directory (gitignored)
└── SKILL.md              # This file (once stable)
```

Shared code never duplicated:
```
test-suite/lib/           # config, checkpoint, report, loader, criteria-layers
test-suite/live/          # ws-client, sim-user, judge, null-audio
```

If the shared code doesn't fit your harness, you're probably building the wrong archetype.

## §7. Anti-patterns

- **"Just ask the LLM to judge it."** → Vague criteria produce random verdicts. Every criterion must be yes/no from transcript.
- **"We'll add more cases later."** → Without oversold cases in the first batch, you miss the biggest class of defects.
- **"The sim-user can improvise."** → It will. Too well. Script exact weak answers (see §2).
- **"Let's test with the production agent."** → Always use a dedicated test agent. Production config carries user data and can't be reset mid-test.
- **"We'll skip Stage 1, Stage 2 is the real test."** → Stage 1 costs 20s and catches prompt hallucinations before you waste 5 min on a bad conversation.

## §8. Quality criteria design (beyond schema checks)

Schema checks verify shape (field X exists, type is string). Quality checks
verify substance — is this feedback actually helpful or generic fluff?

### The helpfulness problem

"Helpfulness" is subjective — you can't write a check for "is this feedback
useful?" But you can measure **proxies** that correlate tightly:

| Proxy | What it catches | Example |
|-------|---------------|---------|
| **Specific-noun density** | Generic filler | "improve communication" → 0 nouns. "StudyMate matching → Gale-Shapley vs Hungarian algorithm trade-offs" → 4 nouns |
| **Action-verb presence** | Vague advice | "be more confident" ✗ vs "restructure as Situation → Task → Action → Result" ✅ |
| **Transcript anchoring** | Unmoored advice | "Practice more" ✗ vs "When the interviewer asked about the Firebase migration..." ✅ |
| **Hallucination-free** | Invented claims | "Learn Rust" (not on CV, not in transcript) ✗ |
| **Score differentiation** | Lazy grading | All 6 dimensions scored exactly the same |

### The specific-noun heuristic

Implemented in `hasSpecificNoun()` in the feedback eval runner:

```js
const hasSpecificNoun = (text) => {
  // Proper nouns (capitalised mid-sentence): "Gale-Shapley", "AWS"
  const properNouns = text.match(/\b(?<![\.!?]\s)[A-Z][a-z]+\b|\b[A-Z]{3,}\b/g) || [];
  // Numbers: "30%", "150ms", "2x"
  const numbers = text.match(/\d+(?:\.\d+)?%?/g) || [];
  // Known tech keywords (89-entry allowlist): "redis", "kubernetes", "pytorch"
  const techPattern = /\b(python|react|docker|kubernetes|...)\b/gi;
  return properNouns.length > 0 || numbers.length > 0 || techPattern.test(text);
};
```

Simple but effective: catches "improve communication skills" while letting
"benchmark Redis sorted-set leaderboards with WRONGTYPE edge-case handling"
through.

### Filler flattery detection

Catches praise-without-evidence:

```js
const flattery = [
  /(great|candidate|excellent|strong|outstanding)\s+candidate/i, // no evidence
  /would\s+hire/i,                                                // no details
  /excellent\s+communication\b(?!.*\b(when|during|such as)\b)/i, // no specific instance
];
```

### Tech allowlist for hallucination detection

An 89-entry allowlist of real technologies catches hallucinated tech names
like "DataStreamOptimizer" or "CachedConnectionPooler." The check is
advisory (not failing) because no allowlist is complete, but a `❓` marker
in the report highlights suspicious entries for human review.

### Cross-field consistency

Beyond per-section checks, cross-field constraints catch systemic issues:

- **Oversold detection**: `technical_depth` score ≤ 5 (if you can't explain
  your claimed expertise, the feedback should reflect that)
- **Persona ordering**: aligned avg score > oversold avg score (if oversold
  candidates score higher than genuinely competent ones, the evaluation is
  broken)
- **Dimension spread**: range ≥ 2 across all 6 dimensions (a 7/7/7/7/7/7
  assessment is not differentiating — the evaluator is phoning it in)

### What quality criteria should NOT do

- **No quantity floors**: don't require "≥2 strengths" or "≥3 praise items."
  The agent should give what's genuinely present, not pad to hit a number.
  Quantity minimums create fabricated content.
- **No subjective judgment**: "the feedback seems helpful" is wrong. "The
  feedback contains ≥1 specific project name from the transcript" is right.
- **No inference about internal state**: "the evaluator understood the
  candidate" is uncheckable. "The gap_analysis.summary references at least
  one claim from the CV" is checkable.

## See also

- [overview](overview.md)
- [status](status.md)
- [test-suite](test-suite.md)
- [decisions](decisions.md)
- [lessons](lessons.md)
- [coaching-feedback](coaching-feedback.md)
