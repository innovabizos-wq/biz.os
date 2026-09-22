import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_DISPATCH_STATUS_FILTER } from "@/modules/dispatch/constants";
import type {
  DispatchAssignableUser,
  DispatchDeliveryEvidence,
  DispatchFulfillmentEvent,
  DispatchItemProgress,
  DispatchOrder,
  DispatchStatusFilter,
  DispatchWarehouse,
} from "@/modules/dispatch/types";
import type {
  LogisticsDashboardStats,
  LogisticsDaySummary,
} from "@/modules/logistics/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type DescriptionRelation = {
  description: string | null;
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

type DispatchItemRow = {
  delivered_quantity: number;
  description: string;
  despacho_id: string;
  id: string;
  ordered_quantity: number;
  product_id: string | null;
  returned_quantity: number;
  sale_item_id: string;
};

type DispatchFulfillmentRow = {
  created_at: string;
  event_type: DispatchFulfillmentEvent["eventType"];
  id: string;
  receiver_name: string | null;
  result: string | null;
  sales_return_id: string | null;
  warehouse: NameRelation | NameRelation[] | null;
};

type DispatchFulfillmentItemRow = {
  dispatch_item_id: string;
  dispatch_items: DescriptionRelation | DescriptionRelation[] | null;
  fulfillment_id: string;
  quantity: number;
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

export type DispatchOrdersPage = {
  items: DispatchOrder[];
  page: number;
  pageSize: number;
  total: number;
};

export type DispatchOperationalSummary = {
  stats: LogisticsDashboardStats;
  summary: LogisticsDaySummary;
};

const DISPATCH_PAGE_SIZE = 50;

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

export async function getDispatchOrdersPage(
  tenant: TenantContext,
  page = 1,
  status: DispatchStatusFilter = DEFAULT_DISPATCH_STATUS_FILTER,
): Promise<CoreResult<DispatchOrdersPage>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver despachos.");
  }

  const safePage = Math.max(1, Math.trunc(page) || 1);
  const from = (safePage - 1) * DISPATCH_PAGE_SIZE;
  const supabase = await createClient();
  let query = supabase
    .from("despachos")
    .select(
      "id, venta_id, cliente_id, numero, estado, fecha_programada, hora_programada, responsable_id, direccion_entrega, contacto_entrega, telefono_entrega, notas, resultado, completado_at, created_at, updated_at, crm_clientes!despachos_cliente_empresa_fkey(nombre), ventas!despachos_venta_empresa_fkey(numero, total), responsable:profiles!despachos_responsable_empresa_fkey(nombre)",
      { count: "exact" },
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + DISPATCH_PAGE_SIZE - 1);

  if (status !== "todos") query = query.eq("estado", status);
  const { count, data, error } = await query;

  if (error) {
    return fail("QUERY_FAILED", "No se pudieron consultar despachos.", error);
  }

  return ok({
    items: ((data ?? []) as DispatchRow[]).map(mapDispatch),
    page: safePage,
    pageSize: DISPATCH_PAGE_SIZE,
    total: count ?? 0,
  });
}

export async function getDispatchOperationalSummary(
  tenant: TenantContext,
): Promise<CoreResult<DispatchOperationalSummary>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver despachos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dispatch_operational_summary");

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return fail("QUERY_FAILED", "No se pudo calcular el resumen de despacho.", error);
  }

  return ok(data as unknown as DispatchOperationalSummary);
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

export async function getDispatchItemProgress(
  tenant: TenantContext,
  despachoId: string,
): Promise<CoreResult<DispatchItemProgress[]>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver las líneas del despacho.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_items")
    .select(
      "id, despacho_id, sale_item_id, product_id, description, ordered_quantity, delivered_quantity, returned_quantity",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("despacho_id", despachoId)
    .order("created_at", { ascending: true });

  if (error) {
    return fail("VALIDATION_ERROR", "No se pudo consultar el avance por línea.", error);
  }

  return ok(((data ?? []) as DispatchItemRow[]).map((row) => ({
    deliveredQuantity: row.delivered_quantity,
    description: row.description,
    dispatchId: row.despacho_id,
    id: row.id,
    netDeliveredQuantity: row.delivered_quantity - row.returned_quantity,
    orderedQuantity: row.ordered_quantity,
    productId: row.product_id,
    returnedQuantity: row.returned_quantity,
    saleItemId: row.sale_item_id,
  })));
}

export async function getDispatchFulfillmentEvents(
  tenant: TenantContext,
  despachoId: string,
): Promise<CoreResult<DispatchFulfillmentEvent[]>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver el historial operativo.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_fulfillments")
    .select(
      "id, event_type, receiver_name, result, sales_return_id, created_at, warehouse:inventario_bodegas!dispatch_fulfillments_warehouse_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("despacho_id", despachoId)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("VALIDATION_ERROR", "No se pudo consultar el historial operativo.", error);
  }

  const rows = (data ?? []) as DispatchFulfillmentRow[];
  if (rows.length === 0) return ok([]);
  const eventIds = rows.map((row) => row.id);
  const { data: itemData, error: itemError } = await supabase
    .from("dispatch_fulfillment_items")
    .select(
      "fulfillment_id, dispatch_item_id, quantity, dispatch_items!dispatch_fulfillment_items_dispatch_item_empresa_fkey(description)",
    )
    .eq("empresa_id", tenant.empresaId)
    .in("fulfillment_id", eventIds)
    .order("created_at", { ascending: true });

  if (itemError) {
    return fail("VALIDATION_ERROR", "No se pudieron consultar las líneas del historial.", itemError);
  }

  const itemsByEvent = new Map<string, DispatchFulfillmentEvent["items"]>();
  for (const row of (itemData ?? []) as DispatchFulfillmentItemRow[]) {
    const items = itemsByEvent.get(row.fulfillment_id) ?? [];
    items.push({
      description: firstRelation(row.dispatch_items)?.description ?? "Línea de venta",
      dispatchItemId: row.dispatch_item_id,
      quantity: row.quantity,
    });
    itemsByEvent.set(row.fulfillment_id, items);
  }

  return ok(rows.map((row) => ({
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    items: itemsByEvent.get(row.id) ?? [],
    receiverName: row.receiver_name,
    result: row.result,
    salesReturnId: row.sales_return_id,
    warehouseName: firstRelation(row.warehouse)?.nombre ?? null,
  })));
}

export async function getDispatchWarehouses(
  tenant: TenantContext,
): Promise<CoreResult<DispatchWarehouse[]>> {
  if (!hasPermission(tenant.permissions, "dispatch.orders.status.change")) return ok([]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_bodegas")
    .select("id, nombre")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activa")
    .order("nombre", { ascending: true });
  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar las bodegas.", error);
  return ok((data ?? []) as DispatchWarehouse[]);
}
