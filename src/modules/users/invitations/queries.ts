import { getCurrentTenantContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";
import type { InvitacionEstado, UserInvitation } from "./types";

type Relation = {
  id: string;
  nombre: string;
};

type InvitationRow = {
  aceptada_at: string | null;
  cargo: string | null;
  cancelada_at: string | null;
  cedula: string | null;
  correo: string;
  created_at: string;
  estado: InvitacionEstado;
  fecha_expiracion: string;
  id: string;
  nombre: string;
  roles: Relation | Relation[] | null;
  sucursales: Relation | Relation[] | null;
  telefono: string | null;
  token: string;
};

function firstRelation(value: Relation | Relation[] | null): Relation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapInvitation(row: InvitationRow): UserInvitation {
  return {
    aceptadaAt: row.aceptada_at,
    cargo: row.cargo,
    canceladaAt: row.cancelada_at,
    cedula: row.cedula,
    correo: row.correo,
    createdAt: row.created_at,
    estado: row.estado,
    fechaExpiracion: row.fecha_expiracion,
    id: row.id,
    nombre: row.nombre,
    rol: firstRelation(row.roles),
    sucursal: firstRelation(row.sucursales),
    telefono: row.telefono,
    token: row.token,
  };
}

export async function getInvitationsForCurrentTenant(): Promise<
  CoreResult<UserInvitation[]>
> {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok || !tenantResult.data) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitaciones_usuarios")
    .select(
      "id, correo, nombre, cedula, telefono, cargo, token, estado, fecha_expiracion, aceptada_at, cancelada_at, created_at, roles(id, nombre), sucursales(id, nombre)",
    )
    .eq("empresa_id", tenantResult.data.empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as InvitationRow[]).map(mapInvitation));
}
