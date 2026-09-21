export type PurchaseReturnEffectStatus = "pending" | "processed" | "not_required";

export type PurchaseReturnItem = {
  description: string;
  id: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  receiptItemId: string;
  returnId: string;
  subtotalAmount: number;
  taxAmount: number;
  taxRate: number;
  totalAmount: number;
  unitCost: number;
  warehouseId: string;
};

export type PurchaseReturn = {
  createdAt: string;
  currencyCode: string;
  financialAccountId: string | null;
  financialProcessedAt: string | null;
  financialStatus: PurchaseReturnEffectStatus;
  id: string;
  inventoryProcessedAt: string | null;
  inventoryStatus: PurchaseReturnEffectStatus;
  items: PurchaseReturnItem[];
  number: string;
  orderId: string;
  reason: string;
  status: "confirmed" | "cancelled";
  subtotalAmount: number;
  supplierCreditAmount: number;
  supplierDocumentReference: string | null;
  taxAmount: number;
  totalAmount: number;
};
