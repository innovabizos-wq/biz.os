import { createClient } from "@/lib/supabase/server";
import type { CoreResult, Sucursal, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type SucursalRow = {
  codigo: string | null;
  created_at: string;
  direccion: string | null;
  empresa_id: string;
  estado: Sucursal["estado"];
  id: string;
  nombre: string;
  telefono: string | null;
  updated_at: string;
};

function mapSucursal(row: SucursalRow): Sucursal {
  return {
    codigo: row.codigo,
    createdAt: row.created_at,
    direccion: row.direccion,
    empresaId: row.empresa_id,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    telefono: row.telefono,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentSucursal(
  tenant: TenantContext,
): Promise<CoreResult<Sucursal | null>> {
  if (!tenant.sucursalId) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sucursales")
    .select(
      "id, empresa_id, nombre, codigo, direccion, telefono, estado, created_at, updated_at",
    )
    .eq("id", tenant.sucursalId)
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<SucursalRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la sucursal.", error);
  }

  return ok(data ? mapSucursal(data) : null);
}
