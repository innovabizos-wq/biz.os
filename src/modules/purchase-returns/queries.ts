import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import type {
  PurchaseReturn,
  PurchaseReturnItem,
} from "@/modules/purchase-returns/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type PurchaseReturnRow = {
  created_at: string;
  currency_code: string;
  financial_account_id: string | null;
  financial_processed_at: string | null;
  financial_status: PurchaseReturn["financialStatus"];
  id: string;
  inventory_processed_at: string | null;
  inventory_status: PurchaseReturn["inventoryStatus"];
  number: string;
  order_id: string;
  reason: string;
  status: PurchaseReturn["status"];
  subtotal_amount: number;
  supplier_credit_amount: number;
  supplier_document_reference: string | null;
  tax_amount: number;
  total_amount: number;
};

type PurchaseReturnItemRow = {
  description: string;
  id: string;
  order_item_id: string;
  product_id: string;
  quantity: number;
  receipt_item_id: string;
  return_id: string;
  subtotal_amount: number;
  tax_amount: number;
  tax_rate: number;
  total_amount: number;
  unit_cost: number;
  warehouse_id: string;
};

function mapItem(row: PurchaseReturnItemRow): PurchaseReturnItem {
  return {
    description: row.description,
    id: row.id,
    orderItemId: row.order_item_id,
    productId: row.product_id,
    quantity: row.quantity,
    receiptItemId: row.receipt_item_id,
    returnId: row.return_id,
    subtotalAmount: row.subtotal_amount,
    taxAmount: row.tax_amount,
    taxRate: row.tax_rate,
    totalAmount: row.total_amount,
    unitCost: row.unit_cost,
    warehouseId: row.warehouse_id,
  };
}

export async function getPurchaseReturnsForOrder(
  tenant: TenantContext,
  orderId: string,
): Promise<CoreResult<PurchaseReturn[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "purchases.orders.view",
      "purchases.orders.manage",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver devoluciones de compra.");
  }

  const supabase = await createClient();
  const { data: returnRows, error: returnsError } = await supabase
    .from("purchase_returns")
    .select(
      "id, order_id, number, status, reason, currency_code, subtotal_amount, tax_amount, total_amount, inventory_status, inventory_processed_at, financial_status, financial_account_id, financial_processed_at, supplier_credit_amount, supplier_document_reference, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (returnsError) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar las devoluciones de compra.",
      returnsError,
    );
  }

  const rows = (returnRows ?? []) as PurchaseReturnRow[];
  if (rows.length === 0) return ok([]);

  const { data: itemRows, error: itemsError } = await supabase
    .from("purchase_return_items")
    .select(
      "id, return_id, receipt_item_id, order_item_id, product_id, warehouse_id, description, quantity, unit_cost, tax_rate, subtotal_amount, tax_amount, total_amount",
    )
    .eq("empresa_id", tenant.empresaId)
    .in(
      "return_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: true });

  if (itemsError) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar las líneas devueltas.",
      itemsError,
    );
  }

  const itemsByReturn = new Map<string, PurchaseReturnItem[]>();
  for (const row of (itemRows ?? []) as PurchaseReturnItemRow[]) {
    const items = itemsByReturn.get(row.return_id) ?? [];
    items.push(mapItem(row));
    itemsByReturn.set(row.return_id, items);
  }

  return ok(
    rows.map((row) => ({
      createdAt: row.created_at,
      currencyCode: row.currency_code,
      financialAccountId: row.financial_account_id,
      financialProcessedAt: row.financial_processed_at,
      financialStatus: row.financial_status,
      id: row.id,
      inventoryProcessedAt: row.inventory_processed_at,
      inventoryStatus: row.inventory_status,
      items: itemsByReturn.get(row.id) ?? [],
      number: row.number,
      orderId: row.order_id,
      reason: row.reason,
      status: row.status,
      subtotalAmount: row.subtotal_amount,
      supplierCreditAmount: row.supplier_credit_amount,
      supplierDocumentReference: row.supplier_document_reference,
      taxAmount: row.tax_amount,
      totalAmount: row.total_amount,
    })),
  );
}
