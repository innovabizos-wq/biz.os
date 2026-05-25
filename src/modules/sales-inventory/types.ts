export type SaleInventoryState = "pendiente" | "aplicado" | "parcial" | "no_aplica";

export type SaleInventorySummaryItem = {
  bodegaId: string | null;
  bodegaNombre: string | null;
  cantidadRequerida: number;
  descripcion: string;
  productoCodigo: string | null;
  productoId: string | null;
  productoNombre: string | null;
  requiereInventario: boolean;
  stockDisponible: number | null;
  stockSuficiente: boolean;
  ventaId: string;
  ventaItemId: string;
  yaAplicado: boolean;
};

export type SaleInventoryWarehouse = {
  id: string;
  nombre: string;
};
