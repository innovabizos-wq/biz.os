import { createClient } from "@/lib/supabase/server";
import type { CoreResult, TenantContext } from "@/types/core";
import { ok } from "@/types/core";
import type {
  CrmAssignableUser,
  CrmCustomer,
  CrmFollowup,
  CrmInteraction,
} from "@/modules/crm/types";

type ProfileRelation = {
  nombre: string | null;
};

type CustomerRow = {
  asignado_a: string | null;
  correo: string | null;
  created_at: string;
  empresa_id: string;
  estado: CrmCustomer["estado"];
  genero: CrmCustomer["genero"] | null;
  id: string;
  identificacion: string | null;
  nombre: string;
  notas: string | null;
  origen: string | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
  telefono: string | null;
  tipo: CrmCustomer["tipo"];
  updated_at: string;
  whatsapp: string | null;
};

type InteractionRow = {
  created_at: string;
  created_by: string | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
  id: string;
  resultado: string | null;
  resumen: string;
  tipo: CrmInteraction["tipo"];
};

type FollowupRow = {
  asignado_a: string | null;
  asunto: string;
  completado_at: string | null;
  created_at: string;
  descripcion: string | null;
  estado: CrmFollowup["estado"];
  fecha_programada: string;
  id: string;
  profiles: ProfileRelation | ProfileRelation[] | null;
};

type AssignableUserRow = {
  id: string;
  nombre: string;
};

function firstProfile(
  value: ProfileRelation | ProfileRelation[] | null,
): ProfileRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapCustomer(row: CustomerRow): CrmCustomer {
  return {
    asignadoA: row.asignado_a,
    asignadoNombre: firstProfile(row.profiles)?.nombre ?? null,
    correo: row.correo,
    createdAt: row.created_at,
    empresaId: row.empresa_id,
    estado: row.estado,
    genero: row.genero ?? "o",
    id: row.id,
    identificacion: row.identificacion,
    nombre: row.nombre,
    notas: row.notas,
    origen: row.origen,
    telefono: row.telefono,
    tipo: row.tipo,
    updatedAt: row.updated_at,
    whatsapp: row.whatsapp,
  };
}

function mapInteraction(row: InteractionRow): CrmInteraction {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByNombre: firstProfile(row.profiles)?.nombre ?? null,
    id: row.id,
    resultado: row.resultado,
    resumen: row.resumen,
    tipo: row.tipo,
  };
}

function mapFollowup(row: FollowupRow): CrmFollowup {
  return {
    asignadoA: row.asignado_a,
    asignadoNombre: firstProfile(row.profiles)?.nombre ?? null,
    asunto: row.asunto,
    completadoAt: row.completado_at,
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    fechaProgramada: row.fecha_programada,
    id: row.id,
  };
}

export async function getCrmCustomers(
  tenant: TenantContext,
): Promise<CoreResult<CrmCustomer[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clientes")
    .select(
      "id, empresa_id, tipo, estado, genero, nombre, identificacion, telefono, whatsapp, correo, origen, asignado_a, notas, created_at, updated_at, profiles!crm_clientes_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as CustomerRow[]).map(mapCustomer));
}

export async function getCrmCustomerDetail(
  tenant: TenantContext,
  clienteId: string,
): Promise<CoreResult<CrmCustomer | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clientes")
    .select(
      "id, empresa_id, tipo, estado, genero, nombre, identificacion, telefono, whatsapp, correo, origen, asignado_a, notas, created_at, updated_at, profiles!crm_clientes_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("id", clienteId)
    .maybeSingle<CustomerRow>();

  if (error || !data) {
    return ok(null);
  }

  return ok(mapCustomer(data));
}

export async function getCrmCustomerInteractions(
  tenant: TenantContext,
  clienteId: string,
): Promise<CoreResult<CrmInteraction[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_interacciones")
    .select(
      "id, tipo, resultado, resumen, created_by, created_at, profiles!crm_interacciones_created_by_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as InteractionRow[]).map(mapInteraction));
}

export async function getCrmCustomerFollowups(
  tenant: TenantContext,
  clienteId: string,
): Promise<CoreResult<CrmFollowup[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_seguimientos")
    .select(
      "id, asignado_a, asunto, descripcion, fecha_programada, estado, completado_at, created_at, profiles!crm_seguimientos_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("cliente_id", clienteId)
    .order("fecha_programada", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as FollowupRow[]).map(mapFollowup));
}

export async function getAssignableUsersForCrm(
  tenant: TenantContext,
): Promise<CoreResult<CrmAssignableUser[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as AssignableUserRow[]).map((user) => user));
}

export async function getCrmSummary(tenant: TenantContext) {
  const customers = await getCrmCustomers(tenant);

  if (!customers.ok) {
    return ok({ pendingFollowups: 0, totalCustomers: 0 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("crm_seguimientos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "pendiente");

  return ok({
    pendingFollowups: count ?? 0,
    totalCustomers: customers.data.length,
  });
}
