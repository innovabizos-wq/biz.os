export type SalesReturnFinancialStatus = "pending" | "not_required" | "processed";

export type SalesReturnInventoryStatus = "pending" | "not_required" | "processed";

export type SalesReturnFiscalStatus =
  | "pending"
  | "not_required"
  | "prepared"
  | "processing"
  | "accepted"
  | "rejected"
  | "uncertain"
  | "error_validation";

export type SalesReturnItem = {
  description: string;
  discountAmount: number;
  id: string;
  physicalQuantity: number;
  productId: string | null;
  quantity: number;
  requiresInventory: boolean;
  saleItemId: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  unitPrice: number;
};

export type SalesReturn = {
  createdAt: string;
  creditedAmount: number;
  currencyCode: string;
  financialAccountId: string | null;
  financialProcessedAt: string | null;
  financialStatus: SalesReturnFinancialStatus;
  fiscalDocumentId: string | null;
  fiscalStatus: SalesReturnFiscalStatus;
  id: string;
  inventoryProcessedAt: string | null;
  inventoryStatus: SalesReturnInventoryStatus;
  inventoryWarehouseId: string | null;
  items: SalesReturnItem[];
  number: string;
  reason: string;
  refundedAmount: number;
  saleId: string;
  status: "confirmed" | "cancelled";
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
};
