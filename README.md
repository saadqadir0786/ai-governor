# 🛡️ ai-governor

> **Model-Agnostic AI Governance, State Machine & Quality Gates for Developer Environments & Autonomous Agents.**  
> Seamlessly orchestrate **Google Antigravity**, **Anthropic Claude Code**, **Cursor**, **Aider**, and **Local Ollama** with zero vendor lock-in.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![Tests: 16 Passing](https://img.shields.io/badge/tests-16%20passing-brightgreen.svg)](tests/test.js)

---

## ⚡ Quick Start (No Installation Needed)

Run directly in any project folder on **Windows, macOS, or Linux**:

```bash
# 1. Initialize project governance policies and tool adapters
npx ai-governor init

# 2. Inspect active tools, credentials, and model capability assignments
npx ai-governor detect

# 3. Evaluate active quality guards against project deliverables
npx ai-governor gate
```

---

## 🌟 Why AI Governor?

Modern developers switch between AI tools, models, and machines:
* Today you might use **Google Antigravity**; tomorrow, **Claude Code**; next week, **Cursor** or an offline **DeepSeek** model.
* Frontier models have starkly different superpowers: **Gemini 3 Pro** has a 2,000,000 token context window ideal for architecture audits; **Claude 3.7 Sonnet** excels at complex algorithmic debugging with extended thinking; **Gemini 3.8 Flash** is unmatched for sub-second linting.
* **The Danger:** Unchecked AI agents hallucinate non-existent packages, overwrite architecture without permission, and claim tasks are "done" without verification tests or rollback plans.

**`ai-governor` provides a complete Dual-Engine solution:**
1. **Passive Governance (Setup Phase):**
   - Fingerprints active IDEs, credentials, and local model servers.
   - Assigns Model-Level RBAC and Reasoning Intensity (`MAX_THINKING`, `HIGH_THINKING`, `STANDARD`, `ECO_FAST`).
   - Syncs universal adapters: `AI_POLICY.md`, `CLAUDE.md`, `.antigravity/rules/`, and `.cursorrules`.
2. **Active Governance (Runtime Execution Phase):**
   - Pluggable Quality Guards (`EG-01` to `EG-10`) that validate deliverables, test proof, self-reviews, rollback plans, secret leaks, and unauthorized deploys.
   - State-machine lifecycle (`ACTIVE` ➔ `READY_FOR_REVIEW` ➔ `COMPLETED` / `REWORK`).
   - Role separation: preventing agents from self-approving their own work.
   - Actionable `fixHint` outputs enabling autonomous LLM self-correction loops.
   - Tamper-evident audit logging and failure hotspot analytics.

---

## 🛡️ Built-in Quality Guards

Guards that don't get tired. Pluggable, zero-dependency validation gates:

| Guard ID | Name | What It Checks |
| :--- | :--- | :--- |
| **EG-01** | `SelfReviewGuard` | Mandates that the agent performs self-reflection and provides a verification summary before submission. |
| **EG-02** | `DeliverablesGuard` | Verifies that all declared output files exist on disk, are non-empty, and reside safely within the project root (symlink & directory traversal safe). |
| **EG-03** | `TestProofGuard` | Verifies automated test execution proof (`exitCode: 0`) for implementation and logic bugfix tasks. |
| **EG-04** | `RollbackPlanGuard` | Blocks any deployment or database schema migration task lacking an explicit rollback strategy. |
| **EG-05** | `ClearanceGateGuard` | Enforces the 3-Tier Human Clearance matrix (RED / YELLOW / GREEN), blocking destructive mutations without human approval. |
| **EG-06** | `ScopedEditGuard` | Enforces a strict 50-line edit limit for rapid-fix models to prevent accidental architectural drift. |
| **EG-07** | `MultiSourceEvidenceGuard` | Ensures investigation and audit tasks cite at least 2 independent reference sources/evidence. |
| **EG-08** | `RoleSeparationGate` | Enforces role separation: the executor who created or submitted the task cannot approve it. |
| **EG-09** | `SecretScannerGuard` | Prevents credential leaks: detects AWS keys, private keys, API tokens, and passwords in task notes. |
| **EG-10** | `NoImpliedDeploysGuard` | Blocks unauthorized deployment/cluster commands (`kubectl`, `helm`, `docker push`) in non-DEPLOY tasks. |

---

## 💡 What Happens When Guards Block

Guards don't just say "no" — they tell your agent **exactly** what is wrong and how to fix it, enabling autonomous self-correction loops:

```bash
$ npx ai-governor task submit TASK_001

Result: FAIL
  ✖ EG-01: No self-review found for task.
     Fix: Create a self-review summary with verification notes before submitting work.
  ✖ EG-02: Missing deliverables on disk: auth.js, auth.test.js
     Fix: Ensure all stated deliverable files are created on the filesystem before transition.
  ✖ EG-03: Proof of work missing: No test execution proof or exit code provided.
     Fix: Run automated tests (e.g., npm test, pytest) and record testResults with exitCode: 0.
```

---

## 🚦 The 3-Tier Human Clearance Gate

| Level | Rule | Triggers |
| :--- | :--- | :--- |
| 🔴 **RED** | **STRICT HARD STOP**<br>AI must stop and get explicit human confirmation. | • Database migrations & schema changes<br>• Installing new third-party packages<br>• Modifying `.env`, auth tokens, or security<br>• Architectural deviations<br>• Git push or branch deletion |
| 🟡 **YELLOW** | **NOTICE & LOG**<br>AI proceeds autonomously but flags the action in its response. | • Adding new test files or mock fixtures<br>• Adding keys to `.env.example`<br>• Refactoring localized helper functions |
| 🟢 **GREEN** | **AUTONOMOUS**<br>AI executes freely without asking. | • Reading files & searching codebase<br>• Running test suites<br>• Fixing compiler/lint errors in open files |

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

### 2. `detect`
```bash
npx ai-governor detect
```
Prints a diagnostic table showing active IDE processes, credentials in environment variables, and the optimal model-to-task mapping.

### 3. `gate` (or `check`)
```bash
npx ai-governor gate
```
Evaluates active quality guards against current workspace files and deliverables. Exits with code 0 on pass, or code 1 with actionable fix hints.

### 4. `task` (Task Lifecycle Management)
```bash
# Create a governed task
npx ai-governor task create "Ship OAuth Flow" "Implement PKCE auth with tests"

# List governed tasks
npx ai-governor task list

# Inspect detailed task status, deliverables, reviews, and audit events
npx ai-governor task show TASK_001

# Add a self-review
npx ai-governor task review TASK_001 --note "PKCE implemented, all unit tests pass"

# Submit for review (runs all quality guards)
npx ai-governor task submit TASK_001

# Reviewer rejects task (returns to REWORK with feedback)
npx ai-governor task reject TASK_001 --role REVIEWER --reason "Add integration tests for refresh token rotation"

# Reviewer approves task (role-separated)
npx ai-governor task approve TASK_001 --role REVIEWER
```

### 5. `audit`
```bash
npx ai-governor audit
```
Verifies project policies and displays audit trail statistics: total transitions, pass rate, and frequent failure hotspots.

### 6. `sync`
```bash
npx ai-governor sync
```
Re-evaluates the environment (e.g., if you switched machines or added new API keys) and updates adapter files.

---

## 💻 Node.js & TypeScript SDK Usage

Integrate `ai-governor` directly into your custom agent workflows (Vercel AI SDK, LangChain.js, Antigravity, Claude Code):

```javascript
import { TransitionEngine, MemoryBackend, registerGuard, TASK_STATES } from 'ai-governor';

// 1. Initialize backend and transition engine
const backend = new MemoryBackend();
const engine = new TransitionEngine(backend);

// 2. Create task
const task = await backend.createTask({
  task_id: 'TASK_001',
  task_name: 'Implement User Authentication',
  task_type: 'IMPLEMENTATION',
  role: 'DEVELOPER',
  deliverables: ['src/auth.js', 'tests/auth.test.js'],
  testResults: { passed: true, exitCode: 0 }
});

// 3. Add self-review evidence
await backend.addReview('TASK_001', {
  review_type: 'SELF_REVIEW',
  rating: 9,
  content: 'OAuth2 with PKCE implemented. All 14 tests passing.'
});

// 4. Submit task (evaluates EG-01 through EG-10 guards)
const submission = await engine.transitionTask('TASK_001', TASK_STATES.READY_FOR_REVIEW, 'DEVELOPER');
console.log(submission.result); // "PASS"

// 5. Reviewer approval (enforces role separation)
const approval = await engine.transitionTask('TASK_001', TASK_STATES.COMPLETED, 'REVIEWER');
console.log(approval.result); // "PASS"
```

---

## 📊 Without Governance vs. With AI Governor

| Workflow Action | Without Governance | With `ai-governor` |
| :--- | :--- | :--- |
| **Agent Submits Work** | Merged straight to main | Evaluated against 10 deterministic quality guards |
| **Missing Self-Review** | Unverified claims | Blocked until verification summary provided (`EG-01`) |
| **Deliverables Verification** | Hallucinated file paths | Verified on disk with symlink & path traversal security (`EG-02`) |
| **Testing Standards** | Ignored or skipped | Blocked without real automated test proof `exitCode: 0` (`EG-03`) |
| **Deployments & Migrations** | High outage risk | Blocked without explicit rollback strategy (`EG-04`) |
| **Destructive Commands** | Database dropped silently | Blocked by 3-Tier Human Clearance Gate (`EG-05`) |
| **Rapid Fix Budget** | Multi-file runaway refactor | Enforces strict $\le 50$-line scoped edit limits (`EG-06`) |
| **Investigation Claims** | Thin, unverifiable claims | Blocked without $\ge 2$ independent evidence citations (`EG-07`) |
| **Self-Approval** | Agent approves own work | Blocked by Role Separation Gate (`EG-08`) |
| **Secret Leaks** | Leaks API tokens into logs | Blocked by automated credential & key regex scanner (`EG-09`) |
| **Unauthorized Deploys** | Sneaky cluster pushes | Blocks deployment commands in non-DEPLOY tasks (`EG-10`) |

---

## 📦 Installation & Setup

### Instant Run (No Installation Needed)
```bash
npx ai-governor init
```

### Install Globally
```bash
npm install -g ai-governor
```

### Add to Existing Project
```bash
npm install --save-dev ai-governor
```

---

## 📄 License
MIT © Saad Qadir
