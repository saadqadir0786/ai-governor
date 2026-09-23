/**
 * Quality-Gated Task Transition Engine
 * State-machine enforced quality gates for AI agent output.
 * Inspired by Neo4j-Labs Governor TransitionEngine.
 */

import { runGuards } from '../guards/registry.js';
import { registerBuiltinGuards } from '../guards/builtins.js';

// Auto-register built-in guards
registerBuiltinGuards();

export const TASK_STATES = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  REWORK: 'REWORK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

export const ALLOWED_TRANSITIONS = {
  [TASK_STATES.PENDING]: [TASK_STATES.ACTIVE, TASK_STATES.CANCELLED],
  [TASK_STATES.ACTIVE]: [TASK_STATES.READY_FOR_REVIEW, TASK_STATES.CANCELLED],
  [TASK_STATES.REWORK]: [TASK_STATES.READY_FOR_REVIEW, TASK_STATES.CANCELLED],
  [TASK_STATES.READY_FOR_REVIEW]: [TASK_STATES.COMPLETED, TASK_STATES.REWORK, TASK_STATES.CANCELLED],
  [TASK_STATES.COMPLETED]: [],
  [TASK_STATES.CANCELLED]: []
};

export class TransitionEngine {
  /**
   * @param {import('./backend.js').MemoryBackend} backend
   */
  constructor(backend) {
    this.backend = backend;
  }

  /**
   * Transition a task to a new state with quality guard validation and role separation
   * @param {string} taskId
   * @param {string} targetStatus
   * @param {string} callerRole - Role attempting the transition (DEVELOPER, EXECUTOR, REVIEWER, HUMAN)
   * @param {Object} [options] - Additional parameters (dryRun, guardIds, contextOverrides)
   */
  async transitionTask(taskId, targetStatus, callerRole = 'EXECUTOR', options = {}) {
    const task = await this.backend.getTask(taskId);
    if (!task) {
      return {
        result: 'ERROR',
        error: `Task ${taskId} not found.`
      };
    }

    const currentStatus = task.status;
    const normTarget = targetStatus.toUpperCase();
    const normCaller = callerRole.toUpperCase();

    // 1. Concurrency Check
    if (options.expectedCurrentStatus && options.expectedCurrentStatus.toUpperCase() !== currentStatus) {
      return {
        result: 'STATE_CONFLICT',
        error: `Task status conflict: expected ${options.expectedCurrentStatus} but was ${currentStatus}`
      };
    }

    // 2. Validate Allowed Transition in State Machine
    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(normTarget)) {
      return {
        result: 'INVALID_TRANSITION',
        error: `Cannot transition task from ${currentStatus} to ${normTarget}. Allowed transitions: [${allowedTargets.join(', ')}]`
      };
    }

    // 3. Role Separation Gate (Approval separation)
    if (normTarget === TASK_STATES.COMPLETED) {
      const creatorRole = (task.role || 'DEVELOPER').toUpperCase();
      const submittingActor = (task.submitted_by || task.role || '').toUpperCase();

      if (['DEVELOPER', 'EXECUTOR'].includes(normCaller) && normCaller === creatorRole) {
        return {
          result: 'FAIL',
          guardResults: [{
            guardId: 'EG-08',
            name: 'Role Separation Gate',
            passed: false,
            reason: `Self-approval rejected: Executor role (${normCaller}) cannot approve its own task.`,
            fixHint: 'Approval must be performed by a distinct role (REVIEWER, HUMAN, or TECH_LEAD).'
          }],
          message: 'Transition blocked by role separation.'
        };
      }
    }

    // 4. Fetch Reviews and Context
    const reviews = await this.backend.getReviews(taskId);
    const reports = await this.backend.getReports(taskId);

    const guardContext = {
      task,
      reviews,
      reports,
      projectRoot: options.projectRoot || process.cwd(),
      callerRole: normCaller,
      targetStatus: normTarget,
      ...options.contextOverrides
    };

    // 5. Evaluate Quality Guards
    let guardRunResult = { passed: true, results: [], failureCount: 0 };
    if (normTarget === TASK_STATES.READY_FOR_REVIEW) {
      guardRunResult = await runGuards(guardContext, options.guardIds);
    }

    const transitionEvent = {
      taskId,
      fromStatus: currentStatus,
      toStatus: normTarget,
      callerRole: normCaller,
      passed: guardRunResult.passed,
      dryRun: Boolean(options.dryRun),
      guardResults: guardRunResult.results
    };

    await this.backend.recordEvent(transitionEvent);

    if (!guardRunResult.passed) {
      return {
        result: 'FAIL',
        previousStatus: currentStatus,
        targetStatus: normTarget,
        guardResults: guardRunResult.results,
        message: `Task transition blocked by ${guardRunResult.failureCount} failing guard(s).`
      };
    }

    // 6. Apply state change if not dry-run
    if (!options.dryRun) {
      await this.backend.updateTask(taskId, {
        status: normTarget,
        last_transition_by: normCaller,
        last_guard_results: guardRunResult.results
      });
    }

    return {
      result: 'PASS',
      previousStatus: currentStatus,
      newStatus: options.dryRun ? currentStatus : normTarget,
      dryRun: Boolean(options.dryRun),
      guardResults: guardRunResult.results,
      message: `Task successfully transitioned to ${normTarget}.`
    };
  }

  /**
   * Query all allowed transitions for a task from its current status,
   * including dry-run evaluation of guards for each possible target state.
   * @param {string} taskId
   * @param {string} callerRole - Role inquiring about transitions (DEVELOPER, REVIEWER, etc.)
   * @param {Object} [options] - Additional context overrides
   */
  async getAvailableTransitions(taskId, callerRole = 'EXECUTOR', options = {}) {
    const task = await this.backend.getTask(taskId);
    if (!task) {
      return { taskId, error: `Task ${taskId} not found.`, transitions: [] };
    }

    const currentStatus = task.status;
    const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
    const transitions = [];

    for (const targetState of allowedTargets) {
      const preview = await this.transitionTask(taskId, targetState, callerRole, {
        ...options,
        dryRun: true
      });

      transitions.push({
        fromState: currentStatus,
        targetState,
        canTransition: preview.result === 'PASS',
        result: preview.result,
        error: preview.error || preview.message,
        guardResults: preview.guardResults || []
      });
    }

    return {
      taskId,
      currentStatus,
      callerRole: callerRole.toUpperCase(),
      transitions
    };
  }
}

