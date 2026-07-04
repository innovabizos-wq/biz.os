export type PurchaseOrderStatus =
  | "borrador"
  | "emitida"
  | "parcial"
  | "recibida"
  | "cancelada";

export type PurchaseSupplier = {
  correo: string | null;
  createdAt: string;
  direccion: string | null;
  estado: "activo" | "inactivo";
  id: string;
  identificacion: string | null;
  nombre: string;
  notas: string | null;
  telefono: string | null;
};

export type PurchaseOrder = {
  bodegaId: string | null;
  bodegaNombre: string | null;
  createdAt: string;
  estado: PurchaseOrderStatus;
  fechaOrden: string;
  fechaRecepcion: string | null;
  id: string;
  moneda: string;
  notas: string | null;
  numero: string;
  receivedAt: string | null;
  supplierId: string | null;
  supplierNombre: string | null;
  total: number;
};

export type PurchaseOrderItem = {
  cantidad: number;
  cantidadPendiente: number;
  cantidadRecibida: number;
  costoUnitario: number;
  descripcion: string;
  id: string;
  orderId: string;
  productoCodigo: string | null;
  productoId: string | null;
  productoNombre: string | null;
  total: number;
};

export type PurchaseReceipt = {
  bodegaId: string;
  bodegaNombre: string | null;
  id: string;
  notas: string | null;
  numero: string;
  orderId: string;
  receivedAt: string;
  receivedByNombre: string | null;
};

export type PurchaseReceiptItem = {
  cantidad: number;
  costoUnitario: number;
  id: string;
  orderItemId: string;
  productoId: string;
  productoNombre: string | null;
  receiptId: string;
  total: number;
};

export type PurchasesSummary = {
  ordenesBorrador: number;
  ordenesEmitidas: number;
  ordenesParciales: number;
  ordenesRecibidas: number;
  proveedoresActivos: number;
  totalPendienteRecepcion: number;
  totalComprado: number;
};
