export type PaymentAccountStatus =
  | "pendiente"
  | "parcial"
  | "pagada"
  | "vencida"
  | "anulada";

export type PaymentAccountType = "receivable" | "payable";

export type PaymentAccount = {
  compraId: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  createdAt: string;
  descripcion: string | null;
  estado: PaymentAccountStatus;
  fechaEmision: string;
  fechaVencimiento: string | null;
  id: string;
  moneda: string;
  numero: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  saldo: number;
  tipo: PaymentAccountType;
  total: number;
  ventaId: string | null;
  ventaNumero: string | null;
};

export type PaymentTransaction = {
  accountId: string;
  accountNumero: string | null;
  createdAt: string;
  createdByNombre: string | null;
  id: string;
  metodo: string;
  monto: number;
  notas: string | null;
  paidAt: string;
  referencia: string | null;
};

export type PaymentsSummary = {
  cuentasPorCobrarPendientes: number;
  cuentasPorPagarPendientes: number;
  cuentasVencidas: number;
  saldoPorCobrar: number;
  saldoPorPagar: number;
  totalCobrado: number;
  totalPagado: number;
};
