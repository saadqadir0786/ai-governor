/**
 * Environment, IDE & Model Detector
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Execute command safely without crashing
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

/**
 * Inspect running processes cross-platform
 */
export function getRunningProcesses() {
  const isWin = os.platform() === 'win32';
  const cmd = isWin ? 'tasklist' : 'ps -A -o comm=';
  const output = safeExec(cmd).toLowerCase();
  return output;
}

/**
 * Check if local Ollama server is running and get installed models
 */
export async function getLocalOllamaModels() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return (data.models || []).map(m => m.name.toLowerCase());
    }
  } catch {
    // Ollama not running
  }
  return [];
}

/**
 * Detect active developer tools and IDEs
 */
export function detectActiveIDEs(targetDir = process.cwd()) {
  const processes = getRunningProcesses();
  const detected = [];

  // Antigravity check
  const hasAntigravityProcess = processes.includes('antigravity');
  const hasAntigravityDir = fs.existsSync(path.join(targetDir, '.antigravity')) ||
                           fs.existsSync(path.join(os.homedir(), '.gemini', 'antigravity'));
  if (hasAntigravityProcess || hasAntigravityDir) {
    detected.push({
      id: 'antigravity',
      name: 'Google Antigravity IDE',
      active: true,
      reason: hasAntigravityProcess ? 'Running Process detected' : 'Configuration detected'
    });
  }

  // Claude Code check
  const hasClaudeProcess = processes.includes('claude');
  const hasClaudeEnv = Boolean(process.env.CLAUDE_CODE);
  const hasClaudeDir = fs.existsSync(path.join(os.homedir(), '.claude')) ||
                       fs.existsSync(path.join(targetDir, 'CLAUDE.md'));
  if (hasClaudeProcess || hasClaudeEnv || hasClaudeDir) {
    detected.push({
      id: 'claude-code',
      name: 'Anthropic Claude Code',
      active: true,
      reason: hasClaudeProcess ? 'Running Process detected' : 'Claude configuration detected'
    });
  }

  // Cursor / Windsurf check
  const hasCursorProcess = processes.includes('cursor');
  const hasWindsurfProcess = processes.includes('windsurf');
  if (hasCursorProcess || hasWindsurfProcess || fs.existsSync(path.join(targetDir, '.cursorrules'))) {
    detected.push({
      id: 'cursor',
      name: hasWindsurfProcess ? 'Windsurf IDE' : 'Cursor IDE',
      active: true,
      reason: 'Editor detected'
    });
  }

  // VS Code check
  if (processes.includes('code') || process.env.VSCODE_PID) {
    detected.push({
      id: 'vscode',
      name: 'Visual Studio Code',
      active: true,
      reason: 'VS Code process active'
    });
  }

  // Aider check
  if (processes.includes('aider') || fs.existsSync(path.join(targetDir, '.aider.conf.yml'))) {
    detected.push({
      id: 'aider',
      name: 'Aider CLI',
      active: true,
      reason: 'Aider environment detected'
    });
  }

  return detected;
}

/**
 * Detect available credentials and API keys
 */
export function detectApiKeys() {
  const keys = {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY)
  };
  return keys;
}

/**
 * Inspect target project tech stack
 */
export function detectProjectStack(targetDir = process.cwd()) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  const info = {
    isNode: fs.existsSync(packageJsonPath),
    isPython: fs.existsSync(path.join(targetDir, 'requirements.txt')) || fs.existsSync(path.join(targetDir, 'pyproject.toml')),
    isRust: fs.existsSync(path.join(targetDir, 'Cargo.toml')),
    isGo: fs.existsSync(path.join(targetDir, 'go.mod')),
    framework: 'Generic',
    testingFramework: 'None'
  };

  if (info.isNode) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (allDeps.next) info.framework = 'Next.js';
      else if (allDeps.react) info.framework = 'React';
      else if (allDeps.vue) info.framework = 'Vue';
      else if (allDeps.express || allDeps.fastify) info.framework = 'Node Backend';

      if (allDeps.vitest) info.testingFramework = 'Vitest';
      else if (allDeps.jest) info.testingFramework = 'Jest';
    } catch {
      // Ignore parse error
    }
  }

  return info;
}

/**
 * Comprehensive environment snapshot
 */
export async function detectEnvironment(targetDir = process.cwd()) {
  const ides = detectActiveIDEs(targetDir);
  const keys = detectApiKeys();
  const ollamaModels = await getLocalOllamaModels();
  const stack = detectProjectStack(targetDir);

  // Derive accessible models
  const availableModels = [];

  // Antigravity provides Gemini models out of the box
  if (ides.some(i => i.id === 'antigravity') || keys.gemini) {
    availableModels.push('gemini-3-pro', 'gemini-3.8-flash', 'gemini-2.5-pro');
  }

  // Claude Code / Anthropic key
  if (ides.some(i => i.id === 'claude-code') || keys.anthropic) {
    availableModels.push('claude-3-7-sonnet', 'claude-3-5-sonnet', 'claude-3-5-haiku');
  }

  // OpenRouter key provides everything
  if (keys.openrouter) {
    availableModels.push('deepseek-r1', 'claude-3-7-sonnet', 'gemini-3-pro', 'gpt-4o');
  }

  // OpenAI key
  if (keys.openai) {
    availableModels.push('gpt-4o');
  }

  // Local Ollama models
  for (const m of ollamaModels) {
    if (m.includes('deepseek-r1') && !availableModels.includes('deepseek-r1')) availableModels.push('deepseek-r1');
    if (m.includes('qwen') && !availableModels.includes('qwen-2.5-coder')) availableModels.push('qwen-2.5-coder');
  }

  // Fallback defaults if no credentials detected
  if (availableModels.length === 0) {
    availableModels.push('gemini-3.8-flash', 'claude-3-5-sonnet');
  }

  return {
    targetDir,
    ides,
    keys,
    ollamaModels,
    stack,
    availableModels: [...new Set(availableModels)]
  };
}
