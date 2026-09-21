import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { DEFAULT_INVENTORY_MOVEMENT_TYPE_FILTER } from "@/modules/inventory/constants";
import type {
  InventoryCount,
  InventoryCountItem,
  InventoryMovement,
  InventoryMovementTypeFilter,
  InventoryProduct,
  InventoryStock,
  InventorySummary,
  InventoryWarehouse,
} from "@/modules/inventory/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type WarehouseRow = {
  created_at: string;
  descripcion: string | null;
  estado: InventoryWarehouse["estado"];
  id: string;
  nombre: string;
  ubicacion: string | null;
  updated_at: string;
};

type ProductRelation = {
  codigo: string | null;
  nombre: string | null;
  unidad_medida?: string | null;
};

type WarehouseRelation = {
  estado?: InventoryWarehouse["estado"] | null;
  nombre: string | null;
};

type ProfileRelation = {
  nombre: string | null;
};

type StockRow = {
  average_unit_cost: number | null;
  bodega_id: string;
  cantidad: number;
  catalogo_productos: ProductRelation | ProductRelation[] | null;
  id: string;
  cost_status: InventoryStock["costStatus"];
  inventario_bodegas: WarehouseRelation | WarehouseRelation[] | null;
  producto_id: string;
  stock_maximo: number | null;
  stock_minimo: number;
  updated_at: string;
};

type MovementRow = {
  average_cost_after: number | null;
  average_cost_before: number | null;
  cantidad: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  catalogo_productos: ProductRelation | ProductRelation[] | null;
  created_at: string;
  cost_status: InventoryMovement["costStatus"];
  id: string;
  inventario_bodegas: WarehouseRelation | WarehouseRelation[] | null;
  motivo: string | null;
  profiles: ProfileRelation | ProfileRelation[] | null;
  referencia_id: string | null;
  referencia_tipo: string | null;
  tipo: InventoryMovement["tipo"];
  total_cost: number | null;
  unit_cost: number | null;
};

type ProductRow = {
  codigo: string | null;
  id: string;
  nombre: string;
  unidad_medida: string;
};

type InventoryCountRow = {
  adjustment_items: number;
  cancelled_at: string | null;
  closed_at: string | null;
  count_number: string;
  counted_items: number;
  id: string;
  inventario_bodegas: WarehouseRelation | WarehouseRelation[] | null;
  notes: string | null;
  opened_at: string;
  status: InventoryCount["status"];
  total_items: number;
  warehouse_id: string;
};

type InventoryCountItemRow = {
  catalogo_productos: ProductRelation | ProductRelation[] | null;
  counted_at: string | null;
  counted_quantity: number | null;
  expected_quantity: number;
  id: string;
  notes: string | null;
  product_id: string;
  variance_quantity: number | null;
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapWarehouse(row: WarehouseRow): InventoryWarehouse {
  return {
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    ubicacion: row.ubicacion,
    updatedAt: row.updated_at,
  };
}

function mapStock(row: StockRow): InventoryStock {
  const product = firstRelation(row.catalogo_productos);
  const warehouse = firstRelation(row.inventario_bodegas);

  return {
    averageUnitCost: row.average_unit_cost,
    bodegaEstado: warehouse?.estado ?? null,
    bodegaId: row.bodega_id,
    bodegaNombre: warehouse?.nombre ?? null,
    cantidad: row.cantidad,
    costStatus: row.cost_status,
    id: row.id,
    productoCodigo: product?.codigo ?? null,
    productoId: row.producto_id,
    productoNombre: product?.nombre ?? null,
    stockMaximo: row.stock_maximo,
    stockMinimo: row.stock_minimo,
    totalInventoryValue:
      row.average_unit_cost === null
        ? null
        : Math.round(row.cantidad * row.average_unit_cost * 100) / 100,
    updatedAt: row.updated_at,
  };
}

function mapMovement(row: MovementRow): InventoryMovement {
  const product = firstRelation(row.catalogo_productos);
  const warehouse = firstRelation(row.inventario_bodegas);

  return {
    averageCostAfter: row.average_cost_after,
    averageCostBefore: row.average_cost_before,
    bodegaNombre: warehouse?.nombre ?? null,
    cantidad: row.cantidad,
    cantidadAnterior: row.cantidad_anterior,
    cantidadNueva: row.cantidad_nueva,
    costStatus: row.cost_status,
    createdAt: row.created_at,
    creadoPorNombre: firstRelation(row.profiles)?.nombre ?? null,
    id: row.id,
    motivo: row.motivo,
    productoCodigo: product?.codigo ?? null,
    productoNombre: product?.nombre ?? null,
    referenciaId: row.referencia_id,
    referenciaTipo: row.referencia_tipo,
    tipo: row.tipo,
    totalCost: row.total_cost,
    unitCost: row.unit_cost,
  };
}

function mapProduct(row: ProductRow): InventoryProduct {
  return {
    codigo: row.codigo,
    id: row.id,
    nombre: row.nombre,
    unidadMedida: row.unidad_medida,
  };
}

function mapInventoryCount(row: InventoryCountRow): InventoryCount {
  return {
    adjustmentItems: row.adjustment_items,
    cancelledAt: row.cancelled_at,
    closedAt: row.closed_at,
    countNumber: row.count_number,
    countedItems: row.counted_items,
    id: row.id,
    notes: row.notes,
    openedAt: row.opened_at,
    status: row.status,
    totalItems: row.total_items,
    warehouseId: row.warehouse_id,
    warehouseName: firstRelation(row.inventario_bodegas)?.nombre ?? null,
  };
}

function mapInventoryCountItem(row: InventoryCountItemRow): InventoryCountItem {
  const product = firstRelation(row.catalogo_productos);

  return {
    countedAt: row.counted_at,
    countedQuantity: row.counted_quantity,
    expectedQuantity: row.expected_quantity,
    id: row.id,
    notes: row.notes,
    productCode: product?.codigo ?? null,
    productId: row.product_id,
    productName: product?.nombre ?? null,
    varianceQuantity: row.variance_quantity,
  };
}

export function canAccessInventoryNav(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "inventory.stock.view",
    "inventory.stock.adjust",
    "inventory.movements.view",
    "inventory.warehouses.view",
    "inventory.warehouses.manage",
  ]);
}

export async function getInventorySummary(
  tenant: TenantContext,
): Promise<CoreResult<InventorySummary>> {
  if (!canAccessInventoryNav(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver inventario.");
  }

  const [warehouses, stock, movements] = await Promise.all([
    getWarehouses(tenant),
    getInventoryStock(tenant),
    getInventoryMovements(tenant),
  ]);

  const warehouseRows = warehouses.ok ? warehouses.data : [];
  const stockRows = stock.ok ? stock.data : [];
  const movementRows = movements.ok ? movements.data : [];

  return ok({
    bodegasActivas: warehouseRows.filter((warehouse) => warehouse.estado === "activa")
      .length,
    movimientosRecientes: movementRows.slice(0, 10).length,
    productosBajoStock: stockRows.filter(
      (item) => item.stockMinimo > 0 && item.cantidad < item.stockMinimo,
    ).length,
    productosConStock: new Set(
      stockRows.filter((item) => item.cantidad > 0).map((item) => item.productoId),
    ).size,
  });
}

export async function getWarehouses(
  tenant: TenantContext,
): Promise<CoreResult<InventoryWarehouse[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.warehouses.view",
      "inventory.warehouses.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver bodegas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_bodegas")
    .select("id, nombre, descripcion, ubicacion, estado, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .order("nombre", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar bodegas.", error);
  }

  return ok(((data ?? []) as WarehouseRow[]).map(mapWarehouse));
}

export async function getWarehouseDetail(
  tenant: TenantContext,
  bodegaId: string,
): Promise<CoreResult<InventoryWarehouse | null>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.warehouses.view",
      "inventory.warehouses.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver bodegas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_bodegas")
    .select("id, nombre, descripcion, ubicacion, estado, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", bodegaId)
    .maybeSingle<WarehouseRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la bodega.", error);
  }

  return ok(data ? mapWarehouse(data) : null);
}

export async function getInventoryStock(
  tenant: TenantContext,
): Promise<CoreResult<InventoryStock[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver stock.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_stock")
    .select(
      "id, producto_id, bodega_id, cantidad, stock_minimo, stock_maximo, average_unit_cost, cost_status, updated_at, catalogo_productos!inventario_stock_producto_empresa_fkey(codigo, nombre), inventario_bodegas!inventario_stock_bodega_empresa_fkey(nombre, estado)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("updated_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el stock.", error);
  }

  return ok(((data ?? []) as StockRow[]).map(mapStock));
}

export async function getInventoryMovements(
  tenant: TenantContext,
  type: InventoryMovementTypeFilter = DEFAULT_INVENTORY_MOVEMENT_TYPE_FILTER,
): Promise<CoreResult<InventoryMovement[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.movements.view",
      "inventory.stock.adjust",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver movimientos.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("inventario_movimientos")
    .select(
      "id, tipo, cantidad, cantidad_anterior, cantidad_nueva, unit_cost, total_cost, average_cost_before, average_cost_after, cost_status, motivo, referencia_tipo, referencia_id, created_at, catalogo_productos(codigo, nombre), inventario_bodegas(nombre), profiles!inventario_movimientos_created_by_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false });

  if (type !== "todos") {
    query = query.eq("tipo", type);
  }

  const { data, error } = await query;

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar movimientos.", error);
  }

  return ok(((data ?? []) as MovementRow[]).map(mapMovement));
}

export async function getProductsForInventory(
  tenant: TenantContext,
): Promise<CoreResult<InventoryProduct[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
    ])
  ) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_productos")
    .select("id, codigo, nombre, unidad_medida")
    .eq("empresa_id", tenant.empresaId)
    .eq("tipo", "producto")
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as ProductRow[]).map(mapProduct));
}

export async function getStockForProduct(
  tenant: TenantContext,
  productoId: string,
): Promise<CoreResult<InventoryStock[]>> {
  if (!hasPermission(tenant.permissions, "inventory.stock.view")) {
    return ok([]);
  }

  const stock = await getInventoryStock(tenant);

  if (!stock.ok) {
    return stock;
  }

  return ok(stock.data.filter((item) => item.productoId === productoId));
}

export async function getInventoryCounts(
  tenant: TenantContext,
): Promise<CoreResult<InventoryCount[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver conteos físicos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_counts")
    .select(
      "id, warehouse_id, count_number, status, notes, total_items, counted_items, adjustment_items, opened_at, closed_at, cancelled_at, inventario_bodegas!inventory_counts_warehouse_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("opened_at", { ascending: false })
    .limit(50);

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar los conteos físicos.", error);
  }

  return ok(((data ?? []) as InventoryCountRow[]).map(mapInventoryCount));
}

export async function getInventoryCountItems(
  tenant: TenantContext,
  countId: string,
): Promise<CoreResult<InventoryCountItem[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "inventory.stock.view",
      "inventory.stock.adjust",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver este conteo.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_count_items")
    .select(
      "id, product_id, expected_quantity, counted_quantity, variance_quantity, notes, counted_at, catalogo_productos!inventory_count_items_product_empresa_fkey(codigo, nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("count_id", countId)
    .order("created_at", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar los productos del conteo.", error);
  }

  return ok(((data ?? []) as InventoryCountItemRow[]).map(mapInventoryCountItem));
}
