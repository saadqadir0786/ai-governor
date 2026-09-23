/**
 * Role-Based Access Control (RBAC) & Model Permission Engine
 */

import { TASK_DOMAINS } from './matrix.js';

/**
 * Assign task domains to the best available models
 */
export function computeRoleAssignments(availableModels, registry) {
  const assignments = {};

  // Preference order per task domain
  const preferenceMap = {
    ARCHITECTURE: ['gemini-3-pro', 'claude-3-7-sonnet', 'gemini-2.5-pro', 'deepseek-r1', 'gpt-4o'],
    LOGIC_DEBUG: ['claude-3-7-sonnet', 'deepseek-r1', 'gemini-3-pro', 'claude-3-5-sonnet', 'gpt-4o'],
    UI_STYLING: ['claude-3-5-sonnet', 'claude-3-7-sonnet', 'qwen-2.5-coder', 'gemini-3.8-flash', 'gpt-4o'],
    RAPID_FIX: ['gemini-3.8-flash', 'claude-3-5-haiku', 'qwen-2.5-coder', 'gpt-4o'],
    DOCUMENTATION: ['claude-3-5-sonnet', 'gemini-3.8-flash', 'gpt-4o', 'gemini-3-pro']
  };

  for (const [domainKey, domain] of Object.entries(TASK_DOMAINS)) {
    const preferences = preferenceMap[domainKey] || [];
    let assignedModelId = preferences.find(modelId => availableModels.includes(modelId));

    if (!assignedModelId) {
      // Fall back to first available
      assignedModelId = availableModels[0] || 'gemini-3.8-flash';
    }

    // Find fallback model (second choice)
    const fallbackModelId = preferences.find(modelId => availableModels.includes(modelId) && modelId !== assignedModelId) || 'None';

    const modelInfo = registry[assignedModelId] || { name: assignedModelId, defaultIntensity: domain.requiredIntensity };

    assignments[domainKey] = {
      domain: domain.id,
      domainTitle: domain.title,
      assignedModelId,
      assignedModelName: modelInfo.name,
      intensity: domain.requiredIntensity,
      clearance: domain.permissionClearance,
      fallbackModelId,
      allowedActions: getAllowedActionsForDomain(domainKey),
      forbiddenActions: getForbiddenActionsForDomain(domainKey)
    };
  }

  return assignments;
}

function getAllowedActionsForDomain(domainKey) {
  switch (domainKey) {
    case 'ARCHITECTURE':
      return [
        'Analyze full repository codebase and external documentation',
        'Generate implementation_plan.md and architectural RFCs',
        'Create Mermaid diagrams for component/data flows',
        'Define schema contracts and API specifications'
      ];
    case 'LOGIC_DEBUG':
      return [
        'Write reproducing test cases before writing code (TDD)',
        'Implement complex algorithms, state machines, and edge case fixes',
        'Trace multi-file execution paths and race conditions',
        'Run test suites and verify exit codes'
      ];
    case 'UI_STYLING':
      return [
        'Create and modify UI components, layout structures, and pages',
        'Apply styling using design tokens and Tailwind utility classes',
        'Implement responsive designs and accessibility (a11y) aria attributes',
        'Handle local UI state and event handlers'
      ];
    case 'RAPID_FIX':
      return [
        'Fix syntax, type, or lint errors in open files (< 50 lines)',
        'Rename variables, functions, and update import paths',
        'Run quick formatters (Prettier, ESLint)',
        'Fix typos and minor documentation comments'
      ];
    case 'DOCUMENTATION':
      return [
        'Draft and update README.md, API specs, and CHANGELOG.md',
        'Add JSDoc/docstrings to existing functions without changing logic',
        'Summarize implementation walkthroughs and release notes'
      ];
    default:
      return ['Read-only inspection'];
  }
}

function getForbiddenActionsForDomain(domainKey) {
  switch (domainKey) {
    case 'ARCHITECTURE':
      return [
        'STRICTLY FORBIDDEN: Writing direct production source code before human plan approval',
        'FORBIDDEN: Modifying database records or dropping tables'
      ];
    case 'LOGIC_DEBUG':
      return [
        'FORBIDDEN: Changing fundamental system architecture or swapping libraries',
        'FORBIDDEN: Claiming task is complete without test execution proof'
      ];
    case 'UI_STYLING':
      return [
        'FORBIDDEN: Writing direct database queries or mutating backend state inside UI',
        'FORBIDDEN: Hardcoding arbitrary inline pixel values or colors without design tokens'
      ];
    case 'RAPID_FIX':
      return [
        'STRICTLY FORBIDDEN: Architectural refactoring or multi-file architectural changes',
        'FORBIDDEN: Installing new third-party npm packages'
      ];
    case 'DOCUMENTATION':
      return [
        'STRICTLY FORBIDDEN: Modifying production source code (.ts, .js, .py, .go)'
      ];
    default:
      return ['Unscoped write actions'];
  }
}

/**
 * The Human-in-the-Loop Clearance Matrix
 */
export const HUMAN_CLEARANCE_MATRIX = {
  RED: {
    level: 'RED (STRICT HARD STOP)',
    rule: 'The AI must stop and obtain explicit human confirmation before proceeding.',
    triggers: [
      'Database migrations, schema drops, or destructive database mutations',
      'Installing new third-party npm/pip packages (anti-hallucination & security gate)',
      'Modifying .env files, auth tokens, secrets, encryption, or security permissions',
      'Architectural deviations (swapping ORMs, changing folder structures)',
      'Git push, git push --force, or deleting git branches'
    ]
  },
  YELLOW: {
    level: 'YELLOW (NOTICE & LOG)',
    rule: 'The AI can proceed autonomously, but must explicitly flag the change in its summary.',
    triggers: [
      'Adding new test files or mock fixtures',
      'Adding new variable keys to .env.example (without values)',
      'Refactoring localized utility functions within a single file'
    ]
  },
  GREEN: {
    level: 'GREEN (AUTONOMOUS)',
    rule: 'The AI executes freely without asking.',
    triggers: [
      'Reading files, searching codebase, indexing dependencies',
      'Writing and executing unit tests',
      'Fixing compiler/type errors in scoped files',
      'Formatting code with Prettier/ESLint'
    ]
  }
};
