import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_QUOTE_STATUS_FILTER } from "@/modules/quotes/constants";
import type {
  Quote,
  QuoteCatalogProduct,
  QuoteCustomer,
  QuoteItem,
  QuoteStatusFilter,
} from "@/modules/quotes/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type ProductRelation = {
  codigo: string | null;
  nombre: string | null;
};

type QuoteRow = {
  cliente_id: string | null;
  condiciones: string | null;
  created_at: string;
  crm_clientes: NameRelation | NameRelation[] | null;
  descuento_total: number;
  estado: Quote["estado"];
  fecha_emision: string;
  fecha_vencimiento: string | null;
  id: string;
  impuesto_total: number;
  moneda: string;
  notas: string | null;
  numero: string;
  profiles: NameRelation | NameRelation[] | null;
  subtotal: number;
  total: number;
  updated_at: string;
};

type QuoteItemRow = {
  cantidad: number;
  catalogo_productos: ProductRelation | ProductRelation[] | null;
  cotizacion_id: string;
  created_at: string;
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
  updated_at: string;
};

type QuoteCustomerRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  whatsapp: string | null;
};

type QuoteCatalogProductRow = {
  codigo: string | null;
  descripcion: string | null;
  id: string;
  impuesto_porcentaje: number;
  moneda: string;
  nombre: string;
  precio_base: number;
  tipo: QuoteCatalogProduct["tipo"];
  unidad_medida: string;
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapQuote(row: QuoteRow): Quote {
  return {
    clienteId: row.cliente_id,
    clienteNombre: firstRelation(row.crm_clientes)?.nombre ?? null,
    condiciones: row.condiciones,
    creadoPorNombre: firstRelation(row.profiles)?.nombre ?? null,
    createdAt: row.created_at,
    descuentoTotal: row.descuento_total,
    estado: row.estado,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento,
    id: row.id,
    impuestoTotal: row.impuesto_total,
    moneda: row.moneda,
    notas: row.notas,
    numero: row.numero,
    subtotal: row.subtotal,
    total: row.total,
    updatedAt: row.updated_at,
  };
}

function mapQuoteItem(row: QuoteItemRow): QuoteItem {
  return {
    cantidad: row.cantidad,
    cotizacionId: row.cotizacion_id,
    createdAt: row.created_at,
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
    updatedAt: row.updated_at,
  };
}

function mapQuoteCatalogProduct(row: QuoteCatalogProductRow): QuoteCatalogProduct {
  return {
    codigo: row.codigo,
    descripcion: row.descripcion,
    id: row.id,
    impuestoPorcentaje: row.impuesto_porcentaje,
    moneda: row.moneda,
    nombre: row.nombre,
    precioBase: row.precio_base,
    tipo: row.tipo,
    unidadMedida: row.unidad_medida,
  };
}

function canReadQuotes(tenant: TenantContext) {
  return hasPermission(tenant.permissions, "quotes.view");
}

function canCreateQuotes(tenant: TenantContext) {
  return hasPermission(tenant.permissions, "quotes.create");
}

export function canAccessQuotesNav(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "quotes.view",
    "quotes.create",
    "quotes.edit",
  ]);
}

export async function getQuotes(
  tenant: TenantContext,
  status: QuoteStatusFilter = DEFAULT_QUOTE_STATUS_FILTER,
): Promise<CoreResult<Quote[]>> {
  if (!canReadQuotes(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver cotizaciones.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("cotizaciones")
    .select(
      "id, cliente_id, numero, estado, fecha_emision, fecha_vencimiento, moneda, subtotal, descuento_total, impuesto_total, total, notas, condiciones, created_at, updated_at, crm_clientes!cotizaciones_cliente_empresa_fkey(nombre), profiles!cotizaciones_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (status !== "todos") {
    query = query.eq("estado", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar cotizaciones.", error);
  }

  return ok(((data ?? []) as QuoteRow[]).map(mapQuote));
}

export async function getQuoteDetail(
  tenant: TenantContext,
  cotizacionId: string,
): Promise<CoreResult<Quote | null>> {
  if (!canReadQuotes(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver cotizaciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, cliente_id, numero, estado, fecha_emision, fecha_vencimiento, moneda, subtotal, descuento_total, impuesto_total, total, notas, condiciones, created_at, updated_at, crm_clientes!cotizaciones_cliente_empresa_fkey(nombre), profiles!cotizaciones_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("id", cotizacionId)
    .maybeSingle<QuoteRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la cotizacion.", error);
  }

  return ok(data ? mapQuote(data) : null);
}

export async function getQuoteItems(
  tenant: TenantContext,
  cotizacionId: string,
): Promise<CoreResult<QuoteItem[]>> {
  if (!canReadQuotes(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver cotizaciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizacion_items")
    .select(
      "id, cotizacion_id, producto_id, descripcion, cantidad, precio_unitario, descuento, impuesto_porcentaje, subtotal, impuesto_monto, total, orden, created_at, updated_at, catalogo_productos!cotizacion_items_producto_empresa_fkey(codigo, nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("cotizacion_id", cotizacionId)
    .order("orden", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar items.", error);
  }

  return ok(((data ?? []) as QuoteItemRow[]).map(mapQuoteItem));
}

export async function getActiveCatalogProductsForQuote(
  tenant: TenantContext,
): Promise<CoreResult<QuoteCatalogProduct[]>> {
  if (!hasPermission(tenant.permissions, "quotes.edit")) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_productos")
    .select(
      "id, codigo, nombre, tipo, descripcion, unidad_medida, precio_base, impuesto_porcentaje, moneda",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as QuoteCatalogProductRow[]).map(mapQuoteCatalogProduct));
}

export async function getCustomersForQuote(
  tenant: TenantContext,
): Promise<CoreResult<QuoteCustomer[]>> {
  if (!canCreateQuotes(tenant) && !hasPermission(tenant.permissions, "quotes.edit")) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clientes")
    .select("id, nombre, telefono, whatsapp")
    .eq("empresa_id", tenant.empresaId)
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as QuoteCustomerRow[]).map((customer) => customer));
}

export async function getQuotesForCustomer(
  tenant: TenantContext,
  clienteId: string,
): Promise<CoreResult<Quote[]>> {
  if (!canReadQuotes(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(
      "id, cliente_id, numero, estado, fecha_emision, fecha_vencimiento, moneda, subtotal, descuento_total, impuesto_total, total, notas, condiciones, created_at, updated_at, crm_clientes!cotizaciones_cliente_empresa_fkey(nombre), profiles!cotizaciones_creado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as QuoteRow[]).map(mapQuote));
}
