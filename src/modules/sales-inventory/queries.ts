import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import type {
  SaleInventorySummaryItem,
  SaleInventoryWarehouse,
} from "@/modules/sales-inventory/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type SaleInventorySummaryRow = {
  bodega_id: string | null;
  bodega_nombre: string | null;
  cantidad_requerida: number;
  descripcion: string;
  producto_codigo: string | null;
  producto_id: string | null;
  producto_nombre: string | null;
  requiere_inventario: boolean;
  stock_disponible: number | null;
  stock_suficiente: boolean;
  venta_id: string;
  venta_item_id: string;
  ya_aplicado: boolean;
};

type WarehouseRow = {
  id: string;
  nombre: string;
};

function mapSummaryRow(row: SaleInventorySummaryRow): SaleInventorySummaryItem {
  return {
    bodegaId: row.bodega_id,
    bodegaNombre: row.bodega_nombre,
    cantidadRequerida: row.cantidad_requerida,
    descripcion: row.descripcion,
    productoCodigo: row.producto_codigo,
    productoId: row.producto_id,
    productoNombre: row.producto_nombre,
    requiereInventario: row.requiere_inventario,
    stockDisponible: row.stock_disponible,
    stockSuficiente: row.stock_suficiente,
    ventaId: row.venta_id,
    ventaItemId: row.venta_item_id,
    yaAplicado: row.ya_aplicado,
  };
}

export function canViewSaleInventoryPanel(tenant: TenantContext) {
  return (
    hasPermission(tenant.permissions, "sales.orders.view") &&
    hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
    ])
  );
}

export function canApplySaleInventory(tenant: TenantContext) {
  return (
    hasPermission(tenant.permissions, "sales.orders.edit") &&
    hasPermission(tenant.permissions, "inventory.stock.adjust")
  );
}

export async function getSaleInventorySummary(
  tenant: TenantContext,
  ventaId: string,
): Promise<CoreResult<SaleInventorySummaryItem[]>> {
  if (!canViewSaleInventoryPanel(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_resumen_inventario_venta", {
    p_venta_id: ventaId,
  });

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudo consultar el inventario de la venta.",
      error,
    );
  }

  return ok(((data ?? []) as SaleInventorySummaryRow[]).map(mapSummaryRow));
}

export async function getActiveWarehousesForSaleInventory(
  tenant: TenantContext,
): Promise<CoreResult<SaleInventoryWarehouse[]>> {
  if (!canApplySaleInventory(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_bodegas")
    .select("id, nombre")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activa")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as WarehouseRow[]).map((row) => ({ ...row })));
}
