import { createClient } from "@/lib/supabase/server";
import type {
  CoreResult,
  ModuleCode,
  PermissionCode,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

export function getTenantPermissionCodes(
  tenant: TenantContext,
): readonly PermissionCode[] {
  return tenant.permissions;
}

export type PermissionCatalogItem = {
  codigo: PermissionCode;
  descripcion: string | null;
  moduloCodigo: ModuleCode | null;
  nombre: string;
};

type PermissionCatalogRow = {
  codigo: PermissionCode;
  descripcion: string | null;
  modulo_codigo: ModuleCode | null;
  nombre: string;
};

export async function getActivePermissionCatalog(): Promise<
  CoreResult<PermissionCatalogItem[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permisos")
    .select("codigo, nombre, descripcion, modulo_codigo")
    .eq("estado", "activo")
    .order("codigo", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar permisos.", error);
  }

  return ok(
    ((data ?? []) as PermissionCatalogRow[]).map((permission) => ({
      codigo: permission.codigo,
      descripcion: permission.descripcion,
      moduloCodigo: permission.modulo_codigo,
      nombre: permission.nombre,
    })),
  );
}

export function getCurrentUserPermissionCodes(
  tenant: TenantContext,
): readonly PermissionCode[] {
  return tenant.permissions;
}
