/**
 * Tier 1 — structural / schema checks. Deterministic, no LLM, no network.
 *
 * Input: the parsed JSON body returned by the n8n "Technical feedback" webhook.
 * The workflow's "Parse & wrap" node spreads the feedback fields at the TOP LEVEL
 * and adds { transcript, audio, callDurationSecs }. On LLM-output parse failure it
 * returns { raw, error, ... } instead.
 *
 * Every check returns { id, name, pass, detail }.
 */

export const CANONICAL_DIMENSIONS = [
  'Correctness & Completeness',
  'Problem-Solving & Thinking',
  'Technical Communication',
  'Complexity & Optimization',
  'Code Quality',
  'Independence',
];

const LABEL_BANDS = [
  { label: 'strong', min: 8.0, max: 10.0 },
  { label: 'adequate', min: 5.5, max: 7.9 },
  { label: 'needs work', min: 0, max: 5.4 },
];

export function labelForScore(score) {
  if (score >= 8.0) return 'strong';
  if (score >= 5.5) return 'adequate';
  return 'needs work';
}

const OUTCOMES = ['solved', 'partially_solved', 'not_solved'];

const isNonEmptyString = (v, min = 1) => typeof v === 'string' && v.trim().length >= min;

/**
 * @param {object} body - webhook response body (already JSON-parsed)
 * @returns {Array<{id:string,name:string,pass:boolean,detail:string}>}
 */
export function runSchemaChecks(body) {
  const checks = [];
  const add = (id, name, pass, detail = '') => checks.push({ id, name, pass, detail });

  // 0. Response is an object and the workflow did not report a parse failure
  const isObject = body && typeof body === 'object' && !Array.isArray(body);
  add('response_is_object', 'Response is a JSON object', isObject, isObject ? '' : `got ${typeof body}`);
  if (!isObject) return checks;

  const parseFailed = Object.prototype.hasOwnProperty.call(body, 'error') && Object.prototype.hasOwnProperty.call(body, 'raw');
  add('llm_json_parsed', 'LLM output parsed as JSON (no {raw,error} failure shape)', !parseFailed,
    parseFailed ? `workflow parse error: ${body.error}` : '');
  if (parseFailed) return checks;

  // 1. Required top-level fields
  const required = ['summary', 'outcome', 'completed', 'reached_phase', 'test_results', 'time',
    'dimensions', 'thinking_and_logic', 'code_assessment', 'next_steps', 'patterns_to_study', 'encouragement'];
  const missing = required.filter((k) => body[k] === undefined || body[k] === null);
  add('required_fields', 'All required top-level fields present', missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : '');

  // 2. No LLM-computed overall score (backend owns it)
  const overallKeys = ['overall_score', 'overallScore', 'overall', 'score'].filter((k) => body[k] !== undefined);
  add('no_overall_score', 'LLM did not emit an overall score', overallKeys.length === 0,
    overallKeys.length ? `found: ${overallKeys.join(', ')}` : '');

  // 3. Outcome enum
  add('outcome_enum', `outcome is one of ${OUTCOMES.join('/')}`, OUTCOMES.includes(body.outcome), `got: ${body.outcome}`);

  // 4. Dimensions — exactly the 6 canonical names (order-insensitive), no extras.
  //    computeOverallScore() in the backend weight-drops any name that isn't an exact
  //    string match, so name drift silently corrupts the overall score.
  const dims = Array.isArray(body.dimensions) ? body.dimensions : [];
  add('dimensions_is_array', 'dimensions is an array', Array.isArray(body.dimensions), `got: ${typeof body.dimensions}`);
  const names = dims.map((d) => d?.name);
  const missingDims = CANONICAL_DIMENSIONS.filter((n) => !names.includes(n));
  const extraDims = names.filter((n) => !CANONICAL_DIMENSIONS.includes(n));
  add('dimension_names_exact', 'Exactly the 6 canonical dimension names (exact match)',
    missingDims.length === 0 && extraDims.length === 0 && dims.length === 6,
    `missing: [${missingDims.join('; ')}] extra: [${extraDims.join('; ')}] count: ${dims.length}`);

  // 5. Per-dimension score/label/narrative validity
  for (const dim of dims) {
    const n = dim?.name || '?';
    const slug = n.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
    const score = Number(dim?.score);
    const scoreOk = Number.isFinite(score) && score >= 0 && score <= 10;
    add(`score_range_${slug}`, `${n}: score numeric in [0,10]`, scoreOk, `score: ${dim?.score}`);
    if (scoreOk) {
      const expected = labelForScore(score);
      add(`label_consistent_${slug}`, `${n}: label matches score band`, dim?.label === expected,
        `score ${score} → expected "${expected}", got "${dim?.label}"`);
    }
    add(`narrative_${slug}`, `${n}: what_went_well & what_to_improve non-empty`,
      isNonEmptyString(dim?.what_went_well, 10) && isNonEmptyString(dim?.what_to_improve, 10),
      `went_well: ${JSON.stringify(dim?.what_went_well)?.slice(0, 60)} to_improve: ${JSON.stringify(dim?.what_to_improve)?.slice(0, 60)}`);
  }

  // 6. Independence carries hints_used
  const indep = dims.find((d) => d?.name === 'Independence');
  if (indep) {
    add('independence_hints_used', 'Independence includes numeric hints_used',
      Number.isFinite(Number(indep.hints_used)), `hints_used: ${indep.hints_used}`);
  }

  // 7. Narrative sections non-trivial (empty code_assessment was a shipped bug — treat as failure)
  add('summary_nontrivial', 'summary is a non-trivial string', isNonEmptyString(body.summary, 40), `len: ${body.summary?.length ?? 0}`);
  add('thinking_nontrivial', 'thinking_and_logic is a non-trivial string', isNonEmptyString(body.thinking_and_logic, 40), `len: ${body.thinking_and_logic?.length ?? 0}`);
  add('code_assessment_nontrivial', 'code_assessment is a non-trivial string', isNonEmptyString(body.code_assessment, 40), `len: ${body.code_assessment?.length ?? 0}`);

  // 8. next_steps: non-empty array of {action, why, how}
  const steps = Array.isArray(body.next_steps) ? body.next_steps : [];
  const stepsOk = steps.length > 0 && steps.every((s) =>
    isNonEmptyString(s?.action, 5) && isNonEmptyString(s?.why, 5) && isNonEmptyString(s?.how, 5));
  add('next_steps_shape', 'next_steps is a non-empty array of {action,why,how}', stepsOk,
    `count: ${steps.length}`);

  // 9. primary_focus: advisory check (LLMs occasionally omit it despite prompt rules;
  //    the Parse node fallback should catch this — if it's empty, it's a prompt nit, not a bug)
  const hasFocus = body.primary_focus !== undefined;
  add('primary_focus_present', 'primary_focus is a non-trivial imperative sentence (advisory)',
    !hasFocus || isNonEmptyString(body.primary_focus, 10),
    `len: ${body.primary_focus?.length ?? 0}${!hasFocus ? ' (field absent — not gating)' : ''}`);

  // 10. patterns_to_study: non-empty array of strings
  const patterns = Array.isArray(body.patterns_to_study) ? body.patterns_to_study : [];
  add('patterns_shape', 'patterns_to_study is a non-empty string array',
    patterns.length > 0 && patterns.every((p) => isNonEmptyString(p)), `count: ${patterns.length}`);

  // 11. test_results shape
  const tr = body.test_results;
  add('test_results_shape', 'test_results has numeric passed/total',
    tr && Number.isFinite(Number(tr.passed)) && Number.isFinite(Number(tr.total)) && Number(tr.passed) <= Number(tr.total),
    `passed: ${tr?.passed}, total: ${tr?.total}`);

  return checks;
}
