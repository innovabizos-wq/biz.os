export type SaleStatus =
  | "nueva"
  | "confirmada"
  | "en_proceso"
  | "completada"
  | "cancelada";

export type SaleInventoryState =
  | "pendiente"
  | "aplicado"
  | "parcial"
  | "no_aplica";

export type Sale = {
  clienteId: string | null;
  clienteNombre: string | null;
  cotizacionId: string | null;
  cotizacionNumero: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
  descuentoTotal: number;
  estado: SaleStatus;
  fechaVenta: string;
  id: string;
  inventarioAplicadoAt: string | null;
  inventarioEstado: SaleInventoryState;
  impuestoTotal: number;
  moneda: string;
  notas: string | null;
  numero: string;
  subtotal: number;
  total: number;
  updatedAt: string;
};

export type SaleItem = {
  cantidad: number;
  cotizacionItemId: string | null;
  descripcion: string;
  descuento: number;
  id: string;
  impuestoMonto: number;
  impuestoPorcentaje: number;
  orden: number;
  precioUnitario: number;
  productoCodigo: string | null;
  productoId: string | null;
  productoNombre: string | null;
  subtotal: number;
  total: number;
  ventaId: string;
};

export type SaleStatusFilter = SaleStatus | "todos";
