export type QuoteStatus =
  | "borrador"
  | "enviada"
  | "aceptada"
  | "rechazada"
  | "vencida"
  | "anulada";

export type Quote = {
  clienteId: string | null;
  clienteNombre: string | null;
  condiciones: string | null;
  creadoPorNombre: string | null;
  createdAt: string;
  descuentoTotal: number;
  estado: QuoteStatus;
  fechaEmision: string;
  fechaVencimiento: string | null;
  id: string;
  impuestoTotal: number;
  moneda: string;
  notas: string | null;
  numero: string;
  subtotal: number;
  total: number;
  updatedAt: string;
};

export type QuoteItem = {
  cantidad: number;
  cotizacionId: string;
  createdAt: string;
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
  updatedAt: string;
};

export type QuoteCustomer = {
  id: string;
  nombre: string;
  telefono: string | null;
  whatsapp: string | null;
};

export type QuoteCatalogProduct = {
  codigo: string | null;
  descripcion: string | null;
  id: string;
  impuestoPorcentaje: number;
  moneda: string;
  nombre: string;
  precioBase: number;
  tipo: "producto" | "servicio";
  unidadMedida: string;
};

export type QuoteStatusFilter = QuoteStatus | "todos";
