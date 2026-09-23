#!/usr/bin/env node

/**
 * ai-governor CLI binary
 * Model-Agnostic AI Governance, State Machine & Quality Gates
 */

import path from 'node:path';
import fs from 'node:fs';
import { banner, c, logSuccess, logInfo, logWarn, logError, table } from '../src/utils/formatting.js';
import { detectEnvironment } from '../src/detector.js';
import { getModelRegistry } from '../src/utils/remote.js';
import { computeRoleAssignments } from '../src/rbac.js';
import { runGovernor } from '../src/index.js';
import { runGuards, getRegisteredGuards } from '../src/guards/registry.js';
import { registerBuiltinGuards } from '../src/guards/builtins.js';
import { TransitionEngine, TASK_STATES } from '../src/engine/state-machine.js';
import { FileBackend } from '../src/engine/backend.js';
import { AuditLogger } from '../src/audit.js';

// Auto-register built-in quality guards
registerBuiltinGuards();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'init';

let targetDir = process.cwd();
const targetIdx = args.indexOf('--target');
if (targetIdx !== -1 && args[targetIdx + 1]) {
  targetDir = path.resolve(args[targetIdx + 1]);
}
const isDryRun = args.includes('--dry-run');

async function handleDetect() {
  banner();
  logInfo(`Scanning environment in: ${c.bold}${targetDir}${c.reset}...`);

  const env = await detectEnvironment(targetDir);
  const { registry, source } = await getModelRegistry();

  console.log(`\n${c.bold}Active Developer Tools & IDEs:${c.reset}`);
  if (env.ides.length === 0) {
    console.log(`  ${c.dim}(No IDE process detected, running in standalone terminal)${c.reset}`);
  } else {
    for (const ide of env.ides) {
      console.log(`  ${c.green}●${c.reset} ${c.bold}${ide.name}${c.reset} - ${c.dim}${ide.reason}${c.reset}`);
    }
  }

  console.log(`\n${c.bold}Discovered Credentials & Local Servers:${c.reset}`);
  console.log(`  Gemini API Key:    ${env.keys.gemini ? c.green + 'Available' : c.dim + 'Not set'}${c.reset}`);
  console.log(`  Anthropic API Key: ${env.keys.anthropic ? c.green + 'Available' : c.dim + 'Not set'}${c.reset}`);
  console.log(`  OpenRouter Key:    ${env.keys.openrouter ? c.green + 'Available' : c.dim + 'Not set'}${c.reset}`);
  console.log(`  OpenAI Key:        ${env.keys.openai ? c.green + 'Available' : c.dim + 'Not set'}${c.reset}`);
  console.log(`  Local Ollama:      ${env.ollamaModels.length > 0 ? c.green + env.ollamaModels.join(', ') : c.dim + 'Offline'}${c.reset}`);

  console.log(`\n${c.bold}Model Capabilities Registry:${c.reset} ${c.dim}(Loaded from ${source})${c.reset}`);
  console.log(`  Accessible Models: ${c.cyan}${env.availableModels.join(', ')}${c.reset}`);

  const assignments = computeRoleAssignments(env.availableModels, registry);
  console.log(`\n${c.bold}Optimal Role & Intensity Assignments:${c.reset}`);

  const headers = ['Task Domain', 'Assigned Model', 'Intensity Budget', 'Clearance Level'];
  const rows = Object.values(assignments).map(a => [
    a.domainTitle,
    a.assignedModelName,
    a.intensity,
    a.clearance
  ]);
  table(headers, rows);
}

async function handleInit() {
  banner();
  logInfo(`Initializing AI Governance for project at: ${c.bold}${targetDir}${c.reset}`);
  if (isDryRun) {
    logWarn('DRY-RUN mode enabled: No files will be written.');
  }

  const result = await runGovernor({ targetDir, dryRun: isDryRun });

  console.log(`\n${c.bold}Generated Governance & Adapter Files:${c.reset}`);
  for (const f of result.generatedFiles) {
    console.log(`  ${c.green}✔${c.reset} ${c.bold}${f.name}${c.reset}`);
  }

  console.log(`\n${c.bold}Role-Based Access Control (RBAC) Assigned:${c.reset}`);
  const headers = ['Task Domain', 'Assigned Model', 'Intensity Level', 'Clearance'];
  const rows = Object.values(result.assignments).map(a => [
    a.domainTitle,
    a.assignedModelName,
    a.intensity,
    a.clearance
  ]);
  table(headers, rows);

  console.log(`
${c.green}${c.bold}AI Governance successfully deployed!${c.reset}
${c.dim}All active models are now constrained by strict RBAC and human approval gates.${c.reset}
`);
}

async function handleGate() {
  banner();
  logInfo(`Evaluating active quality guards in: ${c.bold}${targetDir}${c.reset}`);

  // Check if a taskId was passed: ai-governor gate [taskId]
  const taskIdArg = args[1] && !args[1].startsWith('-') ? args[1] : null;
  const policyExists = fs.existsSync(path.join(targetDir, 'AI_POLICY.md'));
  if (!policyExists && !taskIdArg) {
    logWarn(`No AI_POLICY.md found in ${targetDir}. Run 'ai-governor init' first to generate project policy.`);
  }

  let ctx;
  if (taskIdArg) {
    const backend = new FileBackend(path.join(targetDir, '.ai-governor'));
    const task = await backend.getTask(taskIdArg);
    if (!task) {
      logError(`Task ${taskIdArg} not found.`);
      process.exit(1);
    }
    const reviews = await backend.getReviews(taskIdArg);
    const reports = await backend.getReports(taskIdArg);
    ctx = {
      projectRoot: targetDir,
      task,
      reviews,
      reports,
      selfReview: reviews.find(r => r.review_type === 'SELF_REVIEW')?.content || task.selfReview,
      deliverables: task.deliverables,
      testResults: task.testResults,
      content: task.content
    };
  } else {
    ctx = {
      projectRoot: targetDir,
      selfReview: policyExists ? 'AI Policy & workspace active' : null,
      sources: policyExists ? ['AI_POLICY.md', 'package.json'] : [],
      task: {
        task_id: 'WORKSPACE_CHECK',
        task_type: 'WORKSPACE',
        content: policyExists ? 'Governance policy active in AI_POLICY.md and package.json' : '',
        deliverables: policyExists ? ['AI_POLICY.md'] : []
      }
    };
  }

  const outcome = await runGuards(ctx);

  console.log(`\n${c.bold}Quality Guard Evaluations:${c.reset}`);
  for (const gr of outcome.results) {
    if (gr.passed) {
      console.log(`  ${c.green}✔ [${gr.guardId}] ${gr.name}${c.reset}`);
      console.log(`    ${c.dim}${gr.reason}${c.reset}`);
    } else if (gr.warning) {
      console.log(`  ${c.yellow}▲ [${gr.guardId}] ${gr.name} (Warning)${c.reset}`);
      console.log(`    ${c.dim}${gr.reason}${c.reset}`);
      if (gr.fixHint) console.log(`    ${c.cyan}Fix: ${gr.fixHint}${c.reset}`);
    } else {
      console.log(`  ${c.red}✖ [${gr.guardId}] ${gr.name} (BLOCKED)${c.reset}`);
      console.log(`    ${c.dim}${gr.reason}${c.reset}`);
      if (gr.fixHint) console.log(`    ${c.cyan}Fix: ${gr.fixHint}${c.reset}`);
    }
  }

  if (outcome.passed) {
    logSuccess('\nAll evaluated quality gates PASSED!');
  } else {
    logError(`\nQuality gate checks FAILED (${outcome.failureCount} blocking violation(s)).`);
    process.exit(1);
  }
}

async function handleTask() {
  banner();
  const subCommand = args[1] || 'list';
  const backend = new FileBackend(path.join(targetDir, '.ai-governor'));
  const engine = new TransitionEngine(backend);

  switch (subCommand) {
    case 'create': {
      const taskName = args[2] || 'Untitled AI Task';
      const task = await backend.createTask({
        task_name: taskName,
        task_type: 'IMPLEMENTATION',
        role: 'DEVELOPER',
        status: TASK_STATES.ACTIVE,
        content: args[3] || 'Task created via CLI'
      });
      logSuccess(`Created task: ${c.bold}${task.task_id}${c.reset} [${task.status}]`);
      console.log(`  Name: ${task.task_name}`);
      break;
    }

    case 'list': {
      const tasks = await backend.listTasks();
      if (tasks.length === 0) {
        logInfo('No tasks registered in this project. Run `ai-governor task create "Task name"` to create one.');
        return;
      }
      console.log(`\n${c.bold}Governed Agent Tasks:${c.reset}`);
      const headers = ['Task ID', 'Name', 'Status', 'Role', 'Created'];
      const rows = tasks.map(t => [t.task_id, t.task_name, t.status, t.role, t.created_at.slice(0, 19)]);
      table(headers, rows);
      break;
    }

    case 'review': {
      const taskId = args[2];
      if (!taskId) {
        logError('Usage: ai-governor task review <taskId> --note "Self review note"');
        process.exit(1);
      }
      const noteIdx = args.indexOf('--note');
      const note = noteIdx !== -1 && args[noteIdx + 1] ? args[noteIdx + 1] : 'Self review completed. Tests verified.';
      await backend.addReview(taskId, {
        review_type: 'SELF_REVIEW',
        rating: 9,
        content: note
      });
      logSuccess(`Added SELF_REVIEW to task ${taskId}`);
      break;
    }

    case 'submit': {
      const taskId = args[2];
      if (!taskId) {
        logError('Usage: ai-governor task submit <taskId>');
        process.exit(1);
      }
      logInfo(`Submitting task ${taskId} for review...`);
      const res = await engine.transitionTask(taskId, TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER', {
        projectRoot: targetDir
      });

      console.log(`\nResult: ${res.result === 'PASS' ? c.green + 'PASS' : c.red + 'FAIL'}${c.reset}`);
      for (const gr of res.guardResults || []) {
        if (gr.passed) {
          console.log(`  ${c.green}✔ ${gr.guardId}: ${gr.reason}${c.reset}`);
        } else {
          console.log(`  ${c.red}✖ ${gr.guardId}: ${gr.reason}${c.reset}`);
          if (gr.fixHint) console.log(`     ${c.cyan}Fix: ${gr.fixHint}${c.reset}`);
        }
      }
      break;
    }

    case 'approve': {
      const taskId = args[2];
      if (!taskId) {
        logError('Usage: ai-governor task approve <taskId> [--role REVIEWER]');
        process.exit(1);
      }
      const roleIdx = args.indexOf('--role');
      const role = roleIdx !== -1 && args[roleIdx + 1] ? args[roleIdx + 1] : 'REVIEWER';

      logInfo(`Approving task ${taskId} with role: ${c.bold}${role}${c.reset}...`);
      const res = await engine.transitionTask(taskId, TASK_STATES.COMPLETED, role, {
        projectRoot: targetDir
      });

      if (res.result === 'PASS') {
        logSuccess(`Task ${taskId} successfully approved and COMPLETED!`);
      } else {
        logError(`Approval failed: ${res.message || res.error}`);
        for (const gr of res.guardResults || []) {
          if (!gr.passed) {
            console.log(`  ${c.red}✖ ${gr.guardId}: ${gr.reason}${c.reset}`);
            if (gr.fixHint) console.log(`     ${c.cyan}Fix: ${gr.fixHint}${c.reset}`);
          }
        }
      }
      break;
    }

    case 'reject': {
      const taskId = args[2];
      if (!taskId) {
        logError('Usage: ai-governor task reject <taskId> [--role REVIEWER] [--reason "rework feedback"]');
        process.exit(1);
      }
      const roleIdx = args.indexOf('--role');
      const role = roleIdx !== -1 && args[roleIdx + 1] ? args[roleIdx + 1] : 'REVIEWER';

      const reasonIdx = args.indexOf('--reason');
      const reason = reasonIdx !== -1 && args[reasonIdx + 1] ? args[reasonIdx + 1] : 'Changes requested by reviewer';

      logInfo(`Rejecting task ${taskId} (sending to REWORK) with role: ${c.bold}${role}${c.reset}...`);
      await backend.addReview(taskId, {
        review_type: 'REJECTION',
        role,
        rating: 4,
        content: reason
      });

      const res = await engine.transitionTask(taskId, TASK_STATES.REWORK, role, {
        projectRoot: targetDir
      });

      if (res.result === 'PASS') {
        logSuccess(`Task ${taskId} transitioned to REWORK.`);
        console.log(`  Feedback: ${reason}`);
      } else {
        logError(`Rejection failed: ${res.message || res.error}`);
      }
      break;
    }

    case 'show':
    case 'get': {
      const taskId = args[2];
      if (!taskId) {
        logError('Usage: ai-governor task show <taskId>');
        process.exit(1);
      }
      const task = await backend.getTask(taskId);
      if (!task) {
        logError(`Task ${taskId} not found.`);
        process.exit(1);
      }
      const reviews = await backend.getReviews(taskId);
      const events = await backend.getEvents(taskId);

      console.log(`\n${c.bold}Task Details: ${c.cyan}${task.task_id}${c.reset}`);
      console.log(`  Name:        ${task.task_name}`);
      console.log(`  Status:      ${task.status === 'COMPLETED' ? c.green + task.status : task.status === 'REWORK' ? c.yellow + task.status : c.cyan + task.status}${c.reset}`);
      console.log(`  Type:        ${task.task_type || 'N/A'}`);
      console.log(`  Role:        ${task.role || 'N/A'}`);
      console.log(`  Created:     ${task.created_at || 'N/A'}`);
      console.log(`  Updated:     ${task.updated_at || 'N/A'}`);
      if (task.content) console.log(`  Description: ${task.content}`);

      if (task.deliverables && task.deliverables.length > 0) {
        console.log(`\n${c.bold}Deliverables (${task.deliverables.length}):${c.reset}`);
        for (const d of task.deliverables) {
          const exists = fs.existsSync(path.isAbsolute(d) ? d : path.join(targetDir, d));
          console.log(`  ${exists ? c.green + '✔' : c.red + '✖'}${c.reset} ${d} ${exists ? c.dim + '(on disk)' : c.red + '(missing)'}${c.reset}`);
        }
      }

      if (reviews.length > 0) {
        console.log(`\n${c.bold}Attached Reviews (${reviews.length}):${c.reset}`);
        for (const r of reviews) {
          console.log(`  ${c.cyan}●${c.reset} [${r.review_type}] ${r.content || ''} ${c.dim}(${r.created_at?.slice(0, 19) || ''})${c.reset}`);
        }
      }

      if (events.length > 0) {
        console.log(`\n${c.bold}Transition History (${events.length}):${c.reset}`);
        for (const e of events) {
          const statusIcon = e.passed ? c.green + '✔' : c.red + '✖';
          console.log(`  ${statusIcon}${c.reset} ${e.fromStatus} ➔ ${e.toStatus} by ${e.callerRole} ${c.dim}(${e.timestamp?.slice(0, 19) || ''})${c.reset}`);
        }
      }
      break;
    }

    default:
      logError(`Unknown task command: ${subCommand}`);
      console.log('Available task subcommands: create, list, show, review, submit, approve, reject');
      process.exit(1);
  }
}

async function handleAudit() {
  banner();
  logInfo(`Auditing project policies & execution history in: ${c.bold}${targetDir}${c.reset}`);

  const policyPath = path.join(targetDir, 'AI_POLICY.md');
  if (!fs.existsSync(policyPath)) {
    logError(`No AI_POLICY.md found in ${targetDir}. Run 'ai-governor init' first.`);
    process.exit(1);
  }

  const env = await detectEnvironment(targetDir);
  logSuccess(`Project policy file exists.`);
  console.log(`  Active IDEs: ${env.ides.map(i => i.name).join(', ') || 'Terminal'}`);
  console.log(`  Available Models: ${env.availableModels.join(', ')}`);

  // Inspect Audit Log Metrics
  const audit = new AuditLogger({ storageDir: path.join(targetDir, '.ai-governor') });
  const metrics = audit.getMetrics();

  console.log(`\n${c.bold}Audit Trail & Quality Metrics:${c.reset}`);
  console.log(`  Total Logged Transitions: ${metrics.totalEvents}`);
  console.log(`  Passed: ${c.green}${metrics.passedTransitions}${c.reset} | Failed: ${c.red}${metrics.failedTransitions}${c.reset}`);
  console.log(`  Overall Pass Rate: ${c.cyan}${metrics.passRate}${c.reset}`);

  const hotspots = Object.entries(metrics.guardFailureHotspots);
  if (hotspots.length > 0) {
    console.log(`\n${c.bold}Frequent Failure Hotspots:${c.reset}`);
    for (const [gid, count] of hotspots) {
      console.log(`  ${c.yellow}▲ ${gid}${c.reset}: ${count} failure(s)`);
    }
  }

  logSuccess(`Policy and audit trail verified.`);
}

function handleHelp() {
  banner();
  console.log(`
Usage:
  npx ai-governor [command] [options]

Commands:
  init      Detect environment and generate all AI policies & tool adapters (default)
  detect    Scan environment, active IDEs, API keys, and model capability matrix
  gate      Evaluate active quality guards against current workspace/deliverables
  task      Manage governed agent tasks (create, list, review, submit, approve)
  audit     Verify project policies and review transition audit log metrics
  sync      Recompute model assignments and re-sync adapter files

Task Subcommands:
  ai-governor task create "<task_name>" ["<content>"]
  ai-governor task list
  ai-governor task show <task_id>
  ai-governor task review <task_id> --note "<self_review_summary>"
  ai-governor task submit <task_id>
  ai-governor task approve <task_id> [--role REVIEWER]
  ai-governor task reject <task_id> [--role REVIEWER] [--reason "<feedback>"]

Options:
  --target <path>   Target directory (defaults to current working directory)
  --dry-run         Simulate generation without writing files to disk
  --help, -h        Show this help message
`);
}

async function main() {
  switch (command) {
    case 'detect':
      await handleDetect();
      break;
    case 'init':
    case 'sync':
      await handleInit();
      break;
    case 'gate':
    case 'check':
      await handleGate();
      break;
    case 'task':
      await handleTask();
      break;
    case 'audit':
      await handleAudit();
      break;
    case 'help':
    case '--help':
    case '-h':
      handleHelp();
      break;
    default:
      logError(`Unknown command: ${command}`);
      handleHelp();
      process.exit(1);
  }
}

main().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
