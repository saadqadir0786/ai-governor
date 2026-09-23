/**
 * ai-governor test suite
 */

import assert from 'node:assert';
import { detectEnvironment } from '../src/detector.js';
import { getModelRegistry } from '../src/utils/remote.js';
import { computeRoleAssignments, HUMAN_CLEARANCE_MATRIX } from '../src/rbac.js';
import { generateMasterPolicy } from '../src/generators/policy.js';
import { generateClaudeConfig } from '../src/generators/claude.js';
import { generateAntigravityConfig } from '../src/generators/antigravity.js';

console.log('Running ai-governor unit tests...');

async function runTests() {
  // Test 1: Remote/Local Registry
  const { registry, source } = await getModelRegistry();
  assert(registry['gemini-3-pro'], 'Registry must contain gemini-3-pro');
  assert(registry['claude-3-7-sonnet'], 'Registry must contain claude-3-7-sonnet');
  console.log('✔ Test 1: Registry load passed (source: ' + source + ')');

  // Test 2: Role Assignment Logic
  const mockModels = ['gemini-3-pro', 'claude-3-7-sonnet', 'gemini-3.8-flash'];
  const assignments = computeRoleAssignments(mockModels, registry);
  assert(assignments.ARCHITECTURE.assignedModelId === 'gemini-3-pro', 'Architecture should prefer Gemini 3 Pro');
  assert(assignments.LOGIC_DEBUG.assignedModelId === 'claude-3-7-sonnet', 'Logic Debug should prefer Claude 3.7 Sonnet');
  assert(assignments.RAPID_FIX.assignedModelId === 'gemini-3.8-flash', 'Rapid fix should prefer Gemini 3.8 Flash');
  console.log('✔ Test 2: Role assignment logic passed');

  // Test 3: Fallback Assignment Logic when Claude is absent
  const fallbackModels = ['gemini-3-pro', 'gemini-3.8-flash'];
  const fallbackAssignments = computeRoleAssignments(fallbackModels, registry);
  assert(fallbackAssignments.LOGIC_DEBUG.assignedModelId === 'gemini-3-pro', 'Should fall back to Gemini 3 Pro when Claude is unavailable');
  console.log('✔ Test 3: Fallback logic passed');

  // Test 4: Generator Output Validation
  const env = await detectEnvironment(process.cwd());
  const policyMarkdown = generateMasterPolicy({ env, assignments, registry });
  assert(policyMarkdown.includes('RED LEVEL: STRICT HARD STOP'), 'Policy must contain RED LEVEL approval section');
  assert(policyMarkdown.includes('Anti-Hallucination Guardrails'), 'Policy must contain anti-hallucination section');
  console.log('✔ Test 4: Master policy generator output validated');

  // Test 5: Tool Adapters
  const claudeConfig = generateClaudeConfig({ env, assignments });
  assert(claudeConfig.includes('HARD GATES'), 'Claude config must contain hard gates');
  const antigravityConfig = generateAntigravityConfig({ env, assignments });
  assert(antigravityConfig.includes('Planning Mode'), 'Antigravity config must enforce Planning Mode');
  console.log('✔ Test 5: Tool adapters validated');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
