# Behavioural Eval Fixtures

Test cases for the two-stage behavioural interview eval:

- **Stage 1** — the case's `config` + CV are sent through the real n8n `Prompt`
  workflow; `stage1_checks` assert on the *generated interviewer prompt*.
- **Stage 2** — the generated prompt is installed on the dedicated behavioural
  test agent; a DeepSeek sim-user plays the `persona`; the judge evaluates the
  transcript against `stage2_criteria`.

## Layout

```
fixtures/
├── cases/<config>-<persona>.json   # one test case per persona
├── cvs/<config>-<persona>.md       # the CV (parsed-text equivalent of PDF upload)
└── README.md
```

## Case schema

| Field | Meaning |
|---|---|
| `config` | prompt_spec metadata: `company_preset`, `seniority` (existing enum; `seniority_label` records the future 4-level name), `role_title`, `stage`, `mode`, `duration_min`, `session_mode` |
| `cv_file` | relative path to the CV markdown (fed as `cv_raw_text`) |
| `persona` | sim-user ground truth: `project_knowledge[]` (per CV item: `actual_depth`, `can_explain[]`), `gems[]` (real achievements NOT on the CV — undersold), `hollow_claims[]` (CV claims the candidate cannot back — oversold), `answering_style` |
| `stage1_checks` | deterministic checks on the generated prompt: identity markers (interviewer, not evaluator — guards the known prompt-swap landmine), `must_reference_entities` (≥ `min_entity_references` present), `must_not_mention` (fabrication canaries — entities NOT on this CV), `style_rules_must_contain_any` (each inner list = alternatives, one must match) |
| `stage2_criteria` | judge criteria, same shape as `test-suite/scenarios/*.json` `evaluation_criteria` |
| `sim_user` | run parameters: `end_instruction`, `new_turns_limit` |
| `feedback_expectations` | forward-looking asserts for harness 3 (feedback eval) — not used by stages 1–2 |

## Persona types

| Type | Ground truth | What it tests |
|---|---|---|
| `aligned` | knowledge ≡ CV | CV-grounded questioning, flow arc, drill-down depth, no false gap-flags |
| `undersold` | knowledge > CV (`gems[]`) | probing beneath a sparse CV; ≥2 of the gems must surface |
| `oversold` | CV > knowledge (`hollow_claims[]`) | drilling into bold claims; gap becomes observable in transcript |

## Shared flow-arc criterion

Every case asserts the arc: greeting → get-to-know → CV deep-dive → deeper
probing → wrap, in order, without jarring jumps. Per-persona criteria are
added on top.

## CV realism grounding (researched 2026-07-07)

Modern CVs are metric-dense and buzzword-heavy, so **polish is NOT the persona
differentiator — whether knowledge backs the numbers is**:

- 64–70% of workers admit lying/inflating on CVs at least once; 6 in 10 who did
  landed the job (StandOut CV 2024, ResumeLab 2023, Resume.org 2024)
- 94.3% of resumes contain overused buzzwords (avg 2.9/resume); XYZ-formula
  quantified bullets are standard FAANG advice (resumly.ai 138k-resume study)
- 42% used AI tools on their last CV update → uniform "results-driven" polish

Applied: **aligned** = punchy XYZ bullets, every number defensible in
`project_knowledge`; **undersold** = buzzword *style* (empty "team player"
words) but duty-phrased substance, no achievements; **oversold** = full
AI-polish inflation with suspicious round numbers (99.9%, 60%, 40%, 35%),
each mapped to a `hollow_claims[]` entry.

## Authoring rules

1. Gems / hollow claims are the **ground truth** — write them so a check can
   reference them exactly ("CI pipeline", "60%"). Tier-2 asserts quote them.
2. `must_not_mention` canaries must be plausible for the role but genuinely
   absent from the CV (hallucination detectors).
3. CVs are synthetic — never real people's CVs.
4. The prompt builder never sees the persona — only the CV. Personas exist for
   the sim-user (stage 2) and the feedback asserts (harness 3).
5. Keep `seniority` on the existing enum (`intern|junior|mid|senior|staff`);
   record the future 4-level name in `seniority_label`
   (grad|junior|senior|lead) so fixtures survive the consolidation.

## Current coverage

| Config | Cases |
|---|---|
| faang / grad (intern) / SWE New Grad | aligned, undersold, oversold |
| faang / senior / SWE | (planned) |
| startup / junior / fullstack | (planned) |
| quant / grad / quant dev | (planned) |
