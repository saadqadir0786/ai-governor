/**
 * Model Capability Matrix & Task Domains
 */

export const TASK_DOMAINS = {
  ARCHITECTURE: {
    id: 'ARCHITECTURE',
    title: 'System Architecture & Planning',
    description: 'System design, domain modeling, multi-file refactoring plans, schema architecture',
    requiredIntensity: 'MAX_THINKING',
    permissionClearance: 'PLAN_ONLY' // Forbidden from writing raw code until plan is approved
  },
  LOGIC_DEBUG: {
    id: 'LOGIC_DEBUG',
    title: 'Core Logic & Precision Debugging',
    description: 'Algorithmic code, edge cases, state management, race condition debugging',
    requiredIntensity: 'HIGH_THINKING',
    permissionClearance: 'TDD_STRICT' // Must write tests first
  },
  UI_STYLING: {
    id: 'UI_STYLING',
    title: 'UI, Frontend Crafting & Accessibility',
    description: 'Component hierarchies, Tailwind styling, UX interactions, a11y standards',
    requiredIntensity: 'STANDARD',
    permissionClearance: 'UI_ONLY' // Forbidden from touching db/auth
  },
  RAPID_FIX: {
    id: 'RAPID_FIX',
    title: 'Rapid Fixes, Linting & Small Iterations',
    description: 'Fixing syntax errors, formatting, small script tweaks, typo corrections',
    requiredIntensity: 'ECO_FAST',
    permissionClearance: 'SCOPED_WRITE' // Max 50 lines per change
  },
  DOCUMENTATION: {
    id: 'DOCUMENTATION',
    title: 'Technical Specs & Documentation',
    description: 'README, API reference, changelogs, architecture notes',
    requiredIntensity: 'STANDARD',
    permissionClearance: 'DOCS_ONLY' // Forbidden from editing code
  }
};

export const DEFAULT_MODEL_REGISTRY = {
  'gemini-3-pro': {
    name: 'Gemini 3 Pro',
    provider: 'Google',
    contextWindow: '2,000,000+',
    primaryDomain: 'ARCHITECTURE',
    secondaryDomains: ['LOGIC_DEBUG', 'DOCUMENTATION'],
    defaultIntensity: 'MAX_THINKING',
    strengths: ['Massive context window', 'Deep multimodal reasoning', 'Global codebase indexing'],
    costTier: 'High'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    contextWindow: '2,000,000',
    primaryDomain: 'ARCHITECTURE',
    secondaryDomains: ['LOGIC_DEBUG'],
    defaultIntensity: 'HIGH_THINKING',
    strengths: ['Huge context', 'Deep cross-file reasoning'],
    costTier: 'Medium-High'
  },
  'gemini-3.8-flash': {
    name: 'Gemini 3.8 Flash',
    provider: 'Google',
    contextWindow: '1,000,000',
    primaryDomain: 'RAPID_FIX',
    secondaryDomains: ['DOCUMENTATION'],
    defaultIntensity: 'ECO_FAST',
    strengths: ['Ultra-fast latency', 'Sub-second tool calls', 'Cheap execution'],
    costTier: 'Low'
  },
  'claude-3-7-sonnet': {
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    contextWindow: '200,000',
    primaryDomain: 'LOGIC_DEBUG',
    secondaryDomains: ['ARCHITECTURE', 'UI_STYLING'],
    defaultIntensity: 'HIGH_THINKING',
    strengths: ['Hybrid thinking reasoning', 'Complex bug eradication', 'Flawless code structure'],
    costTier: 'Medium'
  },
  'claude-3-5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: '200,000',
    primaryDomain: 'UI_STYLING',
    secondaryDomains: ['DOCUMENTATION', 'LOGIC_DEBUG'],
    defaultIntensity: 'STANDARD',
    strengths: ['Top-tier frontend design', 'Clean idiomatic code', 'Concise prose'],
    costTier: 'Medium'
  },
  'claude-3-5-haiku': {
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    contextWindow: '200,000',
    primaryDomain: 'RAPID_FIX',
    secondaryDomains: ['DOCUMENTATION'],
    defaultIntensity: 'ECO_FAST',
    strengths: ['Rapid turnaround', 'Precise single-file edits'],
    costTier: 'Low'
  },
  'deepseek-r1': {
    name: 'DeepSeek-R1',
    provider: 'DeepSeek / OpenRouter / Ollama',
    contextWindow: '128,000',
    primaryDomain: 'LOGIC_DEBUG',
    secondaryDomains: ['ARCHITECTURE'],
    defaultIntensity: 'HIGH_THINKING',
    strengths: ['Open-weight mathematical reasoning', 'High logic density', 'Local offline execution'],
    costTier: 'Free/Low'
  },
  'qwen-2.5-coder': {
    name: 'Qwen 2.5 Coder',
    provider: 'Alibaba / Ollama',
    contextWindow: '128,000',
    primaryDomain: 'RAPID_FIX',
    secondaryDomains: ['UI_STYLING'],
    defaultIntensity: 'STANDARD',
    strengths: ['Best local coding model', 'Offline privacy', 'Fast syntax generation'],
    costTier: 'Free'
  },
  'gpt-4o': {
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: '128,000',
    primaryDomain: 'DOCUMENTATION',
    secondaryDomains: ['UI_STYLING', 'RAPID_FIX'],
    defaultIntensity: 'STANDARD',
    strengths: ['General versatile performance', 'Structured output'],
    costTier: 'Medium'
  }
};
