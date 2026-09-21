import { createPublicApiListHandler } from "@/modules/public-api/list-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicApiListHandler({
  resource: "sales",
  scope: "sales:read",
  select: "id, cotizacion_id, cliente_id, numero, estado, cobro_estado, entrega_estado, fiscal_estado, origen, fecha_venta, moneda, subtotal, descuento_total, impuesto_total, total, created_at, updated_at",
  serialize: (row) => ({
    collectionStatus: row.cobro_estado,
    createdAt: row.created_at,
    currency: row.moneda,
    customerId: row.cliente_id,
    date: row.fecha_venta,
    deliveryStatus: row.entrega_estado,
    discountTotal: row.descuento_total,
    fiscalStatus: row.fiscal_estado,
    id: row.id,
    number: row.numero,
    origin: row.origen,
    quoteId: row.cotizacion_id,
    status: row.estado,
    subtotal: row.subtotal,
    taxTotal: row.impuesto_total,
    total: row.total,
    updatedAt: row.updated_at,
  }),
  table: "ventas",
});
