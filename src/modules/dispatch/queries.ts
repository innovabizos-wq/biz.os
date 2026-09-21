import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_DISPATCH_STATUS_FILTER } from "@/modules/dispatch/constants";
import type {
  DispatchAssignableUser,
  DispatchDeliveryEvidence,
  DispatchOrder,
  DispatchStatusFilter,
} from "@/modules/dispatch/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type SaleRelation = {
  numero: string | null;
  total: number | null;
};

type DispatchRow = {
  cliente_id: string | null;
  completado_at: string | null;
  contacto_entrega: string | null;
  created_at: string;
  crm_clientes: NameRelation | NameRelation[] | null;
  direccion_entrega: string | null;
  estado: DispatchOrder["estado"];
  fecha_programada: string | null;
  hora_programada: string | null;
  id: string;
  notas: string | null;
  numero: string;
  responsable_id: string | null;
  resultado: string | null;
  responsable: NameRelation | NameRelation[] | null;
  telefono_entrega: string | null;
  updated_at: string;
  venta_id: string;
  ventas: SaleRelation | SaleRelation[] | null;
};

type UserRow = {
  id: string;
  nombre: string;
};

type DispatchEvidenceRow = {
  accuracy_meters: number | null;
  captured_at: string;
  created_at: string;
  file_name: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  mime_type: string;
  receptor_nombre: string | null;
  size_bytes: number;
  tipo: DispatchDeliveryEvidence["type"];
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapDispatch(row: DispatchRow): DispatchOrder {
  const sale = firstRelation(row.ventas);

  return {
    clienteId: row.cliente_id,
    clienteNombre: firstRelation(row.crm_clientes)?.nombre ?? null,
    completadoAt: row.completado_at,
    contactoEntrega: row.contacto_entrega,
    createdAt: row.created_at,
    direccionEntrega: row.direccion_entrega,
    estado: row.estado,
    fechaProgramada: row.fecha_programada,
    horaProgramada: row.hora_programada,
    id: row.id,
    notas: row.notas,
    numero: row.numero,
    responsableId: row.responsable_id,
    responsableNombre: firstRelation(row.responsable)?.nombre ?? null,
    resultado: row.resultado,
    telefonoEntrega: row.telefono_entrega,
    totalVenta: sale?.total ?? null,
    updatedAt: row.updated_at,
    ventaId: row.venta_id,
    ventaNumero: sale?.numero ?? null,
  };
}

export function canAccessDispatchNav(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "dispatch.orders.view",
    "dispatch.orders.create",
    "dispatch.orders.edit",
  ]);
}

export async function getDispatchOrders(
  tenant: TenantContext,
  status: DispatchStatusFilter = DEFAULT_DISPATCH_STATUS_FILTER,
): Promise<CoreResult<DispatchOrder[]>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver despachos.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("despachos")
    .select(
      "id, venta_id, cliente_id, numero, estado, fecha_programada, hora_programada, responsable_id, direccion_entrega, contacto_entrega, telefono_entrega, notas, resultado, completado_at, created_at, updated_at, crm_clientes!despachos_cliente_empresa_fkey(nombre), ventas!despachos_venta_empresa_fkey(numero, total), responsable:profiles!despachos_responsable_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (status !== "todos") {
    query = query.eq("estado", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar despachos.", error);
  }

  return ok(((data ?? []) as DispatchRow[]).map(mapDispatch));
}

export async function getDispatchDetail(
  tenant: TenantContext,
  despachoId: string,
): Promise<CoreResult<DispatchOrder | null>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver despachos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despachos")
    .select(
      "id, venta_id, cliente_id, numero, estado, fecha_programada, hora_programada, responsable_id, direccion_entrega, contacto_entrega, telefono_entrega, notas, resultado, completado_at, created_at, updated_at, crm_clientes!despachos_cliente_empresa_fkey(nombre), ventas!despachos_venta_empresa_fkey(numero, total), responsable:profiles!despachos_responsable_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("id", despachoId)
    .maybeSingle<DispatchRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el despacho.", error);
  }

  return ok(data ? mapDispatch(data) : null);
}

export async function getDispatchForSale(
  tenant: TenantContext,
  ventaId: string,
): Promise<CoreResult<DispatchOrder | null>> {
  if (!canAccessDispatchNav(tenant)) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despachos")
    .select(
      "id, venta_id, cliente_id, numero, estado, fecha_programada, hora_programada, responsable_id, direccion_entrega, contacto_entrega, telefono_entrega, notas, resultado, completado_at, created_at, updated_at, crm_clientes!despachos_cliente_empresa_fkey(nombre), ventas!despachos_venta_empresa_fkey(numero, total), responsable:profiles!despachos_responsable_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("venta_id", ventaId)
    .maybeSingle<DispatchRow>();

  if (error) {
    return ok(null);
  }

  return ok(data ? mapDispatch(data) : null);
}

export async function getAssignableUsersForDispatch(
  tenant: TenantContext,
): Promise<CoreResult<DispatchAssignableUser[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "dispatch.orders.create",
      "dispatch.orders.edit",
    ])
  ) {
    return ok([]);
  }

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

  return ok(((data ?? []) as UserRow[]).map((row) => ({ ...row })));
}

export async function getDispatchDeliveryEvidence(
  tenant: TenantContext,
  despachoId: string,
): Promise<CoreResult<DispatchDeliveryEvidence[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "dispatch.orders.view",
      "dispatch.orders.status.change",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver evidencias de entrega.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_delivery_evidence")
    .select(
      "id, tipo, mime_type, file_name, size_bytes, captured_at, receptor_nombre, latitude, longitude, accuracy_meters, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("despacho_id", despachoId)
    .order("captured_at", { ascending: false });

  if (error) {
    return fail("VALIDATION_ERROR", "No se pudieron consultar las evidencias.", error);
  }

  return ok(((data ?? []) as DispatchEvidenceRow[]).map((row) => ({
    accuracyMeters: row.accuracy_meters,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    fileName: row.file_name,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    mimeType: row.mime_type,
    receiverName: row.receptor_nombre,
    sizeBytes: row.size_bytes,
    type: row.tipo,
  })));
}
