import type { z } from "zod";

import type {
  CoreResult,
  JsonRecord,
  ModuleCode,
  PermissionCode,
  TenantContext,
} from "@/types/core";

export type BusinessSkillKind = "analysis" | "command" | "draft" | "query";
export type BusinessSkillIdempotency = "none" | "required";
export type BusinessSkillRisk = "critical" | "high" | "low" | "medium";
export type BrainAudience = "customer" | "internal" | "agent" | "system";
export type BrainAgentId =
  | "compras"
  | "contenido"
  | "finanzas"
  | "inventario"
  | "logistica"
  | "marketing"
  | "operaciones"
  | "rrhh"
  | "soporte"
  | "ventas";
export type BrainAutomationJobId =
  | "collections.overdue.scan"
  | "conversations.sla.overdue.scan"
  | "inventory.low_stock.scan"
  | "quotes.expired.scan";
export type BrainWorkflowId =
  | "commercial.quote_to_dispatch"
  | "commercial.sale_confirmation"
  | "crm.followup_after_sale";
export type BrainWorkflowStepStatus =
  | "approval_required"
  | "planned"
  | "ready";
export type BrainWorkflowRuntimeStatus =
  | "blocked"
  | "completed"
  | "failed"
  | "pending_approval"
  | "planned"
  | "ready";
export type CapabilityStatus = "implemented" | "planned" | "blocked";
export type SlotRequirementType =
  | "array"
  | "boolean"
  | "date"
  | "email"
  | "number"
  | "object"
  | "phone"
  | "string"
  | "uuid";

export type BrainSourceContext = {
  audience?: BrainAudience;
  channel:
    | "agent"
    | "api"
    | "automation"
    | "bar"
    | "brain"
    | "event"
    | "job"
    | "module"
    | "system"
    | "user"
    | "webhook";
  correlationId?: string;
  entity?: {
    id?: string;
    label?: string;
    type: string;
  };
  module?: ModuleCode;
  selection?: string;
  surface: string;
  timezone?: string;
};

export type SlotRequirement = {
  aliases?: string[];
  clarification: string;
  description?: string;
  name: string;
  required: boolean;
  type: SlotRequirementType;
};

export type BusinessIntentDefinition = {
  capabilityId: string;
  description: string;
  enabled: boolean;
  examples: string[];
  id: string;
  module: ModuleCode;
  optionalSlots?: SlotRequirement[];
  requiredSlots: SlotRequirement[];
};

export type SkillBinding = {
  capabilityId: string;
  priority: number;
  skillId: string;
  status: CapabilityStatus;
  version: string;
};

export type CapabilityDefinition = {
  description: string;
  enabled: boolean;
  id: string;
  kind: BusinessSkillKind;
  module: ModuleCode;
  name: string;
  requiredPermissions: PermissionCode[];
  skillBindings: SkillBinding[];
  status: CapabilityStatus;
  version: string;
};

export type BusinessIntentResolution = {
  capabilityId: string;
  confidence: number;
  entities: JsonRecord;
  intentId: string;
  source: "deterministic" | "llm" | "manual";
};

export type ContextRequest = {
  capabilityId: string;
  entities: JsonRecord;
  intentId: string;
  source: BrainSourceContext;
  tenant: TenantContext;
};

export type ContextBuilderResult = {
  evidence: BrainEvidence[];
  facts: JsonRecord;
  freshnessAt: string;
};

export type ClarificationResult = {
  capabilityId: string;
  intentId: string;
  message: string;
  missingSlots: SlotRequirement[];
};

export type CapabilityRegistry = {
  get(capabilityId: string): CapabilityDefinition | null;
  getImplementedBinding(capabilityId: string): SkillBinding | null;
  list(): CapabilityDefinition[];
};

export type BusinessIntentRegistry = {
  get(intentId: string): BusinessIntentDefinition | null;
  list(): BusinessIntentDefinition[];
};

export type ContextBuilder = {
  build(request: ContextRequest): Promise<CoreResult<ContextBuilderResult>>;
};

export type BrainEvidence = {
  count?: number;
  entityId?: string;
  entityType?: string;
  freshnessAt: string;
  href?: string;
  source: string;
};

export type BrainResultLink = {
  href: string;
  label: string;
};

export type BrainWorkflowStepDefinition = {
  capabilityId: string;
  dependsOn?: string[];
  id: string;
  name: string;
  required: boolean;
  requiresApproval: boolean;
  status: BrainWorkflowStepStatus;
};

export type BrainWorkflowDefinition = {
  agentIds: BrainAgentId[];
  description: string;
  id: BrainWorkflowId;
  maxConcurrency?: number;
  name: string;
  successMetricId: string;
  steps: BrainWorkflowStepDefinition[];
  version: string;
};

export type BrainAgentDefinition = {
  budget: {
    maxCostUsd: number;
    maxDurationSeconds: number;
    maxTokens: number;
  };
  capabilityIds: string[];
  description: string;
  id: BrainAgentId;
  instructions: string[];
  limits: {
    maxConcurrentTasks: number;
    maxDelegationDepth: number;
  };
  module: ModuleCode;
  name: string;
  requiredPermissions: PermissionCode[];
  successCriteria: string[];
  version: string;
};

export type BrainTeamTaskStatus =
  | "blocked"
  | "cancelled"
  | "completed"
  | "failed"
  | "pending"
  | "running"
  | "waiting_human";

export type BrainTeamTask = {
  agentId: BrainAgentId;
  dependsOn: string[];
  description: string;
  id: string;
  input: JsonRecord;
  skillId: string;
  status: BrainTeamTaskStatus;
  successCriteria: string;
};

export type BrainTeamPlan = {
  budget: {
    maxCostUsd: number;
    maxDurationSeconds: number;
    maxTokens: number;
  };
  id: string;
  maxConcurrency: number;
  objective: string;
  tasks: BrainTeamTask[];
};

export type BrainWorkItemStatus =
  | "blocked"
  | "cancelled"
  | "completed"
  | "in_progress"
  | "needs_changes"
  | "open";

export type BrainWorkItem = {
  assignedProfileId: string;
  attachments: JsonRecord[];
  comments: JsonRecord[];
  createdAt: string;
  description: string;
  id: string;
  priority: "critical" | "high" | "low" | "medium";
  result: JsonRecord;
  runId: string | null;
  slaDueAt: string | null;
  status: BrainWorkItemStatus;
  teamRunId: string | null;
  title: string;
};

export type BrainAutomationJobDefinition = {
  capabilityId: string;
  description: string;
  id: BrainAutomationJobId;
  module: ModuleCode;
  name: string;
  schedule: "manual" | "hourly" | "daily";
  version: string;
};

export type BrainTaskSuccessMetricDefinition = {
  description: string;
  id: string;
  measures: "task_completed" | "task_failed" | "task_pending_approval";
  name: string;
  workflowId?: BrainWorkflowId;
};

export type BrainWorkflowPlannedStep = {
  capabilityId: string;
  dependsOn?: string[];
  id: string;
  name: string;
  reason: string | null;
  required: boolean;
  requiresApproval: boolean;
  skillId: string | null;
  status: BrainWorkflowRuntimeStatus;
};

export type BrainWorkflowMetricEvent = {
  id: string;
  measure: BrainTaskSuccessMetricDefinition["measures"];
  value: number;
  workflowId: BrainWorkflowId;
};

export type BrainWorkflowAuditEvent = {
  capabilityId?: string;
  message: string;
  occurredAt: string;
  skillId?: string;
  status: BrainWorkflowRuntimeStatus;
  stepId?: string;
  workflowId: BrainWorkflowId;
};

export type BrainWorkflowPlan = {
  auditEvents: BrainWorkflowAuditEvent[];
  id: string;
  inputsByStep: Record<string, JsonRecord>;
  inputsReady: boolean;
  metrics: BrainWorkflowMetricEvent[];
  status: BrainWorkflowRuntimeStatus;
  steps: BrainWorkflowPlannedStep[];
  workflowId: BrainWorkflowId;
};

export type BrainWorkflowExecutionResult = BrainWorkflowPlan & {
  completedSteps: number;
  failedSteps: number;
  pendingApprovalSteps: number;
};

export type BusinessSkillExecutionContext = {
  idempotencyKey?: string;
  invocationId: string;
  source: BrainSourceContext;
  tenant: TenantContext;
};

export type BusinessSkillHandlerResult<TOutput = JsonRecord> = {
  data: TOutput;
  evidence?: BrainEvidence[];
  links?: BrainResultLink[];
  message: string;
};

export type BusinessSkillDefinition<
  TInput extends JsonRecord = JsonRecord,
  TOutput extends JsonRecord = JsonRecord,
> = {
  description: string;
  enabled: boolean;
  execute(
    input: TInput,
    context: BusinessSkillExecutionContext,
  ): Promise<CoreResult<BusinessSkillHandlerResult<TOutput>>>;
  id: string;
  idempotency: BusinessSkillIdempotency;
  inputSchema: z.ZodType<TInput>;
  kind: BusinessSkillKind;
  legacyActionId?: string;
  module: ModuleCode;
  name: string;
  outputSchema: z.ZodType<TOutput>;
  requiredPermissions: PermissionCode[];
  requiresConfirmation: boolean;
  risk: BusinessSkillRisk;
  version: string;
};

export type BusinessSkillInvocation = {
  approval?: {
    confirmed: boolean;
    reference?: string;
  };
  idempotencyKey?: string;
  input?: JsonRecord;
  skillId: string;
  source: BrainSourceContext;
  tenant: TenantContext;
};

export type BusinessSkillResult<TOutput = JsonRecord> = {
  cached: boolean;
  data: TOutput;
  durationMs: number;
  evidence: BrainEvidence[];
  executedAt: string;
  invocationId: string;
  links: BrainResultLink[];
  message: string;
  skillId: string;
};

export type BrainPolicyDecision = {
  allowed: boolean;
  reason: string | null;
};

export type BrainPolicyEngine = {
  authorize(
    tenant: TenantContext,
    skill: BusinessSkillDefinition,
  ): CoreResult<BrainPolicyDecision>;
};

export type BusinessSkillRegistry = {
  exists(skillId: string): boolean;
  get(skillId: string): BusinessSkillDefinition | null;
  getAvailable(tenant: TenantContext): BusinessSkillDefinition[];
  getByLegacyActionId(actionId: string): BusinessSkillDefinition | null;
  list(): BusinessSkillDefinition[];
  register(skill: BusinessSkillDefinition): CoreResult<BusinessSkillDefinition>;
};

export type BrainSkillTraceStatus = "blocked" | "error" | "success";

export type BrainSkillTraceEvent = {
  durationMs: number;
  errorCode?: string;
  invocationId: string;
  occurredAt: string;
  skillId: string;
  source: BrainSourceContext;
  status: BrainSkillTraceStatus;
  tenant: TenantContext;
};

export type BrainSkillTraceRecorder = {
  record(event: BrainSkillTraceEvent): Promise<void>;
};

export type BrainSkillExecutionClaim = {
  cachedResult?: BusinessSkillResult;
  status: "claimed" | "completed";
};

export type BrainSkillExecutionStore = {
  claim(input: {
    empresaId: string;
    idempotencyKey: string;
    inputHash: string;
    invocationId: string;
    profileId: string;
    skillId: string;
  }): Promise<CoreResult<BrainSkillExecutionClaim>>;
  complete(input: {
    empresaId: string;
    idempotencyKey: string;
    profileId: string;
    result: BusinessSkillResult;
    skillId: string;
  }): Promise<CoreResult<null>>;
  fail(input: {
    empresaId: string;
    error: JsonRecord;
    idempotencyKey: string;
    profileId: string;
    skillId: string;
  }): Promise<void>;
};

export type BusinessSkillExecutor = {
  invoke<TOutput = JsonRecord>(
    invocation: BusinessSkillInvocation,
  ): Promise<CoreResult<BusinessSkillResult<TOutput>>>;
};

export type BrainRequest = BusinessSkillInvocation;
export type BrainResponse<TOutput = JsonRecord> = BusinessSkillResult<TOutput>;

export type BrainRuntime = {
  invoke<TOutput = JsonRecord>(
    request: BrainRequest,
  ): Promise<CoreResult<BrainResponse<TOutput>>>;
};

export function defineBusinessSkill<
  TInput extends JsonRecord,
  TOutput extends JsonRecord,
>(
  definition: BusinessSkillDefinition<TInput, TOutput>,
): BusinessSkillDefinition {
  return definition as unknown as BusinessSkillDefinition;
}
