export type InventoryWarehouseStatus = "activa" | "inactiva";
export type InventoryMovementType = "entrada" | "salida" | "ajuste";
export type InventoryCountStatus = "open" | "closed" | "cancelled";

export type InventoryWarehouse = {
  createdAt: string;
  descripcion: string | null;
  estado: InventoryWarehouseStatus;
  id: string;
  nombre: string;
  ubicacion: string | null;
  updatedAt: string;
};

export type InventoryProduct = {
  codigo: string | null;
  id: string;
  nombre: string;
  unidadMedida: string;
};

export type InventoryStock = {
  averageUnitCost: number | null;
  bodegaEstado: InventoryWarehouseStatus | null;
  bodegaId: string;
  bodegaNombre: string | null;
  cantidad: number;
  costStatus: "complete" | "incomplete";
  id: string;
  productoCodigo: string | null;
  productoId: string;
  productoNombre: string | null;
  stockMaximo: number | null;
  stockMinimo: number;
  totalInventoryValue: number | null;
  updatedAt: string;
};

export type InventoryMovement = {
  averageCostAfter: number | null;
  averageCostBefore: number | null;
  bodegaNombre: string | null;
  cantidad: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  costStatus: "complete" | "incomplete";
  createdAt: string;
  creadoPorNombre: string | null;
  id: string;
  motivo: string | null;
  productoCodigo: string | null;
  productoNombre: string | null;
  referenciaId: string | null;
  referenciaTipo: string | null;
  tipo: InventoryMovementType;
  totalCost: number | null;
  unitCost: number | null;
};

export type InventorySummary = {
  bodegasActivas: number;
  movimientosRecientes: number;
  productosBajoStock: number;
  productosConStock: number;
};

export type InventoryCount = {
  adjustmentItems: number;
  cancelledAt: string | null;
  closedAt: string | null;
  countNumber: string;
  countedItems: number;
  id: string;
  notes: string | null;
  openedAt: string;
  status: InventoryCountStatus;
  totalItems: number;
  warehouseId: string;
  warehouseName: string | null;
};

export type InventoryCountItem = {
  countedAt: string | null;
  countedQuantity: number | null;
  expectedQuantity: number;
  id: string;
  notes: string | null;
  productCode: string | null;
  productId: string;
  productName: string | null;
  varianceQuantity: number | null;
};

export type InventoryMovementTypeFilter = InventoryMovementType | "todos";
