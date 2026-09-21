import { createPublicApiListHandler } from "@/modules/public-api/list-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicApiListHandler({
  resource: "payments",
  scope: "payments:read",
  select: "id, tipo, venta_id, compra_id, cliente_id, proveedor_id, numero, descripcion, moneda, total, saldo, fecha_emision, fecha_vencimiento, estado, created_at, updated_at",
  serialize: (row) => ({
    balance: row.saldo,
    createdAt: row.created_at,
    currency: row.moneda,
    customerId: row.cliente_id,
    description: row.descripcion,
    dueDate: row.fecha_vencimiento,
    id: row.id,
    issueDate: row.fecha_emision,
    number: row.numero,
    purchaseId: row.compra_id,
    saleId: row.venta_id,
    status: row.estado,
    supplierId: row.proveedor_id,
    total: row.total,
    type: row.tipo,
    updatedAt: row.updated_at,
  }),
  table: "payments_accounts",
});
