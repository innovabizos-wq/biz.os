import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CoreResult, Profile, Rol, Sucursal, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

export { getCurrentProfile };

export type AccessibleUser = Profile & {
  rolNombre: string | null;
  sucursalNombre: string | null;
};

type UserRelation = {
  nombre: string | null;
};

type UserRow = {
  correo: string;
  created_at: string;
  empresa_id: string;
  estado: Profile["estado"];
  id: string;
  nombre: string;
  rol_id: string | null;
  roles: UserRelation | UserRelation[] | null;
  sucursal_id: string | null;
  sucursales: UserRelation | UserRelation[] | null;
  telefono: string | null;
  ultimo_acceso: string | null;
  updated_at: string;
};

type RoleRow = {
  created_at: string;
  descripcion: string | null;
  empresa_id: string;
  es_sistema: boolean;
  estado: Rol["estado"];
  id: string;
  nombre: string;
  updated_at: string;
};

type BranchRow = {
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

function firstRelation(
  value: UserRelation | UserRelation[] | null,
): UserRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapUser(row: UserRow): AccessibleUser {
  return {
    correo: row.correo,
    createdAt: row.created_at,
    empresaId: row.empresa_id,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    rolId: row.rol_id,
    rolNombre: firstRelation(row.roles)?.nombre ?? null,
    sucursalId: row.sucursal_id,
    sucursalNombre: firstRelation(row.sucursales)?.nombre ?? null,
    telefono: row.telefono,
    ultimoAcceso: row.ultimo_acceso,
    updatedAt: row.updated_at,
  };
}

function mapRole(row: RoleRow): Rol {
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

function mapBranch(row: BranchRow): Sucursal {
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

export async function getAccessibleUsersForCurrentTenant(
  tenant: TenantContext,
): Promise<CoreResult<AccessibleUser[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, empresa_id, sucursal_id, rol_id, nombre, correo, telefono, estado, ultimo_acceso, created_at, updated_at, sucursales(nombre), roles(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as UserRow[]).map(mapUser));
}

export const getUsersForCurrentTenant = getAccessibleUsersForCurrentTenant;

export async function getUserDetailForCurrentTenant(
  tenant: TenantContext,
  profileId: string,
): Promise<CoreResult<AccessibleUser | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, empresa_id, sucursal_id, rol_id, nombre, correo, telefono, estado, ultimo_acceso, created_at, updated_at, sucursales(nombre), roles(nombre)",
    )
    .eq("id", profileId)
    .eq("empresa_id", tenant.empresaId)
    .maybeSingle<UserRow>();

  if (error || !data) {
    return ok(null);
  }

  return ok(mapUser(data));
}

export async function getAssignableRolesForCurrentTenant(
  tenant: TenantContext,
): Promise<CoreResult<Rol[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, empresa_id, nombre, descripcion, es_sistema, estado, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as RoleRow[]).map(mapRole));
}

export async function getAssignableBranchesForCurrentTenant(
  tenant: TenantContext,
): Promise<CoreResult<Sucursal[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sucursales")
    .select(
      "id, empresa_id, nombre, codigo, direccion, telefono, estado, created_at, updated_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activa")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as BranchRow[]).map(mapBranch));
}
