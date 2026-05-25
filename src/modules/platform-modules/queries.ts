import { createClient } from "@/lib/supabase/server";
import type { CatalogEstado, CoreResult, ModuleCode, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

export type ActiveEmpresaModule = {
  codigo: ModuleCode;
  estado: CatalogEstado;
  fechaActivacion: string;
  nombre: string;
};

type ModuleRelation = {
  codigo: ModuleCode;
  nombre: string;
};

type EmpresaModuloRow = {
  estado: CatalogEstado;
  fecha_activacion: string;
  modulos: ModuleRelation | ModuleRelation[] | null;
};

function firstModule(
  value: ModuleRelation | ModuleRelation[] | null,
): ModuleRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getActiveEmpresaModules(
  tenant: TenantContext,
): Promise<CoreResult<ActiveEmpresaModule[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_modulos")
    .select("estado, fecha_activacion, modulos(codigo, nombre)")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo");

  if (error) {
    return fail("MODULE_INACTIVE", "No se pudieron consultar modulos.", error);
  }

  const modules = ((data ?? []) as EmpresaModuloRow[])
    .map((row) => ({
      relation: firstModule(row.modulos),
      row,
    }))
    .filter((item): item is { relation: ModuleRelation; row: EmpresaModuloRow } =>
      Boolean(item.relation),
    )
    .map(({ relation, row }) => ({
      codigo: relation.codigo,
      estado: row.estado,
      fechaActivacion: row.fecha_activacion,
      nombre: relation.nombre,
    }));

  return ok(modules);
}
