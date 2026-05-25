export type InventoryWarehouseStatus = "activa" | "inactiva";
export type InventoryMovementType = "entrada" | "salida" | "ajuste";

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
  bodegaEstado: InventoryWarehouseStatus | null;
  bodegaId: string;
  bodegaNombre: string | null;
  cantidad: number;
  id: string;
  productoCodigo: string | null;
  productoId: string;
  productoNombre: string | null;
  stockMaximo: number | null;
  stockMinimo: number;
  updatedAt: string;
};

export type InventoryMovement = {
  bodegaNombre: string | null;
  cantidad: number;
  cantidadAnterior: number;
  cantidadNueva: number;
  createdAt: string;
  creadoPorNombre: string | null;
  id: string;
  motivo: string | null;
  productoCodigo: string | null;
  productoNombre: string | null;
  referenciaId: string | null;
  referenciaTipo: string | null;
  tipo: InventoryMovementType;
};

export type InventorySummary = {
  bodegasActivas: number;
  movimientosRecientes: number;
  productosBajoStock: number;
  productosConStock: number;
};

export type InventoryMovementTypeFilter = InventoryMovementType | "todos";
