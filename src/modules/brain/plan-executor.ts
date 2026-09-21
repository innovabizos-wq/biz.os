import "server-only";

import { createClient } from "@/lib/supabase/server";
import { canManageBrain, getBrainActionPlans } from "@/modules/brain/queries";
import { businessSkillRegistry } from "@/modules/brain/runtime/default-runtime";
import { executeBusinessSkillDurably } from "@/modules/brain/runtime/durable-skill-workflow";
import { requiresBrainApproval } from "@/modules/brain/runtime/policy-engine";
import type { BrainActionPlan, BrainPlanStep } from "@/modules/brain/types";
import { executeBrainWorkflow } from "@/modules/brain/workflow-service";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type PlanExecutionStatus =
  | "completed"
  | "failed"
  | "pending_confirmation"
  | "started";

export async function executeBrainActionPlan(
  tenant: TenantContext,
  planId: string,
): Promise<CoreResult<{ completed: number; failed: number; pendingConfirmation: number }>> {
  if (!canManageBrain(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ejecutar planes Brain.");
  }

  const plans = await getBrainActionPlans(tenant);
  const plan = plans.ok ? plans.data.find((item) => item.id === planId) : null;

  if (!plan) {
    return fail("VALIDATION_ERROR", "No encontre el plan.");
  }

  if (plan.status !== "approved") {
    return fail("VALIDATION_ERROR", "El plan debe estar aprobado antes de ejecutarse.");
  }

  const supabase = await createClient();
  let completed = 0;
  let failed = 0;
  const pendingConfirmation = 0;

  const workflowId = workflowIdFromPlan(plan);

  if (workflowId) {
    await writeActionPlanAudit(supabase, tenant, plan, {
      executionType: "workflow",
      status: "started",
      workflowId,
    });

    const workflowResult = await executeBrainWorkflow(tenant, {
      approvals: Object.fromEntries(
        plan.steps.map((step) => [workflowStepId(step), true]),
      ),
      id: plan.id,
      idempotencyPrefix: `brain-action-plan:${plan.id}`,
      inputsByStep: Object.fromEntries(
        plan.steps.map((step) => [
          workflowStepId(step),
          stepInput(step.payload),
        ]),
      ),
      workflowId,
    });

    if (!workflowResult.ok) {
      await supabase
        .from("brain_action_plans")
        .update({ status: "failed" })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", plan.id);
      await writeActionPlanAudit(supabase, tenant, plan, {
        error: workflowResult.error.message,
        executionType: "workflow",
        status: "failed",
        workflowId,
      });
      return workflowResult;
    }

    await writeActionPlanAudit(supabase, tenant, plan, {
      completed: workflowResult.data.completedSteps,
      executionType: "workflow",
      failed: workflowResult.data.failedSteps,
      pendingConfirmation: workflowResult.data.pendingApprovalSteps,
      status:
        workflowResult.data.failedSteps > 0
          ? "failed"
          : workflowResult.data.pendingApprovalSteps > 0
            ? "pending_confirmation"
            : "completed",
      workflowId,
    });

    return ok({
      completed: workflowResult.data.completedSteps,
      failed: workflowResult.data.failedSteps,
      pendingConfirmation: workflowResult.data.pendingApprovalSteps,
    });
  }

  await supabase
    .from("brain_action_plans")
    .update({ status: "executing" })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", plan.id);
  await writeActionPlanAudit(supabase, tenant, plan, {
    executionType: "action_plan",
    status: "started",
  });

  for (const step of plan.steps) {
    const skill =
      businessSkillRegistry.get(step.actionId) ??
      businessSkillRegistry.getByLegacyActionId(step.actionId);
    if (!skill) {
      failed += 1;
      await supabase
        .from("brain_plan_steps")
        .update({
          result: { error: `La Skill ${step.actionId} ya no está disponible.` } satisfies JsonRecord,
          status: "failed",
        })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", step.id);
      continue;
    }

    const durable = await executeBusinessSkillDurably({
      approval: requiresBrainApproval(skill)
        ? { confirmed: true, reference: `brain-action-plan:${plan.id}` }
        : undefined,
      idempotencyKey:
        skill.idempotency === "required"
          ? `brain-plan:${plan.id}:step:${step.id}`
          : undefined,
      input: stepInput(step.payload),
      skillId: skill.id,
      source: {
        channel: "brain",
        correlationId: plan.id,
        module: skill.module,
        surface: "brain.action_plan.execute",
      },
      tenant,
    });
    const result = durable.result;

    if (!result.ok) {
      failed += 1;
      await supabase
        .from("brain_plan_steps")
        .update({
          result: { error: result.error.message } satisfies JsonRecord,
          status: "failed",
        })
        .eq("empresa_id", tenant.empresaId)
        .eq("id", step.id);
      continue;
    }

    completed += 1;
    await supabase
      .from("brain_plan_steps")
      .update({
        executed_at: new Date().toISOString(),
        result: {
          ...result.data,
          workflowRunId: durable.workflowRunId,
        } as unknown as JsonRecord,
        status: "completed",
      })
      .eq("empresa_id", tenant.empresaId)
      .eq("id", step.id);
  }

  await supabase
    .from("brain_action_plans")
    .update({
      status: failed > 0 ? "failed" : pendingConfirmation > 0 ? "approved" : "completed",
    })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", plan.id);

  await writeActionPlanAudit(supabase, tenant, plan, {
    completed,
    executionType: "action_plan",
    failed,
    pendingConfirmation,
    status:
      failed > 0
        ? "failed"
        : pendingConfirmation > 0
          ? "pending_confirmation"
          : "completed",
  });

  return ok({ completed, failed, pendingConfirmation });
}

async function writeActionPlanAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenant: TenantContext,
  plan: BrainActionPlan,
  input: {
    completed?: number;
    error?: string;
    executionType: "action_plan" | "workflow";
    failed?: number;
    pendingConfirmation?: number;
    status: PlanExecutionStatus;
    workflowId?: string;
  },
) {
  await supabase.from("auditoria_eventos").insert({
    accion: `brain.action_plan.${input.status}`,
    datos_antes: null,
    datos_despues: {
      completed: input.completed ?? 0,
      error: input.error ?? null,
      failed: input.failed ?? 0,
      pendingConfirmation: input.pendingConfirmation ?? 0,
      status: input.status,
    } satisfies JsonRecord,
    empresa_id: tenant.empresaId,
    entidad: "brain_action_plan",
    entidad_id: plan.id,
    ip: null,
    metadata: {
      executionType: input.executionType,
      planId: plan.id,
      recommendationId: plan.recommendationId,
      workflowId: input.workflowId ?? null,
    } satisfies JsonRecord,
    sucursal_id: tenant.sucursalId ?? null,
    user_agent: null,
    usuario_id: tenant.profileId,
  });
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function workflowIdFromPlan(
  plan: BrainActionPlan,
) {
  const workflowIds = Array.from(
    new Set(
      plan.steps
        .map((step) => readString(step.payload.workflowId))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return workflowIds.length === 1 ? workflowIds[0] : null;
}

function workflowStepId(
  step: BrainPlanStep,
) {
  const value = readString(step.payload.stepId);
  return value ?? step.title.toLowerCase().replace(/\s+/g, "_");
}

function stepInput(payload: JsonRecord) {
  const input = payload.input;
  return input && typeof input === "object" && !Array.isArray(input)
    ? input as JsonRecord
    : payload;
}
