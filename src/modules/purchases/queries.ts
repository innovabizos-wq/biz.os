import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReceipt,
  PurchaseReceiptItem,
  PurchaseSupplier,
  PurchasesSummary,
} from "@/modules/purchases/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type SupplierRow = {
  correo: string | null;
  created_at: string;
  direccion: string | null;
  estado: PurchaseSupplier["estado"];
  id: string;
  identificacion: string | null;
  nombre: string;
  notas: string | null;
  telefono: string | null;
};

type OrderRow = {
  bodega_id: string | null;
  created_at: string;
  estado: PurchaseOrder["estado"];
  fecha_orden: string;
  fecha_recepcion: string | null;
  id: string;
  moneda: string;
  notas: string | null;
  numero: string;
  received_at: string | null;
  supplier_id: string | null;
  total: number;
};

type OrderItemRow = {
  cantidad: number;
  cantidad_recibida: number | null;
  costo_unitario: number;
  descripcion: string;
  id: string;
  order_id: string;
  producto_id: string | null;
  total: number;
};

type ReceiptRow = {
  bodega_id: string;
  id: string;
  notas: string | null;
  numero: string;
  order_id: string;
  received_at: string;
  received_by: string | null;
};

type ReceiptItemRow = {
  cantidad: number;
  costo_unitario: number;
  id: string;
  order_item_id: string;
  producto_id: string;
  receipt_id: string;
  total: number;
};

type NameRow = {
  id: string;
  nombre: string | null;
};

type ProductRow = NameRow & {
  codigo: string | null;
};

export type PurchaseOrdersPage = {
  items: PurchaseOrder[];
  page: number;
  pageSize: number;
  total: number;
};

const PURCHASES_PAGE_SIZE = 50;

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function mapSupplier(row: SupplierRow): PurchaseSupplier {
  return {
    correo: row.correo,
    createdAt: row.created_at,
    direccion: row.direccion,
    estado: row.estado,
    id: row.id,
    identificacion: row.identificacion,
    nombre: row.nombre,
    notas: row.notas,
    telefono: row.telefono,
  };
}

function mapOrder(
  row: OrderRow,
  suppliersById: Map<string, string | null>,
  warehousesById: Map<string, string | null>,
): PurchaseOrder {
  return {
    bodegaId: row.bodega_id,
    bodegaNombre: row.bodega_id ? (warehousesById.get(row.bodega_id) ?? null) : null,
    createdAt: row.created_at,
    estado: row.estado,
    fechaOrden: row.fecha_orden,
    fechaRecepcion: row.fecha_recepcion,
    id: row.id,
    moneda: row.moneda,
    notas: row.notas,
    numero: row.numero,
    receivedAt: row.received_at,
    supplierId: row.supplier_id,
    supplierNombre: row.supplier_id
      ? (suppliersById.get(row.supplier_id) ?? null)
      : null,
    total: row.total,
  };
}

function mapOrderItem(
  row: OrderItemRow,
  productsById: Map<string, ProductRow>,
): PurchaseOrderItem {
  const product = row.producto_id ? productsById.get(row.producto_id) : null;
  const received = row.cantidad_recibida ?? 0;

  return {
    cantidad: row.cantidad,
    cantidadPendiente: Math.max(row.cantidad - received, 0),
    cantidadRecibida: received,
    costoUnitario: row.costo_unitario,
    descripcion: row.descripcion,
    id: row.id,
    orderId: row.order_id,
    productoCodigo: product?.codigo ?? null,
    productoId: row.producto_id,
    productoNombre: product?.nombre ?? null,
    total: row.total,
  };
}

function mapReceipt(
  row: ReceiptRow,
  warehousesById: Map<string, string | null>,
  profilesById: Map<string, string | null>,
): PurchaseReceipt {
  return {
    bodegaId: row.bodega_id,
    bodegaNombre: warehousesById.get(row.bodega_id) ?? null,
    id: row.id,
    notas: row.notas,
    numero: row.numero,
    orderId: row.order_id,
    receivedAt: row.received_at,
    receivedByNombre: row.received_by
      ? (profilesById.get(row.received_by) ?? null)
      : null,
  };
}

function mapReceiptItem(
  row: ReceiptItemRow,
  productsById: Map<string, ProductRow>,
): PurchaseReceiptItem {
  return {
    cantidad: row.cantidad,
    costoUnitario: row.costo_unitario,
    id: row.id,
    orderItemId: row.order_item_id,
    productoId: row.producto_id,
    productoNombre: productsById.get(row.producto_id)?.nombre ?? null,
    receiptId: row.receipt_id,
    total: row.total,
  };
}

export function canAccessPurchases(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "purchases") &&
    hasAnyPermission(tenant.permissions, [
      "purchases.suppliers.view",
      "purchases.suppliers.manage",
      "purchases.orders.view",
      "purchases.orders.manage",
    ])
  );
}

export function canManagePurchases(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "purchases") &&
    hasAnyPermission(tenant.permissions, [
      "purchases.suppliers.manage",
      "purchases.orders.manage",
    ])
  );
}

export async function getPurchaseSuppliers(
  tenant: TenantContext,
): Promise<CoreResult<PurchaseSupplier[]>> {
  if (!isModuleActive(tenant.activeModules, "purchases")) {
    return fail("MODULE_INACTIVE", "El modulo Compras no esta activo.");
  }

  if (
    !hasAnyPermission(tenant.permissions, [
      "purchases.suppliers.view",
      "purchases.suppliers.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver proveedores.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases_suppliers")
    .select("id, nombre, identificacion, correo, telefono, direccion, estado, notas, created_at")
    .eq("empresa_id", tenant.empresaId)
    .order("nombre", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar proveedores.", error);
  }

  return ok(((data ?? []) as SupplierRow[]).map(mapSupplier));
}

async function getNamesById(
  tenant: TenantContext,
  table: string,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string | null>();

  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id, nombre")
    .in("id", ids);

  if (["purchases_suppliers", "inventario_bodegas", "profiles"].includes(table)) {
    query = query.eq("empresa_id", tenant.empresaId);
  }

  const { data, error } = await query;

  if (error) {
    return new Map<string, string | null>();
  }

  return new Map(((data ?? []) as NameRow[]).map((row) => [row.id, row.nombre]));
}

async function getProductsById(tenant: TenantContext, ids: string[]) {
  if (ids.length === 0) return new Map<string, ProductRow>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_productos")
    .select("id, codigo, nombre")
    .eq("empresa_id", tenant.empresaId)
    .in("id", ids);

  if (error) {
    return new Map<string, ProductRow>();
  }

  return new Map(((data ?? []) as ProductRow[]).map((row) => [row.id, row]));
}

export async function getPurchaseOrders(
  tenant: TenantContext,
): Promise<CoreResult<PurchaseOrder[]>> {
  if (!isModuleActive(tenant.activeModules, "purchases")) {
    return fail("MODULE_INACTIVE", "El modulo Compras no esta activo.");
  }

  if (
    !hasAnyPermission(tenant.permissions, [
      "purchases.orders.view",
      "purchases.orders.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver compras.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases_orders")
    .select(
      "id, supplier_id, numero, estado, moneda, total, fecha_orden, fecha_recepcion, bodega_id, notas, received_at, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar ordenes.", error);
  }

  const rows = (data ?? []) as OrderRow[];
  const [suppliersById, warehousesById] = await Promise.all([
    getNamesById(
      tenant,
      "purchases_suppliers",
      uniqueIds(rows.map((row) => row.supplier_id)),
    ),
    getNamesById(
      tenant,
      "inventario_bodegas",
      uniqueIds(rows.map((row) => row.bodega_id)),
    ),
  ]);

  return ok(rows.map((row) => mapOrder(row, suppliersById, warehousesById)));
}

export async function getPurchaseOrdersPage(
  tenant: TenantContext,
  page = 1,
): Promise<CoreResult<PurchaseOrdersPage>> {
  if (!isModuleActive(tenant.activeModules, "purchases")) {
    return fail("MODULE_INACTIVE", "El modulo Compras no esta activo.");
  }

  if (!canAccessPurchases(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver compras.");
  }

  const safePage = Math.max(1, Math.trunc(page) || 1);
  const from = (safePage - 1) * PURCHASES_PAGE_SIZE;
  const supabase = await createClient();
  const { count, data, error } = await supabase
    .from("purchases_orders")
    .select(
      "id, supplier_id, numero, estado, moneda, total, fecha_orden, fecha_recepcion, bodega_id, notas, received_at, created_at",
      { count: "exact" },
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PURCHASES_PAGE_SIZE - 1);

  if (error) {
    return fail("QUERY_FAILED", "No se pudieron cargar ordenes.", error);
  }

  const rows = (data ?? []) as OrderRow[];
  const [suppliersById, warehousesById] = await Promise.all([
    getNamesById(tenant, "purchases_suppliers", uniqueIds(rows.map((row) => row.supplier_id))),
    getNamesById(tenant, "inventario_bodegas", uniqueIds(rows.map((row) => row.bodega_id))),
  ]);

  return ok({
    items: rows.map((row) => mapOrder(row, suppliersById, warehousesById)),
    page: safePage,
    pageSize: PURCHASES_PAGE_SIZE,
    total: count ?? 0,
  });
}

export async function getPurchaseOrderDetail(
  tenant: TenantContext,
  orderId: string,
): Promise<CoreResult<PurchaseOrder | null>> {
  const orders = await getPurchaseOrders(tenant);

  if (!orders.ok) return orders;

  return ok(orders.data.find((order) => order.id === orderId) ?? null);
}

export async function getPurchaseOrderItems(
  tenant: TenantContext,
  orderId?: string | string[],
): Promise<CoreResult<PurchaseOrderItem[]>> {
  if (!canAccessPurchases(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  let query = supabase
    .from("purchases_order_items")
    .select(
      "id, order_id, producto_id, descripcion, cantidad, cantidad_recibida, costo_unitario, total, created_at",
    )
    .eq("empresa_id", tenant.empresaId);

  if (Array.isArray(orderId)) {
    if (orderId.length === 0) return ok([]);
    query = query.in("order_id", orderId);
  } else if (orderId) {
    query = query.eq("order_id", orderId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  const rows = (data ?? []) as OrderItemRow[];
  const productsById = await getProductsById(
    tenant,
    uniqueIds(rows.map((row) => row.producto_id)),
  );

  return ok(rows.map((row) => mapOrderItem(row, productsById)));
}

export async function getPurchaseReceipts(
  tenant: TenantContext,
  orderId?: string,
): Promise<CoreResult<PurchaseReceipt[]>> {
  if (!canAccessPurchases(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  let query = supabase
    .from("purchases_receipts")
    .select("id, order_id, numero, bodega_id, received_by, received_at, notas")
    .eq("empresa_id", tenant.empresaId);

  if (orderId) {
    query = query.eq("order_id", orderId);
  }

  const { data, error } = await query.order("received_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  const rows = (data ?? []) as ReceiptRow[];
  const [warehousesById, profilesById] = await Promise.all([
    getNamesById(
      tenant,
      "inventario_bodegas",
      uniqueIds(rows.map((row) => row.bodega_id)),
    ),
    getNamesById(tenant, "profiles", uniqueIds(rows.map((row) => row.received_by))),
  ]);

  return ok(rows.map((row) => mapReceipt(row, warehousesById, profilesById)));
}

export async function getPurchaseReceiptItems(
  tenant: TenantContext,
  receiptIds: string[],
): Promise<CoreResult<PurchaseReceiptItem[]>> {
  if (!canAccessPurchases(tenant) || receiptIds.length === 0) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases_receipt_items")
    .select("id, receipt_id, order_item_id, producto_id, cantidad, costo_unitario, total")
    .eq("empresa_id", tenant.empresaId)
    .in("receipt_id", receiptIds)
    .order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  const rows = (data ?? []) as ReceiptItemRow[];
  const productsById = await getProductsById(
    tenant,
    uniqueIds(rows.map((row) => row.producto_id)),
  );

  return ok(rows.map((row) => mapReceiptItem(row, productsById)));
}

export async function getPurchasesSummary(
  tenant: TenantContext,
): Promise<CoreResult<PurchasesSummary>> {
  if (!canAccessPurchases(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver compras.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_purchases_operational_summary");

  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return fail("QUERY_FAILED", "No se pudo calcular el resumen de compras.", error);
  }

  const summary = data as Record<string, unknown>;
  return ok({
    ordenesBorrador: Number(summary.ordenesBorrador ?? 0),
    ordenesEmitidas: Number(summary.ordenesEmitidas ?? 0),
    ordenesParciales: Number(summary.ordenesParciales ?? 0),
    ordenesRecibidas: Number(summary.ordenesRecibidas ?? 0),
    proveedoresActivos: Number(summary.proveedoresActivos ?? 0),
    totalComprado: Number(summary.totalComprado ?? 0),
    totalPendienteRecepcion: Number(summary.totalPendienteRecepcion ?? 0),
  });
}
