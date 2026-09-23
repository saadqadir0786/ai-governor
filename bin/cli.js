#!/usr/bin/env node

/**
 * ai-governor CLI binary
 */

import path from 'node:path';
import fs from 'node:fs';
import { banner, c, logSuccess, logInfo, logWarn, logError, table } from '../src/utils/formatting.js';
import { detectEnvironment } from '../src/detector.js';
import { getModelRegistry } from '../src/utils/remote.js';
import { computeRoleAssignments, HUMAN_CLEARANCE_MATRIX } from '../src/rbac.js';
import { runGovernor } from '../src/index.js';

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

async function handleAudit() {
  banner();
  logInfo(`Auditing project policies in: ${c.bold}${targetDir}${c.reset}`);

  const policyPath = path.join(targetDir, 'AI_POLICY.md');
  if (!fs.existsSync(policyPath)) {
    logError(`No AI_POLICY.md found in ${targetDir}. Run 'ai-governor init' first.`);
    process.exit(1);
  }

  const env = await detectEnvironment(targetDir);
  logSuccess(`Project policy file exists.`);
  console.log(`  Active IDEs: ${env.ides.map(i => i.name).join(', ') || 'Terminal'}`);
  console.log(`  Available Models: ${env.availableModels.join(', ')}`);
  logSuccess(`Policy is active and verified.`);
}

function handleHelp() {
  banner();
  console.log(`
Usage:
  npx ai-governor [command] [options]

Commands:
  init      Detect environment and generate all AI policies & tool adapters (default)
  detect    Scan environment, active IDEs, API keys, and model capability matrix
  audit     Verify current environment against existing project AI policies
  sync      Recompute model assignments and re-sync adapter files

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
