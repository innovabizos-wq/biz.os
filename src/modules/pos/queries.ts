import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import type { PosCatalogItem, PosSession, PosTerminal } from "@/modules/pos/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type WarehouseRelation = { nombre: string | null };
type TerminalRow = {
  code: string;
  id: string;
  inventario_bodegas: WarehouseRelation | WarehouseRelation[] | null;
  name: string;
  offline_enabled: boolean;
  offline_session_hours: number;
  status: PosTerminal["status"];
  warehouse_id: string;
};
type SessionRow = {
  authorized_until: string;
  id: string;
  last_sequence: number;
  opened_at: string;
  opening_cash: number;
  status: PosSession["status"];
  terminal_id: string;
};
type CatalogRow = {
  code: string | null;
  currency: string;
  name: string;
  product_id: string;
  product_type: PosCatalogItem["productType"];
  tax_rate: number;
  unit: string;
  unit_price: number;
};
type AllocationRow = {
  allocated_quantity: number;
  consumed_quantity: number;
  product_id: string;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function canUsePos(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "sales.pos.use",
    "sales.pos.manage",
    "sales.cash.manage",
  ]);
}

export async function getPosTerminals(
  tenant: TenantContext,
): Promise<CoreResult<PosTerminal[]>> {
  if (!canUsePos(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para usar el punto de venta.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_terminals")
    .select("id, code, name, warehouse_id, status, offline_enabled, offline_session_hours, inventario_bodegas!pos_terminals_warehouse_empresa_fkey(nombre)")
    .eq("empresa_id", tenant.empresaId)
    .order("name", { ascending: true });
  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar las terminales POS.", error);
  return ok(((data ?? []) as TerminalRow[]).map((row) => ({
    code: row.code,
    id: row.id,
    name: row.name,
    offlineEnabled: row.offline_enabled,
    offlineSessionHours: row.offline_session_hours,
    status: row.status,
    warehouseId: row.warehouse_id,
    warehouseName: first(row.inventario_bodegas)?.nombre ?? null,
  })));
}

export async function getCurrentPosSessions(
  tenant: TenantContext,
): Promise<CoreResult<PosSession[]>> {
  if (!canUsePos(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para usar el punto de venta.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pos_sessions")
    .select("id, terminal_id, status, opened_at, authorized_until, opening_cash, last_sequence")
    .eq("empresa_id", tenant.empresaId)
    .in("status", ["open", "pending_sync"])
    .order("opened_at", { ascending: false });
  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar las cajas abiertas.", error);
  return ok(((data ?? []) as SessionRow[]).map((row) => ({
    authorizedUntil: row.authorized_until,
    id: row.id,
    lastSequence: row.last_sequence,
    openedAt: row.opened_at,
    openingCash: row.opening_cash,
    status: row.status,
    terminalId: row.terminal_id,
  })));
}

export async function getPosCatalogPage(
  tenant: TenantContext,
  sessionId: string,
  options: { limit?: number; offset?: number; search?: string } = {},
): Promise<CoreResult<{ items: PosCatalogItem[]; nextOffset: number | null }>> {
  if (!hasPermission(tenant.permissions, "sales.pos.use")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para vender en POS.");
  }
  const limit = Math.min(500, Math.max(1, options.limit ?? 200));
  const offset = Math.max(0, options.offset ?? 0);
  const supabase = await createClient();
  let query = supabase
    .from("pos_session_catalog")
    .select("product_id, product_type, code, name, unit, currency, unit_price, tax_rate")
    .eq("empresa_id", tenant.empresaId)
    .eq("session_id", sessionId)
    .order("name", { ascending: true })
    .range(offset, offset + limit);
  const search = options.search?.trim();
  if (search) query = query.ilike("name", `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const { data, error } = await query;
  if (error) return fail("VALIDATION_ERROR", "No se pudo descargar el catálogo de caja.", error);

  const rows = (data ?? []) as CatalogRow[];
  const ids = rows.map((row) => row.product_id);
  const allocationMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: allocations, error: allocationError } = await supabase
      .from("pos_stock_allocations")
      .select("product_id, allocated_quantity, consumed_quantity")
      .eq("empresa_id", tenant.empresaId)
      .eq("session_id", sessionId)
      .in("product_id", ids);
    if (allocationError) return fail("VALIDATION_ERROR", "No se pudo consultar el cupo sin conexión.", allocationError);
    for (const row of (allocations ?? []) as AllocationRow[]) {
      allocationMap.set(row.product_id, Number(row.allocated_quantity) - Number(row.consumed_quantity));
    }
  }
  const hasNext = rows.length > limit;
  return ok({
    items: rows.slice(0, limit).map((row) => ({
      code: row.code,
      currency: row.currency,
      name: row.name,
      offlineAvailable: allocationMap.get(row.product_id) ?? 0,
      productId: row.product_id,
      productType: row.product_type,
      taxRate: Number(row.tax_rate),
      unit: row.unit,
      unitPrice: Number(row.unit_price),
    })),
    nextOffset: hasNext ? offset + limit : null,
  });
}
