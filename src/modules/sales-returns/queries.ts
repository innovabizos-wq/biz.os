import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import type { SalesReturn, SalesReturnItem } from "@/modules/sales-returns/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type SalesReturnRow = {
  created_at: string;
  credited_amount: number;
  currency_code: string;
  discount_amount: number;
  financial_account_id: string | null;
  financial_processed_at: string | null;
  financial_status: SalesReturn["financialStatus"];
  fiscal_document_id: string | null;
  fiscal_status: SalesReturn["fiscalStatus"];
  id: string;
  inventory_processed_at: string | null;
  inventory_status: SalesReturn["inventoryStatus"];
  inventory_warehouse_id: string | null;
  number: string;
  reason: string;
  refunded_amount: number;
  sale_id: string;
  status: SalesReturn["status"];
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
};

type SalesReturnItemRow = {
  description: string;
  discount_amount: number;
  id: string;
  physical_quantity: number;
  product_id: string | null;
  quantity: number;
  requires_inventory: boolean;
  return_id: string;
  sale_item_id: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  unit_price: number;
};

function mapItem(row: SalesReturnItemRow): SalesReturnItem {
  return {
    description: row.description,
    discountAmount: row.discount_amount,
    id: row.id,
    physicalQuantity: row.physical_quantity,
    productId: row.product_id,
    quantity: row.quantity,
    requiresInventory: row.requires_inventory,
    saleItemId: row.sale_item_id,
    subtotalAmount: row.subtotal_amount,
    taxAmount: row.tax_amount,
    totalAmount: row.total_amount,
    unitPrice: row.unit_price,
  };
}

export async function getSalesReturnsForSale(
  tenant: TenantContext,
  saleId: string,
): Promise<CoreResult<SalesReturn[]>> {
  if (!hasPermission(tenant.permissions, "sales.orders.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver devoluciones.");
  }

  const supabase = await createClient();
  const { data: returnRows, error: returnsError } = await supabase
    .from("sales_returns")
    .select(
      "id, sale_id, number, status, reason, currency_code, subtotal_amount, discount_amount, tax_amount, total_amount, financial_status, credited_amount, refunded_amount, financial_account_id, financial_processed_at, inventory_status, inventory_warehouse_id, inventory_processed_at, fiscal_status, fiscal_document_id, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });

  if (returnsError) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar las devoluciones.", returnsError);
  }

  const rows = (returnRows ?? []) as SalesReturnRow[];
  if (rows.length === 0) return ok([]);

  const returnIds = rows.map((row) => row.id);
  const { data: itemRows, error: itemsError } = await supabase
    .from("sales_return_items")
    .select(
      "id, return_id, sale_item_id, product_id, description, quantity, physical_quantity, unit_price, subtotal_amount, discount_amount, tax_amount, total_amount, requires_inventory",
    )
    .eq("empresa_id", tenant.empresaId)
    .in("return_id", returnIds)
    .order("created_at", { ascending: true });

  if (itemsError) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar las lineas devueltas.",
      itemsError,
    );
  }

  const itemsByReturn = new Map<string, SalesReturnItem[]>();
  for (const row of (itemRows ?? []) as SalesReturnItemRow[]) {
    const items = itemsByReturn.get(row.return_id) ?? [];
    items.push(mapItem(row));
    itemsByReturn.set(row.return_id, items);
  }

  return ok(
    rows.map((row) => ({
      createdAt: row.created_at,
      creditedAmount: row.credited_amount,
      currencyCode: row.currency_code,
      discountAmount: row.discount_amount,
      financialAccountId: row.financial_account_id,
      financialProcessedAt: row.financial_processed_at,
      financialStatus: row.financial_status,
      fiscalDocumentId: row.fiscal_document_id,
      fiscalStatus: row.fiscal_status,
      id: row.id,
      inventoryProcessedAt: row.inventory_processed_at,
      inventoryStatus: row.inventory_status,
      inventoryWarehouseId: row.inventory_warehouse_id,
      items: itemsByReturn.get(row.id) ?? [],
      number: row.number,
      reason: row.reason,
      refundedAmount: row.refunded_amount,
      saleId: row.sale_id,
      status: row.status,
      subtotalAmount: row.subtotal_amount,
      taxAmount: row.tax_amount,
      totalAmount: row.total_amount,
    })),
  );
}
