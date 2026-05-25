import { createClient } from "@/lib/supabase/server";
import { normalizeConsultationDocument } from "@/modules/consultations/schemas";
import { lookupHaciendaContributorByDocument } from "@/modules/consultations/hacienda";
import type { ConsultationSearchResult } from "@/modules/consultations/types";
import type { CrmCustomer } from "@/modules/crm/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type ProfileRelation = {
  nombre: string | null;
};

type CustomerRow = {
  asignado_a: string | null;
  correo: string | null;
  created_at: string;
  empresa_id: string;
  estado: CrmCustomer["estado"];
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

export async function findCrmCustomerByDocument(
  tenant: TenantContext,
  documento: string,
): Promise<CoreResult<CrmCustomer | null>> {
  const normalized = normalizeConsultationDocument(documento);

  if (!normalized) return ok(null);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clientes")
    .select(
      "id, empresa_id, tipo, estado, nombre, identificacion, telefono, whatsapp, correo, origen, asignado_a, notas, created_at, updated_at, profiles!crm_clientes_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .not("identificacion", "is", null)
    .limit(200);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo buscar en CRM.", error);
  }

  const match = ((data ?? []) as CustomerRow[]).find(
    (row) => normalizeConsultationDocument(row.identificacion ?? "") === normalized,
  );

  return ok(match ? mapCustomer(match) : null);
}

export async function getAutomaticCustomerType(
  tenant: TenantContext,
  customerId: string,
): Promise<CoreResult<CrmCustomer["tipo"]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("cliente_id", customerId)
    .in("estado", ["confirmada", "en_proceso", "completada"])
    .limit(1);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo revisar el historial de ventas.", error);
  }

  return ok((data ?? []).length > 0 ? "cliente" : "prospecto");
}

export async function getConsultationSearchResult(
  tenant: TenantContext,
  documento: string,
): Promise<CoreResult<ConsultationSearchResult>> {
  const normalized = normalizeConsultationDocument(documento);
  const internal = await findCrmCustomerByDocument(tenant, normalized);

  if (!internal.ok) return internal;

  if (internal.data) {
    const automaticType = await getAutomaticCustomerType(tenant, internal.data.id);

    if (!automaticType.ok) return automaticType;

    return ok({
      cliente: internal.data,
      documento: normalized,
      source: "internal",
      tipoAutomatico: automaticType.data,
    });
  }

  const hacienda = await lookupHaciendaContributorByDocument(normalized);

  if (hacienda.found) {
    return ok({
      hacienda,
      source: "hacienda",
    });
  }

  return ok({
    documento: normalized,
    message: hacienda.message,
    source: "manual",
  });
}
