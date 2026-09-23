/**
 * Pluggable Quality Guard Registry
 * Inspired by Neo4j-Labs AI Governor
 */

const guardRegistry = new Map();

/**
 * Register a quality guard function
 * @param {string} id - Guard identifier (e.g. EG-01)
 * @param {string} name - Friendly name
 * @param {Function} evaluateFn - Guard function (ctx) => Promise<GuardResult> | GuardResult
 * @param {Object} options - Additional options (overwrite, description)
 */
export function registerGuard(id, name, evaluateFn, options = {}) {
  if (guardRegistry.has(id) && !options.overwrite) {
    return;
  }

  guardRegistry.set(id, {
    id,
    name,
    description: options.description || '',
    evaluate: evaluateFn
  });
}

/**
 * Get all registered guards
 */
export function getRegisteredGuards() {
  return Array.from(guardRegistry.values());
}

/**
 * Run registered guards against a given context
 * @param {Object} ctx - Guard context: { task, deliverables, projectRoot, role, ... }
 * @param {Array<string>} [guardIds] - Optional subset of guard IDs to run
 * @returns {Promise<{ passed: boolean, results: Array<Object>, failureCount: number, warningCount: number }>}
 */
export async function runGuards(ctx, guardIds = null) {
  const guardsToRun = guardIds
    ? guardIds.map(id => guardRegistry.get(id)).filter(Boolean)
    : Array.from(guardRegistry.values());

  const results = [];
  let failureCount = 0;
  let warningCount = 0;

  for (const guard of guardsToRun) {
    try {
      const res = await guard.evaluate(ctx);
      const isWarning = Boolean(res.warning);
      const passed = Boolean(res.passed);

      if (!passed && !isWarning) {
        failureCount++;
      } else if (isWarning && !passed) {
        warningCount++;
      }

      results.push({
        guardId: guard.id,
        name: guard.name,
        passed,
        warning: isWarning,
        reason: res.reason || (passed ? 'Validation passed' : 'Guard check failed'),
        fixHint: res.fixHint || null
      });
    } catch (err) {
      failureCount++;
      results.push({
        guardId: guard.id,
        name: guard.name,
        passed: false,
        warning: false,
        reason: `Guard execution exception: ${err.message}`,
        fixHint: 'Check guard context arguments and try again'
      });
    }
  }

  return {
    passed: failureCount === 0,
    results,
    failureCount,
    warningCount
  };
}
