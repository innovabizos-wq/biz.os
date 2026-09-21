import { getCurrentTenantContext } from "../../../lib/auth/session";
import { runWithDelegatedSupabaseAccessToken } from "../../../lib/supabase/delegated-auth";
import { createClient } from "../../../lib/supabase/server";
import type { JsonRecord, TenantContext } from "../../../types/core";

export type HumanWorkItemWorkflowInput = {
  accessToken: string;
  workItem: {
    assignedProfileId: string;
    attachments?: JsonRecord[];
    description: string;
    id: string;
    input?: JsonRecord;
    priority: "critical" | "high" | "low" | "medium";
    runId?: string | null;
    slaDueAt?: string | null;
    teamRunId?: string | null;
    title: string;
  };
  tenant: TenantContext;
};

async function authorizedTenant(input: HumanWorkItemWorkflowInput) {
  const result = await getCurrentTenantContext();
  if (!result.ok || !result.data) throw new Error("La sesion delegada de la tarea ya no es valida.");
  if (
    result.data.empresaId !== input.tenant.empresaId ||
    result.data.profileId !== input.tenant.profileId
  ) {
    throw new Error("La identidad delegada no coincide con quien creo la tarea.");
  }
  return result.data;
}

export async function createHumanWorkItemStep(
  input: HumanWorkItemWorkflowInput,
  hookToken: string,
) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authorizedTenant(input);
    const supabase = await createClient();
    const assignee = await supabase
      .from("profiles")
      .select("id")
      .eq("id", input.workItem.assignedProfileId)
      .eq("empresa_id", tenant.empresaId)
      .eq("estado", "activo")
      .maybeSingle<{ id: string }>();
    if (assignee.error || !assignee.data) {
      throw new Error("La persona asignada no pertenece a la empresa o no esta activa.");
    }
    const result = await supabase.from("brain_work_items").insert({
      assigned_profile_id: input.workItem.assignedProfileId,
      attachments: input.workItem.attachments ?? [],
      created_by: tenant.profileId,
      description: input.workItem.description,
      empresa_id: tenant.empresaId,
      hook_token: hookToken,
      id: input.workItem.id,
      input: input.workItem.input ?? {},
      priority: input.workItem.priority,
      run_id: input.workItem.runId ?? null,
      sla_due_at: input.workItem.slaDueAt ?? null,
      status: "open",
      team_run_id: input.workItem.teamRunId ?? null,
      title: input.workItem.title,
    });
    if (result.error) throw new Error(`No se pudo crear la tarea humana: ${result.error.message}`);
    return { hookToken, workItemId: input.workItem.id };
  });
}

export async function attachHumanWorkItemWorkflowStep(
  input: HumanWorkItemWorkflowInput,
  workflowRunId: string,
) {
  "use step";
  return runWithDelegatedSupabaseAccessToken(input.accessToken, async () => {
    const tenant = await authorizedTenant(input);
    const supabase = await createClient();
    const result = await supabase
      .from("brain_work_items")
      .update({ workflow_run_id: workflowRunId })
      .eq("id", input.workItem.id)
      .eq("empresa_id", tenant.empresaId);
    if (result.error) throw new Error(`No se pudo enlazar la tarea humana: ${result.error.message}`);
  });
}
