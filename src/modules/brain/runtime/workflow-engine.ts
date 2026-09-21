import { randomUUID } from "node:crypto";

import type {
  BrainRuntime,
  BrainSourceContext,
  BrainTaskSuccessMetricDefinition,
  BrainWorkflowAuditEvent,
  BrainWorkflowDefinition,
  BrainWorkflowExecutionResult,
  BrainWorkflowId,
  BrainWorkflowMetricEvent,
  BrainWorkflowPlan,
  BrainWorkflowPlannedStep,
  BrainWorkflowRuntimeStatus,
  BusinessSkillRegistry,
  CapabilityRegistry,
} from "@/modules/brain/runtime/contracts";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type WorkflowEngineInput = {
  capabilities: CapabilityRegistry;
  metrics: BrainTaskSuccessMetricDefinition[];
  runtime?: BrainRuntime;
  skills: BusinessSkillRegistry;
  workflows: BrainWorkflowDefinition[];
};

type PrepareWorkflowInput = {
  id?: string;
  inputsByStep?: Record<string, JsonRecord>;
  tenant: TenantContext;
  workflowId: BrainWorkflowId;
};

type ExecuteWorkflowInput = PrepareWorkflowInput & {
  approvals?: Record<string, boolean>;
  idempotencyPrefix?: string;
  inputsByStep?: Record<string, JsonRecord>;
  source?: BrainSourceContext;
};

function now() {
  return new Date().toISOString();
}

function audit(
  workflowId: BrainWorkflowId,
  input: Omit<BrainWorkflowAuditEvent, "occurredAt" | "workflowId">,
): BrainWorkflowAuditEvent {
  return {
    occurredAt: now(),
    workflowId,
    ...input,
  };
}

function aggregateStatus(steps: BrainWorkflowPlannedStep[]): BrainWorkflowRuntimeStatus {
  if (steps.some((step) => step.status === "blocked")) return "blocked";
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.some((step) => step.status === "pending_approval")) {
    return "pending_approval";
  }
  if (steps.every((step) => step.status === "planned")) return "planned";
  if (steps.some((step) => step.status === "planned")) return "planned";
  if (steps.every((step) => step.status === "completed")) return "completed";
  return "ready";
}

function metric(
  metricId: string,
  workflowId: BrainWorkflowId,
  measure: BrainWorkflowMetricEvent["measure"],
  value: number,
): BrainWorkflowMetricEvent {
  return {
    id: metricId,
    measure,
    value,
    workflowId,
  };
}

function sourceForWorkflow(
  workflowId: BrainWorkflowId,
  step: BrainWorkflowPlannedStep,
  source?: BrainSourceContext,
): BrainSourceContext {
  return {
    channel: source?.channel ?? "brain",
    correlationId: source?.correlationId,
    module: source?.module,
    surface: source?.surface ?? `workflow:${workflowId}:${step.id}`,
  };
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function setStepInputDefaults(
  inputsByStep: Record<string, JsonRecord>,
  stepId: string,
  values: JsonRecord,
) {
  const current = inputsByStep[stepId] ?? {};
  inputsByStep[stepId] = {
    ...values,
    ...current,
  };
}

function propagateWorkflowResult(
  inputsByStep: Record<string, JsonRecord>,
  resultData: JsonRecord,
) {
  const quoteReference = firstString(
    resultData.quoteNumber,
    resultData.quoteReference,
    resultData.quoteId,
    resultData.cotizacionId,
  );
  const saleReference = firstString(
    resultData.saleNumber,
    resultData.saleReference,
    resultData.saleId,
  );

  if (quoteReference) {
    setStepInputDefaults(inputsByStep, "confirm_sale", { quoteReference });
    setStepInputDefaults(inputsByStep, "create_followup", { quoteReference });
  }

  if (saleReference) {
    setStepInputDefaults(inputsByStep, "generate_receivable", { saleReference });
    setStepInputDefaults(inputsByStep, "prepare_dispatch", { saleReference });
    setStepInputDefaults(inputsByStep, "create_followup", { saleReference });
  }

  setStepInputDefaults(inputsByStep, "create_followup", {
    title: "Seguimiento despues del workflow comercial",
  });
}

function summarizeInputIssues(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    const issueLabels = (error as { issues: Array<{ path?: unknown[] }> }).issues
      .map((issue) => issue.path?.filter((part) => typeof part === "string").join("."))
      .filter((path): path is string => Boolean(path))
      .slice(0, 4);

    if (issueLabels.length > 0) {
      return `Faltan datos o hay datos invalidos: ${issueLabels.join(", ")}.`;
    }
  }

  return "Faltan datos o hay datos invalidos para ejecutar este paso.";
}

export function createBrainWorkflowEngine(input: WorkflowEngineInput) {
  function getWorkflow(workflowId: BrainWorkflowId) {
    return input.workflows.find((workflow) => workflow.id === workflowId) ?? null;
  }

  function successMetricFor(workflow: BrainWorkflowDefinition) {
    return (
      input.metrics.find((item) => item.id === workflow.successMetricId) ??
      null
    );
  }

  function prepareStep(
    tenant: TenantContext,
    step: BrainWorkflowDefinition["steps"][number],
    stepInput: JsonRecord | undefined,
  ): BrainWorkflowPlannedStep {
    const base = {
      capabilityId: step.capabilityId,
      dependsOn: step.dependsOn ?? [],
      id: step.id,
      name: step.name,
      required: step.required,
      requiresApproval: step.requiresApproval,
    };
    const capability = input.capabilities.get(step.capabilityId);
    if (!capability) {
      return {
        ...base,
        reason: "La capability no existe en el catalogo.",
        skillId: null,
        status: "blocked",
      };
    }

    const binding = input.capabilities.getImplementedBinding(capability.id);
    if (!binding) {
      return {
        ...base,
        reason: "La capability existe, pero todavia no tiene Skill ejecutable.",
        skillId: null,
        status: "planned",
      };
    }

    const skill = input.skills.get(binding.skillId);
    if (!skill) {
      return {
        ...base,
        reason: "La Skill vinculada no esta registrada.",
        skillId: binding.skillId,
        status: "blocked",
      };
    }

    const availableSkillIds = new Set(
      input.skills.getAvailable(tenant).map((availableSkill) => availableSkill.id),
    );
    if (!availableSkillIds.has(skill.id)) {
      return {
        ...base,
        reason: "La Skill existe, pero no esta disponible por modulo activo o permisos.",
        skillId: skill.id,
        status: "blocked",
      };
    }

    const requiresApproval = step.requiresApproval || skill.requiresConfirmation;
    const parsedInput = skill.inputSchema.safeParse(stepInput ?? {});

    if (!parsedInput.success) {
      return {
        ...base,
        reason: summarizeInputIssues(parsedInput.error),
        requiresApproval,
        skillId: skill.id,
        status: "planned",
      };
    }

    return {
      ...base,
      reason: requiresApproval
        ? "Requiere aprobacion antes de ejecutarse."
        : null,
      requiresApproval,
      skillId: skill.id,
      status: requiresApproval ? "pending_approval" : "ready",
    };
  }

  function prepare(request: PrepareWorkflowInput): CoreResult<BrainWorkflowPlan> {
    const workflow = getWorkflow(request.workflowId);
    if (!workflow) {
      return fail("VALIDATION_ERROR", "El workflow solicitado no existe.");
    }

    const steps = workflow.steps.map((step) =>
      prepareStep(request.tenant, step, request.inputsByStep?.[step.id]),
    );
    const status = aggregateStatus(steps);
    const inputsReady = steps.every((step) =>
      step.status === "ready" ||
      step.status === "pending_approval" ||
      step.status === "completed",
    );
    const auditEvents = steps.map((step) =>
      audit(workflow.id, {
        capabilityId: step.capabilityId,
        message: step.reason ?? `Step ${step.name} lista para ejecucion.`,
        skillId: step.skillId ?? undefined,
        status: step.status,
        stepId: step.id,
      }),
    );
    const metricDefinition = successMetricFor(workflow);
    const metrics = metricDefinition
      ? [
          metric(
            metricDefinition.id,
            workflow.id,
            status === "pending_approval"
              ? "task_pending_approval"
              : status === "blocked" || status === "failed"
                ? "task_failed"
                : "task_completed",
            status === "ready" || status === "completed" ? 1 : 0,
          ),
        ]
      : [];

    return ok({
      auditEvents,
      id: request.id ?? randomUUID(),
      inputsByStep: request.inputsByStep ?? {},
      inputsReady,
      metrics,
      status,
      steps,
      workflowId: workflow.id,
    });
  }

  async function execute(
    request: ExecuteWorkflowInput,
  ): Promise<CoreResult<BrainWorkflowExecutionResult>> {
    if (!input.runtime) {
      return fail(
        "MODULE_MISCONFIGURED",
        "Brain Workflow Engine no tiene Brain Runtime configurado.",
      );
    }

    const plan = prepare(request);
    if (!plan.ok) return plan;

    const steps = [...plan.data.steps];
    const workflow = getWorkflow(request.workflowId);
    const inputsByStep = { ...(plan.data.inputsByStep ?? {}) };
    const auditEvents = [...plan.data.auditEvents];
    const maxConcurrency = Math.min(Math.max(workflow?.maxConcurrency ?? 2, 1), 6);
    let madeProgress = true;

    while (madeProgress) {
      madeProgress = false;
      const completedIds = new Set(
        steps.filter((step) => step.status === "completed").map((step) => step.id),
      );
      const failedIds = new Set(
        steps
          .filter((step) => step.status === "failed" || step.status === "blocked")
          .map((step) => step.id),
      );

      for (const step of steps) {
        const dependencies = step.dependsOn ?? [];
        if (dependencies.some((dependency) => failedIds.has(dependency))) {
          step.status = "blocked";
          step.reason = "Una dependencia requerida fallo o fue bloqueada.";
          continue;
        }
        if (
          step.status === "planned" &&
          dependencies.every((dependency) => completedIds.has(dependency)) &&
          workflow
        ) {
          const definition = workflow.steps.find((item) => item.id === step.id);
          if (definition) {
            Object.assign(
              step,
              prepareStep(request.tenant, definition, inputsByStep[step.id]),
            );
          }
        }
      }

      const ready = steps
        .filter((step) => {
          if (step.status !== "ready" && step.status !== "pending_approval") return false;
          if (!(step.dependsOn ?? []).every((dependency) => completedIds.has(dependency))) {
            return false;
          }
          return !step.requiresApproval || Boolean(request.approvals?.[step.id]);
        })
        .slice(0, maxConcurrency);
      if (ready.length === 0) break;

      const batch = await Promise.all(
        ready.map(async (step) => {
          if (!step.skillId) return { result: null, step };
          const result = await input.runtime?.invoke({
            approval: step.requiresApproval
              ? {
                  confirmed: true,
                  reference: `workflow:${plan.data.id}:step:${step.id}`,
                }
              : undefined,
            idempotencyKey:
              request.idempotencyPrefix != null
                ? `${request.idempotencyPrefix}:${plan.data.id}:${step.id}`
                : undefined,
            input: inputsByStep[step.id] ?? {},
            skillId: step.skillId,
            source: sourceForWorkflow(request.workflowId, step, request.source),
            tenant: request.tenant,
          });
          return { result: result ?? null, step };
        }),
      );

      for (const { result, step } of batch) {
        madeProgress = true;
        if (!result) {
          step.status = "blocked";
          step.reason = "La Skill del paso no esta disponible.";
          continue;
        }
        if (!result.ok) {
          step.status = "failed";
          step.reason = result.error.message;
          auditEvents.push(
            audit(request.workflowId, {
              capabilityId: step.capabilityId,
              message: result.error.message,
              skillId: step.skillId ?? undefined,
              status: "failed",
              stepId: step.id,
            }),
          );
          continue;
        }
        step.status = "completed";
        step.reason = result.data.message;
        propagateWorkflowResult(inputsByStep, result.data.data);
        auditEvents.push(
          audit(request.workflowId, {
            capabilityId: step.capabilityId,
            message: result.data.message,
            skillId: step.skillId ?? undefined,
            status: "completed",
            stepId: step.id,
          }),
        );
      }
    }

    const completedSteps = steps.filter((step) => step.status === "completed").length;
    const failedSteps = steps.filter(
      (step) => step.status === "failed" || step.status === "blocked",
    ).length;
    const pendingApprovalSteps = steps.filter(
      (step) => step.status === "pending_approval" && !request.approvals?.[step.id],
    ).length;

    const status = aggregateStatus(steps);
    const metricDefinition = workflow ? successMetricFor(workflow) : null;
    const metrics = metricDefinition
      ? [
          metric(
            metricDefinition.id,
            request.workflowId,
            status === "completed"
              ? "task_completed"
              : pendingApprovalSteps > 0
                ? "task_pending_approval"
                : "task_failed",
            status === "completed" ? 1 : 0,
          ),
        ]
      : [];

    return ok({
      ...plan.data,
      auditEvents,
      completedSteps,
      failedSteps,
      inputsByStep,
      metrics,
      pendingApprovalSteps,
      status,
      steps,
    });
  }

  return {
    execute,
    prepare,
  };
}
