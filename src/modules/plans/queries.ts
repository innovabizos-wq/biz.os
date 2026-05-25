import { createClient } from "@/lib/supabase/server";
import type { CoreResult, EmpresaPlan, JsonRecord, PlanCode, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

export type CurrentPlanDetail = {
  codigo: PlanCode;
  estado: EmpresaPlan["estado"];
  fechaFin: string | null;
  fechaInicio: string;
  limites: JsonRecord;
  limitesOverride: JsonRecord;
  nombre: string;
  renovacionAutomatica: boolean;
};

type PlanRelation = {
  codigo: PlanCode;
  limites: JsonRecord;
  nombre: string;
};

type EmpresaPlanRow = {
  estado: EmpresaPlan["estado"];
  fecha_fin: string | null;
  fecha_inicio: string;
  limites_override: JsonRecord;
  planes: PlanRelation | PlanRelation[] | null;
  renovacion_automatica: boolean;
};

function firstPlan(value: PlanRelation | PlanRelation[] | null): PlanRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCurrentEmpresaPlan(
  tenant: TenantContext,
): Promise<CoreResult<CurrentPlanDetail | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_plan")
    .select(
      "estado, fecha_inicio, fecha_fin, renovacion_automatica, limites_override, planes(codigo, nombre, limites)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .maybeSingle();

  if (error) {
    return fail("PLAN_INACTIVE", "No se pudo consultar el plan.", error);
  }

  const row = data as EmpresaPlanRow | null;
  const plan = firstPlan(row?.planes ?? null);

  if (!row || !plan) {
    return ok(null);
  }

  return ok({
    codigo: plan.codigo,
    estado: row.estado,
    fechaFin: row.fecha_fin,
    fechaInicio: row.fecha_inicio,
    limites: plan.limites,
    limitesOverride: row.limites_override,
    nombre: plan.nombre,
    renovacionAutomatica: row.renovacion_automatica,
  });
}
