/**
 * Built-in Quality Guards (EG-01 to EG-06)
 * Quality gates for AI agents — guards that don't get tired.
 */

import fs from 'node:fs';
import path from 'node:path';
import { registerGuard } from './registry.js';

/**
 * Utility: Check if a path stays within base directory (symlink & traversal safe)
 */
export function isPathContained(basePath, candidatePath) {
  try {
    const realBase = fs.realpathSync(basePath);
    let resolvedCandidate = path.resolve(realBase, candidatePath);

    if (fs.existsSync(resolvedCandidate)) {
      resolvedCandidate = fs.realpathSync(resolvedCandidate);
    }

    const rel = path.relative(realBase, resolvedCandidate);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

/**
 * EG-01: Self-Review Guard
 * An agent must self-reflect and provide a verification summary before submitting work.
 */
export const guardSelfReview = (ctx) => {
  const hasReview = Boolean(
    ctx.selfReview ||
    (ctx.reviews && ctx.reviews.some(r => (r.review_type || r.type || '').toUpperCase() === 'SELF_REVIEW')) ||
    (ctx.task && ctx.task.selfReview)
  );

  if (!hasReview) {
    return {
      passed: false,
      reason: 'No self-review found for task.',
      fixHint: 'Create a self-review summary with verification notes before submitting work.'
    };
  }

  return {
    passed: true,
    reason: 'Self-review verified.'
  };
};

/**
 * EG-02: Deliverables Verification & Path Containment Guard
 * Checks that all declared deliverables exist, are non-empty, and reside safely within project root.
 */
export const guardDeliverables = (ctx) => {
  const projectRoot = path.resolve(ctx.projectRoot || process.cwd());
  const rawDeliverables = ctx.deliverables || (ctx.task && ctx.task.deliverables) || [];

  const deliverablePaths = Array.isArray(rawDeliverables)
    ? rawDeliverables
    : typeof rawDeliverables === 'string'
      ? rawDeliverables.split('\n').map(s => s.trim()).filter(Boolean)
      : [];

  if (deliverablePaths.length === 0) {
    const taskType = String((ctx.task && ctx.task.task_type) || ctx.taskType || '').toUpperCase();
    if (['IMPLEMENTATION', 'REFACTOR'].includes(taskType)) {
      return {
        passed: false,
        reason: `No deliverables declared for ${taskType} task.`,
        fixHint: 'Declare list of created or modified file paths in deliverables.'
      };
    }
    return {
      passed: true,
      reason: 'No filesystem deliverables required.'
    };
  }

  const missing = [];
  const escaped = [];
  const empty = [];

  for (const p of deliverablePaths) {
    // 1. Path containment check
    const fullPath = path.isAbsolute(p) ? p : path.resolve(projectRoot, p);

    if (!isPathContained(projectRoot, fullPath)) {
      escaped.push(p);
      continue;
    }

    // 2. Existence check
    if (!fs.existsSync(fullPath)) {
      missing.push(p);
      continue;
    }

    // 3. Non-empty check
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isFile() && stats.size === 0) {
        empty.push(p);
      }
    } catch {
      missing.push(p);
    }
  }

  if (escaped.length > 0) {
    return {
      passed: false,
      reason: `Deliverables attempted to escape project root: ${escaped.join(', ')}`,
      fixHint: 'Ensure all deliverable paths remain inside the safe project workspace root.'
    };
  }

  if (missing.length > 0) {
    return {
      passed: false,
      reason: `Missing deliverables on disk: ${missing.join(', ')}`,
      fixHint: 'Ensure all stated deliverable files are created on the filesystem before transition.'
    };
  }

  if (empty.length > 0) {
    return {
      passed: false,
      reason: `Deliverables are empty (0 bytes): ${empty.join(', ')}`,
      fixHint: 'Populate deliverable files with actual code or documentation content.'
    };
  }

  return {
    passed: true,
    reason: `All ${deliverablePaths.length} deliverables exist, are non-empty, and reside safely within project root.`
  };
};

/**
 * EG-03: Test Proof & Execution Guard
 * Verifies that automated tests ran and exited cleanly without failure.
 */
export const guardTestProof = (ctx) => {
  const taskType = String((ctx.task && ctx.task.task_type) || ctx.taskType || '').toUpperCase();
  const testProof = ctx.testResults || (ctx.task && ctx.task.testResults);

  // Mandatory for implementation and logic debug tasks
  const isCodeTask = ['IMPLEMENTATION', 'LOGIC_DEBUG', 'BUGFIX'].includes(taskType);

  if (!testProof) {
    if (isCodeTask) {
      return {
        passed: false,
        reason: 'Proof of work missing: No test execution proof or exit code provided.',
        fixHint: 'Run automated tests (e.g., npm test, pytest) and record testResults with exitCode: 0.'
      };
    }
    return {
      passed: true,
      reason: 'No automated test requirements for this task type.'
    };
  }

  if (testProof.exitCode !== 0 && testProof.passed !== true) {
    return {
      passed: false,
      reason: `Tests failed (exitCode: ${testProof.exitCode || 1}): ${testProof.error || 'Test suite reported failures'}`,
      fixHint: 'Fix failing unit tests before submitting task for review.'
    };
  }

  return {
    passed: true,
    reason: 'Test proof verified (tests executed cleanly).'
  };
};

/**
 * EG-04: Rollback Strategy Guard
 * Blocks any deployment or database schema migration task without a documented rollback strategy.
 */
export const guardRollbackPlan = (ctx) => {
  const taskType = String((ctx.task && ctx.task.task_type) || ctx.taskType || '').toUpperCase();
  const content = String((ctx.task && ctx.task.content) || ctx.content || '').toLowerCase();

  const isDeployOrMigration = taskType === 'DEPLOY' ||
                              taskType === 'MIGRATION' ||
                              content.includes('deploy') ||
                              content.includes('migration') ||
                              content.includes('schema change');

  if (!isDeployOrMigration) {
    return {
      passed: true,
      reason: 'Not a deployment or migration task.'
    };
  }

  const rollbackPlan = ctx.rollbackPlan ||
                       (ctx.task && ctx.task.rollbackPlan) ||
                       (content.includes('rollback') ? 'Documented in content' : null);

  if (!rollbackPlan) {
    return {
      passed: false,
      reason: 'Missing rollback strategy for deployment/migration task.',
      fixHint: 'Provide an explicit rollbackPlan or document rollback procedure in task notes.'
    };
  }

  return {
    passed: true,
    reason: 'Rollback strategy verified.'
  };
};

/**
 * EG-05: Clearance Gate Guard
 * Enforces the 3-Tier Human Clearance matrix (RED / YELLOW / GREEN).
 */
export const guardClearanceGate = (ctx) => {
  const actions = ctx.actions || (ctx.task && ctx.task.actions) || [];
  const actionList = Array.isArray(actions) ? actions : [actions];

  const redKeywords = [
    'drop table', 'drop database', 'migration',
    'install package', 'npm install', 'pip install',
    'secret', 'auth token', 'api_key', 'private_key',
    '.env', 'git push --force'
  ];

  const triggeredRed = [];
  for (const act of actionList) {
    const actStr = String(act).toLowerCase();
    for (const kw of redKeywords) {
      if (actStr.includes(kw)) {
        triggeredRed.push(`${kw} in "${act}"`);
      }
    }
  }

  if (triggeredRed.length > 0 && !ctx.humanApproved) {
    return {
      passed: false,
      reason: `RED LEVEL Clearance Gate triggered without human approval: ${triggeredRed.join('; ')}`,
      fixHint: 'Request explicit human approval before executing sensitive operations (DB mutations, new dependencies, secret changes).'
    };
  }

  return {
    passed: true,
    reason: 'Clearance gate satisfied.'
  };
};

/**
 * EG-06: Scoped Edit Budget Guard
 * Prevents rapid-fix models from executing multi-file or massive edits (> 50 lines).
 */
export const guardScopedEdit = (ctx) => {
  const domain = (ctx.domain || (ctx.task && ctx.task.domain) || '').toUpperCase();
  const lineCount = ctx.lineCount ?? (ctx.task && ctx.task.lineCount);

  if (domain === 'RAPID_FIX' && lineCount !== undefined && lineCount > 50) {
    return {
      passed: false,
      reason: `Edit budget exceeded for Rapid Fix: ${lineCount} lines modified (limit is 50).`,
      fixHint: 'Elevate task to Core Logic domain or split changes into smaller scoped PRs.'
    };
  }

  return {
    passed: true,
    reason: 'Line edit budget within limits.'
  };
};

/**
 * EG-07: Multi-Source Evidence Verification Guard
 * Ensures investigation or audit tasks reference at least 2 distinct evidence sources
 * (files, URLs, git commits, or benchmark citations) to prevent thin, unsubstantiated conclusions.
 */
export const guardAuditMultiSource = (ctx) => {
  const taskType = String((ctx.task && ctx.task.task_type) || ctx.taskType || '').toUpperCase();
  if (!['INVESTIGATION', 'AUDIT'].includes(taskType)) {
    return {
      passed: true,
      reason: 'Multi-source evidence check only applies to INVESTIGATION or AUDIT tasks.'
    };
  }

  const sources = ctx.sources || (ctx.task && ctx.task.sources) || [];
  const content = String((ctx.task && ctx.task.content) || ctx.content || '');

  // Extract sources from array, or parse citations/URLs/file references from content
  const sourceSet = new Set(Array.isArray(sources) ? sources : []);

  if (sourceSet.size < 2 && content) {
    // Regex for URLs
    const urlMatches = content.match(/https?:\/\/[^\s)"]+/gi) || [];
    urlMatches.forEach(u => sourceSet.add(u));

    // Regex for file/path references like `src/...` or `[path]`
    const pathMatches = content.match(/(?:file:\/\/\/|[a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]{1,4})/gi) || [];
    pathMatches.forEach(p => {
      if (!p.startsWith('http') && p.includes('/') && !p.endsWith('.')) {
        sourceSet.add(p);
      }
    });

    // Check for explicit "Source:" or "Evidence:" lines
    const citationMatches = content.match(/(?:source|reference|citation|evidence)\s*:\s*([^\n]+)/gi) || [];
    citationMatches.forEach(c => sourceSet.add(c.trim()));
  }

  if (sourceSet.size < 2) {
    return {
      passed: false,
      reason: `Insufficient evidence: Found ${sourceSet.size} source(s), but at least 2 independent sources are required for ${taskType}.`,
      fixHint: 'Cite at least 2 distinct reference sources (files, documentation URLs, logs, or commit SHAs) in task evidence.'
    };
  }

  return {
    passed: true,
    reason: `Multi-source evidence verified (${sourceSet.size} distinct sources cited).`
  };
};

/**
 * EG-08: Role Separation Gate
 * Enforces that an executor cannot approve or self-certify their own work.
 */
export const guardRoleSeparation = (ctx) => {
  const targetStatus = String(ctx.targetStatus || '').toUpperCase();
  if (targetStatus !== 'COMPLETED') {
    return {
      passed: true,
      reason: 'Role separation gate applies to COMPLETED state transition.'
    };
  }

  const callerRole = String(ctx.callerRole || '').toUpperCase();
  const creatorRole = String((ctx.task && ctx.task.role) || 'DEVELOPER').toUpperCase();
  const submittingActor = String((ctx.task && (ctx.task.submitted_by || ctx.task.role)) || '').toUpperCase();

  if (['DEVELOPER', 'EXECUTOR'].includes(callerRole) && (callerRole === creatorRole || callerRole === submittingActor)) {
    return {
      passed: false,
      reason: `Self-approval rejected: Executor role (${callerRole}) cannot approve its own task.`,
      fixHint: 'Approval must be performed by a distinct role (REVIEWER, HUMAN, or TECH_LEAD).'
    };
  }

  return {
    passed: true,
    reason: 'Role separation verified (distinct approval role).'
  };
};

/**
 * EG-09: Secret & Credential Leak Prevention Guard
 * Scans task descriptions, review notes, and deliverables for accidentally leaked credentials or private keys.
 */
export const guardNoSecrets = (ctx) => {
  const contentsToScan = [
    String((ctx.task && ctx.task.content) || ''),
    String((ctx.task && ctx.task.notes) || ''),
    String(ctx.content || ''),
    String(ctx.selfReview || ''),
    ...(Array.isArray(ctx.reviews) ? ctx.reviews.map(r => String(r.content || '')) : [])
  ];

  const fullText = contentsToScan.join('\n');
  if (!fullText.trim()) {
    return { passed: true, reason: 'No content to scan for secret leakage.' };
  }

  const secretPatterns = [
    { name: 'AWS Access Key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { name: 'Private Key Block', regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA|PGP)?\s*PRIVATE\s+KEY-----/i },
    { name: 'Anthropic API Key', regex: /\bsk-ant-[a-zA-Z0-9_\-]{20,}\b/ },
    { name: 'OpenAI API Key', regex: /\bsk-(?:proj-)?[a-zA-Z0-9_\-]{20,}\b/ },
    { name: 'GitHub Personal Access Token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/ },
    { name: 'Slack Bot Token', regex: /\bxoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}\b/ },
    { name: 'URI with Plaintext Password', regex: /[a-zA-Z0-9+.-]+:\/\/[^:\s]+:[^@\s]+@[a-zA-Z0-9.-]+/ }
  ];

  const violations = [];
  for (const { name, regex } of secretPatterns) {
    if (regex.test(fullText)) {
      violations.push(name);
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      reason: `Secret or credential leakage detected in task content: ${violations.join(', ')}`,
      fixHint: 'Remove hardcoded secrets or API tokens from task notes and use environment variables instead.'
    };
  }

  return {
    passed: true,
    reason: 'No secret credentials or private keys detected in task content.'
  };
};

/**
 * EG-10: No-Implied-Deploys in Non-Deploy Tasks Guard
 * Prevents execution of deployment and cluster mutation commands in regular code tasks.
 */
export const guardNoImpliedDeploys = (ctx) => {
  const taskType = String((ctx.task && ctx.task.task_type) || ctx.taskType || '').toUpperCase();
  if (taskType === 'DEPLOY') {
    return {
      passed: true,
      reason: 'Deploy commands permitted in DEPLOY task type.'
    };
  }

  const content = String((ctx.task && ctx.task.content) || ctx.content || '').toLowerCase();
  const deployKeywords = [
    'kubectl apply', 'kubectl set', 'helm upgrade', 'helm install',
    'docker push', 'terraform apply', 'aws s3 sync', 'pulumi up',
    'git push origin main --force', 'git push origin master --force'
  ];

  const foundDeployCmds = deployKeywords.filter(cmd => content.includes(cmd));

  if (foundDeployCmds.length > 0) {
    return {
      passed: false,
      reason: `Unauthorized deployment commands found in non-DEPLOY task: ${foundDeployCmds.join(', ')}`,
      fixHint: 'Remove deployment commands from regular task, or explicitly change task_type to DEPLOY.'
    };
  }

  return {
    passed: true,
    reason: 'No unauthorized deployment commands detected.'
  };
};

/**
 * Register all built-in guards into the global registry
 */
export function registerBuiltinGuards() {
  registerGuard('EG-01', 'Self-Review Requirement', guardSelfReview, {
    description: 'Requires an agent self-review before task can transition to review'
  });

  registerGuard('EG-02', 'Deliverables Presence & Sandbox Containment', guardDeliverables, {
    description: 'Verifies deliverable files exist, are non-empty, and reside safely within project root'
  });

  registerGuard('EG-03', 'Proof of Work & Test Verification', guardTestProof, {
    description: 'Verifies test suite execution proof for code implementation tasks'
  });

  registerGuard('EG-04', 'Deployment & Migration Rollback Strategy', guardRollbackPlan, {
    description: 'Guarantees a documented rollback strategy exists for deploy and schema change tasks'
  });

  registerGuard('EG-05', 'Human-in-the-Loop Clearance Gate', guardClearanceGate, {
    description: 'Blocks high-risk actions without explicit human approval'
  });

  registerGuard('EG-06', 'Scoped Edit Budget', guardScopedEdit, {
    description: 'Limits rapid-fix models to < 50 line modifications'
  });

  registerGuard('EG-07', 'Multi-Source Evidence Verification', guardAuditMultiSource, {
    description: 'Requires at least 2 distinct evidence citations for investigation or audit tasks'
  });

  registerGuard('EG-08', 'Role Separation Gate', guardRoleSeparation, {
    description: 'Enforces separation of duties: executor cannot approve their own task'
  });

  registerGuard('EG-09', 'Secret & Credential Leak Prevention', guardNoSecrets, {
    description: 'Detects hardcoded API keys, private keys, and passwords in task notes and output'
  });

  registerGuard('EG-10', 'No-Implied-Deploys Guard', guardNoImpliedDeploys, {
    description: 'Blocks deployment and cluster mutation commands in non-DEPLOY tasks'
  });
}
