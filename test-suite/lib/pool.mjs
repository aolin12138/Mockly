/**
 * Bounded concurrency pool for running scenarios.
 * Handles rate limiting by pausing dispatches and reducing concurrency.
 */
import { runScenario } from './api-client.mjs';
import { CONFIG } from './config.mjs';

/**
 * Run multiple scenarios with bounded concurrency.
 * @param {string} agentId
 * @param {Object[]} scenarios
 * @param {Object} options
 * @param {number} options.concurrency - max simultaneous runs (default 5)
 * @param {number} options.timeoutMs - per-scenario timeout
 * @param {function} options.onProgress - called after each scenario completes: ({ scenarioId, result, index, total })
 * @returns {Promise<Object[]>} results array
 */
export async function runPool(agentId, scenarios, options = {}) {
  const concurrency = options.concurrency || CONFIG.concurrency;
  const timeoutMs = options.timeoutMs || CONFIG.perScenarioTimeoutMs;
  const onProgress = options.onProgress || (() => {});

  const results = new Array(scenarios.length);
  let currentConcurrency = concurrency;
  let rateLimitBackoffUntil = 0;
  let completedCount = 0;
  let nextIndex = 0;

  return new Promise((resolve) => {
    let activeCount = 0;

    function launchNext() {
      // Don't launch more than we have or beyond concurrency
      if (nextIndex >= scenarios.length) return;
      if (activeCount >= currentConcurrency) return;

      // Rate limit backoff
      const now = Date.now();
      if (now < rateLimitBackoffUntil) {
        setTimeout(() => launchNext(), rateLimitBackoffUntil - now + 100);
        return;
      }

      const index = nextIndex++;
      const scenario = scenarios[index];
      activeCount++;

      runScenario(agentId, scenario, timeoutMs).then((result) => {
        results[index] = result;
        activeCount--;

        // On rate limit, back off and reduce concurrency
        if (result.error === 'RATE_LIMITED') {
          rateLimitBackoffUntil = Date.now() + 30_000;
          currentConcurrency = Math.max(1, currentConcurrency - 2);
          console.warn(`  Rate limited. Reducing concurrency to ${currentConcurrency}, backing off 30s.`);
        }

        completedCount++;
        onProgress({
          scenarioId: scenario.id,
          result: result.result,
          index: completedCount,
          total: scenarios.length,
        });

        // Launch next and check completion
        launchNext();
        if (completedCount >= scenarios.length) {
          resolve(results.filter(Boolean));
        }
      });
    }

    // Launch initial batch
    for (let i = 0; i < Math.min(concurrency, scenarios.length); i++) {
      launchNext();
    }
  });
}
