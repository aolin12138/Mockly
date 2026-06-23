/**
 * Local judge — evaluates scenario criteria against a transcript using DeepSeek.
 *
 * Runs all criteria for a scenario in one batch call for efficiency.
 * Deterministic (temperature 0.0).
 */
import { evaluateCriterion } from './sim-user.mjs';

/**
 * Evaluate all criteria for a scenario against the live transcript.
 *
 * @param {Object} opts
 * @param {string} opts.scenarioId
 * @param {string} opts.scenarioDescription
 * @param {Array<{id: string, name: string, conversation_goal_prompt: string}>} opts.criteria
 * @param {Array<{role: string, message: string, workflowNodeId?: string}>} opts.transcript
 * @param {string} [opts.apiKey]
 * @returns {Promise<Array<{id: string, result: 'success'|'failure'|'unknown', rationale: string}>>}
 */
export async function judgeCriteria(opts) {
  const { scenarioId, scenarioDescription, criteria, transcript } = opts;
  const apiKey = opts.apiKey;

  const results = [];
  for (const crit of criteria) {
    try {
      const result = await evaluateCriterion({
        scenarioGoal: scenarioDescription,
        criterionId: crit.id,
        criterionPrompt: crit.conversation_goal_prompt,
        transcript,
        apiKey,
      });
      results.push({ id: crit.id, result: result.result, rationale: result.rationale });
    } catch (err) {
      results.push({
        id: crit.id,
        result: 'unknown',
        rationale: `Judge error: ${err.message}`,
      });
    }
  }
  return results;
}

/**
 * Determine overall scenario result from criterion results.
 * @param {Array<{result: string}>} criteriaResults
 * @returns {'pass'|'fail'}
 */
export function overallResult(criteriaResults) {
  const failures = criteriaResults.filter(c => c.result === 'failure');
  const unknowns = criteriaResults.filter(c => c.result === 'unknown');
  if (failures.length > 0 || unknowns.length > 0) return 'fail';
  return 'pass';
}
