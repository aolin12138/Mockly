# Behavioural Eval Harness

## What it is

A two-stage evaluation harness for Mockly's behavioural interview pipeline. Tests whether the
AI interviewer generates persona-aware, research-enriched prompts and conducts natural,
gap-surfacing conversations.

## Architecture

```
CV + persona fixture
  → Research pack (Tavily web search, cached)
    → Prompt builder v2 (DeepSeek, research-enriched template)
      → Interviewer system prompt
        → Stage 1: deterministic checks on generated prompt
        → Stage 2: live ElevenLabs conversation + judge
          → Report (collapsible HTML with all artifacts)
```

## Quick start

```bash
# Stage 1 only (prompt checks, ~3 min for 9 cases)
node test-suite/behavioural/runner.mjs --direct --research --stage1-only

# Stage 1 + Stage 2 (live conversations, ~5 min per case)
node test-suite/behavioural/runner.mjs --direct --research

# Regenerate research packs (force-refresh cached packs)
node test-suite/behavioural/research.mjs <case-id> --force
```

## Persona types

| Type | Ground truth | What it tests |
|---|---|---|
| **aligned** | knowledge ≡ CV | Good candidate gets probed to depth without false flags |
| **undersold** | knowledge > CV (`gems[]`) | Interviewer surfaces hidden strengths not on sparse CV |
| **oversold** | CV > knowledge (`hollow_claims[]`) | Two-level measurement probing cracks inflated claims |

## Stage 1 checks (deterministic)

1. **identity_present** — prompt says "interviewer" not "evaluator"
2. **not_evaluator** — no JSON/output instructions leaked
3. **cv_grounding** — ≥N CV entities referenced
4. **no_fabrication** — canary entities NOT on CV absent
5. **style_rules** — one question at a time, no praise

## Stage 2 criteria (judge-evaluated)

- flow_arc_order — greeting → get-to-know → candidate picks project → deep-dive → close
- drills_into_claims — mechanism-level follow-ups on bold CV claims
- asks_how_measured — probes measurement methodology for quantified claims
- gap_visible — vague/deflective answers observable in transcript (oversold only)
- one_question_per_turn — never compound questions
- no_praise_no_coaching — neutral acknowledgements only

## Adding a new test case

1. Create `fixtures/cases/<case-id>.json` following the schema:
   - `config`: company_preset, seniority, role_title, duration_min
   - `cv_file`: relative path to CV markdown
   - `persona`: project_knowledge, gems[], hollow_claims[], answering_style with escalation
   - `stage1_checks`: must_reference_entities, must_not_mention, style_rules
   - `stage2_criteria`: judge criteria array
   - `sim_user`: end_instruction, new_turns_limit

2. Create `fixtures/cvs/<case-id>.md` — synthetic CV (never real people)

3. Generate research pack:
   ```bash
   node test-suite/behavioural/research.mjs <case-id>
   ```

4. Run Stage 1 to verify:
   ```bash
   node test-suite/behavioural/runner.mjs --direct --research --stage1-only
   ```

## Oversold persona design (key pattern)

The sim-user must crack under two-level probing:

```
answering_style: "ESCALATION UNDER PROBING:
  - First follow-up: VAGUE. No specific tools named.
  - Second follow-up: deflect to team.
  - Third follow-up: admit lack of involvement."
```

Each `hollow_claims[].under_probing` should script exact weak answers.

## Dependencies

- DeepSeek API (`deepseek-chat`) for prompt generation + sim-user + judge
- ElevenLabs Conversational AI (`agent_7401kxffy3hmf2drqtptznj9j9cq`) for live Stage 2
- Tavily Search API for research packs (cached in `fixtures/research/`)
- n8n (optional) — Prompt/Feedback/Technical Feedback workflows

## Key files

| File | Purpose |
|---|---|
| `test-suite/behavioural/runner.mjs` | Two-stage eval runner |
| `test-suite/behavioural/research.mjs` | Tavily research pack generator |
| `test-suite/behavioural/fixtures/cases/*.json` | 9 test case definitions |
| `test-suite/behavioural/fixtures/cvs/*.md` | Synthetic CVs |
| `test-suite/behavioural/fixtures/research/*.json` | Cached research packs |
| `Mockly/prompts/interview_prompt_builder.md` | v2 prompt template with research injection |
| `test-suite/behavioural/run-report.html` | Generated report (open in browser) |
| `test-suite/live/ws-client.mjs` | ElevenLabs WebSocket client |

## See also

- [eval-harness-engineering](../.wiki/eval-harness-engineering.md) — three harness archetypes, common mistakes, build guide for new harnesses
