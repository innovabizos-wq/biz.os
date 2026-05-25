import { createClient } from "@/lib/supabase/server";
import type { CoreResult, Empresa, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type EmpresaRow = {
  correo: string | null;
  created_at: string;
  estado: Empresa["estado"];
  id: string;
  identificacion_fiscal: string | null;
  nombre: string;
  nombre_comercial: string | null;
  telefono: string | null;
  updated_at: string;
};

function mapEmpresa(row: EmpresaRow): Empresa {
  return {
    correo: row.correo,
    createdAt: row.created_at,
    estado: row.estado,
    id: row.id,
    identificacionFiscal: row.identificacion_fiscal,
    nombre: row.nombre,
    nombreComercial: row.nombre_comercial,
    telefono: row.telefono,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentEmpresa(
  tenant: TenantContext,
): Promise<CoreResult<Empresa | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select(
      "id, nombre, nombre_comercial, identificacion_fiscal, correo, telefono, estado, created_at, updated_at",
    )
    .eq("id", tenant.empresaId)
    .maybeSingle<EmpresaRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la empresa.", error);
  }

  return ok(data ? mapEmpresa(data) : null);
}
