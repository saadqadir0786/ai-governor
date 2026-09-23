# 🛡️ ai-governor

> **Model-Agnostic AI Governance, RBAC & Reasoning Intensity Engine for Developer Environments.**  
> Seamlessly orchestrate **Google Antigravity**, **Anthropic Claude Code**, **Cursor**, **Aider**, and **Local Ollama** with zero vendor lock-in.

---

## ⚡ Quick Start (No Installation Needed)

Run directly in any project folder on **any operating system** (Windows, macOS, Linux):

```bash
npx ai-governor init
```

To inspect your current environment, active IDEs, API keys, and model capability assignments:

```bash
npx ai-governor detect
```

---

## 🌟 Why AI Governor?

Modern developers switch between AI tools, models, and machines:
* Today you might use **Google Antigravity**; tomorrow, **Claude Code**; next week, **Cursor** or an offline **DeepSeek** model.
* Frontier models have starkly different superpowers: **Gemini 3 Pro** has a 2,000,000 token context window ideal for architecture audits; **Claude 3.7 Sonnet** excels at complex algorithmic debugging with extended thinking; **Gemini 3.8 Flash** is unmatched for sub-second linting.
* **The Danger:** Unchecked AI agents hallucinate non-existent packages, overwrite architecture without permission, and execute destructive commands.

**`ai-governor` solves this by:**
1. **Fingerprinting your active tool & models**: Automatically probes active IDEs, environment keys, and local model servers.
2. **Assigning Model-Level RBAC**: Grants strict, non-transferable permissions to each model (e.g., Architects can draft plans but cannot touch code; UI builders cannot mutate databases).
3. **Calibrating Reasoning Intensity**: Enforces thinking budgets (`MAX_THINKING`, `HIGH_THINKING`, `STANDARD`, `ECO_FAST`) tailored to task difficulty.
4. **Enforcing Human Permission Gates**: Sets clear **RED**, **YELLOW**, and **GREEN** clearance thresholds.
5. **Syncing Universal Tool Adapters**: Automatically generates `AI_POLICY.md`, `CLAUDE.md`, `.antigravity/rules/`, and `.cursorrules`.

---

## 🚦 The 3-Tier Human Clearance Gate

| Level | Rule | Triggers |
| :--- | :--- | :--- |
| 🔴 **RED** | **STRICT HARD STOP**<br>AI must stop and get explicit human confirmation. | • Database migrations & schema changes<br>• Installing new third-party packages<br>• Modifying `.env`, auth tokens, or security<br>• Architectural deviations<br>• Git push or branch deletion |
| 🟡 **YELLOW** | **NOTICE & LOG**<br>AI proceeds autonomously but flags the action in its response. | • Adding new test files or mock fixtures<br>• Adding keys to `.env.example`<br>• Refactoring localized helper functions |
| 🟢 **GREEN** | **AUTONOMOUS**<br>AI executes freely without asking. | • Reading files & searching codebase<br>• Running test suites<br>• Fixing compiler/lint errors in open files |

---

## 🧠 Model Disciplines & Intensity Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODEL RBAC ASSIGNMENTS                          │
├──────────────────────────┬───────────────────┬─────────────────────────┤
│ Domain                   │ Assigned Model    │ Intensity Level         │
├──────────────────────────┼───────────────────┼─────────────────────────┤
│ System Architecture      │ Gemini 3 Pro      │ 🧠 MAX_THINKING         │
│ Core Logic & Debugging   │ Claude 3.7 Sonnet │ 🧠 HIGH_THINKING (TDD)  │
│ UI & Frontend Crafting   │ Claude 3.5 Sonnet │ ⚡ STANDARD             │
│ Rapid Fixes & Linting    │ Gemini 3.8 Flash  │ 🚀 ECO_FAST             │
│ Documentation & Specs    │ Claude 3.5 Sonnet │ ⚡ STANDARD             │
└──────────────────────────┴───────────────────┴─────────────────────────┘
```

---

## 🛠️ CLI Commands

### 1. `init`
```bash
npx ai-governor init
```
Scans the current project, detects installed tools and available models, and creates:
* `AI_POLICY.md` - Master project policy and governance rules
* `CLAUDE.md` - Configuration file for Claude Code
* `.antigravity/rules/ai_policy.md` - Rules for Google Antigravity
* `.cursorrules` - Rules for Cursor / Windsurf

Options:
* `--target <path>`: Specify project directory (default: current directory)
* `--dry-run`: Preview file generation without writing to disk

### 2. `detect`
```bash
npx ai-governor detect
```
Prints a diagnostic table showing active IDE processes, credentials in environment variables, and the optimal model-to-task mapping.

### 3. `audit`
```bash
npx ai-governor audit
```
Verifies whether the current project has an active `AI_POLICY.md` and checks if local models match the required permissions.

### 4. `sync`
```bash
npx ai-governor sync
```
Re-evaluates the environment (e.g. if you switched computers or lost access to an API key) and updates the project adapter files accordingly.

---

## 📦 How to Publish & Share

### Step 1: Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new) named `ai-governor`.
2. Connect and push:
```bash
git remote add origin https://github.com/<YOUR-USERNAME>/ai-governor.git
git branch -M main
git push -u origin main
```

Now anyone can run it directly from GitHub:
```bash
npx github:<YOUR-USERNAME>/ai-governor init
```

### Step 2: Publish to NPM
To make it available globally via `npx ai-governor`:
```bash
npm login
npm publish --access public
```

---

## 📄 License
MIT © Alishba
