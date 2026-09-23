/**
 * ai-governor - Main Library Entrypoint
 */

import fs from 'node:fs';
import path from 'node:path';
import { detectEnvironment } from './detector.js';
import { getModelRegistry } from './utils/remote.js';
import { computeRoleAssignments } from './rbac.js';
import { generateMasterPolicy } from './generators/policy.js';
import { generateClaudeConfig } from './generators/claude.js';
import { generateAntigravityConfig } from './generators/antigravity.js';
import { generateCursorConfig } from './generators/cursor.js';

export async function runGovernor({ targetDir = process.cwd(), dryRun = false, logger = console.log }) {
  // 1. Detect Environment
  const env = await detectEnvironment(targetDir);

  // 2. Fetch Model Capabilities
  const { registry, source: registrySource } = await getModelRegistry();

  // 3. Compute Roles, Intensity & Permissions
  const assignments = computeRoleAssignments(env.availableModels, registry);

  // 4. Generate Content
  const policyContent = generateMasterPolicy({ env, assignments, registry });
  const claudeContent = generateClaudeConfig({ env, assignments });
  const antigravityContent = generateAntigravityConfig({ env, assignments });
  const cursorContent = generateCursorConfig({ env, assignments });

  const generatedFiles = [
    { filePath: path.join(targetDir, 'AI_POLICY.md'), content: policyContent, name: 'AI_POLICY.md' },
    { filePath: path.join(targetDir, 'CLAUDE.md'), content: claudeContent, name: 'CLAUDE.md' },
    { filePath: path.join(targetDir, '.antigravity', 'rules', 'ai_policy.md'), content: antigravityContent, name: '.antigravity/rules/ai_policy.md' },
    { filePath: path.join(targetDir, '.cursorrules'), content: cursorContent, name: '.cursorrules' }
  ];

  if (!dryRun) {
    for (const file of generatedFiles) {
      const parentDir = path.dirname(file.filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(file.filePath, file.content, 'utf-8');
    }
  }

  return {
    env,
    registrySource,
    assignments,
    generatedFiles
  };
}
