import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_SALE_STATUS_FILTER } from "@/modules/sales/constants";
import type { Sale, SaleItem, SaleStatusFilter } from "@/modules/sales/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type NumberRelation = {
  numero: string | null;
};

type ProductRelation = {
  codigo: string | null;
  nombre: string | null;
};

type SaleRow = {
  cliente_id: string | null;
  cotizacion_id: string | null;
  cotizaciones: NumberRelation | NumberRelation[] | null;
  created_at: string;
  crm_clientes: NameRelation | NameRelation[] | null;
  descuento_total: number;
  estado: Sale["estado"];
  fecha_venta: string;
  id: string;
  inventario_aplicado_at: string | null;
  inventario_estado: Sale["inventarioEstado"];
  impuesto_total: number;
  moneda: string;
  notas: string | null;
  numero: string;
  profiles: NameRelation | NameRelation[] | null;
  subtotal: number;
  total: number;
  updated_at: string;
};

type SaleItemRow = {
  cantidad: number;
  catalogo_productos: ProductRelation | ProductRelation[] | null;
  cotizacion_item_id: string | null;
  descripcion: string;
  descuento: number;
  id: string;
  impuesto_monto: number;
  impuesto_porcentaje: number;
  orden: number;
  precio_unitario: number;
  producto_id: string | null;
  subtotal: number;
  total: number;
  venta_id: string;
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapSale(row: SaleRow): Sale {
  return {
    clienteId: row.cliente_id,
    clienteNombre: firstRelation(row.crm_clientes)?.nombre ?? null,
    cotizacionId: row.cotizacion_id,
    cotizacionNumero: firstRelation(row.cotizaciones)?.numero ?? null,
    creadoPorNombre: firstRelation(row.profiles)?.nombre ?? null,
    createdAt: row.created_at,
    descuentoTotal: row.descuento_total,
    estado: row.estado,
    fechaVenta: row.fecha_venta,
    id: row.id,
    inventarioAplicadoAt: row.inventario_aplicado_at,
    inventarioEstado: row.inventario_estado,
    impuestoTotal: row.impuesto_total,
    moneda: row.moneda,
    notas: row.notas,
    numero: row.numero,
    subtotal: row.subtotal,
    total: row.total,
    updatedAt: row.updated_at,
  };
}

function mapSaleItem(row: SaleItemRow): SaleItem {
  return {
    cantidad: row.cantidad,
    cotizacionItemId: row.cotizacion_item_id,
    descripcion: row.descripcion,
    descuento: row.descuento,
    id: row.id,
    impuestoMonto: row.impuesto_monto,
    impuestoPorcentaje: row.impuesto_porcentaje,
    orden: row.orden,
    precioUnitario: row.precio_unitario,
    productoCodigo: firstRelation(row.catalogo_productos)?.codigo ?? null,
    productoId: row.producto_id,
    productoNombre: firstRelation(row.catalogo_productos)?.nombre ?? null,
    subtotal: row.subtotal,
    total: row.total,
    ventaId: row.venta_id,
  };
}

export function canAccessSalesNav(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "sales.orders.view",
    "sales.orders.create",
    "sales.orders.edit",
  ]);
}

export async function getSales(
  tenant: TenantContext,
  status: SaleStatusFilter = DEFAULT_SALE_STATUS_FILTER,
): Promise<CoreResult<Sale[]>> {
  if (!hasPermission(tenant.permissions, "sales.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver ventas.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("ventas")
    .select(
      "id, cotizacion_id, cliente_id, numero, estado, inventario_estado, inventario_aplicado_at, fecha_venta, moneda, subtotal, descuento_total, impuesto_total, total, notas, created_at, updated_at, crm_clientes!ventas_cliente_empresa_fkey(nombre), cotizaciones!ventas_cotizacion_empresa_fkey(numero), profiles!ventas_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (status !== "todos") {
    query = query.eq("estado", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar ventas.", error);
  }

  return ok(((data ?? []) as SaleRow[]).map(mapSale));
}

export async function getSaleDetail(
  tenant: TenantContext,
  ventaId: string,
): Promise<CoreResult<Sale | null>> {
  if (!hasPermission(tenant.permissions, "sales.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver ventas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, cotizacion_id, cliente_id, numero, estado, inventario_estado, inventario_aplicado_at, fecha_venta, moneda, subtotal, descuento_total, impuesto_total, total, notas, created_at, updated_at, crm_clientes!ventas_cliente_empresa_fkey(nombre), cotizaciones!ventas_cotizacion_empresa_fkey(numero), profiles!ventas_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("id", ventaId)
    .maybeSingle<SaleRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la venta.", error);
  }

  return ok(data ? mapSale(data) : null);
}

export async function getSaleItems(
  tenant: TenantContext,
  ventaId: string,
): Promise<CoreResult<SaleItem[]>> {
  if (!hasPermission(tenant.permissions, "sales.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver ventas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venta_items")
    .select(
      "id, venta_id, cotizacion_item_id, producto_id, descripcion, cantidad, precio_unitario, descuento, impuesto_porcentaje, subtotal, impuesto_monto, total, orden, catalogo_productos(codigo, nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("venta_id", ventaId)
    .order("orden", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar items.", error);
  }

  return ok(((data ?? []) as SaleItemRow[]).map(mapSaleItem));
}

export async function getSaleForQuote(
  tenant: TenantContext,
  cotizacionId: string,
): Promise<CoreResult<Sale | null>> {
  if (!hasPermission(tenant.permissions, "sales.orders.view")) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, cotizacion_id, cliente_id, numero, estado, inventario_estado, inventario_aplicado_at, fecha_venta, moneda, subtotal, descuento_total, impuesto_total, total, notas, created_at, updated_at, crm_clientes!ventas_cliente_empresa_fkey(nombre), cotizaciones!ventas_cotizacion_empresa_fkey(numero), profiles!ventas_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("cotizacion_id", cotizacionId)
    .maybeSingle<SaleRow>();

  if (error) {
    return ok(null);
  }

  return ok(data ? mapSale(data) : null);
}
