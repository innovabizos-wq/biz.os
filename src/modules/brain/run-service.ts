import "server-only";

import { getRun } from "workflow/api";

import { createClient } from "@/lib/supabase/server";
import type { TenantContext } from "@/types/core";

export async function getBrainRunDetail(tenant: TenantContext, runId: string) {
  const supabase = await createClient();
  const [run, steps, events, approvals] = await Promise.all([
    supabase.from("brain_runs").select("id, kind, source, audience, status, conversation_id, parent_run_id, workflow_run_id, request, response, current_step, retry_count, token_budget, cost_budget_usd, actual_cost_usd, max_concurrency, deadline_at, cancel_requested_at, last_heartbeat_at, error_code, value_generated, started_at, completed_at, created_at").eq("id", runId).eq("empresa_id", tenant.empresaId).single(),
    supabase.from("brain_run_steps").select("id, step_id, tool_name, status, attempt, input, output, error, started_at, completed_at, created_at").eq("run_id", runId).eq("empresa_id", tenant.empresaId).order("created_at"),
    supabase.from("brain_run_events").select("id, event_type, payload, created_at").eq("run_id", runId).eq("empresa_id", tenant.empresaId).order("id"),
    supabase.from("brain_approvals").select("id, tool_call_id, tool_name, risk, status, requested_at, decided_at, decision_reason").eq("run_id", runId).eq("empresa_id", tenant.empresaId).order("requested_at"),
  ]);
  if (run.error || !run.data) throw new Error("El run no existe o no es visible.");
  return {
    ...run.data,
    approvals: approvals.data ?? [],
    events: events.data ?? [],
    steps: steps.data ?? [],
  };
}

export async function cancelBrainRun(tenant: TenantContext, runId: string) {
  const supabase = await createClient();
  const run = await supabase
    .from("brain_runs")
    .select("status, workflow_run_id")
    .eq("id", runId)
    .eq("empresa_id", tenant.empresaId)
    .single<{ status: string; workflow_run_id: string | null }>();
  if (run.error || !run.data) throw new Error("El run no existe o no es visible.");
  if (["cancelled", "completed", "denied", "failed"].includes(run.data.status)) {
    return { cancelled: false, reason: "terminal", runId, status: run.data.status };
  }
  const now = new Date().toISOString();
  const updated = await supabase
    .from("brain_runs")
    .update({ cancel_requested_at: now, completed_at: now, status: "cancelled" })
    .eq("id", runId)
    .eq("empresa_id", tenant.empresaId);
  if (updated.error) throw new Error(`No se pudo cancelar el run: ${updated.error.message}`);
  if (run.data.workflow_run_id) {
    await getRun(run.data.workflow_run_id).cancel().catch(() => undefined);
  }
  return { cancelled: true, runId, status: "cancelled" as const };
}
