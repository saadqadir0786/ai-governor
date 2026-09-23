export interface Task {
  task_id: string;
  task_name: string;
  task_type?: 'IMPLEMENTATION' | 'INVESTIGATION' | 'AUDIT' | 'REFACTOR' | 'DEPLOY' | 'BUGFIX' | string;
  role?: string;
  status: 'PENDING' | 'ACTIVE' | 'READY_FOR_REVIEW' | 'REWORK' | 'COMPLETED' | 'CANCELLED';
  content?: string;
  notes?: string;
  deliverables?: string[] | string;
  selfReview?: string;
  testResults?: {
    passed: boolean;
    exitCode: number;
    error?: string;
  };
  rollbackPlan?: string;
  humanApproved?: boolean;
  actions?: string[];
  domain?: string;
  lineCount?: number;
  sources?: string[];
  submitted_by?: string;
  last_transition_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Review {
  id?: string;
  taskId?: string;
  review_type: 'SELF_REVIEW' | 'APPROVAL' | 'REJECTION' | string;
  role?: string;
  rating?: number;
  content: string;
  created_at?: string;
}

export interface Report {
  id?: string;
  taskId?: string;
  title: string;
  content?: string;
  created_at?: string;
}

export interface GuardResult {
  passed: boolean;
  reason: string;
  fixHint?: string | null;
  warning?: boolean;
}

export interface GuardEvaluationResult extends GuardResult {
  guardId: string;
  name: string;
}

export interface GuardRunOutcome {
  passed: boolean;
  results: GuardEvaluationResult[];
  failureCount: number;
  warningCount: number;
}

export interface GuardContext {
  task?: Task;
  taskType?: string;
  selfReview?: string | null;
  deliverables?: string[] | string;
  testResults?: { passed: boolean; exitCode: number; error?: string };
  rollbackPlan?: string;
  actions?: string[] | string;
  humanApproved?: boolean;
  domain?: string;
  lineCount?: number;
  sources?: string[];
  reviews?: Review[];
  reports?: Report[];
  content?: string;
  projectRoot?: string;
  callerRole?: string;
  targetStatus?: string;
  [key: string]: unknown;
}

export interface TransitionOutcome {
  result: 'PASS' | 'FAIL' | 'ERROR' | 'STATE_CONFLICT' | 'INVALID_TRANSITION';
  previousStatus?: string;
  newStatus?: string;
  targetStatus?: string;
  dryRun?: boolean;
  guardResults?: GuardEvaluationResult[];
  message?: string;
  error?: string;
}

export interface AvailableTransition {
  fromState: string;
  targetState: string;
  canTransition: boolean;
  result: string;
  error?: string;
  guardResults: GuardEvaluationResult[];
}

export interface AvailableTransitionsOutcome {
  taskId: string;
  currentStatus: string;
  callerRole: string;
  transitions: AvailableTransition[];
  error?: string;
}

export declare const TASK_STATES: {
  readonly PENDING: 'PENDING';
  readonly ACTIVE: 'ACTIVE';
  readonly READY_FOR_REVIEW: 'READY_FOR_REVIEW';
  readonly REWORK: 'REWORK';
  readonly COMPLETED: 'COMPLETED';
  readonly CANCELLED: 'CANCELLED';
};

export declare const ALLOWED_TRANSITIONS: Record<string, string[]>;

export declare class MemoryBackend {
  constructor();
  createTask(task: Partial<Task>): Promise<Task>;
  getTask(taskId: string): Promise<Task | null>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<Task>;
  listTasks(filter?: { status?: string; role?: string }): Promise<Task[]>;
  addReview(taskId: string, review: Partial<Review>): Promise<Review>;
  getReviews(taskId: string): Promise<Review[]>;
  addReport(taskId: string, report: Partial<Report>): Promise<Report>;
  getReports(taskId: string): Promise<Report[]>;
  recordEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>;
  getEvents(taskId?: string | null): Promise<Record<string, unknown>[]>;
}

export declare class FileBackend extends MemoryBackend {
  constructor(storageDir?: string);
  load(): void;
  save(): void;
}

export declare class TransitionEngine {
  constructor(backend: MemoryBackend);
  transitionTask(
    taskId: string,
    targetStatus: string,
    callerRole?: string,
    options?: {
      dryRun?: boolean;
      guardIds?: string[];
      projectRoot?: string;
      expectedCurrentStatus?: string;
      contextOverrides?: Record<string, unknown>;
    }
  ): Promise<TransitionOutcome>;

  getAvailableTransitions(
    taskId: string,
    callerRole?: string,
    options?: Record<string, unknown>
  ): Promise<AvailableTransitionsOutcome>;
}

export declare class AuditLogger {
  constructor(options?: { storageDir?: string });
  log(event: Record<string, unknown>): Record<string, unknown> | null;
  readLogs(): Record<string, unknown>[];
  getMetrics(): {
    totalEvents: number;
    passedTransitions: number;
    failedTransitions: number;
    passRate: string;
    guardFailureHotspots: Record<string, number>;
  };
}

export declare function registerGuard(
  id: string,
  name: string,
  evaluateFn: (ctx: GuardContext) => Promise<GuardResult> | GuardResult,
  options?: { overwrite?: boolean; description?: string }
): void;

export declare function runGuards(ctx: GuardContext, guardIds?: string[] | null): Promise<GuardRunOutcome>;
export declare function getRegisteredGuards(): Array<{ id: string; name: string; description: string }>;
export declare function registerBuiltinGuards(): void;

export declare function guardSelfReview(ctx: GuardContext): GuardResult;
export declare function guardDeliverables(ctx: GuardContext): GuardResult;
export declare function guardTestProof(ctx: GuardContext): GuardResult;
export declare function guardRollbackPlan(ctx: GuardContext): GuardResult;
export declare function guardClearanceGate(ctx: GuardContext): GuardResult;
export declare function guardScopedEdit(ctx: GuardContext): GuardResult;
export declare function guardAuditMultiSource(ctx: GuardContext): GuardResult;
export declare function guardRoleSeparation(ctx: GuardContext): GuardResult;
export declare function guardNoSecrets(ctx: GuardContext): GuardResult;
export declare function guardNoImpliedDeploys(ctx: GuardContext): GuardResult;
export declare function isPathContained(basePath: string, candidatePath: string): boolean;

export declare function detectEnvironment(targetDir?: string): Promise<{
  targetDir: string;
  ides: Array<{ id: string; name: string; active: boolean; reason: string }>;
  keys: { gemini: boolean; anthropic: boolean; openrouter: boolean; openai: boolean };
  ollamaModels: string[];
  stack: { isNode: boolean; isPython: boolean; isRust: boolean; isGo: boolean; framework: string; testingFramework: string };
  availableModels: string[];
}>;

export declare function computeRoleAssignments(
  availableModels: string[],
  registry: Record<string, unknown>
): Record<string, {
  domain: string;
  domainTitle: string;
  assignedModelId: string;
  assignedModelName: string;
  intensity: string;
  clearance: string;
  fallbackModelId: string;
  allowedActions: string[];
  forbiddenActions: string[];
}>;

export declare function runGovernor(options?: {
  targetDir?: string;
  dryRun?: boolean;
  logger?: (msg: string) => void;
}): Promise<{
  env: unknown;
  registrySource: string;
  assignments: unknown;
  generatedFiles: Array<{ filePath: string; content: string; name: string }>;
}>;

export declare const TASK_DOMAINS: Record<string, unknown>;
export declare const HUMAN_CLEARANCE_MATRIX: Record<string, unknown>;
