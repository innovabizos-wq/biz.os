import "server-only";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import type { JsonRecord, TenantContext } from "@/types/core";

function assertEvalPermission(tenant: TenantContext) {
  if (!hasPermission(tenant.permissions, "brain.settings.manage")) {
    throw new Error("No tienes permiso para registrar evaluaciones de Brain.");
  }
}

export async function listBrainEvalRuns(tenant: TenantContext) {
  assertEvalPermission(tenant);
  const supabase = await createClient();
  const result = await supabase
    .from("brain_eval_runs")
    .select("id, suite, status, total_cases, passed_cases, failed_cases, metrics, commit_sha, started_at, completed_at")
    .eq("empresa_id", tenant.empresaId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (result.error) throw new Error(`No se pudieron consultar las evaluaciones: ${result.error.message}`);
  return result.data ?? [];
}

export async function startBrainEvalRun(input: {
  commitSha?: string | null;
  suite: string;
  tenant: TenantContext;
  totalCases: number;
}) {
  assertEvalPermission(input.tenant);
  const supabase = await createClient();
  const result = await supabase
    .from("brain_eval_runs")
    .insert({
      commit_sha: input.commitSha ?? null,
      empresa_id: input.tenant.empresaId,
      status: "running",
      suite: input.suite,
      total_cases: input.totalCases,
    })
    .select("id, status")
    .single();
  if (result.error || !result.data) throw new Error(`No se pudo iniciar la evaluacion: ${result.error?.message ?? "sin resultado"}`);
  return result.data;
}

export async function completeBrainEvalRun(input: {
  evalRunId: string;
  failedCases: number;
  metrics?: JsonRecord;
  passedCases: number;
  tenant: TenantContext;
}) {
  assertEvalPermission(input.tenant);
  const supabase = await createClient();
  const status = input.failedCases > 0 ? "failed" : "passed";
  const result = await supabase
    .from("brain_eval_runs")
    .update({
      completed_at: new Date().toISOString(),
      failed_cases: input.failedCases,
      metrics: input.metrics ?? {},
      passed_cases: input.passedCases,
      status,
    })
    .eq("id", input.evalRunId)
    .eq("empresa_id", input.tenant.empresaId)
    .select("id, status, total_cases, passed_cases, failed_cases, metrics")
    .single();
  if (result.error || !result.data) throw new Error(`No se pudo cerrar la evaluacion: ${result.error?.message ?? "sin resultado"}`);
  return result.data;
}
