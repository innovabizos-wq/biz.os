import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { JsonRecord, TenantContext } from "@/types/core";

type SkillHealthRow = {
  consecutive_errors: number;
  error_threshold: number;
  paused_until: string | null;
  status: "disabled" | "enabled" | "paused";
};

export async function getBrainSkillBlockReason(tenant: TenantContext, skillId: string) {
  try {
    const supabase = await createClient();
    const result = await supabase
      .from("brain_skill_health")
      .select("status, consecutive_errors, error_threshold, paused_until")
      .eq("empresa_id", tenant.empresaId)
      .eq("skill_id", skillId)
      .maybeSingle<SkillHealthRow>();
    if (result.error || !result.data || result.data.status === "enabled") return null;
    if (
      result.data.status === "paused" &&
      result.data.paused_until &&
      new Date(result.data.paused_until).getTime() <= Date.now()
    ) {
      await supabase
        .from("brain_skill_health")
        .update({ consecutive_errors: 0, paused_until: null, status: "enabled" })
        .eq("empresa_id", tenant.empresaId)
        .eq("skill_id", skillId);
      return null;
    }
    return result.data.status === "disabled"
      ? `La habilidad ${skillId} esta deshabilitada por seguridad.`
      : `La habilidad ${skillId} esta pausada temporalmente por errores consecutivos.`;
  } catch {
    // La telemetria nunca debe impedir la ejecucion si su tabla aun no fue desplegada.
    return null;
  }
}

export async function recordBrainSkillHealth(input: {
  error?: JsonRecord;
  success: boolean;
  skillId: string;
  tenant: TenantContext;
}) {
  try {
    const supabase = await createClient();
    if (input.success) {
      await supabase.from("brain_skill_health").upsert({
        consecutive_errors: 0,
        empresa_id: input.tenant.empresaId,
        last_error: null,
        last_success_at: new Date().toISOString(),
        paused_until: null,
        skill_id: input.skillId,
        status: "enabled",
      }, { onConflict: "empresa_id,skill_id" });
      return;
    }
    const current = await supabase
      .from("brain_skill_health")
      .select("consecutive_errors, error_threshold")
      .eq("empresa_id", input.tenant.empresaId)
      .eq("skill_id", input.skillId)
      .maybeSingle<Pick<SkillHealthRow, "consecutive_errors" | "error_threshold">>();
    const errors = (current.data?.consecutive_errors ?? 0) + 1;
    const threshold = current.data?.error_threshold ?? 3;
    await supabase.from("brain_skill_health").upsert({
      consecutive_errors: errors,
      empresa_id: input.tenant.empresaId,
      error_threshold: threshold,
      last_error: input.error ?? {},
      last_error_at: new Date().toISOString(),
      paused_until: errors >= threshold ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
      skill_id: input.skillId,
      status: errors >= threshold ? "paused" : "enabled",
    }, { onConflict: "empresa_id,skill_id" });
  } catch {
    // Best effort: el resultado principal de la habilidad conserva prioridad.
  }
}
