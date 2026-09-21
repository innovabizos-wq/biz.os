import "server-only";

import { randomUUID } from "node:crypto";
import { resumeHook, start } from "workflow/api";

import { createClient } from "@/lib/supabase/server";
import { currentAccessToken } from "@/modules/brain/runtime/durable-skill-workflow";
import type { HumanWorkItemWorkflowInput } from "@/modules/brain/runtime/human-work-steps";
import { brainHumanWorkItemWorkflow } from "@/modules/brain/runtime/human-work-workflows";
import type { JsonRecord, TenantContext } from "@/types/core";

export async function startBrainHumanWorkItem(input: {
  assignedProfileId: string;
  attachments?: JsonRecord[];
  description: string;
  input?: JsonRecord;
  priority?: "critical" | "high" | "low" | "medium";
  runId?: string | null;
  slaDueAt?: string | null;
  teamRunId?: string | null;
  tenant: TenantContext;
  title: string;
}) {
  const workItemId = randomUUID();
  const workflowInput: HumanWorkItemWorkflowInput = {
    accessToken: await currentAccessToken(),
    tenant: input.tenant,
    workItem: {
      assignedProfileId: input.assignedProfileId,
      attachments: input.attachments,
      description: input.description,
      id: workItemId,
      input: input.input,
      priority: input.priority ?? "medium",
      runId: input.runId,
      slaDueAt: input.slaDueAt,
      teamRunId: input.teamRunId,
      title: input.title,
    },
  };
  const run = await start(brainHumanWorkItemWorkflow, [workflowInput]);
  return {
    hookToken: `brain-work-item:${workItemId}`,
    status: "open" as const,
    workItemId,
    workflowRunId: run.runId,
  };
}

export async function startBrainHumanWorkItemByAssignee(input: {
  assignee: string;
  description: string;
  priority?: "critical" | "high" | "low" | "medium";
  runId?: string | null;
  slaDueAt?: string | null;
  teamRunId?: string | null;
  tenant: TenantContext;
  title: string;
}) {
  const query = input.assignee.trim();
  if (!query) throw new Error("Indica a quien debe asignarse la tarea.");
  const safeQuery = query.replace(/[%_,()]/g, "");
  const supabase = await createClient();
  const candidates = await supabase
    .from("profiles")
    .select("id, nombre, correo")
    .eq("empresa_id", input.tenant.empresaId)
    .eq("estado", "activo")
    .or(`nombre.ilike.%${safeQuery}%,correo.ilike.%${safeQuery}%`)
    .limit(6);
  if (candidates.error) throw new Error(`No se pudo buscar a la persona: ${candidates.error.message}`);
  if (!candidates.data?.length) throw new Error(`No encontre una persona activa llamada ${query}.`);
  if (candidates.data.length > 1) {
    throw new Error(`Hay varias coincidencias para ${query}: ${candidates.data.map((candidate) => `${candidate.nombre} (${candidate.correo})`).join(", ")}.`);
  }
  return startBrainHumanWorkItem({
    assignedProfileId: candidates.data[0].id,
    description: input.description,
    priority: input.priority,
    runId: input.runId,
    slaDueAt: input.slaDueAt,
    teamRunId: input.teamRunId,
    tenant: input.tenant,
    title: input.title,
  });
}

export async function listBrainWorkItems(
  tenant: TenantContext,
  input?: { assignedToMe?: boolean; status?: string | null },
) {
  const supabase = await createClient();
  let query = supabase
    .from("brain_work_items")
    .select("id, run_id, team_run_id, assigned_profile_id, title, description, status, priority, sla_due_at, comments, attachments, result, version, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .order("sla_due_at", { ascending: true, nullsFirst: false })
    .limit(100);
  if (input?.assignedToMe) query = query.eq("assigned_profile_id", tenant.profileId);
  if (input?.status) query = query.eq("status", input.status);
  const result = await query;
  if (result.error) throw new Error(`No se pudieron consultar las tareas humanas: ${result.error.message}`);
  return result.data ?? [];
}

export async function respondBrainWorkItem(input: {
  comment?: string;
  result?: JsonRecord;
  status: "completed" | "needs_changes";
  tenant: TenantContext;
  version: number;
  workItemId: string;
}) {
  const supabase = await createClient();
  const item = await supabase
    .from("brain_work_items")
    .select("assigned_profile_id, comments, hook_token, status, version")
    .eq("id", input.workItemId)
    .eq("empresa_id", input.tenant.empresaId)
    .single<{
      assigned_profile_id: string;
      comments: JsonRecord[];
      hook_token: string | null;
      status: string;
      version: number;
    }>();
  if (item.error || !item.data) throw new Error("La tarea humana no existe o no es visible.");
  if (item.data.assigned_profile_id !== input.tenant.profileId) {
    throw new Error("Solo la persona asignada puede responder esta tarea.");
  }
  if (!["open", "in_progress", "blocked"].includes(item.data.status)) {
    throw new Error("La tarea ya fue respondida o cancelada.");
  }
  if (item.data.version !== input.version) {
    throw new Error("La tarea cambio mientras la estabas revisando. Actualiza y vuelve a intentarlo.");
  }
  if (!item.data.hook_token) throw new Error("La tarea no tiene un checkpoint durable asociado.");
  const comments = input.comment?.trim()
    ? [
        ...(item.data.comments ?? []),
        {
          authorProfileId: input.tenant.profileId,
          createdAt: new Date().toISOString(),
          message: input.comment.trim(),
        },
      ]
    : item.data.comments ?? [];
  const updated = await supabase
    .from("brain_work_items")
    .update({
      comments,
      completed_at: input.status === "completed" ? new Date().toISOString() : null,
      result: input.result ?? {},
      status: input.status,
      version: item.data.version + 1,
    })
    .eq("id", input.workItemId)
    .eq("empresa_id", input.tenant.empresaId)
    .eq("version", input.version)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (updated.error || !updated.data) {
    throw new Error("No se pudo guardar la respuesta porque la tarea cambio. Actualiza y reintenta.");
  }
  await resumeHook(item.data.hook_token, {
    comment: input.comment?.trim() || undefined,
    result: input.result,
    status: input.status,
  });
  return { status: input.status, workItemId: input.workItemId };
}
