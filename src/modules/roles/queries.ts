import { createClient } from "@/lib/supabase/server";
import type {
  CoreResult,
  ModuleCode,
  PermissionCode,
  Rol,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

type RolRow = {
  created_at: string;
  descripcion: string | null;
  empresa_id: string;
  es_sistema: boolean;
  estado: Rol["estado"];
  id: string;
  nombre: string;
  updated_at: string;
};

export type RolePermissionDetail = {
  codigo: PermissionCode;
  descripcion: string | null;
  moduloCodigo: ModuleCode | null;
  nombre: string;
};

type PermissionRelation = {
  codigo: PermissionCode;
  descripcion: string | null;
  modulo_codigo: ModuleCode | null;
  nombre: string;
};

type RolPermisoRow = {
  permisos: PermissionRelation | PermissionRelation[] | null;
};

function mapRol(row: RolRow): Rol {
  return {
    createdAt: row.created_at,
    descripcion: row.descripcion,
    empresaId: row.empresa_id,
    esSistema: row.es_sistema,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    updatedAt: row.updated_at,
  };
}

function firstPermission(
  value: PermissionRelation | PermissionRelation[] | null,
): PermissionRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCurrentRol(
  tenant: TenantContext,
): Promise<CoreResult<Rol | null>> {
  if (!tenant.rolId) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, empresa_id, nombre, descripcion, es_sistema, estado, created_at, updated_at",
    )
    .eq("id", tenant.rolId)
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<RolRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el rol.", error);
  }

  return ok(data ? mapRol(data) : null);
}

export type AccessibleRole = Rol & {
  permissionCount: number;
};

export async function getAccessibleRolesForCurrentTenant(
  tenant: TenantContext,
): Promise<CoreResult<AccessibleRole[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, empresa_id, nombre, descripcion, es_sistema, estado, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: true });

  if (error) {
    return ok([]);
  }

  const roles = ((data ?? []) as RolRow[]).map(mapRol);
  const permissionCounts = await Promise.all(
    roles.map(async (role) => {
      const { count } = await supabase
        .from("rol_permisos")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", tenant.empresaId)
        .eq("rol_id", role.id);

      return [role.id, count ?? 0] as const;
    }),
  );
  const counts = new Map(permissionCounts);

  return ok(
    roles.map((role) => ({
      ...role,
      permissionCount: counts.get(role.id) ?? 0,
    })),
  );
}

export const getRolesForCurrentTenant = getAccessibleRolesForCurrentTenant;

export async function getRoleDetailForCurrentTenant(
  tenant: TenantContext,
  rolId: string,
): Promise<CoreResult<AccessibleRole | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, empresa_id, nombre, descripcion, es_sistema, estado, created_at, updated_at",
    )
    .eq("id", rolId)
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<RolRow>();

  if (error) {
    return ok(null);
  }

  if (!data) {
    return ok(null);
  }

  const { count } = await supabase
    .from("rol_permisos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", tenant.empresaId)
    .eq("rol_id", rolId);

  return ok({
    ...mapRol(data),
    permissionCount: count ?? 0,
  });
}

export async function getRolePermissionsForCurrentTenant(
  tenant: TenantContext,
  rolId: string,
): Promise<CoreResult<RolePermissionDetail[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rol_permisos")
    .select("permisos(codigo, nombre, descripcion, modulo_codigo)")
    .eq("empresa_id", tenant.empresaId)
    .eq("rol_id", rolId);

  if (error) {
    return ok([]);
  }

  const permissions = ((data ?? []) as RolPermisoRow[])
    .map((row) => firstPermission(row.permisos))
    .filter((permission): permission is PermissionRelation => Boolean(permission))
    .map((permission) => ({
      codigo: permission.codigo,
      descripcion: permission.descripcion,
      moduloCodigo: permission.modulo_codigo,
      nombre: permission.nombre,
    }));

  return ok(permissions);
}

export async function getCurrentRolPermissions(
  tenant: TenantContext,
): Promise<CoreResult<RolePermissionDetail[]>> {
  if (!tenant.rolId) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rol_permisos")
    .select("permisos(codigo, nombre, descripcion, modulo_codigo)")
    .eq("empresa_id", tenant.empresaId)
    .eq("rol_id", tenant.rolId);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar permisos.", error);
  }

  const permissions = ((data ?? []) as RolPermisoRow[])
    .map((row) => firstPermission(row.permisos))
    .filter((permission): permission is PermissionRelation => Boolean(permission))
    .map((permission) => ({
      codigo: permission.codigo,
      descripcion: permission.descripcion,
      moduloCodigo: permission.modulo_codigo,
      nombre: permission.nombre,
    }));

  return ok(permissions);
}

export async function getCurrentUserRoleWithPermissions(
  tenant: TenantContext,
): Promise<CoreResult<{ permissions: RolePermissionDetail[]; role: Rol | null }>> {
  const [role, permissions] = await Promise.all([
    getCurrentRol(tenant),
    getCurrentRolPermissions(tenant),
  ]);

  if (!role.ok) {
    return role;
  }

  if (!permissions.ok) {
    return permissions;
  }

  return ok({ permissions: permissions.data, role: role.data });
}
