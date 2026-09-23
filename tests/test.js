/**
 * ai-governor comprehensive test suite
 * Tests environment detection, RBAC matrix, quality guards, state transitions, and audit trails.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectEnvironment,
  computeRoleAssignments,
  TransitionEngine,
  MemoryBackend,
  AuditLogger,
  TASK_STATES,
  guardSelfReview,
  guardDeliverables,
  guardTestProof,
  guardRollbackPlan,
  guardClearanceGate,
  guardScopedEdit,
  guardAuditMultiSource,
  guardRoleSeparation,
  guardNoSecrets,
  guardNoImpliedDeploys,
  isPathContained,
  runGuards
} from '../src/index.js';
import { getModelRegistry } from '../src/utils/remote.js';
import { generateMasterPolicy } from '../src/generators/policy.js';

console.log('🛡️  Running ai-governor unit tests...\n');

async function runTests() {
  // Test 1: Remote/Local Registry & Fallbacks
  const { registry, source } = await getModelRegistry();
  assert(registry['gemini-3-pro'], 'Registry must contain gemini-3-pro');
  assert(registry['claude-3-7-sonnet'], 'Registry must contain claude-3-7-sonnet');
  console.log('✔ Test 1: Registry load passed (source: ' + source + ')');

  // Test 2: Role Assignment Logic
  const mockModels = ['gemini-3-pro', 'claude-3-7-sonnet', 'gemini-3.8-flash'];
  const assignments = computeRoleAssignments(mockModels, registry);
  assert.strictEqual(assignments.ARCHITECTURE.assignedModelId, 'gemini-3-pro', 'Architecture should prefer Gemini 3 Pro');
  assert.strictEqual(assignments.LOGIC_DEBUG.assignedModelId, 'claude-3-7-sonnet', 'Logic Debug should prefer Claude 3.7 Sonnet');
  assert.strictEqual(assignments.RAPID_FIX.assignedModelId, 'gemini-3.8-flash', 'Rapid fix should prefer Gemini 3.8 Flash');
  console.log('✔ Test 2: Role assignment logic passed');

  // Test 3: Fallback Assignment Logic when Claude is absent
  const fallbackModels = ['gemini-3-pro', 'gemini-3.8-flash'];
  const fallbackAssignments = computeRoleAssignments(fallbackModels, registry);
  assert.strictEqual(fallbackAssignments.LOGIC_DEBUG.assignedModelId, 'gemini-3-pro', 'Should fall back to Gemini 3 Pro when Claude is absent');
  console.log('✔ Test 3: Fallback logic passed');

  // Test 4: EG-01 Self-Review Guard
  const selfReviewFail = guardSelfReview({});
  assert.strictEqual(selfReviewFail.passed, false, 'EG-01 should fail without self-review');
  assert(selfReviewFail.fixHint.includes('self-review'), 'EG-01 should return actionable fixHint');

  const selfReviewPass = guardSelfReview({ selfReview: 'Implemented PKCE login flow. Verified tests.' });
  assert.strictEqual(selfReviewPass.passed, true, 'EG-01 should pass with self-review');
  console.log('✔ Test 4: EG-01 Self-Review guard passed');

  // Test 5: EG-02 Deliverables Guard & Path Traversal Prevention
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-test-'));
  const safeFile = path.join(tempDir, 'output.js');
  fs.writeFileSync(safeFile, 'console.log("hello world");', 'utf-8');

  // 5a. Safe existing deliverable
  const delivPass = guardDeliverables({
    projectRoot: tempDir,
    deliverables: ['output.js']
  });
  assert.strictEqual(delivPass.passed, true, 'EG-02 should pass when file exists in root');

  // 5b. Missing deliverable
  const delivMissing = guardDeliverables({
    projectRoot: tempDir,
    deliverables: ['nonexistent.js']
  });
  assert.strictEqual(delivMissing.passed, false, 'EG-02 should fail when deliverable is missing');

  // 5c. Path traversal / escape attempt
  const delivEscape = guardDeliverables({
    projectRoot: tempDir,
    deliverables: ['../../etc/passwd', '../secret.txt']
  });
  assert.strictEqual(delivEscape.passed, false, 'EG-02 must reject directory traversal attempts');
  assert(delivEscape.reason.includes('escape'), 'EG-02 reason must state escape attempt');
  console.log('✔ Test 5: EG-02 Deliverables & path containment security guard passed');

  // Test 6: EG-03 Proof of Work & Test Verification Guard
  const testProofFail = guardTestProof({
    taskType: 'IMPLEMENTATION'
  });
  assert.strictEqual(testProofFail.passed, false, 'EG-03 should fail when code task has no test proof');

  const testProofPass = guardTestProof({
    taskType: 'IMPLEMENTATION',
    testResults: { passed: true, exitCode: 0 }
  });
  assert.strictEqual(testProofPass.passed, true, 'EG-03 should pass when test exit code is 0');
  console.log('✔ Test 6: EG-03 Test verification guard passed');

  // Test 7: EG-04 Rollback Plan Guard for Deploy / Migration
  const rollbackFail = guardRollbackPlan({
    taskType: 'DEPLOY',
    content: 'Deploying auth microservice v2 to production cluster.'
  });
  assert.strictEqual(rollbackFail.passed, false, 'EG-04 should block DEPLOY task without rollback strategy');

  const rollbackPass = guardRollbackPlan({
    taskType: 'DEPLOY',
    rollbackPlan: 'Canary rollout: revert deployment revision using helm rollback if error rate > 0.5%.'
  });
  assert.strictEqual(rollbackPass.passed, true, 'EG-04 should pass with rollback plan');
  console.log('✔ Test 7: EG-04 Rollback strategy guard passed');

  // Test 8: EG-05 Human Clearance Gate Guard (RED Operations)
  const clearanceFail = guardClearanceGate({
    actions: ['Run database migration: drop table old_users;'],
    humanApproved: false
  });
  assert.strictEqual(clearanceFail.passed, false, 'EG-05 should block RED operations without human approval');

  const clearancePass = guardClearanceGate({
    actions: ['Run database migration: drop table old_users;'],
    humanApproved: true
  });
  assert.strictEqual(clearancePass.passed, true, 'EG-05 should pass when human approval is granted');
  console.log('✔ Test 8: EG-05 Clearance Gate guard passed');

  // Test 9: EG-06 Scoped Edit Budget Guard
  const scopedFail = guardScopedEdit({
    domain: 'RAPID_FIX',
    lineCount: 145
  });
  assert.strictEqual(scopedFail.passed, false, 'EG-06 should block Rapid Fix exceeding 50 lines');

  const scopedPass = guardScopedEdit({
    domain: 'RAPID_FIX',
    lineCount: 22
  });
  assert.strictEqual(scopedPass.passed, true, 'EG-06 should allow edits <= 50 lines');
  console.log('✔ Test 9: EG-06 Scoped edit budget guard passed');

  // Test 10: State Machine Transitions & Role Separation
  const backend = new MemoryBackend();
  const engine = new TransitionEngine(backend);

  const task = await backend.createTask({
    task_id: 'TASK_TEST_001',
    task_name: 'Implement OAuth PKCE flow',
    task_type: 'IMPLEMENTATION',
    role: 'DEVELOPER',
    deliverables: ['output.js'],
    testResults: { passed: true, exitCode: 0 }
  });

  // Attempt transition without self-review -> expect FAIL
  const submitFail = await engine.transitionTask(task.task_id, TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER', {
    projectRoot: tempDir
  });
  assert.strictEqual(submitFail.result, 'FAIL', 'Transition should fail without self-review');
  assert(submitFail.guardResults.some(g => g.guardId === 'EG-01' && !g.passed));

  // Add self-review and resubmit -> expect PASS
  await backend.addReview(task.task_id, {
    review_type: 'SELF_REVIEW',
    rating: 9,
    content: 'All PKCE edge cases handled. Unit tests pass.'
  });

  const submitPass = await engine.transitionTask(task.task_id, TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER', {
    projectRoot: tempDir
  });
  assert.strictEqual(submitPass.result, 'PASS', 'Transition to READY_FOR_REVIEW should pass when guards satisfied');

  // Role separation test: DEVELOPER attempting to approve its own task -> expect FAIL (EG-08)
  const selfApprove = await engine.transitionTask(task.task_id, TASK_STATES.COMPLETED, 'DEVELOPER');
  assert.strictEqual(selfApprove.result, 'FAIL', 'Self-approval must be blocked by role separation');

  // Approval by REVIEWER role -> expect PASS
  const reviewerApprove = await engine.transitionTask(task.task_id, TASK_STATES.COMPLETED, 'REVIEWER');
  assert.strictEqual(reviewerApprove.result, 'PASS', 'Reviewer approval must succeed');

  const finalTask = await backend.getTask(task.task_id);
  assert.strictEqual(finalTask.status, TASK_STATES.COMPLETED);
  console.log('✔ Test 10: State machine transition engine & role separation passed');

  // Test 11: Audit Logger & Hotspot Tracking
  const audit = new AuditLogger({ storageDir: tempDir });
  audit.log({ action: 'TASK_TRANSITION', taskId: 'TASK_001', passed: true, guardResults: [{ guardId: 'EG-01', passed: true }] });
  audit.log({ action: 'TASK_TRANSITION', taskId: 'TASK_002', passed: false, guardResults: [{ guardId: 'EG-01', passed: false }] });

  const metrics = audit.getMetrics();
  assert.strictEqual(metrics.totalEvents, 2);
  assert.strictEqual(metrics.passedTransitions, 1);
  assert.strictEqual(metrics.failedTransitions, 1);
  assert.strictEqual(metrics.guardFailureHotspots['EG-01'], 1);
  console.log('✔ Test 11: Audit logger & hotspot metrics passed');

  // Test 12: EG-07 Multi-Source Verification Guard
  const auditSingleSource = guardAuditMultiSource({
    taskType: 'AUDIT',
    sources: ['https://example.com/spec.html']
  });
  assert.strictEqual(auditSingleSource.passed, false, 'EG-07 should fail with only 1 source');

  const auditMultiSource = guardAuditMultiSource({
    taskType: 'AUDIT',
    sources: ['https://example.com/spec.html', 'src/auth.js', 'docs/rfc-12.md']
  });
  assert.strictEqual(auditMultiSource.passed, true, 'EG-07 should pass with >= 2 sources');
  console.log('✔ Test 12: EG-07 Multi-source verification guard passed');

  // Test 13: EG-08 Role Separation Gate Guard
  const selfApproveGuard = guardRoleSeparation({
    targetStatus: 'COMPLETED',
    callerRole: 'DEVELOPER',
    task: { role: 'DEVELOPER' }
  });
  assert.strictEqual(selfApproveGuard.passed, false, 'EG-08 should fail when executor approves own task');

  const reviewerApproveGuard = guardRoleSeparation({
    targetStatus: 'COMPLETED',
    callerRole: 'REVIEWER',
    task: { role: 'DEVELOPER' }
  });
  assert.strictEqual(reviewerApproveGuard.passed, true, 'EG-08 should pass when reviewer approves');
  console.log('✔ Test 13: EG-08 Role separation gate guard passed');

  // Test 14: EG-09 Secret & Credential Leak Prevention Guard
  const leakedSecret = guardNoSecrets({
    content: 'Connecting using AWS key AKIAIOSFODNN7EXAMPLE and secret token'
  });
  assert.strictEqual(leakedSecret.passed, false, 'EG-09 should fail when secret key is detected');
  assert(leakedSecret.reason.includes('AWS Access Key ID'));

  const cleanContent = guardNoSecrets({
    content: 'Using process.env.AWS_ACCESS_KEY_ID loaded safely from secret manager'
  });
  assert.strictEqual(cleanContent.passed, true, 'EG-09 should pass clean content');
  console.log('✔ Test 14: EG-09 Secret & credential leak prevention guard passed');

  // Test 15: EG-10 No-Implied-Deploys in Non-Deploy Tasks Guard
  const unauthorizedDeploy = guardNoImpliedDeploys({
    taskType: 'IMPLEMENTATION',
    content: 'Updated auth controller. Now running helm upgrade --install auth-chart ./helm'
  });
  assert.strictEqual(unauthorizedDeploy.passed, false, 'EG-10 should block deploy command in non-DEPLOY task');

  const allowedDeploy = guardNoImpliedDeploys({
    taskType: 'DEPLOY',
    content: 'Running helm upgrade --install auth-chart ./helm'
  });
  assert.strictEqual(allowedDeploy.passed, true, 'EG-10 should allow deploy command in DEPLOY task');
  console.log('✔ Test 15: EG-10 No-implied-deploys guard passed');

  // Test 16: Complete Rework Cycle & Available Transitions Query
  const reworkBackend = new MemoryBackend();
  const reworkEngine = new TransitionEngine(reworkBackend);

  const safeFile2 = path.join(tempDir, 'safe.js');
  fs.writeFileSync(safeFile2, 'console.log("safe refresh token");', 'utf-8');

  const t16 = await reworkBackend.createTask({
    task_id: 'TASK_REWORK_001',
    task_name: 'Implement OAuth refresh token',
    task_type: 'IMPLEMENTATION',
    role: 'DEVELOPER',
    deliverables: ['safe.js'],
    testResults: { passed: true, exitCode: 0 }
  });

  // Query available transitions for DEVELOPER from ACTIVE
  const availTransitions = await reworkEngine.getAvailableTransitions(t16.task_id, 'DEVELOPER', { projectRoot: tempDir });
  assert.strictEqual(availTransitions.currentStatus, TASK_STATES.ACTIVE);
  assert(availTransitions.transitions.some(t => t.targetState === TASK_STATES.READY_FOR_REVIEW));

  // Add self-review and transition to READY_FOR_REVIEW
  await reworkBackend.addReview(t16.task_id, {
    review_type: 'SELF_REVIEW',
    content: 'Implemented refresh token logic with tests'
  });
  const subRes = await reworkEngine.transitionTask(t16.task_id, TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER', { projectRoot: tempDir });
  assert.strictEqual(subRes.result, 'PASS');

  // Reviewer rejects task -> moves to REWORK
  const rejectRes = await reworkEngine.transitionTask(t16.task_id, TASK_STATES.REWORK, 'REVIEWER', { projectRoot: tempDir });
  assert.strictEqual(rejectRes.result, 'PASS');
  const reworkedTask = await reworkBackend.getTask(t16.task_id);
  assert.strictEqual(reworkedTask.status, TASK_STATES.REWORK);

  // Developer addresses rework and resubmits to READY_FOR_REVIEW
  const resubmitRes = await reworkEngine.transitionTask(t16.task_id, TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER', { projectRoot: tempDir });
  assert.strictEqual(resubmitRes.result, 'PASS');

  // Reviewer approves
  const compRes = await reworkEngine.transitionTask(t16.task_id, TASK_STATES.COMPLETED, 'REVIEWER', { projectRoot: tempDir });
  assert.strictEqual(compRes.result, 'PASS');
  console.log('✔ Test 16: Rework lifecycle & getAvailableTransitions passed');

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }

  console.log('\n🎉 ALL 16 TEST SUITES PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
