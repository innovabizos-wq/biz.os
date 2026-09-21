import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  brainWorkflowEngine,
  initialBrainAgents,
  initialBrainAutomationJobs,
  initialBrainTaskSuccessMetrics,
  initialBrainWorkflows,
} from "@/modules/brain/runtime";
import type {
  BrainWorkflowAuditEvent,
  BrainWorkflowExecutionResult,
  BrainWorkflowId,
  BrainWorkflowPlan,
  BrainWorkflowPlannedStep,
} from "@/modules/brain/runtime/contracts";
import { executeBrainCatalogWorkflowDurably } from "@/modules/brain/runtime/durable-skill-workflow";
import { canManageBrain } from "@/modules/brain/queries";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail } from "@/types/core";

type PrepareWorkflowInput = {
  id?: string;
  inputsByStep?: Record<string, JsonRecord>;
  workflowId?: string;
};

type ExecuteWorkflowInput = PrepareWorkflowInput & {
  approvals?: Record<string, boolean>;
  idempotencyPrefix?: string;
  inputsByStep?: Record<string, JsonRecord>;
};

function isBrainWorkflowId(value: unknown): value is BrainWorkflowId {
  return (
    typeof value === "string" &&
    initialBrainWorkflows.some((workflow) => workflow.id === value)
  );
}

async function writeWorkflowAudit(
  tenant: TenantContext,
  plan: BrainWorkflowPlan | BrainWorkflowExecutionResult,
  mode: "execute" | "prepare",
) {
  const supabase = await createClient();
  const rows = plan.auditEvents.map((event: BrainWorkflowAuditEvent) => ({
    accion: `brain.workflow.${mode}.${event.status}`,
    datos_antes: null,
    datos_despues: {
      capabilityId: event.capabilityId ?? null,
      metricEvents: plan.metrics,
      planId: plan.id,
      skillId: event.skillId ?? null,
      status: event.status,
      stepId: event.stepId ?? null,
      workflowId: event.workflowId,
    } satisfies JsonRecord,
    empresa_id: tenant.empresaId,
    entidad: "brain_workflow",
    entidad_id: plan.id,
    ip: null,
    metadata: {
      message: event.message,
      mode,
      occurredAt: event.occurredAt,
      status: plan.status,
      workflowId: plan.workflowId,
    } satisfies JsonRecord,
    sucursal_id: tenant.sucursalId ?? null,
    user_agent: null,
    usuario_id: tenant.profileId,
  }));

  if (rows.length === 0) return;
  await supabase.from("auditoria_eventos").insert(rows);
}

function planStatusFromWorkflow(
  plan: BrainWorkflowPlan | BrainWorkflowExecutionResult,
) {
  if (plan.status === "completed") return "completed";
  if (plan.status === "failed" || plan.status === "blocked") return "failed";
  if (plan.inputsReady) return "approved";
  if (plan.status === "pending_approval") return "pending_approval";
  return "draft";
}

function stepStatusFromWorkflow(step: BrainWorkflowPlannedStep) {
  if (step.status === "completed") return "completed";
  if (step.status === "failed" || step.status === "blocked") return "failed";
  if (step.status === "pending_approval") return "confirmation_required";
  if (step.status === "ready") return "approved";
  return "pending";
}

async function persistWorkflowActionPlan(
  tenant: TenantContext,
  plan: BrainWorkflowPlan | BrainWorkflowExecutionResult,
) {
  if (!canManageBrain(tenant)) return;

  const workflow = initialBrainWorkflows.find((item) => item.id === plan.workflowId);
  const supabase = await createClient();
  const { error: planError } = await supabase
    .from("brain_action_plans")
    .upsert(
      {
        approval_required: plan.steps.some((step) => step.requiresApproval),
        approved_at: plan.status === "completed" ? new Date().toISOString() : null,
        approved_by: plan.status === "completed" ? tenant.profileId : null,
        created_by: tenant.profileId,
        description:
          workflow?.description ??
          "Workflow Brain preparado desde el Runtime de inteligencia empresarial.",
        empresa_id: tenant.empresaId,
        expected_impact: "Completar una tarea empresarial multi-paso desde Biz.Brain.",
        id: plan.id,
        recommendation_id: null,
        risk_level: "high",
        source_modules: workflow?.agentIds ?? ["brain"],
        status: planStatusFromWorkflow(plan),
        title: workflow?.name ?? `Workflow ${plan.workflowId}`,
      },
      { onConflict: "id,empresa_id" },
    );

  if (planError) return;

  const rows = plan.steps.map((step, index) => ({
    action_id: step.skillId ?? step.capabilityId,
    description: step.reason,
    empresa_id: tenant.empresaId,
    executed_at: step.status === "completed" ? new Date().toISOString() : null,
    payload: {
      capabilityId: step.capabilityId,
      input: plan.inputsByStep[step.id] ?? {},
      stepId: step.id,
      workflowId: plan.workflowId,
    } satisfies JsonRecord,
    plan_id: plan.id,
    requires_confirmation: step.requiresApproval,
    result: {
      reason: step.reason,
      skillId: step.skillId,
      status: step.status,
    } satisfies JsonRecord,
    status: stepStatusFromWorkflow(step),
    step_order: index + 1,
    title: step.name,
  }));

  if (rows.length > 0) {
    await supabase
      .from("brain_plan_steps")
      .upsert(rows, { onConflict: "empresa_id,plan_id,step_order" });
  }
}

export function listBrainWorkflowCatalog(tenant: TenantContext) {
  const activeModules = new Set(tenant.activeModules);
  const permissions = new Set(tenant.permissions);

  const agents = initialBrainAgents.map((agent) => ({
    ...agent,
    available:
      activeModules.has(agent.module) &&
      agent.requiredPermissions.every((permission) => permissions.has(permission)),
  }));

  return {
    agents,
    automationJobs: initialBrainAutomationJobs,
    metrics: initialBrainTaskSuccessMetrics,
    workflows: initialBrainWorkflows,
  };
}

export async function prepareBrainWorkflow(
  tenant: TenantContext,
  input: PrepareWorkflowInput,
): Promise<CoreResult<BrainWorkflowPlan>> {
  if (!isBrainWorkflowId(input.workflowId)) {
    return fail("VALIDATION_ERROR", "El workflow solicitado no existe.");
  }

  const result = brainWorkflowEngine.prepare({
    id: input.id,
    inputsByStep: input.inputsByStep,
    tenant,
    workflowId: input.workflowId,
  });

  if (result.ok) {
    await writeWorkflowAudit(tenant, result.data, "prepare");
    await persistWorkflowActionPlan(tenant, result.data);
  }

  return result;
}

export async function executeBrainWorkflow(
  tenant: TenantContext,
  input: ExecuteWorkflowInput,
): Promise<CoreResult<BrainWorkflowExecutionResult>> {
  if (!isBrainWorkflowId(input.workflowId)) {
    return fail("VALIDATION_ERROR", "El workflow solicitado no existe.");
  }

  const durable = await executeBrainCatalogWorkflowDurably({
    approvals: input.approvals,
    id: input.id,
    idempotencyPrefix: input.idempotencyPrefix,
    inputsByStep: input.inputsByStep,
    source: {
      channel: "brain",
      module: "brain",
      surface: "brain.workflow.execute",
    },
    tenant,
    workflowId: input.workflowId,
  });
  const result = durable.result;

  if (result.ok) {
    result.data.auditEvents.push({
      message: `Workflow durable ${durable.workflowRunId}.`,
      occurredAt: new Date().toISOString(),
      status: result.data.status,
      workflowId: result.data.workflowId,
    });
    await writeWorkflowAudit(tenant, result.data, "execute");
    await persistWorkflowActionPlan(tenant, result.data);
  }

  return result;
}
