export type PosTerminal = {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  warehouseName: string | null;
  status: "active" | "disabled" | "lost";
  offlineEnabled: boolean;
  offlineSessionHours: number;
};

export type PosSession = {
  id: string;
  terminalId: string;
  status: "open" | "pending_sync" | "closed" | "cancelled";
  openedAt: string;
  authorizedUntil: string;
  openingCash: number;
  lastSequence: number;
};

export type PosCatalogItem = {
  productId: string;
  productType: "producto" | "servicio";
  code: string | null;
  name: string;
  unit: string;
  currency: string;
  unitPrice: number;
  taxRate: number;
  offlineAvailable: number;
};

export type PosPaymentInput = {
  amount: number;
  method: "cash" | "card" | "sinpe" | "other";
  reference?: string;
  verified?: boolean;
};

export type PosSaleInput = {
  capturedAt: string;
  clientOperationId: string;
  items: Array<{ productId: string; quantity: number }>;
  offline: boolean;
  payments: PosPaymentInput[];
  sequence: number;
  sessionId: string;
};

export type PosSaleResult = {
  fiscalStatus: string;
  paymentStatus: string;
  reused: boolean;
  saleId: string;
  saleNumber: string;
  total: number;
};

export type PosActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
