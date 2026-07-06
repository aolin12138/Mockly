# Technical Feedback Eval Harness

Offline batch evaluation for the n8n **Technical feedback** workflow
(`pbjDnkI5TDO9bto5`, webhook `POST /webhook/technical-feedback`, backed up in
`../n8n-backups/technical-feedback-pbjDnkI5TDO9bto5.json`).

Unlike the interviewer harness (`../live/`), no sim-user or WebSocket is needed:
the workflow is **stateless** — `Webhook → Format prompt → GPT-5.2 → Parse & wrap → Respond` —
it grades exactly what is POSTed to it and never fetches the transcript itself.
So evaluation is: POST fixture → run deterministic checks on the JSON that comes back.

## Run

```bash
cd test-suite/feedback
node runner.mjs --all                    # every fixture once
node runner.mjs --fixture solved-clean   # one fixture (comma-separate for several)
node runner.mjs --all --repeats 3        # stability run (per-dimension stddev + label flips)
node runner.mjs --all --dry              # validate fixtures, no network
node report.mjs                          # HTML report + rendered feedback pages (latest run)
```

`report.mjs` writes `feedback-report.html` (harness-style report: checks, ordering,
stability) and, for **every test case**, a faithful static replica of the real
`ResultsTechnicalPage` rendered from the generated feedback
(`runs/<ts>/pages/<fixture>-r<N>.html`, embedded as previews in the report) — same
`transformFeedbackData` mapping and same backend `computeOverallScore` weights, so you
see exactly the page a user would get for that session.

Env: `TECHNICAL_FEEDBACK_WEBHOOK_URL` (default `http://localhost:5678/webhook/technical-feedback`).
Requires n8n running with the workflow active and its OpenAI credential valid.
Exit code 0 = all gates pass (CI-friendly). Results + raw responses land in `runs/<timestamp>/`.

## Check tiers

| Tier | File | What it catches |
|---|---|---|
| 1 Schema | `lib/schema-checks.mjs` | invalid JSON (`{raw,error}` shape), missing fields, wrong/extra dimension names (silently zero-weighted by `computeOverallScore`!), score out of [0,10], label≠score band, LLM-emitted overall score, empty `code_assessment`/`next_steps` |
| 2 Facts | `lib/fact-checks.mjs` | hallucinated test results/time/phase/hint counts, "all tests passed" when some failed, fabricated candidate quotes when no transcript was given, fixture-specific outcome + score-band expectations |
| Ordering | `runner.mjs` | miscalibration: pairs of fixtures where the correct ranking is known a priori (e.g. 0-hints run must out-score 3-hints run on Independence) |
| Stability | `runner.mjs --repeats N` | same input → wildly different scores; gate: per-dimension σ ≤ 1.0 and no label flips |

## Fixtures

| Fixture | Archetype | Key expectations |
|---|---|---|
| `solved-clean` | optimal solution, 0 hints, narrates, states complexity | outcome solved; Correctness ≥8; Independence ≥8; anchors 4 ordering pairs |
| `solved-heavy-hints` | same code/tests but 3 escalating hints | Independence ≤6.5 and < solved-clean |
| `partial-edge-fail` | brute force, fails empty-input edge + 1 hidden | outcome partially_solved; no "all tests passed" claim |
| `not-solved-silent` | 1/6 tests, near-silent candidate, phase 2 | outcome not_solved; Correctness ≤4.5; Communication < solved-clean |
| `wrong-complexity-claim` | claims O(n) for an O(n²) solution | Complexity ≤6 and < solved-clean |
| `no-transcript` | replicates the real `/technical/end` payload (no transcript!) | schema still valid; **no fabricated quotes** |
| `prompt-injection` | transcript orders the grader to give 10s | facts dominate: outcome not_solved, Correctness ≤5 |

Fixture format: `{ id, description, payload, expectations: { outcome: [..], bands: { <dim>: [min,max] } }, ordering: [{ dimension, mustBeat }] }`.
`payload` is the exact webhook body; ground-truth facts for tier-2 are **derived from it**, never duplicated.

Add fixtures by dropping a JSON file in `fixtures/` — real (anonymized) sessions and
transcripts from `../runs/` live-harness runs are ideal sources.

## Promotion gate (mirrors ../EVAL-PLAN.md)

A change to the feedback prompt/workflow is promotable only if:
1. Tier 1 + 2 = 100% pass on all fixtures,
2. all ordering constraints hold,
3. stability run (`--repeats 3`) has no σ > 1.0 and no label flips,
4. no regression vs the previous `runs/` results.

Back up the workflow before editing it (n8n API key is in `.env` as `N8N_API`):

```bash
curl -H "X-N8N-API-KEY: $N8N_API" http://localhost:5678/api/v1/workflows/pbjDnkI5TDO9bto5 \
  -o ../n8n-backups/technical-feedback-$(date +%Y-%m-%dT%H-%M-%S).json
```

## Fixed via this harness (2026-07-06, see scripts/patch-workflow.py + git history)

1. ✅ **`/technical/end` now fetches the transcript** before calling the workflow
   (`fetchConversationTranscript` in `interviewRoutes.js`) — previously the primary path
   graded Communication/Independence blind. The `no-transcript` fixture still pins
   graceful degradation if the fetch fails.
2. ✅ **`Format prompt` now derives failures/by-category from `results.visibleTests.details`**
   (the shape the backend actually sends).
3. ✅ **hints_used drift** — grader counted a failed-test disclosure as a hint; prompt now pins
   hints_used to the HINTS list length.
4. ✅ **Test-total arithmetic** — grader reported 9/10 for 5/6 + 3/4; Format prompt now emits a
   precomputed `TOTAL TESTS PASSED` line the model must copy.
5. ✅ **Example-value bleed-through** — with no transcript, grader copied `reached_phase: 4`
   from the prompt's example JSON; prompt now marks example values as placeholders.
6. ✅ **Answer key never reached the model** — Format prompt concatenated JSON objects into
   `"[object Object]"`; now `JSON.stringify`ed. The canonical optimal solution (with code) is
   finally visible to the grader, and the prompt now requires code_assessment to contrast the
   candidate's code with it by name.
7. ✅ **Independence rubric flaw** — silent do-nothing candidates scored 7–9 on Independence
   (zero hints ≠ independent progress); prompt now caps Independence ≤ 5 without real progress.
8. ✅ **Lazy coaching / fabricated attribution** — `what_to_improve: "None."` on perfect scores
   and 'you said…' phrasing without a transcript are now banned by prompt rules.
9. ✅ **Backend fact enforcement** — `enforceFactFields()` overwrites test counts, time, phase,
   and hints_used from the execution summary after generation; plus one validated retry when
   the workflow returns invalid feedback (design doc Part 6).

## Known gaps still open

1. `elevenlabs_api_key` / `openai_api_key` in the webhook payload are **unused** by the workflow —
   dead payload and unnecessary key exposure.
2. `LoadingPage.jsx` technical branch requires a `webhookUrl` state field that is never passed —
   the post-interview waiting page never polls/navigates on its own.
3. Question bank has only 5 questions (all with full answer keys — `solutions.optimal` incl.
   code, mistakes, follow-ups). No schema migration needed for optimal-solution reference;
   growing the bank is a seeding task (`seed_answer_keys.js` pattern).

## Not yet implemented (tier 3)

LLM-judge rubric checks (specificity of `next_steps`, grounding of quoted evidence in the
transcript, coaching tone) — reuse the DeepSeek judge pattern from `../live/judge.mjs` once
tiers 1–2 are green in CI.
