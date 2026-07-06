/**
 * Tier 2 — faithfulness-to-facts checks. Deterministic, no LLM.
 *
 * Verifies the feedback ECHOES the ground-truth facts it was given
 * (test results, time, phase, hints) instead of hallucinating them,
 * plus fixture-specific expectations (outcome, per-dimension score bands).
 *
 * Facts are derived from the fixture's webhook payload — never duplicated by hand.
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/** Derive ground-truth facts from a fixture's webhook payload. */
export function deriveFacts(payload) {
  const s = payload?.execution_summary || {};
  const r = s.results || {};
  const visible = { passed: num(r.visibleTests?.passed) ?? 0, total: num(r.visibleTests?.total) ?? 0 };
  const hidden = { passed: num(r.hiddenTests?.passed) ?? 0, total: num(r.hiddenTests?.total) ?? 0 };
  return {
    visible,
    hidden,
    combined: { passed: visible.passed + hidden.passed, total: visible.total + hidden.total },
    completed: s.completed === true,
    reachedPhase: num(s.reachedPhase ?? s.reached_phase),
    timeTakenMinutes: num(s.timeTakenMinutes),
    timeBudgetMinutes: num(s.timeBudgetMinutes),
    hintCount: Array.isArray(s.hintLog) ? s.hintLog.length : num(s.hintCount) ?? 0,
    hasTranscript: Array.isArray(payload?.transcript) && payload.transcript.length > 0,
  };
}

/**
 * @param {object} body - webhook response body
 * @param {object} payload - the webhook request payload (ground truth source)
 * @param {object} [expectations] - fixture expectations: { outcome: string[], bands: {dimName: [min,max]} }
 */
export function runFactChecks(body, payload, expectations = {}) {
  const checks = [];
  const add = (id, name, pass, detail = '') => checks.push({ id, name, pass, detail });

  if (!body || typeof body !== 'object' || (body.error && body.raw)) {
    add('facts_skipped', 'Fact checks skipped — no parseable feedback', false, 'tier 1 parse failure');
    return checks;
  }

  const facts = deriveFacts(payload);
  const dims = Array.isArray(body.dimensions) ? body.dimensions : [];
  const dimByName = Object.fromEntries(dims.map((d) => [d?.name, d]));

  // 1. Test-result echo. The prompt shows visible and hidden separately, so accept
  //    either visible-only or combined totals — but passed must match the same basis.
  const tr = body.test_results || {};
  const passed = num(tr.passed);
  const total = num(tr.total);
  const matchesVisible = total === facts.visible.total && passed === facts.visible.passed;
  const matchesCombined = total === facts.combined.total && passed === facts.combined.passed;
  add('test_results_echo', 'test_results echoes input facts (visible or combined basis)',
    matchesVisible || matchesCombined,
    `feedback ${passed}/${total} vs visible ${facts.visible.passed}/${facts.visible.total}, combined ${facts.combined.passed}/${facts.combined.total}`);

  // 2. Time echo
  if (facts.timeTakenMinutes != null) {
    add('time_echo', 'time.taken/budget echoes input',
      num(body.time?.taken_minutes) === facts.timeTakenMinutes &&
      (facts.timeBudgetMinutes == null || num(body.time?.budget_minutes) === facts.timeBudgetMinutes),
      `feedback ${body.time?.taken_minutes}/${body.time?.budget_minutes} vs input ${facts.timeTakenMinutes}/${facts.timeBudgetMinutes}`);
  }

  // 3. Phase + completed echo
  if (facts.reachedPhase != null) {
    add('phase_echo', 'reached_phase echoes input', num(body.reached_phase) === facts.reachedPhase,
      `feedback ${body.reached_phase} vs input ${facts.reachedPhase}`);
  }
  add('completed_echo', 'completed echoes input', body.completed === facts.completed,
    `feedback ${body.completed} vs input ${facts.completed}`);

  // 4. hints_used echo on Independence
  const indep = dimByName['Independence'];
  if (indep) {
    add('hints_echo', 'Independence.hints_used equals hint log length',
      num(indep.hints_used) === facts.hintCount,
      `feedback ${indep.hints_used} vs input ${facts.hintCount}`);
  }

  // 5. Cheap contradiction heuristics in narrative text
  const narrative = [body.summary, body.thinking_and_logic, body.code_assessment,
    ...dims.flatMap((d) => [d?.what_went_well, d?.what_to_improve])]
    .filter((t) => typeof t === 'string').join(' ').toLowerCase();

  if (facts.combined.passed < facts.combined.total) {
    const claimsAllPassed = /\ball (?:the )?tests? (?:passed|passing)\b|\bpassed all (?:the )?tests?\b/.test(narrative);
    add('no_false_all_passed', 'Narrative does not claim all tests passed when some failed', !claimsAllPassed,
      claimsAllPassed ? 'found an "all tests passed" claim' : '');
  }
  if (facts.combined.passed === facts.combined.total && facts.combined.total > 0) {
    const claimsFailures = /\bfailed \d+ tests?\b|\btests? (?:are )?failing\b/.test(narrative);
    add('no_false_failures', 'Narrative does not claim test failures when all passed', !claimsFailures,
      claimsFailures ? 'found a failure claim' : '');
  }
  if (facts.hintCount === 0) {
    const claimsHints = /\b(?:needed|used|required|given) (?:a|one|two|three|\d+|several|multiple) hints?\b/.test(narrative);
    add('no_false_hints', 'Narrative does not claim hints were used when none were', !claimsHints,
      claimsHints ? 'found a hint-usage claim' : '');
  }
  if (!facts.hasTranscript) {
    // Blind-grading probe: with no transcript, quoting the candidate is hallucination.
    const quotesCandidate = /\bwhen you said\b|\byou mentioned\b|\byou stated\b/.test(narrative);
    add('no_fabricated_quotes', 'No fabricated candidate quotes when transcript is absent', !quotesCandidate,
      quotesCandidate ? 'narrative quotes a candidate statement but no transcript was provided' : '');
  }

  // 6. Fixture expectations — outcome
  if (Array.isArray(expectations.outcome) && expectations.outcome.length) {
    add('expected_outcome', `outcome in [${expectations.outcome.join(', ')}]`,
      expectations.outcome.includes(body.outcome), `got: ${body.outcome}`);
  }

  // 7. Fixture expectations — per-dimension score bands
  for (const [dimName, [min, max]] of Object.entries(expectations.bands || {})) {
    const d = dimByName[dimName];
    const score = num(d?.score);
    const slug = dimName.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '');
    add(`band_${slug}`, `${dimName} score in [${min}, ${max}]`,
      score != null && score >= min && score <= max, `got: ${d?.score ?? 'missing'}`);
  }

  return checks;
}
