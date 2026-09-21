import { createPublicApiListHandler } from "@/modules/public-api/list-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicApiListHandler({
  resource: "fiscal-documents",
  scope: "fiscal_documents:read",
  select: "id, sale_id, customer_id, document_type_code, status, hacienda_status, clave, consecutivo, environment, currency_code, exchange_rate, receiver_name, receiver_identification_type, totals, issue_datetime, provider_code, provider_status, created_at, updated_at",
  serialize: (row) => ({
    clave: row.clave,
    consecutivo: row.consecutivo,
    createdAt: row.created_at,
    currency: row.currency_code,
    customerId: row.customer_id,
    documentTypeCode: row.document_type_code,
    environment: row.environment,
    exchangeRate: row.exchange_rate,
    haciendaStatus: row.hacienda_status,
    id: row.id,
    issueDatetime: row.issue_datetime,
    providerCode: row.provider_code,
    providerStatus: row.provider_status,
    receiverIdentificationType: row.receiver_identification_type,
    receiverName: row.receiver_name,
    saleId: row.sale_id,
    status: row.status,
    totals: row.totals,
    updatedAt: row.updated_at,
  }),
  table: "fiscal_documents",
});
