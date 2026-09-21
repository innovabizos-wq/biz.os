import { getCurrentTenantContext } from "../../../lib/auth/session";
import { runWithDelegatedSupabaseAccessToken } from "../../../lib/supabase/delegated-auth";
import type { TenantContext } from "../../../types/core";
import type { BrainTeamPlan, BrainTeamTask } from "./contracts";
import { runSpecializedBrainAgent } from "./specialized-agent";
import {
  updateBrainTeamMember,
  updateBrainTeamStatus,
} from "./team-repository";

export type BrainTeamWorkflowInput = {
  accessToken: string;
  plan: BrainTeamPlan;
  runId: string;
  teamRunId: string;
  tenant: TenantContext;
};

async function authorizedTenant(input: BrainTeamWorkflowInput) {
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await getCurrentTenantContext();
    if (!tenant.ok || !tenant.data) throw new Error("La sesion delegada del equipo ya no es valida.");
    if (
      tenant.data.empresaId !== input.tenant.empresaId ||
      tenant.data.profileId !== input.tenant.profileId
    ) {
      throw new Error("La identidad del equipo no coincide con el supervisor autenticado.");
    }
    return tenant.data;
  });
}

export async function setBrainTeamStatusStep(
  input: BrainTeamWorkflowInput,
  status: "cancelled" | "completed" | "failed" | "running" | "verifying" | "waiting_human",
  result?: unknown,
) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authorizedTenant(input);
    await updateBrainTeamStatus({
      result,
      runId: input.runId,
      status,
      teamRunId: input.teamRunId,
      tenant,
    });
  });
}

export async function executeBrainTeamTaskStep(
  input: BrainTeamWorkflowInput,
  task: BrainTeamTask,
  dependencyOutputs: Record<string, unknown>,
) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authorizedTenant(input);
    await updateBrainTeamMember({
      status: "running",
      taskId: task.id,
      teamRunId: input.teamRunId,
      tenant,
    });
    try {
      const output = await runSpecializedBrainAgent({
        agentId: task.agentId,
        dependencyOutputs,
        objective: task.description,
        runId: input.runId,
        taskId: task.id,
        tenant,
      });
      await updateBrainTeamMember({
        output,
        status: "completed",
        taskId: task.id,
        teamRunId: input.teamRunId,
        tenant,
      });
      return { ok: true as const, output, taskId: task.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "El agente no pudo completar su tarea.";
      await updateBrainTeamMember({
        error: { message },
        status: "failed",
        taskId: task.id,
        teamRunId: input.teamRunId,
        tenant,
      });
      return { error: message, ok: false as const, taskId: task.id };
    }
  });
}
