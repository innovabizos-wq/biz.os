import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { adaptConversationActionToBusinessSkill } from "@/modules/brain/runtime/adapters/conversation-action-skill-adapter";
import type {
  BrainEvidence,
  BusinessSkillDefinition,
} from "@/modules/brain/runtime/contracts";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import {
  getOverdueFollowups,
  getTodayFollowups,
} from "@/modules/agenda/queries";
import {
  getBrainActionPlans,
  getBrainRecommendations,
  getBrainSignals,
} from "@/modules/brain/queries";
import {
  getCrmCustomerFollowups,
  getCrmCustomerInteractions,
  getCrmCustomers,
} from "@/modules/crm/queries";
import type { CrmCustomer } from "@/modules/crm/types";
import { getProducts } from "@/modules/catalog/queries";
import type { CatalogProduct } from "@/modules/catalog/types";
import { getInboxConversations } from "@/modules/inbox/queries";
import { getInventoryStock, getWarehouses } from "@/modules/inventory/queries";
import { getPaymentAccounts } from "@/modules/payments/queries";
import { paymentOperationIdFromKey } from "@/modules/payments/idempotency";
import { getDispatchForSale } from "@/modules/dispatch/queries";
import {
  getActiveCatalogProductsForQuote,
  getQuoteItems,
  getQuotes,
} from "@/modules/quotes/queries";
import {
  getSaleForQuote,
  getSaleItems,
  getSales,
  getSalesForCustomer,
} from "@/modules/sales/queries";
import { fail, ok } from "@/types/core";

const nullableText = z.string().nullable();

const readSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).default(20),
  query: z.string().trim().default(""),
});

const legacySearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  query: z.string().trim().min(1),
});

const legacyOptionalSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  query: z.string().trim().optional(),
  summary: z.string().trim().optional(),
});

const emptyInputSchema = z.object({});

const customerHistoryInputSchema = z.object({
  customerQuery: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const followupQueryInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  query: z.string().trim().optional(),
});

const crmFollowupCreateInputSchema = z.object({
  assignedTo: z.string().trim().optional(),
  customerQuery: z.string().trim().optional(),
  description: z.string().trim().optional(),
  scheduledAt: z.string().trim().optional(),
  title: z.string().trim().min(1),
  quoteReference: z.string().trim().optional(),
  saleReference: z.string().trim().optional(),
});

const crmCustomerUpdateInputSchema = z.object({
  correo: z.string().trim().email().optional(),
  customerQuery: z.string().trim().min(1),
  estado: z.enum([
    "calificado",
    "contactado",
    "cotizado",
    "ganado",
    "inactivo",
    "nuevo",
    "perdido",
  ]).optional(),
  genero: z.enum(["h", "m", "o"]).optional(),
  identificacion: z.string().trim().optional(),
  nombre: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  origen: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  tipo: z.enum(["cliente", "prospecto"]).optional(),
  whatsapp: z.string().trim().optional(),
});

const saleDetailInputSchema = z.object({
  saleReference: z.string().trim().min(1),
});

const saleCommandInputSchema = z.object({
  saleReference: z.string().trim().min(1),
});

const saleDispatchPrepareInputSchema = z.object({
  contactoEntrega: z.string().trim().optional(),
  direccionEntrega: z.string().trim().optional(),
  fechaProgramada: z.string().trim().optional(),
  horaProgramada: z.string().trim().optional(),
  notas: z.string().trim().optional(),
  saleReference: z.string().trim().min(1),
  telefonoEntrega: z.string().trim().optional(),
});

const accountStatementInputSchema = z.object({
  customerQuery: z.string().trim().min(1),
});

const paymentRegisterInputSchema = z.object({
  accountReference: z.string().trim().min(1),
  metodo: z.enum(["cash", "card", "sinpe", "transfer", "other"]).default("cash"),
  notas: z.string().trim().optional(),
  quantity: z.coerce.number().positive().multipleOf(0.01),
  referencia: z.string().trim().optional(),
}).superRefine((value, schemaContext) => {
  if (["card", "sinpe", "transfer"].includes(value.metodo) && !value.referencia) {
    schemaContext.addIssue({
      code: "custom",
      message: "La referencia es requerida para tarjeta, SINPE o transferencia.",
      path: ["referencia"],
    });
  }
});

const productValidationInputSchema = z.object({
  productQuery: z.string().trim().min(1),
});

const productUpdateInputSchema = z.object({
  codigo: z.string().trim().optional(),
  descripcion: z.string().trim().optional(),
  impuestoPorcentaje: z.coerce.number().min(0).max(100).optional(),
  moneda: z.string().trim().optional(),
  nombre: z.string().trim().optional(),
  precioBase: z.coerce.number().min(0).optional(),
  productQuery: z.string().trim().min(1),
  tipo: z.enum(["producto", "servicio"]).optional(),
  unidadMedida: z.string().trim().optional(),
});

const productStockInitializeInputSchema = z.object({
  productQuery: z.string().trim().min(1),
  quantity: z.coerce.number().min(0),
  warehouse: z.string().trim().min(1),
});

const inventoryStockAdjustInputSchema = z.object({
  motivo: z.string().trim().optional(),
  productQuery: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  tipo: z.enum(["ajuste", "entrada", "salida"]).default("ajuste"),
  warehouse: z.string().trim().min(1),
});

const inventoryStockTransferInputSchema = z.object({
  destinationWarehouse: z.string().trim().min(1),
  motivo: z.string().trim().optional(),
  originWarehouse: z.string().trim().min(1),
  productQuery: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
});

const quoteTotalInputSchema = z.object({
  quoteReference: z.string().trim().min(1),
});

const quoteExpiredQueryInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const quoteItemAddInputSchema = z.object({
  descripcion: z.string().trim().optional(),
  descuento: z.coerce.number().min(0).default(0),
  impuestoPorcentaje: z.coerce.number().min(0).optional(),
  precioUnitario: z.coerce.number().positive().optional(),
  productQuery: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  quoteReference: z.string().trim().min(1),
});

const quoteSaleConfirmInputSchema = z.object({
  quoteReference: z.string().trim().min(1),
});

const inboxConversationInputSchema = z.object({
  conversationReference: z.string().trim().min(1),
});

const inboxSlaOverdueQueryInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const inboxReplyDraftInputSchema = inboxConversationInputSchema.extend({
  content: z.string().trim().optional(),
});

const inboxNoteCreateInputSchema = inboxConversationInputSchema.extend({
  content: z.string().trim().min(1),
});

const inboxCustomerLinkInputSchema = inboxConversationInputSchema.extend({
  customerQuery: z.string().trim().min(1),
});

const inboxConversationAssignInputSchema = inboxConversationInputSchema.extend({
  assignee: z.string().trim().min(1),
});

const brainPlanPrepareInputSchema = z.object({
  content: z.string().trim().min(1),
});

const autoblogContentInputSchema = z.object({
  content: z.string().trim().min(1),
});

const genericRecord = z.record(z.string(), z.unknown());

const crmCustomerSchema = z.object({
  asignadoA: nullableText,
  asignadoNombre: nullableText,
  correo: nullableText,
  createdAt: z.string(),
  empresaId: z.string(),
  estado: z.enum([
    "calificado",
    "contactado",
    "cotizado",
    "ganado",
    "inactivo",
    "nuevo",
    "perdido",
  ]),
  fiscalIdentificationType: z.enum(["01", "02", "03", "04"]).nullable(),
  followupsCount: z.number(),
  genero: z.enum(["h", "m", "o"]),
  id: z.string(),
  identificacion: nullableText,
  interactionsCount: z.number(),
  lastActivityAt: nullableText,
  lastFollowupAt: nullableText,
  lastInteractionAt: nullableText,
  lastQuoteAt: nullableText,
  lastSaleAt: nullableText,
  nombre: z.string(),
  notas: nullableText,
  origen: nullableText,
  pendingFollowupsCount: z.number(),
  quotesCount: z.number(),
  salesCount: z.number(),
  telefono: nullableText,
  tipo: z.enum(["cliente", "prospecto"]),
  updatedAt: z.string(),
  whatsapp: nullableText,
});

export const crmCustomerSearchOutputSchema = z.object({
  customers: z.array(crmCustomerSchema),
});

export type CrmCustomerSearchOutput = z.infer<
  typeof crmCustomerSearchOutputSchema
>;

const productSearchOutputSchema = z.object({
  products: z.array(
    z.object({
      categoriaId: nullableText,
      categoriaNombre: nullableText,
      codigo: nullableText,
      createdAt: z.string(),
      descripcion: nullableText,
      estado: z.enum(["activo", "inactivo"]),
      id: z.string(),
      impuestoPorcentaje: z.number(),
      moneda: z.string(),
      nombre: z.string(),
      precioBase: z.number(),
      tipo: z.enum(["producto", "servicio"]),
      unidadMedida: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

const inventoryStockOutputSchema = z.object({
  stock: z.array(
    z.object({
      bodegaEstado: z.enum(["activa", "inactiva"]).nullable(),
      bodegaId: z.string(),
      bodegaNombre: nullableText,
      cantidad: z.number(),
      id: z.string(),
      productoCodigo: nullableText,
      productoId: z.string(),
      productoNombre: nullableText,
      stockMaximo: z.number().nullable(),
      stockMinimo: z.number(),
      updatedAt: z.string(),
    }),
  ),
});

const salesSummaryOutputSchema = z.object({
  sales: z.array(
    z.object({
      estado: z.string(),
      fecha_venta: z.string(),
      id: z.string(),
      moneda: z.string(),
      notas: nullableText,
      numero: z.string(),
      total: z.number(),
    }),
  ),
});

const customerHistoryOutputSchema = z.object({
  customer: crmCustomerSchema.nullable(),
  followups: z.array(genericRecord),
  interactions: z.array(genericRecord),
  sales: z.array(genericRecord),
});

const followupQueryOutputSchema = z.object({
  customers: z.array(crmCustomerSchema),
});

const crmFollowupCreateOutputSchema = z.object({
  customer: crmCustomerSchema,
  followup: genericRecord,
});

const saleDetailOutputSchema = z.object({
  items: z.array(genericRecord),
  sale: genericRecord,
});

const salesReceivableGenerateOutputSchema = z.object({
  accounts: z.array(genericRecord),
  saleId: z.string(),
});

const salesDispatchPrepareOutputSchema = z.object({
  dispatchId: z.string(),
  saleId: z.string(),
});

const accountStatementOutputSchema = z.object({
  accounts: z.array(genericRecord),
  saldoPorCobrar: z.number(),
  saldoPorPagar: z.number(),
  totalPorCobrar: z.number(),
  totalPorPagar: z.number(),
});

const paymentRegisterOutputSchema = z.object({
  accountId: z.string(),
  monto: z.number(),
  saldoAnterior: z.number(),
});

const genericIdOutputSchema = z.object({
  id: z.string(),
});

const productValidationOutputSchema = z.object({
  issues: z.array(z.string()),
  product: productSearchOutputSchema.shape.products.element.nullable(),
  stock: z.array(inventoryStockOutputSchema.shape.stock.element),
  valid: z.boolean(),
});

const inventoryCommandOutputSchema = z.object({
  bodegaId: z.string(),
  productoId: z.string(),
  quantity: z.number(),
  referenceId: z.string().nullable(),
});

const inventoryTransferOutputSchema = z.object({
  destinationWarehouseId: z.string(),
  originWarehouseId: z.string(),
  productId: z.string(),
  quantity: z.number(),
  transferId: z.string(),
});

const quoteTotalOutputSchema = z.object({
  items: z.array(genericRecord),
  quote: genericRecord,
  total: z.number(),
});

const quoteExpiredQueryOutputSchema = z.object({
  quotes: z.array(genericRecord),
});

const quoteItemAddOutputSchema = z.object({
  cotizacionId: z.string(),
  productoId: z.string().nullable(),
  quantity: z.number(),
});

const quoteSaleConfirmOutputSchema = z.object({
  cotizacionId: z.string(),
  saleId: z.string(),
});

const inboxCommandOutputSchema = z.object({
  conversationId: z.string(),
});

const inboxReplyDraftOutputSchema = z.object({
  conversation: genericRecord,
  draft: z.string(),
  lastIncomingMessage: genericRecord.nullable(),
  messages: z.array(genericRecord),
});

const inboxSlaOverdueQueryOutputSchema = z.object({
  conversations: z.array(genericRecord),
});

const brainSignalsOutputSchema = z.object({
  signals: z.array(genericRecord),
});

const brainRecommendationsOutputSchema = z.object({
  recommendations: z.array(genericRecord),
});

const brainQuestionInputSchema = z.object({
  question: z.string().trim().optional(),
  recommendationId: z.string().trim().optional(),
  summary: z.string().trim().optional(),
});

const brainQuestionOutputSchema = z.object({
  agenda: z.array(genericRecord),
  inbox: z.array(genericRecord),
  overdueReceivables: z.array(genericRecord),
  priorities: z.array(genericRecord),
  quotes: z.array(genericRecord),
  recommendations: z.array(genericRecord),
  signals: z.array(genericRecord),
});

const brainPlanPrepareOutputSchema = z.object({
  recommendations: z.array(genericRecord),
  requestedGoal: z.string(),
  steps: z.array(genericRecord),
});

const autoblogValidationOutputSchema = z.object({
  issues: z.array(z.string()),
  valid: z.boolean(),
});

const autoblogNormalizeOutputSchema = z.object({
  content: z.string(),
});

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function customerMatches(customer: CrmCustomer, query: string) {
  if (!query) return true;

  return [
    customer.nombre,
    customer.identificacion,
    customer.correo,
    customer.telefono,
    customer.whatsapp,
    customer.origen,
    customer.asignadoNombre,
  ].some((value) => normalize(value).includes(query));
}

function productMatches(product: CatalogProduct, query: string) {
  if (!query) return true;

  return [
    product.nombre,
    product.codigo,
    product.descripcion,
    product.categoriaNombre,
  ].some((value) => normalize(value).includes(query));
}

function warehouseMatches(
  warehouse: { nombre: string; ubicacion: string | null },
  query: string,
) {
  if (!query) return true;

  return [warehouse.nombre, warehouse.ubicacion].some((value) =>
    normalize(value).includes(query),
  );
}

function quoteMatches(
  quote: { clienteNombre: string | null; id: string; numero: string },
  query: string,
) {
  if (!query) return true;

  return [quote.id, quote.numero, quote.clienteNombre].some((value) =>
    normalize(value).includes(query),
  );
}

type InboxConversationLookup = {
  clienteNombre: string | null;
  contactoIdentificador: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  estado: string;
  id: string;
};

async function findInboxConversation(
  tenant: { empresaId: string },
  reference: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_conversaciones")
    .select(
      "id, estado, contacto_nombre, contacto_identificador, contacto_telefono, crm_clientes!inbox_conversaciones_cliente_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .neq("estado", "excluido")
    .order("updated_at", { ascending: false });

  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar conversaciones.", error);

  const query = normalize(reference);
  const conversations = (data ?? []).map((row) => {
    const customer = Array.isArray(row.crm_clientes)
      ? (row.crm_clientes[0] ?? null)
      : row.crm_clientes;

    return {
      clienteNombre: customer?.nombre ?? null,
      contactoIdentificador: row.contacto_identificador,
      contactoNombre: row.contacto_nombre,
      contactoTelefono: row.contacto_telefono,
      estado: row.estado,
      id: row.id,
    } satisfies InboxConversationLookup;
  });

  return ok(
    conversations.find((conversation) =>
      [
        conversation.id,
        conversation.clienteNombre,
        conversation.contactoNombre,
        conversation.contactoIdentificador,
        conversation.contactoTelefono,
      ].some((value) => normalize(value).includes(query)),
    ) ?? null,
  );
}

async function getInboxMessagesForTenant(
  tenant: { empresaId: string },
  conversationId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_mensajes")
    .select(
      "id, conversacion_id, direccion, tipo, contenido, estado, es_nota_interna, received_at, sent_at, created_at",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("conversacion_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return fail("VALIDATION_ERROR", "No se pudieron consultar mensajes.", error);
  }

  return ok((data ?? []).map((message) => ({
    contenido: message.contenido,
    conversacionId: message.conversacion_id,
    createdAt: message.created_at,
    direccion: message.direccion,
    estado: message.estado,
    esNotaInterna: message.es_nota_interna,
    id: message.id,
    receivedAt: message.received_at,
    sentAt: message.sent_at,
    tipo: message.tipo,
  })));
}

async function findProfileId(tenant: { empresaId: string }, query: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, correo, nombre")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar usuarios.", error);

  const normalized = normalize(query);
  return ok(
    (data ?? []).find((profile) =>
      [profile.id, profile.nombre, profile.correo].some((value) =>
        normalize(value).includes(normalized),
      ),
    )?.id ?? null,
  );
}

function nextBusinessFollowupIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(15, 0, 0, 0);
  return date.toISOString();
}

async function resolveFollowupCustomer(
  tenant: Parameters<typeof getCrmCustomers>[0],
  input: z.infer<typeof crmFollowupCreateInputSchema>,
) {
  const customers = await getCrmCustomers(tenant);
  if (!customers.ok) return customers;

  if (input.customerQuery) {
    const query = normalize(input.customerQuery);
    const customer = customers.data.find((item) =>
      [item.id, item.nombre, item.identificacion, item.correo, item.telefono, item.whatsapp]
        .some((value) => normalize(value).includes(query)),
    );

    return ok(customer ?? null);
  }

  if (input.saleReference) {
    const sales = await getSales(tenant, "todos");
    if (!sales.ok) return fail(sales.error.code, sales.error.message);
    const query = normalize(input.saleReference);
    const sale = sales.data.find((item) =>
      [item.id, item.numero, item.clienteNombre, item.cotizacionNumero].some((value) =>
        normalize(value).includes(query),
      ),
    );
    const customer = sale?.clienteId
      ? customers.data.find((item) => item.id === sale.clienteId)
      : null;

    return ok(customer ?? null);
  }

  if (input.quoteReference) {
    const quotes = await getQuotes(tenant, "todos");
    if (!quotes.ok) return fail(quotes.error.code, quotes.error.message);
    const quote = quotes.data.find((item) =>
      quoteMatches(item, normalize(input.quoteReference ?? "")),
    );
    const customer = quote?.clienteId
      ? customers.data.find((item) => item.id === quote.clienteId)
      : null;

    return ok(customer ?? null);
  }

  return ok(null);
}

function sourceEvidence(source: string, count: number): BrainEvidence[] {
  return [
    {
      count,
      freshnessAt: new Date().toISOString(),
      source,
    },
  ];
}

function normalizeAutoblogContent(content: string) {
  const compact = content
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (/<(?:p|h1|h2|ul|ol|li)\b/i.test(compact)) {
    return compact;
  }

  return compact
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.trim()}</p>`)
    .join("\n");
}

const crmCustomerSearchSkill = defineBusinessSkill<
  z.infer<typeof readSearchSchema>,
  CrmCustomerSearchOutput
>({
  description:
    "Busca clientes y prospectos autorizados con sus metricas comerciales basicas.",
  enabled: true,
  id: "crm.customer.search",
  idempotency: "none",
  inputSchema: readSearchSchema,
  kind: "query",
  legacyActionId: "clientes.buscar_cliente",
  module: "crm",
  name: "Buscar clientes",
  outputSchema: crmCustomerSearchOutputSchema,
  requiredPermissions: ["crm.customers.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const customers = await getCrmCustomers(context.tenant);
    if (!customers.ok) return fail(customers.error.code, customers.error.message);

    const query = normalize(input.query);
    const matches = customers.data
      .filter((customer) => customerMatches(customer, query))
      .slice(0, input.limit);

    return ok({
      data: { customers: matches },
      evidence: sourceEvidence("crm_clientes", matches.length),
      links: matches.slice(0, 10).map((customer) => ({
        href: `/crm/clientes/${customer.id}`,
        label: customer.nombre,
      })),
      message:
        matches.length > 0
          ? `Encontre ${matches.length} cliente(s): ${matches
              .slice(0, 3)
              .map((customer) => customer.nombre)
              .join(", ")}.`
          : "No encontre clientes con esa busqueda.",
    });
  },
});

const productSearchSkill = adaptConversationActionToBusinessSkill({
  actionId: "productos.buscar_producto",
  description: "Busca productos y servicios autorizados del catalogo.",
  evidence: (output) => sourceEvidence("catalogo_productos", output.products.length),
  id: "catalog.product.search",
  inputSchema: legacySearchSchema,
  kind: "query",
  links: (output) =>
    output.products.slice(0, 10).map((product) => ({
      href: "/catalogo/productos",
      label: product.nombre,
    })),
  module: "catalog",
  name: "Buscar productos",
  outputSchema: productSearchOutputSchema,
  requiredPermissions: ["catalog.products.view"],
  risk: "low",
});

const inventoryStockSkill = adaptConversationActionToBusinessSkill({
  actionId: "inventario.consultar_stock",
  description: "Consulta stock autorizado por producto o bodega.",
  evidence: (output) => sourceEvidence("inventario_stock", output.stock.length),
  id: "inventory.stock.query",
  inputSchema: legacySearchSchema,
  kind: "query",
  links: () => [{ href: "/inventario", label: "Abrir inventario" }],
  module: "inventory",
  name: "Consultar inventario",
  outputSchema: inventoryStockOutputSchema,
  requiredPermissions: ["inventory.stock.view"],
  risk: "low",
});

const salesSummarySkill = adaptConversationActionToBusinessSkill({
  actionId: "ventas.buscar_ventas",
  description: "Consulta ventas recientes o filtradas para resumir actividad comercial.",
  evidence: (output) => sourceEvidence("ventas", output.sales.length),
  id: "sales.summary.query",
  inputSchema: legacyOptionalSearchSchema,
  kind: "query",
  links: () => [{ href: "/ventas", label: "Abrir ventas" }],
  module: "sales",
  name: "Consultar ventas",
  outputSchema: salesSummaryOutputSchema,
  requiredPermissions: ["sales.orders.view"],
  risk: "low",
});

const crmCustomerHistorySkill = defineBusinessSkill<
  z.infer<typeof customerHistoryInputSchema>,
  z.infer<typeof customerHistoryOutputSchema>
>({
  description:
    "Consulta historial comercial de un cliente usando clientes, interacciones, seguimientos y ventas reales.",
  enabled: true,
  id: "crm.customer.history",
  idempotency: "none",
  inputSchema: customerHistoryInputSchema,
  kind: "query",
  module: "crm",
  name: "Historial de cliente",
  outputSchema: customerHistoryOutputSchema,
  requiredPermissions: ["crm.customers.view", "sales.orders.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const customers = await getCrmCustomers(context.tenant);
    if (!customers.ok) return fail(customers.error.code, customers.error.message);

    const query = normalize(input.customerQuery);
    const customer = customers.data.find((item) => customerMatches(item, query));
    if (!customer) {
      return ok({
        data: { customer: null, followups: [], interactions: [], sales: [] },
        evidence: sourceEvidence("crm_clientes", 0),
        message: "No encontre clientes con esa busqueda.",
      });
    }

    const [interactions, followups, sales] = await Promise.all([
      getCrmCustomerInteractions(context.tenant, customer.id),
      getCrmCustomerFollowups(context.tenant, customer.id),
      getSalesForCustomer(context.tenant, customer.id),
    ]);

    const interactionRows = interactions.ok ? interactions.data.slice(0, input.limit) : [];
    const followupRows = followups.ok ? followups.data.slice(0, input.limit) : [];
    const saleRows = sales.ok ? sales.data.slice(0, input.limit) : [];

    return ok({
      data: {
        customer,
        followups: followupRows,
        interactions: interactionRows,
        sales: saleRows,
      },
      evidence: [
        ...sourceEvidence("crm_clientes", 1),
        ...sourceEvidence("crm_interacciones", interactionRows.length),
        ...sourceEvidence("crm_seguimientos", followupRows.length),
        ...sourceEvidence("ventas", saleRows.length),
      ],
      links: [{ href: `/crm/clientes/${customer.id}`, label: customer.nombre }],
      message: `Historial de ${customer.nombre}: ${saleRows.length} venta(s), ${interactionRows.length} interaccion(es), ${followupRows.length} seguimiento(s).`,
    });
  },
});

const crmFollowupQuerySkill = defineBusinessSkill<
  z.infer<typeof followupQueryInputSchema>,
  z.infer<typeof followupQueryOutputSchema>
>({
  description: "Consulta clientes con seguimientos pendientes desde metricas CRM reales.",
  enabled: true,
  id: "crm.followup.query",
  idempotency: "none",
  inputSchema: followupQueryInputSchema,
  kind: "query",
  module: "crm",
  name: "Consultar seguimientos CRM",
  outputSchema: followupQueryOutputSchema,
  requiredPermissions: ["crm.followups.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const customers = await getCrmCustomers(context.tenant);
    if (!customers.ok) return fail(customers.error.code, customers.error.message);

    const query = normalize(input.query);
    const matches = customers.data
      .filter((customer) => customer.pendingFollowupsCount > 0)
      .filter((customer) => customerMatches(customer, query))
      .slice(0, input.limit);

    return ok({
      data: { customers: matches },
      evidence: sourceEvidence("crm_seguimientos", matches.length),
      links: matches.slice(0, 10).map((customer) => ({
        href: `/crm/clientes/${customer.id}`,
        label: customer.nombre,
      })),
      message:
        matches.length > 0
          ? `Encontre ${matches.length} cliente(s) con seguimientos pendientes.`
          : "No encontre seguimientos pendientes.",
    });
  },
});

const crmFollowupCreateSkill = defineBusinessSkill<
  z.infer<typeof crmFollowupCreateInputSchema>,
  z.infer<typeof crmFollowupCreateOutputSchema>
>({
  description: "Crea un seguimiento CRM real asociado a un cliente, venta o cotizacion.",
  enabled: true,
  id: "crm.followup.create",
  idempotency: "required",
  inputSchema: crmFollowupCreateInputSchema,
  kind: "command",
  module: "crm",
  name: "Crear seguimiento CRM",
  outputSchema: crmFollowupCreateOutputSchema,
  requiredPermissions: ["crm.followups.create"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const customerResult = await resolveFollowupCustomer(context.tenant, input);
    if (!customerResult.ok) return customerResult;
    const customer = customerResult.data;

    if (!customer) {
      return fail(
        "VALIDATION_ERROR",
        "Necesito identificar un cliente, venta o cotizacion real para crear el seguimiento.",
      );
    }

    const assignedTo = input.assignedTo
      ? await findProfileId(context.tenant, input.assignedTo)
      : ok(null);
    if (!assignedTo.ok) return fail(assignedTo.error.code, assignedTo.error.message);

    const scheduledAt = input.scheduledAt?.trim() || nextBusinessFollowupIso();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crear_crm_seguimiento", {
      p_asignado_a: assignedTo.data,
      p_asunto: input.title,
      p_cliente_id: customer.id,
      p_descripcion:
        input.description ??
        [
          input.saleReference ? `Venta: ${input.saleReference}` : null,
          input.quoteReference ? `Cotizacion: ${input.quoteReference}` : null,
          "Creado por Biz.Brain workflow.",
        ].filter(Boolean).join(" | "),
      p_fecha_programada: scheduledAt,
    });

    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo crear el seguimiento CRM.", error);
    }

    const followup = Array.isArray(data) ? (data[0] ?? {}) : {};

    return ok({
      data: {
        customer,
        followup,
      },
      evidence: [
        ...sourceEvidence("crm_clientes", 1),
        ...sourceEvidence("crm_seguimientos", 1),
      ],
      links: [
        { href: `/crm/clientes/${customer.id}`, label: customer.nombre },
        { href: "/agenda/seguimientos", label: "Abrir agenda" },
      ],
      message: `Seguimiento creado para ${customer.nombre}: ${input.title}.`,
    });
  },
});

const crmCustomerUpdateSkill = defineBusinessSkill<
  z.infer<typeof crmCustomerUpdateInputSchema>,
  z.infer<typeof genericIdOutputSchema>
>({
  description: "Actualiza datos de un cliente existente con campos estructurados.",
  enabled: true,
  id: "crm.customer.update",
  idempotency: "required",
  inputSchema: crmCustomerUpdateInputSchema,
  kind: "command",
  module: "crm",
  name: "Actualizar cliente",
  outputSchema: genericIdOutputSchema,
  requiredPermissions: ["crm.customers.edit"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const hasUpdate = [
      input.correo,
      input.estado,
      input.genero,
      input.identificacion,
      input.nombre,
      input.notas,
      input.origen,
      input.telefono,
      input.tipo,
      input.whatsapp,
    ].some((value) => value !== undefined);
    if (!hasUpdate) {
      return fail("VALIDATION_ERROR", "Indica que dato del cliente debo actualizar.");
    }

    const customers = await getCrmCustomers(context.tenant);
    if (!customers.ok) return fail(customers.error.code, customers.error.message);
    const customer = customers.data.find((item) =>
      customerMatches(item, normalize(input.customerQuery)),
    );
    if (!customer) {
      return fail("VALIDATION_ERROR", "No encontre el cliente para actualizar.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("actualizar_crm_cliente", {
      p_asignado_a: customer.asignadoA,
      p_cliente_id: customer.id,
      p_correo: input.correo ?? customer.correo,
      p_estado: input.estado ?? customer.estado,
      p_genero: input.genero ?? customer.genero,
      p_identificacion: input.identificacion ?? customer.identificacion,
      p_nombre: input.nombre ?? customer.nombre,
      p_notas: input.notas ?? customer.notas,
      p_origen: input.origen ?? customer.origen,
      p_telefono: input.telefono ?? customer.telefono,
      p_tipo: input.tipo ?? customer.tipo,
      p_whatsapp: input.whatsapp ?? customer.whatsapp,
    });
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo actualizar el cliente.", error);
    }

    return ok({
      data: { id: customer.id },
      evidence: sourceEvidence("crm_clientes", 1),
      links: [{ href: `/crm/clientes/${customer.id}`, label: customer.nombre }],
      message: `Cliente ${customer.nombre} actualizado correctamente.`,
    });
  },
});

const salesOrderDetailSkill = defineBusinessSkill<
  z.infer<typeof saleDetailInputSchema>,
  z.infer<typeof saleDetailOutputSchema>
>({
  description: "Consulta detalle de una venta y sus items reales.",
  enabled: true,
  id: "sales.order.detail",
  idempotency: "none",
  inputSchema: saleDetailInputSchema,
  kind: "query",
  module: "sales",
  name: "Detalle de venta",
  outputSchema: saleDetailOutputSchema,
  requiredPermissions: ["sales.orders.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const sales = await getSales(context.tenant, "todos");
    if (!sales.ok) return fail(sales.error.code, sales.error.message);

    const query = normalize(input.saleReference);
    const sale = sales.data.find((item) =>
      [item.id, item.numero, item.clienteNombre, item.cotizacionNumero].some((value) =>
        normalize(value).includes(query),
      ),
    );

    if (!sale) {
      return ok({
        data: { items: [], sale: {} },
        evidence: sourceEvidence("ventas", 0),
        message: "No encontre ventas con esa busqueda.",
      });
    }

    const items = await getSaleItems(context.tenant, sale.id);
    if (!items.ok) return fail(items.error.code, items.error.message);

    return ok({
      data: { items: items.data, sale },
      evidence: [
        ...sourceEvidence("ventas", 1),
        ...sourceEvidence("ventas_items", items.data.length),
      ],
      links: [{ href: `/ventas/${sale.id}`, label: sale.numero }],
      message: `Venta ${sale.numero}: ${sale.estado}, total ${sale.moneda} ${sale.total}.`,
    });
  },
});

const paymentsAccountStatementSkill = defineBusinessSkill<
  z.infer<typeof accountStatementInputSchema>,
  z.infer<typeof accountStatementOutputSchema>
>({
  description: "Consulta estado de cuenta real por cliente, proveedor, venta o numero de cuenta.",
  enabled: true,
  id: "payments.account.statement",
  idempotency: "none",
  inputSchema: accountStatementInputSchema,
  kind: "query",
  module: "payments",
  name: "Estado de cuenta",
  outputSchema: accountStatementOutputSchema,
  requiredPermissions: ["payments.accounts.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const accounts = await getPaymentAccounts(context.tenant, "all");
    if (!accounts.ok) return fail(accounts.error.code, accounts.error.message);

    const query = normalize(input.customerQuery);
    const matches = accounts.data.filter((account) =>
      [
        account.numero,
        account.clienteNombre,
        account.proveedorNombre,
        account.ventaNumero,
        account.descripcion,
      ].some((value) => normalize(value).includes(query)),
    );

    const receivables = matches.filter((account) => account.tipo === "receivable");
    const payables = matches.filter((account) => account.tipo === "payable");
    const saldoPorCobrar = receivables.reduce((total, account) => total + account.saldo, 0);
    const saldoPorPagar = payables.reduce((total, account) => total + account.saldo, 0);
    const totalPorCobrar = receivables.reduce((total, account) => total + account.total, 0);
    const totalPorPagar = payables.reduce((total, account) => total + account.total, 0);

    return ok({
      data: {
        accounts: matches,
        saldoPorCobrar,
        saldoPorPagar,
        totalPorCobrar,
        totalPorPagar,
      },
      evidence: sourceEvidence("payments_accounts", matches.length),
      links: [{ href: "/pagos", label: "Abrir pagos" }],
      message:
        matches.length > 0
          ? `Estado de cuenta: ${matches.length} cuenta(s), saldo por cobrar ${saldoPorCobrar}, saldo por pagar ${saldoPorPagar}.`
          : "No encontre cuentas con esa busqueda.",
    });
  },
});

const paymentsPaymentRegisterSkill = defineBusinessSkill<
  z.infer<typeof paymentRegisterInputSchema>,
  z.infer<typeof paymentRegisterOutputSchema>
>({
  description: "Registra un cobro o abono contra una cuenta existente con validacion de saldo.",
  enabled: true,
  id: "payments.payment.register",
  idempotency: "required",
  inputSchema: paymentRegisterInputSchema,
  kind: "command",
  module: "payments",
  name: "Registrar cobro",
  outputSchema: paymentRegisterOutputSchema,
  requiredPermissions: ["payments.accounts.manage"],
  requiresConfirmation: true,
  risk: "high",
  version: "1.0.0",
  async execute(input, context) {
    if (!context.idempotencyKey) {
      return fail("VALIDATION_ERROR", "La operacion requiere una clave idempotente.");
    }

    const accounts = await getPaymentAccounts(context.tenant, "all");
    if (!accounts.ok) return fail(accounts.error.code, accounts.error.message);

    const query = normalize(input.accountReference);
    const account = accounts.data.find((item) =>
      [
        item.numero,
        item.clienteNombre,
        item.proveedorNombre,
        item.ventaNumero,
        item.descripcion,
      ].some((value) => normalize(value).includes(query)),
    );

    if (!account) {
      return fail("VALIDATION_ERROR", "No encontre la cuenta para registrar el cobro.");
    }

    const supabase = await createClient();
    const operationId = paymentOperationIdFromKey([
      context.tenant.empresaId,
      context.tenant.profileId,
      "payments.payment.register",
      context.idempotencyKey,
    ]);
    const { data, error } = await supabase.rpc("registrar_movimiento_cuenta_idempotente", {
      p_account_id: account.id,
      p_metodo: input.metodo,
      p_monto: input.quantity,
      p_notas: input.notas ?? null,
      p_operation_id: operationId,
      p_referencia: input.referencia ?? null,
    });

    if (error) {
      return fail(
        error.code === "23505" ? "IDEMPOTENCY_CONFLICT" : "VALIDATION_ERROR",
        "No se pudo registrar el movimiento de cuenta.",
        error,
      );
    }

    const result = (data as Array<{
      estado: string;
      replayed: boolean;
      saldo: number | string;
      transaction_id: string;
    }> | null)?.[0];

    if (!result || !Number.isFinite(Number(result.saldo))) {
      return fail("VALIDATION_ERROR", "El movimiento no devolvio un resultado verificable.");
    }

    return ok({
      data: {
        accountId: account.id,
        monto: input.quantity,
        saldoAnterior: Number(result.saldo) + input.quantity,
      },
      evidence: sourceEvidence("payments_transactions", 1),
      links: [{ href: "/pagos", label: "Abrir pagos" }],
      message: result.replayed
        ? `Cobro ya registrado por ${input.quantity} en la cuenta ${account.numero}.`
        : `Cobro registrado por ${input.quantity} en la cuenta ${account.numero}.`,
    });
  },
});

const salesReceivableGenerateSkill = defineBusinessSkill<
  z.infer<typeof saleCommandInputSchema>,
  z.infer<typeof salesReceivableGenerateOutputSchema>
>({
  description: "Sincroniza o genera la cuenta por cobrar asociada a una venta.",
  enabled: true,
  id: "sales.receivable.generate",
  idempotency: "required",
  inputSchema: saleCommandInputSchema,
  kind: "command",
  module: "sales",
  name: "Generar cuenta por cobrar",
  outputSchema: salesReceivableGenerateOutputSchema,
  requiredPermissions: ["sales.orders.edit", "payments.accounts.manage"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const sales = await getSales(context.tenant, "todos");
    if (!sales.ok) return fail(sales.error.code, sales.error.message);

    const query = normalize(input.saleReference);
    const sale = sales.data.find((item) =>
      [item.id, item.numero, item.clienteNombre, item.cotizacionNumero].some((value) =>
        normalize(value).includes(query),
      ),
    );
    if (!sale) {
      return fail("VALIDATION_ERROR", "No encontre la venta para generar CxC.");
    }
    if (sale.estado === "cancelada") {
      return fail("VALIDATION_ERROR", "No puedo generar CxC para una venta cancelada.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("sincronizar_cuentas_cobrar_ventas_actual");
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo sincronizar la cuenta por cobrar.", error);
    }

    const accounts = await getPaymentAccounts(context.tenant, "receivable");
    if (!accounts.ok) return fail(accounts.error.code, accounts.error.message);
    const matches = accounts.data.filter(
      (account) => account.ventaId === sale.id || account.ventaNumero === sale.numero,
    );

    return ok({
      data: {
        accounts: matches,
        saleId: sale.id,
      },
      evidence: [
        ...sourceEvidence("ventas", 1),
        ...sourceEvidence("payments_accounts", matches.length),
      ],
      links: [
        { href: `/ventas/${sale.id}`, label: sale.numero },
        { href: "/pagos", label: "Abrir pagos" },
      ],
      message:
        matches.length > 0
          ? `Cuenta por cobrar sincronizada para la venta ${sale.numero}.`
          : `Sincronizacion ejecutada, pero no encontre CxC asociada a la venta ${sale.numero}.`,
    });
  },
});

const salesDispatchPrepareSkill = defineBusinessSkill<
  z.infer<typeof saleDispatchPrepareInputSchema>,
  z.infer<typeof salesDispatchPrepareOutputSchema>
>({
  description: "Prepara un despacho desde una venta existente.",
  enabled: true,
  id: "sales.dispatch.prepare",
  idempotency: "required",
  inputSchema: saleDispatchPrepareInputSchema,
  kind: "command",
  module: "sales",
  name: "Preparar despacho de venta",
  outputSchema: salesDispatchPrepareOutputSchema,
  requiredPermissions: ["sales.orders.edit", "dispatch.orders.create"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const sales = await getSales(context.tenant, "todos");
    if (!sales.ok) return fail(sales.error.code, sales.error.message);

    const query = normalize(input.saleReference);
    const sale = sales.data.find((item) =>
      [item.id, item.numero, item.clienteNombre, item.cotizacionNumero].some((value) =>
        normalize(value).includes(query),
      ),
    );
    if (!sale) {
      return fail("VALIDATION_ERROR", "No encontre la venta para preparar despacho.");
    }
    if (sale.estado === "cancelada") {
      return fail("VALIDATION_ERROR", "No puedo preparar despacho de una venta cancelada.");
    }

    const existing = await getDispatchForSale(context.tenant, sale.id);
    if (!existing.ok) return fail(existing.error.code, existing.error.message);
    if (existing.data) {
      return ok({
        data: {
          dispatchId: existing.data.id,
          saleId: sale.id,
        },
        evidence: [
          ...sourceEvidence("ventas", 1),
          ...sourceEvidence("despachos", 1),
        ],
        links: [{ href: `/despacho/${existing.data.id}`, label: existing.data.numero }],
        message: `La venta ${sale.numero} ya tiene despacho ${existing.data.numero}.`,
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("crear_despacho_desde_venta", {
      p_contacto_entrega: input.contactoEntrega ?? null,
      p_direccion_entrega: input.direccionEntrega ?? null,
      p_fecha_programada: input.fechaProgramada ?? null,
      p_hora_programada: input.horaProgramada ?? null,
      p_notas: input.notas ?? null,
      p_responsable_id: null,
      p_telefono_entrega: input.telefonoEntrega ?? null,
      p_venta_id: sale.id,
    });

    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo crear el despacho desde la venta.", error);
    }

    const dispatchId = ((data as { despacho_id?: string }[] | null)?.[0]?.despacho_id) ?? "";
    if (!dispatchId) {
      return fail("VALIDATION_ERROR", "El despacho fue creado pero no devolvio identificador.");
    }

    return ok({
      data: {
        dispatchId,
        saleId: sale.id,
      },
      evidence: [
        ...sourceEvidence("ventas", 1),
        ...sourceEvidence("despachos", 1),
      ],
      links: [{ href: `/despacho/${dispatchId}`, label: "Abrir despacho" }],
      message: `Despacho preparado para la venta ${sale.numero}.`,
    });
  },
});

const catalogProductValidateSkill = defineBusinessSkill<
  z.infer<typeof productValidationInputSchema>,
  z.infer<typeof productValidationOutputSchema>
>({
  description: "Valida datos minimos de un producto consultando catalogo e inventario reales.",
  enabled: true,
  id: "catalog.product.validate",
  idempotency: "none",
  inputSchema: productValidationInputSchema,
  kind: "analysis",
  module: "catalog",
  name: "Validar producto",
  outputSchema: productValidationOutputSchema,
  requiredPermissions: ["catalog.products.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const products = await getProducts(context.tenant, "todos", "todos");
    if (!products.ok) return fail(products.error.code, products.error.message);

    const product = products.data.find((item) =>
      productMatches(item, normalize(input.productQuery)),
    );

    if (!product) {
      return ok({
        data: { issues: ["Producto no encontrado."], product: null, stock: [], valid: false },
        evidence: sourceEvidence("catalogo_productos", 0),
        message: "No encontre productos con esa busqueda.",
      });
    }

    const stock = await getInventoryStock(context.tenant);
    const stockRows = stock.ok
      ? stock.data.filter((item) => item.productoId === product.id)
      : [];
    const issues = [
      product.nombre.trim().length === 0 ? "Falta nombre del producto." : null,
      product.precioBase < 0 ? "El precio base no puede ser negativo." : null,
      product.moneda.trim().length === 0 ? "Falta moneda." : null,
      product.unidadMedida.trim().length === 0 ? "Falta unidad de medida." : null,
      product.estado !== "activo" ? "El producto no esta activo." : null,
      product.tipo === "producto" && stock.ok && stockRows.length === 0
        ? "Producto fisico sin filas de stock inicializadas."
        : null,
    ].filter((issue): issue is string => Boolean(issue));

    return ok({
      data: {
        issues,
        product,
        stock: stockRows,
        valid: issues.length === 0,
      },
      evidence: [
        ...sourceEvidence("catalogo_productos", 1),
        ...sourceEvidence("inventario_stock", stockRows.length),
      ],
      links: [{ href: `/catalogo/productos/${product.id}`, label: product.nombre }],
      message:
        issues.length === 0
          ? `Producto ${product.nombre} validado correctamente.`
          : `Producto ${product.nombre} tiene ${issues.length} punto(s) por revisar: ${issues.join(" ")}`,
    });
  },
});

const catalogProductUpdateSkill = defineBusinessSkill<
  z.infer<typeof productUpdateInputSchema>,
  z.infer<typeof genericIdOutputSchema>
>({
  description: "Actualiza datos de producto usando campos estructurados y el registro actual como base.",
  enabled: true,
  id: "catalog.product.update",
  idempotency: "required",
  inputSchema: productUpdateInputSchema,
  kind: "command",
  module: "catalog",
  name: "Actualizar producto",
  outputSchema: genericIdOutputSchema,
  requiredPermissions: ["catalog.products.edit"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const hasUpdate = [
      input.codigo,
      input.descripcion,
      input.impuestoPorcentaje,
      input.moneda,
      input.nombre,
      input.precioBase,
      input.tipo,
      input.unidadMedida,
    ].some((value) => value !== undefined);
    if (!hasUpdate) {
      return fail("VALIDATION_ERROR", "Indica que dato del producto debo actualizar.");
    }

    const products = await getProducts(context.tenant, "todos", "todos");
    if (!products.ok) return fail(products.error.code, products.error.message);
    const product = products.data.find((item) =>
      productMatches(item, normalize(input.productQuery)),
    );
    if (!product) {
      return fail("VALIDATION_ERROR", "No encontre el producto para actualizar.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("actualizar_catalogo_producto", {
      p_categoria_id: product.categoriaId,
      p_codigo: input.codigo ?? product.codigo,
      p_descripcion: input.descripcion ?? product.descripcion,
      p_impuesto_porcentaje: input.impuestoPorcentaje ?? product.impuestoPorcentaje,
      p_moneda: input.moneda ?? product.moneda,
      p_nombre: input.nombre ?? product.nombre,
      p_precio_base: input.precioBase ?? product.precioBase,
      p_producto_id: product.id,
      p_tipo: input.tipo ?? product.tipo,
      p_unidad_medida: input.unidadMedida ?? product.unidadMedida,
    });
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo actualizar el producto.", error);
    }

    return ok({
      data: { id: product.id },
      evidence: sourceEvidence("catalogo_productos", 1),
      links: [{ href: `/catalogo/productos/${product.id}`, label: product.nombre }],
      message: `Producto ${product.nombre} actualizado correctamente.`,
    });
  },
});

const catalogProductStockInitializeSkill = defineBusinessSkill<
  z.infer<typeof productStockInitializeInputSchema>,
  z.infer<typeof genericIdOutputSchema>
>({
  description: "Inicializa stock de un producto en una bodega y registra cantidad inicial opcional.",
  enabled: true,
  id: "catalog.product.stock.initialize",
  idempotency: "required",
  inputSchema: productStockInitializeInputSchema,
  kind: "command",
  module: "catalog",
  name: "Inicializar stock de producto",
  outputSchema: genericIdOutputSchema,
  requiredPermissions: ["catalog.products.edit", "inventory.stock.adjust"],
  requiresConfirmation: true,
  risk: "high",
  version: "1.0.0",
  async execute(input, context) {
    const [products, warehouses] = await Promise.all([
      getProducts(context.tenant, "producto", "activo"),
      getWarehouses(context.tenant),
    ]);
    if (!products.ok) return fail(products.error.code, products.error.message);
    if (!warehouses.ok) return fail(warehouses.error.code, warehouses.error.message);

    const product = products.data.find((item) =>
      productMatches(item, normalize(input.productQuery)),
    );
    const warehouse = warehouses.data.find((item) =>
      item.estado === "activa" && warehouseMatches(item, normalize(input.warehouse)),
    );
    if (!product) {
      return fail("VALIDATION_ERROR", "No encontre el producto para inicializar stock.");
    }
    if (!warehouse) {
      return fail("VALIDATION_ERROR", "No encontre una bodega activa con esa busqueda.");
    }

    const supabase = await createClient();
    const { error: minError } = await supabase.rpc("actualizar_stock_minimos", {
      p_bodega_id: warehouse.id,
      p_producto_id: product.id,
      p_stock_maximo: null,
      p_stock_minimo: 0,
    });
    if (minError) {
      return fail("VALIDATION_ERROR", "No se pudo inicializar la fila de stock.", minError);
    }

    if (input.quantity > 0) {
      const { error: movementError } = await supabase.rpc("registrar_movimiento_inventario", {
        p_bodega_id: warehouse.id,
        p_cantidad: input.quantity,
        p_motivo: "Ingreso inicial desde Biz.Brain",
        p_producto_id: product.id,
        p_referencia_id: null,
        p_referencia_tipo: "brain_stock_initialize",
        p_tipo: "entrada",
      });
      if (movementError) {
        return fail("VALIDATION_ERROR", "No se pudo registrar la cantidad inicial.", movementError);
      }
    }

    return ok({
      data: { id: product.id },
      evidence: sourceEvidence("inventario_stock", 1),
      links: [{ href: "/inventario/productos", label: "Abrir inventario" }],
      message: `Stock inicializado para ${product.nombre} en ${warehouse.nombre}.`,
    });
  },
});

const inventoryStockAdjustSkill = defineBusinessSkill<
  z.infer<typeof inventoryStockAdjustInputSchema>,
  z.infer<typeof inventoryCommandOutputSchema>
>({
  description: "Registra un movimiento de inventario con validacion de producto y bodega.",
  enabled: true,
  id: "inventory.stock.adjust",
  idempotency: "required",
  inputSchema: inventoryStockAdjustInputSchema,
  kind: "command",
  module: "inventory",
  name: "Ajustar stock",
  outputSchema: inventoryCommandOutputSchema,
  requiredPermissions: ["inventory.stock.adjust"],
  requiresConfirmation: true,
  risk: "high",
  version: "1.0.0",
  async execute(input, context) {
    const [products, warehouses] = await Promise.all([
      getProducts(context.tenant, "producto", "activo"),
      getWarehouses(context.tenant),
    ]);
    if (!products.ok) return fail(products.error.code, products.error.message);
    if (!warehouses.ok) return fail(warehouses.error.code, warehouses.error.message);

    const product = products.data.find((item) =>
      productMatches(item, normalize(input.productQuery)),
    );
    if (!product) {
      return fail("VALIDATION_ERROR", "No encontre el producto para ajustar stock.");
    }

    const warehouse = warehouses.data.find((item) =>
      item.estado === "activa" && warehouseMatches(item, normalize(input.warehouse)),
    );
    if (!warehouse) {
      return fail("VALIDATION_ERROR", "No encontre una bodega activa con esa busqueda.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("registrar_movimiento_inventario", {
      p_bodega_id: warehouse.id,
      p_cantidad: input.quantity,
      p_motivo: input.motivo ?? "Ajuste solicitado desde Biz.Brain",
      p_producto_id: product.id,
      p_referencia_id: null,
      p_referencia_tipo: "brain_runtime",
      p_tipo: input.tipo,
    });

    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo registrar el movimiento de inventario.", error);
    }

    return ok({
      data: {
        bodegaId: warehouse.id,
        productoId: product.id,
        quantity: input.quantity,
        referenceId: null,
      },
      evidence: sourceEvidence("inventario_movimientos", 1),
      links: [{ href: "/inventario/movimientos", label: "Abrir movimientos" }],
      message: `Movimiento de inventario registrado para ${product.nombre} en ${warehouse.nombre}.`,
    });
  },
});

const inventoryStockTransferSkill = defineBusinessSkill<
  z.infer<typeof inventoryStockTransferInputSchema>,
  z.infer<typeof inventoryTransferOutputSchema>
>({
  description: "Transfiere stock entre dos bodegas usando movimientos trazables.",
  enabled: true,
  id: "inventory.stock.transfer",
  idempotency: "required",
  inputSchema: inventoryStockTransferInputSchema,
  kind: "command",
  module: "inventory",
  name: "Transferir stock",
  outputSchema: inventoryTransferOutputSchema,
  requiredPermissions: ["inventory.stock.adjust"],
  requiresConfirmation: true,
  risk: "high",
  version: "1.0.0",
  async execute(input, context) {
    const [products, warehouses] = await Promise.all([
      getProducts(context.tenant, "producto", "activo"),
      getWarehouses(context.tenant),
    ]);
    if (!products.ok) return fail(products.error.code, products.error.message);
    if (!warehouses.ok) return fail(warehouses.error.code, warehouses.error.message);

    const product = products.data.find((item) =>
      productMatches(item, normalize(input.productQuery)),
    );
    if (!product) {
      return fail("VALIDATION_ERROR", "No encontre el producto para transferir stock.");
    }

    const origin = warehouses.data.find((item) =>
      item.estado === "activa" &&
      warehouseMatches(item, normalize(input.originWarehouse)),
    );
    const destination = warehouses.data.find((item) =>
      item.estado === "activa" &&
      warehouseMatches(item, normalize(input.destinationWarehouse)),
    );
    if (!origin || !destination) {
      return fail("VALIDATION_ERROR", "No encontre bodega origen o destino activa.");
    }
    if (origin.id === destination.id) {
      return fail("VALIDATION_ERROR", "La bodega destino debe ser diferente a la bodega origen.");
    }

    const transferId = crypto.randomUUID();
    const motivo = input.motivo ?? "Traslado solicitado desde Biz.Brain";
    const supabase = await createClient();
    const { error: salidaError } = await supabase.rpc("registrar_movimiento_inventario", {
      p_bodega_id: origin.id,
      p_cantidad: input.quantity,
      p_motivo: motivo,
      p_producto_id: product.id,
      p_referencia_id: transferId,
      p_referencia_tipo: "brain_stock_transfer",
      p_tipo: "salida",
    });
    if (salidaError) {
      return fail("VALIDATION_ERROR", "No se pudo retirar stock de la bodega origen.", salidaError);
    }

    const { error: entradaError } = await supabase.rpc("registrar_movimiento_inventario", {
      p_bodega_id: destination.id,
      p_cantidad: input.quantity,
      p_motivo: motivo,
      p_producto_id: product.id,
      p_referencia_id: transferId,
      p_referencia_tipo: "brain_stock_transfer",
      p_tipo: "entrada",
    });
    if (entradaError) {
      await supabase.rpc("registrar_movimiento_inventario", {
        p_bodega_id: origin.id,
        p_cantidad: input.quantity,
        p_motivo: `Reversion automatica de traslado Brain ${transferId}`,
        p_producto_id: product.id,
        p_referencia_id: transferId,
        p_referencia_tipo: "brain_stock_transfer_reversal",
        p_tipo: "entrada",
      });
      return fail("VALIDATION_ERROR", "No se pudo ingresar stock en la bodega destino.", entradaError);
    }

    return ok({
      data: {
        destinationWarehouseId: destination.id,
        originWarehouseId: origin.id,
        productId: product.id,
        quantity: input.quantity,
        transferId,
      },
      evidence: sourceEvidence("inventario_movimientos", 2),
      links: [{ href: "/inventario/movimientos", label: "Abrir movimientos" }],
      message: `Transferi ${input.quantity} unidad(es) de ${product.nombre} desde ${origin.nombre} hacia ${destination.nombre}.`,
    });
  },
});

const quotesTotalCalculateSkill = defineBusinessSkill<
  z.infer<typeof quoteTotalInputSchema>,
  z.infer<typeof quoteTotalOutputSchema>
>({
  description: "Calcula total de una cotizacion consultando la cotizacion y sus items reales.",
  enabled: true,
  id: "quotes.total.calculate",
  idempotency: "none",
  inputSchema: quoteTotalInputSchema,
  kind: "query",
  module: "quotes",
  name: "Calcular cotizacion",
  outputSchema: quoteTotalOutputSchema,
  requiredPermissions: ["quotes.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const quotes = await getQuotes(context.tenant, "todos");
    if (!quotes.ok) return fail(quotes.error.code, quotes.error.message);

    const quote = quotes.data.find((item) =>
      quoteMatches(item, normalize(input.quoteReference)),
    );
    if (!quote) {
      return fail("VALIDATION_ERROR", "No encontre la cotizacion para calcular total.");
    }

    const items = await getQuoteItems(context.tenant, quote.id);
    if (!items.ok) return fail(items.error.code, items.error.message);

    const subtotal = items.data.reduce((total, item) => total + item.subtotal, 0);
    const impuestoTotal = items.data.reduce((total, item) => total + item.impuestoMonto, 0);
    const descuentoTotal = items.data.reduce((total, item) => total + item.descuento, 0);
    const total = items.data.reduce((sum, item) => sum + item.total, 0);

    return ok({
      data: {
        items: items.data,
        quote: {
          ...quote,
          descuentoTotal,
          impuestoTotal,
          subtotal,
          total,
        },
        total,
      },
      evidence: [
        ...sourceEvidence("cotizaciones", 1),
        ...sourceEvidence("cotizacion_items", items.data.length),
      ],
      links: [{ href: `/cotizaciones/${quote.id}`, label: quote.numero }],
      message: `Cotizacion ${quote.numero}: ${items.data.length} item(s), total ${quote.moneda} ${total}.`,
    });
  },
});

const quotesExpiredQuerySkill = defineBusinessSkill<
  z.infer<typeof quoteExpiredQueryInputSchema>,
  z.infer<typeof quoteExpiredQueryOutputSchema>
>({
  description: "Consulta cotizaciones vencidas o sin respuesta usando datos reales.",
  enabled: true,
  id: "quotes.expired.query",
  idempotency: "none",
  inputSchema: quoteExpiredQueryInputSchema,
  kind: "query",
  module: "quotes",
  name: "Consultar cotizaciones vencidas",
  outputSchema: quoteExpiredQueryOutputSchema,
  requiredPermissions: ["quotes.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const quotes = await getQuotes(context.tenant, "todos");
    if (!quotes.ok) return fail(quotes.error.code, quotes.error.message);

    const today = new Date();
    const expired = quotes.data
      .filter((quote) => {
        if (quote.estado === "vencida") return true;
        if (!quote.fechaVencimiento) return false;
        return (
          ["borrador", "enviada"].includes(quote.estado) &&
          new Date(quote.fechaVencimiento).getTime() < today.getTime()
        );
      })
      .slice(0, input.limit);

    return ok({
      data: { quotes: expired },
      evidence: sourceEvidence("quotes.quotes", expired.length),
      links: [{ href: "/cotizaciones", label: "Abrir cotizaciones" }],
      message:
        expired.length > 0
          ? `Encontre ${expired.length} cotizacion(es) vencida(s) o sin respuesta.`
          : "No encontre cotizaciones vencidas o sin respuesta.",
    });
  },
});

const quotesItemAddSkill = defineBusinessSkill<
  z.infer<typeof quoteItemAddInputSchema>,
  z.infer<typeof quoteItemAddOutputSchema>
>({
  description: "Agrega un item a una cotizacion existente validando cotizacion y producto.",
  enabled: true,
  id: "quotes.item.add",
  idempotency: "required",
  inputSchema: quoteItemAddInputSchema,
  kind: "command",
  module: "quotes",
  name: "Agregar item a cotizacion",
  outputSchema: quoteItemAddOutputSchema,
  requiredPermissions: ["quotes.edit"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const [quotes, products] = await Promise.all([
      getQuotes(context.tenant, "todos"),
      getActiveCatalogProductsForQuote(context.tenant),
    ]);
    if (!quotes.ok) return fail(quotes.error.code, quotes.error.message);
    if (!products.ok) return fail(products.error.code, products.error.message);

    const quote = quotes.data.find((item) =>
      quoteMatches(item, normalize(input.quoteReference)),
    );
    if (!quote) {
      return fail("VALIDATION_ERROR", "No encontre la cotizacion para agregar el item.");
    }
    if (["rechazada", "vencida", "anulada"].includes(quote.estado)) {
      return fail("VALIDATION_ERROR", "Esta cotizacion no acepta nuevos items por su estado actual.");
    }

    const product = products.data.find((item) =>
      [item.id, item.nombre, item.codigo, item.descripcion].some((value) =>
        normalize(value).includes(normalize(input.productQuery)),
      ),
    );
    const descripcion = input.descripcion ?? product?.nombre ?? input.productQuery;
    const precioUnitario = input.precioUnitario ?? product?.precioBase;
    const impuestoPorcentaje =
      input.impuestoPorcentaje ?? product?.impuestoPorcentaje ?? 0;

    if (!precioUnitario || precioUnitario <= 0) {
      return fail("VALIDATION_ERROR", "Indica un precio unitario mayor a 0 para agregar el item.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("agregar_item_cotizacion", {
      p_cantidad: input.quantity,
      p_cotizacion_id: quote.id,
      p_descripcion: descripcion,
      p_descuento: input.descuento,
      p_impuesto_porcentaje: impuestoPorcentaje,
      p_precio_unitario: precioUnitario,
      p_producto_id: product?.id ?? null,
    });

    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo agregar el item a la cotizacion.", error);
    }

    return ok({
      data: {
        cotizacionId: quote.id,
        productoId: product?.id ?? null,
        quantity: input.quantity,
      },
      evidence: sourceEvidence("cotizacion_items", 1),
      links: [{ href: `/cotizaciones/${quote.id}`, label: quote.numero }],
      message: `Item agregado a la cotizacion ${quote.numero}.`,
    });
  },
});

const quotesSaleConfirmSkill = defineBusinessSkill<
  z.infer<typeof quoteSaleConfirmInputSchema>,
  z.infer<typeof quoteSaleConfirmOutputSchema>
>({
  description: "Confirma una cotizacion como venta y sincroniza la cuenta por cobrar cuando aplica.",
  enabled: true,
  id: "quotes.sale.confirm",
  idempotency: "required",
  inputSchema: quoteSaleConfirmInputSchema,
  kind: "command",
  module: "quotes",
  name: "Confirmar cotizacion como venta",
  outputSchema: quoteSaleConfirmOutputSchema,
  requiredPermissions: [
    "quotes.status.change",
    "sales.orders.create",
    "sales.orders.status.change",
  ],
  requiresConfirmation: true,
  risk: "high",
  version: "1.0.0",
  async execute(input, context) {
    const quotes = await getQuotes(context.tenant, "todos");
    if (!quotes.ok) return fail(quotes.error.code, quotes.error.message);

    const quote = quotes.data.find((item) =>
      quoteMatches(item, normalize(input.quoteReference)),
    );
    if (!quote) {
      return fail("VALIDATION_ERROR", "No encontre la cotizacion para confirmar.");
    }
    if (["rechazada", "vencida", "anulada"].includes(quote.estado)) {
      return fail(
        "VALIDATION_ERROR",
        "Esta cotizacion no puede convertirse en venta por su estado actual.",
      );
    }

    const items = await getQuoteItems(context.tenant, quote.id);
    if (!items.ok) return fail(items.error.code, items.error.message);
    if (items.data.length === 0) {
      return fail(
        "VALIDATION_ERROR",
        "No puedo confirmar la venta porque la cotizacion no tiene items.",
      );
    }

    const supabase = await createClient();
    if (quote.estado === "borrador") {
      const { error } = await supabase.rpc("cambiar_estado_cotizacion", {
        p_cotizacion_id: quote.id,
        p_estado: "enviada",
      });
      if (error) {
        return fail("VALIDATION_ERROR", "No se pudo enviar la cotizacion.", error);
      }
    }

    if (quote.estado !== "aceptada") {
      const { error } = await supabase.rpc("cambiar_estado_cotizacion", {
        p_cotizacion_id: quote.id,
        p_estado: "aceptada",
      });
      if (error) {
        return fail("VALIDATION_ERROR", "No se pudo aceptar la cotizacion.", error);
      }
    }

    let sale = await getSaleForQuote(context.tenant, quote.id);
    if (!sale.ok) return fail(sale.error.code, sale.error.message);

    if (!sale.data) {
      const { error } = await supabase.rpc("generar_venta_desde_cotizacion", {
        p_cotizacion_id: quote.id,
      });
      if (error && error.code !== "23505") {
        return fail("VALIDATION_ERROR", "No se pudo generar la venta.", error);
      }
      sale = await getSaleForQuote(context.tenant, quote.id);
      if (!sale.ok) return fail(sale.error.code, sale.error.message);
    }

    if (!sale.data) {
      return fail("VALIDATION_ERROR", "La venta no pudo confirmarse.");
    }
    if (sale.data.estado === "cancelada") {
      return fail("VALIDATION_ERROR", "La venta asociada esta cancelada.");
    }
    if (sale.data.estado === "nueva") {
      const { error } = await supabase.rpc("cambiar_estado_venta", {
        p_estado: "confirmada",
        p_venta_id: sale.data.id,
      });
      if (error) {
        return fail("VALIDATION_ERROR", "No se pudo confirmar la venta.", error);
      }
    }

    await supabase.rpc("sincronizar_cuentas_cobrar_ventas_actual");

    return ok({
      data: {
        cotizacionId: quote.id,
        saleId: sale.data.id,
      },
      evidence: [
        ...sourceEvidence("cotizaciones", 1),
        ...sourceEvidence("ventas", 1),
      ],
      links: [
        { href: `/cotizaciones/${quote.id}`, label: quote.numero },
        { href: `/ventas/${sale.data.id}`, label: sale.data.numero },
      ],
      message: `Cotizacion ${quote.numero} confirmada como venta ${sale.data.numero}.`,
    });
  },
});

const inboxNoteCreateSkill = defineBusinessSkill<
  z.infer<typeof inboxNoteCreateInputSchema>,
  z.infer<typeof inboxCommandOutputSchema>
>({
  description: "Crea una nota interna en una conversacion de Inbox.",
  enabled: true,
  id: "inbox.note.create",
  idempotency: "required",
  inputSchema: inboxNoteCreateInputSchema,
  kind: "command",
  module: "whapp",
  name: "Crear nota interna Inbox",
  outputSchema: inboxCommandOutputSchema,
  requiredPermissions: ["inbox.conversations.reply"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const conversation = await findInboxConversation(
      context.tenant,
      input.conversationReference,
    );
    if (!conversation.ok) return fail(conversation.error.code, conversation.error.message);
    if (!conversation.data) {
      return fail("VALIDATION_ERROR", "No encontre la conversacion para agregar nota.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("agregar_mensaje_inbox", {
      p_contenido: input.content,
      p_conversacion_id: conversation.data.id,
      p_direccion: "interna",
      p_es_nota_interna: true,
    });

    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo crear la nota interna.", error);
    }

    return ok({
      data: { conversationId: conversation.data.id },
      evidence: sourceEvidence("inbox_mensajes", 1),
      links: [{ href: `/inbox/conversaciones/${conversation.data.id}`, label: "Abrir conversacion" }],
      message: "Nota interna agregada a la conversacion.",
    });
  },
});

const inboxReplyDraftSkill = defineBusinessSkill<
  z.infer<typeof inboxReplyDraftInputSchema>,
  z.infer<typeof inboxReplyDraftOutputSchema>
>({
  description: "Prepara un borrador de respuesta para Inbox o WhatsApp leyendo la conversacion real.",
  enabled: true,
  id: "inbox.reply.draft",
  idempotency: "none",
  inputSchema: inboxReplyDraftInputSchema,
  kind: "draft",
  legacyActionId: "inbox.preparar_respuesta",
  module: "whapp",
  name: "Preparar respuesta Inbox",
  outputSchema: inboxReplyDraftOutputSchema,
  requiredPermissions: ["inbox.conversations.reply"],
  requiresConfirmation: false,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const conversation = await findInboxConversation(
      context.tenant,
      input.conversationReference,
    );
    if (!conversation.ok) return conversation;
    if (!conversation.data) {
      return ok({
        data: {
          conversation: {},
          draft: "",
          lastIncomingMessage: null,
          messages: [],
        },
        evidence: sourceEvidence("inbox_conversaciones", 0),
        message: "No encontre una conversacion de Inbox con esa referencia.",
      });
    }

    const messages = await getInboxMessagesForTenant(
      context.tenant,
      conversation.data.id,
    );
    if (!messages.ok) return messages;

    const lastIncoming =
      [...messages.data]
        .reverse()
        .find((message) =>
          message.direccion === "inbound" &&
          !message.esNotaInterna &&
          typeof message.contenido === "string" &&
          message.contenido.trim().length > 0,
        ) ?? null;
    const contactName =
      conversation.data.contactoNombre ??
      conversation.data.clienteNombre ??
      "gracias por escribirnos";
    const incomingText =
      typeof lastIncoming?.contenido === "string"
        ? lastIncoming.contenido.trim()
        : "";
    const draft = incomingText
      ? `Hola ${contactName}. Gracias por escribirnos. Ya revise tu mensaje: "${incomingText}". Te confirmo la informacion en breve.`
      : `Hola ${contactName}. Gracias por escribirnos. Ya estoy revisando tu caso y te confirmo la informacion en breve.`;

    return ok({
      data: {
        conversation: conversation.data,
        draft,
        lastIncomingMessage: lastIncoming,
        messages: messages.data.slice(-10),
      },
      evidence: [
        ...sourceEvidence("inbox_conversaciones", 1),
        ...sourceEvidence("inbox_mensajes", messages.data.length),
      ],
      links: [{ href: `/inbox/${conversation.data.id}`, label: "Abrir conversacion" }],
      message:
        "Borrador preparado desde la conversacion real. No se envio ningun mensaje.",
    });
  },
});

const inboxSlaOverdueQuerySkill = defineBusinessSkill<
  z.infer<typeof inboxSlaOverdueQueryInputSchema>,
  z.infer<typeof inboxSlaOverdueQueryOutputSchema>
>({
  description: "Consulta conversaciones de Inbox con SLA vencido o en riesgo.",
  enabled: true,
  id: "inbox.sla.overdue.query",
  idempotency: "none",
  inputSchema: inboxSlaOverdueQueryInputSchema,
  kind: "query",
  module: "whapp",
  name: "Consultar SLA vencido Inbox",
  outputSchema: inboxSlaOverdueQueryOutputSchema,
  requiredPermissions: ["inbox.conversations.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input) {
    const conversations = await getInboxConversations();
    if (!conversations.ok) {
      return fail(conversations.error.code, conversations.error.message);
    }

    const now = Date.now();
    const matches = conversations.data
      .filter((conversation) =>
        conversation.estado !== "cerrada" &&
        (
          conversation.slaStatus === "vencido" ||
          (conversation.slaDueAt
            ? new Date(conversation.slaDueAt).getTime() < now
            : false)
        ),
      )
      .slice(0, input.limit);

    return ok({
      data: { conversations: matches },
      evidence: sourceEvidence("inbox.conversations", matches.length),
      links: [{ href: "/whapp", label: "Abrir Inbox" }],
      message:
        matches.length > 0
          ? `Encontre ${matches.length} conversacion(es) con SLA vencido.`
          : "No encontre conversaciones con SLA vencido.",
    });
  },
});

const inboxCustomerLinkSkill = defineBusinessSkill<
  z.infer<typeof inboxCustomerLinkInputSchema>,
  z.infer<typeof inboxCommandOutputSchema>
>({
  description: "Vincula una conversacion de Inbox con un cliente CRM existente.",
  enabled: true,
  id: "inbox.customer.link",
  idempotency: "required",
  inputSchema: inboxCustomerLinkInputSchema,
  kind: "command",
  module: "whapp",
  name: "Vincular cliente Inbox",
  outputSchema: inboxCommandOutputSchema,
  requiredPermissions: ["inbox.conversations.assign", "crm.customers.view"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const [conversation, customers] = await Promise.all([
      findInboxConversation(context.tenant, input.conversationReference),
      getCrmCustomers(context.tenant),
    ]);
    if (!conversation.ok) return fail(conversation.error.code, conversation.error.message);
    if (!customers.ok) return fail(customers.error.code, customers.error.message);
    if (!conversation.data) {
      return fail("VALIDATION_ERROR", "No encontre la conversacion para vincular.");
    }

    const customer = customers.data.find((item) =>
      customerMatches(item, normalize(input.customerQuery)),
    );
    if (!customer) {
      return fail("VALIDATION_ERROR", "No encontre el cliente para vincular.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("vincular_inbox_conversacion_cliente", {
      p_cliente_id: customer.id,
      p_conversacion_id: conversation.data.id,
    });
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo vincular el cliente.", error);
    }

    return ok({
      data: { conversationId: conversation.data.id },
      evidence: [
        ...sourceEvidence("inbox_conversaciones", 1),
        ...sourceEvidence("crm_clientes", 1),
      ],
      links: [{ href: `/inbox/conversaciones/${conversation.data.id}`, label: "Abrir conversacion" }],
      message: `Conversacion vinculada con ${customer.nombre}.`,
    });
  },
});

const inboxConversationAssignSkill = defineBusinessSkill<
  z.infer<typeof inboxConversationAssignInputSchema>,
  z.infer<typeof inboxCommandOutputSchema>
>({
  description: "Asigna una conversacion de Inbox a un usuario activo.",
  enabled: true,
  id: "inbox.conversation.assign",
  idempotency: "required",
  inputSchema: inboxConversationAssignInputSchema,
  kind: "command",
  module: "whapp",
  name: "Asignar conversacion Inbox",
  outputSchema: inboxCommandOutputSchema,
  requiredPermissions: ["inbox.conversations.assign"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const [conversation, profileId] = await Promise.all([
      findInboxConversation(context.tenant, input.conversationReference),
      findProfileId(context.tenant, input.assignee),
    ]);
    if (!conversation.ok) return fail(conversation.error.code, conversation.error.message);
    if (!profileId.ok) return fail(profileId.error.code, profileId.error.message);
    if (!conversation.data) {
      return fail("VALIDATION_ERROR", "No encontre la conversacion para asignar.");
    }
    if (!profileId.data) {
      return fail("VALIDATION_ERROR", "No encontre el usuario para asignar.");
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("asignar_inbox_conversacion", {
      p_asignado_a: profileId.data,
      p_conversacion_id: conversation.data.id,
    });
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo asignar la conversacion.", error);
    }

    return ok({
      data: { conversationId: conversation.data.id },
      evidence: sourceEvidence("inbox_conversaciones", 1),
      links: [{ href: `/inbox/conversaciones/${conversation.data.id}`, label: "Abrir conversacion" }],
      message: "Conversacion asignada correctamente.",
    });
  },
});

const inboxConversationCloseSkill = defineBusinessSkill<
  z.infer<typeof inboxConversationInputSchema>,
  z.infer<typeof inboxCommandOutputSchema>
>({
  description: "Cierra una conversacion de Inbox.",
  enabled: true,
  id: "inbox.conversation.close",
  idempotency: "required",
  inputSchema: inboxConversationInputSchema,
  kind: "command",
  module: "whapp",
  name: "Cerrar conversacion Inbox",
  outputSchema: inboxCommandOutputSchema,
  requiredPermissions: ["inbox.conversations.status.change"],
  requiresConfirmation: true,
  risk: "medium",
  version: "1.0.0",
  async execute(input, context) {
    const conversation = await findInboxConversation(
      context.tenant,
      input.conversationReference,
    );
    if (!conversation.ok) return fail(conversation.error.code, conversation.error.message);
    if (!conversation.data) {
      return fail("VALIDATION_ERROR", "No encontre la conversacion para cerrar.");
    }
    if (conversation.data.estado === "cerrada") {
      return ok({
        data: { conversationId: conversation.data.id },
        evidence: sourceEvidence("inbox_conversaciones", 1),
        links: [{ href: `/inbox/conversaciones/${conversation.data.id}`, label: "Abrir conversacion" }],
        message: "La conversacion ya estaba cerrada.",
      });
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("cambiar_estado_inbox_conversacion", {
      p_conversacion_id: conversation.data.id,
      p_estado: "cerrada",
    });
    if (error) {
      return fail("VALIDATION_ERROR", "No se pudo cerrar la conversacion.", error);
    }

    return ok({
      data: { conversationId: conversation.data.id },
      evidence: sourceEvidence("inbox_conversaciones", 1),
      links: [{ href: `/inbox/conversaciones/${conversation.data.id}`, label: "Abrir conversacion" }],
      message: "Conversacion cerrada correctamente.",
    });
  },
});

const brainSignalsQuerySkill = defineBusinessSkill<
  z.infer<typeof emptyInputSchema>,
  z.infer<typeof brainSignalsOutputSchema>
>({
  description: "Consulta senales activas detectadas por Business Brain.",
  enabled: true,
  id: "brain.signals.query",
  idempotency: "none",
  inputSchema: emptyInputSchema,
  kind: "analysis",
  module: "brain",
  name: "Consultar senales Brain",
  outputSchema: brainSignalsOutputSchema,
  requiredPermissions: ["brain.insights.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(_input, context) {
    const signals = await getBrainSignals(context.tenant);
    if (!signals.ok) return fail(signals.error.code, signals.error.message);

    return ok({
      data: { signals: signals.data },
      evidence: sourceEvidence("brain_signals", signals.data.length),
      links: [{ href: "/brain", label: "Abrir Brain" }],
      message:
        signals.data.length > 0
          ? `Brain tiene ${signals.data.length} senal(es) activa(s).`
          : "No hay senales activas registradas.",
    });
  },
});

const brainRecommendationsQuerySkill = defineBusinessSkill<
  z.infer<typeof emptyInputSchema>,
  z.infer<typeof brainRecommendationsOutputSchema>
>({
  description: "Consulta recomendaciones activas generadas por Business Brain.",
  enabled: true,
  id: "brain.recommendations.query",
  idempotency: "none",
  inputSchema: emptyInputSchema,
  kind: "analysis",
  module: "brain",
  name: "Consultar recomendaciones Brain",
  outputSchema: brainRecommendationsOutputSchema,
  requiredPermissions: ["brain.recommendations.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(_input, context) {
    const recommendations = await getBrainRecommendations(context.tenant);
    if (!recommendations.ok) {
      return fail(recommendations.error.code, recommendations.error.message);
    }

    return ok({
      data: { recommendations: recommendations.data },
      evidence: sourceEvidence("brain_recommendations", recommendations.data.length),
      links: [{ href: "/brain/recomendaciones", label: "Abrir recomendaciones" }],
      message:
        recommendations.data.length > 0
          ? `Brain tiene ${recommendations.data.length} recomendacion(es) disponible(s).`
          : "No hay recomendaciones activas registradas.",
    });
  },
});

function normalizeQuestion(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isOperationalTodayQuestion(question: string | undefined) {
  return /\b(atender|hoy|prioridad|prioridades|pendiente|pendientes)\b/.test(
    normalizeQuestion(question),
  );
}

const brainQuestionAnswerSkill = defineBusinessSkill<
  z.infer<typeof brainQuestionInputSchema>,
  z.infer<typeof brainQuestionOutputSchema>
>({
  description: "Responde preguntas operativas usando datos reales antes de sintetizar.",
  enabled: true,
  id: "brain.question.answer",
  idempotency: "none",
  inputSchema: brainQuestionInputSchema,
  kind: "query",
  legacyActionId: "brain.responder_pregunta",
  module: "brain",
  name: "Responder pregunta Brain",
  outputSchema: brainQuestionOutputSchema,
  requiredPermissions: ["brain.insights.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const question = input.question ?? input.summary ?? "Como va mi negocio";
    const [signals, recommendations] = await Promise.all([
      getBrainSignals(context.tenant),
      getBrainRecommendations(context.tenant),
    ]);
    if (!signals.ok) return fail(signals.error.code, signals.error.message);
    if (!recommendations.ok) {
      return fail(recommendations.error.code, recommendations.error.message);
    }

    if (!isOperationalTodayQuestion(question)) {
      const signalRows = signals.data.slice(0, 8);
      const recommendationRows = recommendations.data.slice(0, 8);

      return ok({
        data: {
          agenda: [],
          inbox: [],
          overdueReceivables: [],
          priorities: [
            ...recommendationRows.slice(0, 3).map((item) => ({
              reason: "Recomendacion activa de Brain",
              source: "brain.recommendations",
              ...item,
            })),
            ...signalRows.slice(0, 3).map((item) => ({
              reason: "Senal activa de Brain",
              source: "brain.signals",
              ...item,
            })),
          ],
          quotes: [],
          recommendations: recommendationRows,
          signals: signalRows,
        },
        evidence: [
          ...sourceEvidence("brain_signals", signalRows.length),
          ...sourceEvidence("brain_recommendations", recommendationRows.length),
        ],
        message:
          signalRows.length || recommendationRows.length
            ? `Revise Brain: ${signalRows.length} senal(es) y ${recommendationRows.length} recomendacion(es) activas.`
            : "No hay senales ni recomendaciones activas registradas en Brain.",
      });
    }

    const [today, overdue, accounts, quotes, inbox] = await Promise.all([
      getTodayFollowups(context.tenant, { source: "dashboard" }),
      getOverdueFollowups(context.tenant, { source: "dashboard" }),
      getPaymentAccounts(context.tenant, "receivable"),
      getQuotes(context.tenant, "todos"),
      getInboxConversations(),
    ]);
    const todayRows = today.ok ? today.data.slice(0, 5) : [];
    const overdueRows = overdue.ok ? overdue.data.slice(0, 5) : [];
    const accountRows = accounts.ok
      ? accounts.data
          .filter((account) => ["pendiente", "parcial", "vencida"].includes(account.estado))
          .sort((left, right) => right.saldo - left.saldo)
          .slice(0, 5)
      : [];
    const quoteRows = quotes.ok
      ? quotes.data
          .filter((quote) => ["borrador", "enviada", "vencida"].includes(quote.estado))
          .slice(0, 5)
      : [];
    const inboxRows = inbox.ok
      ? inbox.data
          .filter((conversation) => ["abierta", "pendiente"].includes(conversation.estado))
          .slice(0, 5)
      : [];
    const priorities = [
      ...overdueRows.map((item) => ({
        href: `/crm/clientes/${item.clienteId}`,
        reason: "Seguimiento vencido",
        title: item.asunto,
        type: "agenda.overdue",
      })),
      ...todayRows.map((item) => ({
        href: `/crm/clientes/${item.clienteId}`,
        reason: "Seguimiento programado para hoy",
        title: item.asunto,
        type: "agenda.today",
      })),
      ...accountRows.map((item) => ({
        href: "/pagos",
        reason: "Cuenta por cobrar pendiente",
        title: `${item.numero} ${item.clienteNombre ?? item.descripcion ?? ""}`.trim(),
        total: item.saldo,
        type: "payments.receivable",
      })),
      ...inboxRows.map((item) => ({
        href: `/inbox/${item.id}`,
        reason: "Conversacion abierta de Inbox",
        title: item.contactoNombre ?? item.clienteNombre ?? item.contactoTelefono ?? item.id,
        type: "inbox.conversation",
      })),
      ...quoteRows.map((item) => ({
        href: `/cotizaciones/${item.id}`,
        reason: "Cotizacion pendiente",
        title: `${item.numero} ${item.clienteNombre ?? ""}`.trim(),
        total: item.total,
        type: "quotes.quote",
      })),
    ].slice(0, 10);

    return ok({
      data: {
        agenda: [...overdueRows, ...todayRows],
        inbox: inboxRows,
        overdueReceivables: accountRows,
        priorities,
        quotes: quoteRows,
        recommendations: recommendations.data.slice(0, 5),
        signals: signals.data.slice(0, 5),
      },
      evidence: [
        ...sourceEvidence("agenda_followups", overdueRows.length + todayRows.length),
        ...sourceEvidence("payment_accounts", accountRows.length),
        ...sourceEvidence("quotes", quoteRows.length),
        ...sourceEvidence("inbox_conversations", inboxRows.length),
        ...sourceEvidence("brain_signals", signals.data.length),
        ...sourceEvidence("brain_recommendations", recommendations.data.length),
      ],
      links: [
        { href: "/agenda", label: "Abrir agenda" },
        { href: "/pagos", label: "Abrir pagos" },
        { href: "/cotizaciones", label: "Abrir cotizaciones" },
        { href: "/inbox", label: "Abrir Inbox" },
      ],
      message:
        priorities.length > 0
          ? `Encontré ${priorities.length} asunto(s) para revisar hoy entre agenda, cobros, cotizaciones e Inbox.`
          : "Revisé agenda, cobros, cotizaciones e Inbox. No encontré pendientes prioritarios para hoy.",
    });
  },
});

const brainPlanPrepareSkill = defineBusinessSkill<
  z.infer<typeof brainPlanPrepareInputSchema>,
  z.infer<typeof brainPlanPrepareOutputSchema>
>({
  description: "Prepara un plan ejecutable usando recomendaciones y planes existentes de Brain.",
  enabled: true,
  id: "brain.plan.prepare",
  idempotency: "none",
  inputSchema: brainPlanPrepareInputSchema,
  kind: "draft",
  module: "brain",
  name: "Preparar plan Brain",
  outputSchema: brainPlanPrepareOutputSchema,
  requiredPermissions: ["brain.recommendations.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input, context) {
    const [recommendations, plans] = await Promise.all([
      getBrainRecommendations(context.tenant),
      getBrainActionPlans(context.tenant),
    ]);
    if (!recommendations.ok) {
      return fail(recommendations.error.code, recommendations.error.message);
    }
    if (!plans.ok) return fail(plans.error.code, plans.error.message);

    const selectedRecommendations = recommendations.data.slice(0, 5);
    const selectedPlans = plans.data.slice(0, 5);
    const steps = selectedRecommendations.map((recommendation, index) => ({
      actionId: recommendation.actionId,
      approvalRequired: recommendation.approvalRequired,
      order: index + 1,
      recommendationId: recommendation.id,
      title: recommendation.title,
    }));

    return ok({
      data: {
        recommendations: selectedRecommendations,
        requestedGoal: input.content,
        steps: steps.length > 0 ? steps : selectedPlans,
      },
      evidence: [
        ...sourceEvidence("brain_recommendations", selectedRecommendations.length),
        ...sourceEvidence("brain_action_plans", selectedPlans.length),
      ],
      links: [{ href: "/brain", label: "Abrir Brain" }],
      message:
        steps.length > 0
          ? `Prepare un plan con ${steps.length} paso(s) basado en recomendaciones reales.`
          : "No hay recomendaciones suficientes para preparar un plan ejecutable.",
    });
  },
});

const autoblogArticleValidateSkill = defineBusinessSkill<
  z.infer<typeof autoblogContentInputSchema>,
  z.infer<typeof autoblogValidationOutputSchema>
>({
  description: "Valida estructura minima de un articulo Autoblog antes de publicarlo.",
  enabled: true,
  id: "autoblog.article.validate",
  idempotency: "none",
  inputSchema: autoblogContentInputSchema,
  kind: "analysis",
  module: "autoblog",
  name: "Validar articulo Autoblog",
  outputSchema: autoblogValidationOutputSchema,
  requiredPermissions: ["autoblog.view"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input) {
    const text = input.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const issues = [
      text.length < 300 ? "El articulo es demasiado corto." : null,
      !/<h1|<h2|^#\s+/i.test(input.content) ? "Falta un titulo o subtitulo claro." : null,
      !/<p|\n\n/i.test(input.content) ? "Faltan parrafos separados." : null,
    ].filter((issue): issue is string => Boolean(issue));

    return ok({
      data: { issues, valid: issues.length === 0 },
      evidence: sourceEvidence("autoblog_content_input", 1),
      message:
        issues.length === 0
          ? "El articulo cumple la estructura minima."
          : `El articulo tiene ${issues.length} punto(s) por revisar: ${issues.join(" ")}`,
    });
  },
});

const autoblogOutputNormalizeSkill = defineBusinessSkill<
  z.infer<typeof autoblogContentInputSchema>,
  z.infer<typeof autoblogNormalizeOutputSchema>
>({
  description: "Normaliza contenido de Autoblog para guardarlo con estructura HTML basica.",
  enabled: true,
  id: "autoblog.output.normalize",
  idempotency: "none",
  inputSchema: autoblogContentInputSchema,
  kind: "command",
  module: "autoblog",
  name: "Normalizar salida Autoblog",
  outputSchema: autoblogNormalizeOutputSchema,
  requiredPermissions: ["autoblog.edit"],
  requiresConfirmation: false,
  risk: "low",
  version: "1.0.0",
  async execute(input) {
    const content = normalizeAutoblogContent(input.content);

    return ok({
      data: { content },
      evidence: sourceEvidence("autoblog_content_input", 1),
      message: "Contenido normalizado para Autoblog.",
    });
  },
});

export function createInitialReadBusinessSkills(): BusinessSkillDefinition[] {
  return [
    autoblogArticleValidateSkill,
    autoblogOutputNormalizeSkill,
    brainPlanPrepareSkill,
    brainQuestionAnswerSkill,
    brainRecommendationsQuerySkill,
    brainSignalsQuerySkill,
    catalogProductStockInitializeSkill,
    catalogProductUpdateSkill,
    crmCustomerSearchSkill,
    crmCustomerHistorySkill,
    crmFollowupCreateSkill,
    crmFollowupQuerySkill,
    crmCustomerUpdateSkill,
    catalogProductValidateSkill,
    productSearchSkill,
    inventoryStockAdjustSkill,
    inventoryStockSkill,
    inventoryStockTransferSkill,
    inboxConversationAssignSkill,
    inboxConversationCloseSkill,
    inboxCustomerLinkSkill,
    inboxNoteCreateSkill,
    inboxReplyDraftSkill,
    paymentsAccountStatementSkill,
    paymentsPaymentRegisterSkill,
    inboxSlaOverdueQuerySkill,
    quotesItemAddSkill,
    quotesExpiredQuerySkill,
    quotesSaleConfirmSkill,
    quotesTotalCalculateSkill,
    salesDispatchPrepareSkill,
    salesOrderDetailSkill,
    salesReceivableGenerateSkill,
    salesSummarySkill,
  ];
}
