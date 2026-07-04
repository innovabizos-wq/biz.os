import "server-only";

import { createClient } from "@/lib/supabase/server";
import { executeConversationExecution } from "@/modules/ai/conversation-execution-bridge";
import { canManageBrain, getBrainActionPlans } from "@/modules/brain/queries";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

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
  let pendingConfirmation = 0;

  await supabase
    .from("brain_action_plans")
    .update({ status: "executing" })
    .eq("empresa_id", tenant.empresaId)
    .eq("id", plan.id);

  for (const step of plan.steps) {
    const result = await executeConversationExecution(tenant, {
      actionId: step.actionId,
      planId: plan.id,
      params: step.payload,
      recommendationId: plan.recommendationId ?? undefined,
      source: "brain",
      target: "action",
    });

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

    if (result.data.confirmationRequired) {
      pendingConfirmation += 1;
      await supabase
        .from("brain_plan_steps")
        .update({
          result: result.data as unknown as JsonRecord,
          status: "confirmation_required",
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
        result: result.data as unknown as JsonRecord,
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

  return ok({ completed, failed, pendingConfirmation });
}
