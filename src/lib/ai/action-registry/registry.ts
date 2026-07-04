import "server-only";

import { z } from "zod";

import { hasEveryPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { getProducts } from "@/modules/catalog/queries";
import {
  isValidCrmIdentification,
  normalizeCrmIdentification,
} from "@/modules/crm/identification";
import { getInventoryStock } from "@/modules/inventory/queries";
import {
  answerBrainQuestion,
  runAdvancedBrainAnalysis,
} from "@/modules/brain/analyst-service";
import { generateAutoblogDraft } from "@/modules/autoblog/ai";
import { getBusinessContext } from "@/modules/business-context/queries";
import { getQuoteModalItemValidationMessage } from "@/modules/quotes/quote-validation";
import { quoteModalItemsSchema } from "@/modules/quotes/schemas";
import type {
  ConversationActionDefinition,
  PublicConversationAction,
} from "@/lib/ai/action-registry/types";
import type { PermissionCode } from "@/types/core";

const optionalText = z.string().trim().optional().or(z.literal("").transform(() => undefined));
const optionalEmail = z
  .string()
  .trim()
  .email()
  .optional()
  .or(z.literal("").transform(() => undefined));
const optionalPhone = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => value === "" || value.length >= 7, {
    message: "El telefono debe tener al menos 7 digitos.",
  })
  .transform((value) => value || undefined);
const optionalIdentification = z
  .string()
  .trim()
  .transform(normalizeCrmIdentification)
  .refine((value) => value === "" || isValidCrmIdentification(value), {
    message: "La identificacion debe tener entre 9 y 12 digitos numericos.",
  })
  .transform((value) => value || undefined)
  .optional()
  .or(z.literal("").transform(() => undefined));

const searchSchema = z.object({
  query: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

const optionalSearchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  query: optionalText,
  summary: optionalText,
});

const taskSchema = z.object({
  description: optionalText,
  href: optionalText,
  recommendationId: optionalText,
  title: z.string().trim().min(1).default("Tarea sugerida por Brain"),
});

const brainQuestionSchema = z.object({
  question: optionalText,
  recommendationId: optionalText,
  summary: optionalText,
});

const autoblogGenerateSchema = z.object({
  sourceMode: z.enum(["manual", "news", "trend", "internal_context"]).default("internal_context"),
  sourceNotes: optionalText,
  sourceUrls: z.array(z.string().trim().url()).default([]),
  topic: z.string().trim().min(1),
});

const createCustomerSchema = z.object({
  correo: optionalEmail,
  genero: z.enum(["m", "f", "o"]).default("o"),
  identificacion: optionalIdentification,
  nombre: z.string().trim().min(1),
  notas: optionalText,
  origen: optionalText,
  telefono: optionalPhone,
  tipo: z.enum(["prospecto", "cliente"]).default("prospecto"),
  whatsapp: optionalPhone,
});

const createProductSchema = z.object({
  codigo: optionalText,
  descripcion: optionalText,
  impuestoPorcentaje: z.coerce.number().min(0).max(100).default(0),
  moneda: z.enum(["CRC", "USD"]).default("CRC"),
  nombre: z.string().trim().min(1),
  precioBase: z.coerce.number().min(0).default(0),
  tipo: z.enum(["producto", "servicio"]).default("producto"),
  unidadMedida: z.string().trim().min(1).default("unidad"),
});

const createQuoteDraftSchema = z.object({
  clienteId: z.string().uuid().optional(),
  condiciones: optionalText,
  fechaVencimiento: optionalText,
  items: quoteModalItemsSchema,
  moneda: z.enum(["CRC", "USD"]).default("CRC"),
  notas: optionalText,
});

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function searchTokens(value: string) {
  return normalizeSearch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function levenshteinDistance(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, index) => [index]);

  for (let index = 1; index <= b.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      matrix[row][col] =
        a[row - 1] === b[col - 1]
          ? matrix[row - 1][col - 1]
          : Math.min(
              matrix[row - 1][col - 1] + 1,
              matrix[row][col - 1] + 1,
              matrix[row - 1][col] + 1,
            );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyIncludesSearch(value: string | null | undefined, query: string) {
  const normalizedValue = normalizeSearch(value ?? "");
  if (!normalizedValue) return false;
  if (normalizedValue.includes(query)) return true;

  const valueTokens = searchTokens(normalizedValue);
  const queryTokens = searchTokens(query);
  if (queryTokens.length === 0) return false;

  return queryTokens.every((queryToken) =>
    valueTokens.some(
      (valueToken) =>
        valueToken.includes(queryToken) ||
        queryToken.includes(valueToken) ||
        levenshteinDistance(valueToken, queryToken) <= 2,
    ),
  );
}

function summarizeNames(items: { nombre?: string | null }[], empty: string) {
  if (items.length === 0) return empty;

  const names = items
    .slice(0, 3)
    .map((item) => item.nombre)
    .filter(Boolean);

  return names.length > 0
    ? `Encontre ${items.length}: ${names.join(", ")}.`
    : `Encontre ${items.length} resultado(s).`;
}

function summarizeRows<T>(
  rows: T[],
  empty: string,
  format: (row: T) => string,
) {
  if (rows.length === 0) return empty;

  return `Encontre ${rows.length}: ${rows.slice(0, 3).map(format).join(", ")}.`;
}

function publicAction(action: ConversationActionDefinition): PublicConversationAction {
  return {
    aliases: action.aliases,
    description: action.description,
    executionMode: action.executionMode,
    enabled: action.enabled ?? true,
    id: action.id,
    module: action.module,
    name: action.name,
    requiredFields:
      action.schema instanceof z.ZodObject ? Object.keys(action.schema.shape) : [],
    requiredPermissions: action.requiredPermissions,
    requiresConfirmation: action.requiresConfirmation,
    risk: action.risk,
  };
}

function defineConversationAction<TSchema extends z.ZodTypeAny>(
  definition: ConversationActionDefinition<TSchema>,
): ConversationActionDefinition {
  return definition as unknown as ConversationActionDefinition;
}

async function assertNoDuplicateCustomer(empresaId: string, input: z.infer<typeof createCustomerSchema>) {
  const checks = [
    input.identificacion
      ? { column: "identificacion", value: input.identificacion }
      : null,
    input.correo ? { column: "correo", value: input.correo } : null,
    input.telefono ? { column: "telefono", value: input.telefono } : null,
    input.whatsapp ? { column: "whatsapp", value: input.whatsapp } : null,
  ].filter(Boolean) as { column: string; value: string }[];

  if (checks.length === 0) {
    return null;
  }

  const supabase = await createClient();

  for (const check of checks) {
    const { data, error } = await supabase
      .from("crm_clientes")
      .select("id, nombre, identificacion, correo, telefono, whatsapp")
      .eq("empresa_id", empresaId)
      .eq(check.column, check.value)
      .limit(1);

    if (error) throw new Error("No se pudo validar duplicados de clientes.");
    if (data?.[0]) return data[0];
  }

  return null;
}

async function initializeProductStockRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    empresaId: string;
    productId: string | null | undefined;
  },
) {
  if (!input.productId) return 0;

  const { data: warehouses, error: warehouseError } = await supabase
    .from("inventario_bodegas")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .eq("estado", "activa");

  if (warehouseError || !warehouses?.length) return 0;

  let initialized = 0;

  for (const warehouse of warehouses) {
    const { error } = await supabase.rpc("actualizar_stock_minimos", {
      p_bodega_id: warehouse.id,
      p_producto_id: input.productId,
      p_stock_maximo: null,
      p_stock_minimo: 0,
    });

    if (!error) initialized += 1;
  }

  return initialized;
}

export const conversationActionRegistry: ConversationActionDefinition[] = [
  defineConversationAction({
    aliases: [
      "crear blog",
      "crea un blog",
      "generar blog",
      "genera un blog",
      "crear articulo",
      "crear articulo de blog",
      "escribir blog",
      "escribe un blog",
    ],
    description: "Genera un articulo de Autoblog con IA y lo guarda como borrador editable.",
    executionMode: "write",
    id: "autoblog.generar_articulo",
    module: "autoblog",
    name: "Generar articulo Autoblog",
    requiredPermissions: ["autoblog.create"],
    requiresConfirmation: false,
    risk: "medium",
    schema: autoblogGenerateSchema,
    async handler(params: z.infer<typeof autoblogGenerateSchema>, { tenant }) {
      const context = await getBusinessContext(tenant);
      const draft = await generateAutoblogDraft({
        businessContext: context.ok ? context.data : null,
        sourceNotes: params.sourceNotes,
        sourceUrls: params.sourceUrls,
        topic: params.topic,
      });

      if (!draft.ok) throw new Error(draft.message);

      const supabase = await createClient();
      const fallbackCta = context.ok ? context.data?.preferredCta ?? null : null;
      const { data, error } = await supabase.rpc("crear_autoblog_article", {
        p_content: draft.data.content,
        p_cta: draft.data.cta ?? fallbackCta,
        p_keywords: draft.data.keywords ?? null,
        p_seo_description: draft.data.seoDescription ?? null,
        p_seo_title: draft.data.seoTitle ?? null,
        p_social_facebook: draft.data.socialFacebook ?? null,
        p_social_instagram: draft.data.socialInstagram ?? null,
        p_social_linkedin: draft.data.socialLinkedin ?? null,
        p_social_whatsapp: draft.data.socialWhatsapp ?? null,
        p_source_mode: params.sourceMode,
        p_source_notes: params.sourceNotes ?? null,
        p_source_urls: params.sourceUrls,
        p_summary: draft.data.summary ?? null,
        p_title: draft.data.title,
        p_topic: params.topic,
      });

      if (error) throw new Error(error.message || "No se pudo guardar el articulo.");

      const created = (data as { article_id?: string }[] | null)?.[0] ?? null;
      return {
        entityId: created?.article_id ?? null,
        message: `Borrador de blog creado: ${draft.data.title}.`,
        result: {
          articleId: created?.article_id ?? null,
          href: created?.article_id ? `/autoblog/${created.article_id}` : "/autoblog",
        },
      };
    },
  }),
  defineConversationAction({
    aliases: ["buscar cliente", "encontrar cliente", "ver cliente"],
    description: "Busca clientes o prospectos por nombre, identificacion, correo o telefono.",
    executionMode: "read",
    id: "clientes.buscar_cliente",
    module: "crm",
    name: "Buscar cliente",
    requiredPermissions: ["crm.customers.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: searchSchema,
    async handler(params: z.infer<typeof searchSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("crm_clientes")
        .select("id, tipo, estado, nombre, identificacion, telefono, whatsapp, correo")
        .eq("empresa_id", tenant.empresaId)
        .limit(100);

      if (error) throw new Error("No se pudo buscar clientes.");
      const query = normalizeSearch(params.query);
      const matches = (data ?? [])
        .filter(
          (customer) =>
            fuzzyIncludesSearch(customer.nombre, query) ||
            fuzzyIncludesSearch(customer.identificacion, query) ||
            fuzzyIncludesSearch(customer.telefono, query) ||
            fuzzyIncludesSearch(customer.whatsapp, query) ||
            fuzzyIncludesSearch(customer.correo, query),
        )
        .slice(0, params.limit);

      return {
        message: summarizeNames(
          matches,
          "No encontre clientes con esa busqueda.",
        ),
        result: { customers: matches },
      };
    },
  }),
  defineConversationAction({
    aliases: [
      "crear cliente",
      "crea cliente",
      "crear un cliente",
      "crea un cliente",
      "registrar cliente",
      "registre cliente",
      "agregar cliente",
      "agregue cliente",
      "nuevo cliente",
      "cliente nuevo",
      "dar de alta cliente",
      "registrar prospecto",
    ],
    description: "Crea un cliente o prospecto CRM despues de validar duplicados basicos.",
    executionMode: "write",
    id: "clientes.crear_cliente",
    module: "crm",
    name: "Crear cliente",
    requiredPermissions: ["crm.customers.create"],
    requiresConfirmation: false,
    risk: "medium",
    schema: createCustomerSchema,
    async handler(params: z.infer<typeof createCustomerSchema>, { tenant }) {
      const duplicate = await assertNoDuplicateCustomer(tenant.empresaId, params);
      if (duplicate) {
        return {
          entityId: String(duplicate.id),
          message: `Ya existe un cliente con esos datos: ${duplicate.nombre ?? "cliente existente"}.`,
          result: { duplicate, created: false },
        };
      }

      const supabase = await createClient();
      const { data, error } = await supabase.rpc("crear_crm_cliente", {
        p_asignado_a: null,
        p_correo: params.correo ?? null,
        p_genero: params.genero,
        p_identificacion: params.identificacion ?? null,
        p_nombre: params.nombre,
        p_notas: params.notas ?? null,
        p_origen: params.origen ?? "ia_conversacional",
        p_telefono: params.telefono ?? null,
        p_tipo: params.tipo,
        p_whatsapp: params.whatsapp ?? null,
      });

      if (error) throw new Error(error.message || "No se pudo crear el cliente.");

      const created = (data as { cliente_id?: string }[] | null)?.[0] ?? null;
      return {
        entityId: created?.cliente_id ?? null,
        message: `Listo, cree el cliente ${params.nombre} correctamente.`,
        result: { created: true, customerId: created?.cliente_id ?? null },
      };
    },
  }),
  defineConversationAction({
    aliases: ["buscar producto", "ver producto", "buscar servicio"],
    description: "Busca productos o servicios del catalogo por nombre, codigo o descripcion.",
    executionMode: "read",
    id: "productos.buscar_producto",
    module: "catalog",
    name: "Buscar producto",
    requiredPermissions: ["catalog.products.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: searchSchema,
    async handler(params: z.infer<typeof searchSchema>, { tenant }) {
      const products = await getProducts(tenant, "todos", "todos");
      if (!products.ok) throw new Error(products.error.message);

      const query = normalizeSearch(params.query);
      const matches = products.data
        .filter(
          (product) =>
            fuzzyIncludesSearch(product.nombre, query) ||
            fuzzyIncludesSearch(product.codigo, query) ||
            fuzzyIncludesSearch(product.descripcion, query),
        )
        .slice(0, params.limit);

      return {
        message: summarizeNames(
          matches,
          "No encontre productos o servicios con esa busqueda.",
        ),
        result: { products: matches },
      };
    },
  }),
  defineConversationAction({
    aliases: ["crear producto", "nuevo producto", "crear servicio"],
    description: "Crea un producto o servicio comercial basico.",
    executionMode: "write",
    id: "productos.crear_producto",
    module: "catalog",
    name: "Crear producto",
    requiredPermissions: ["catalog.products.create"],
    requiresConfirmation: true,
    risk: "medium",
    schema: createProductSchema,
    async handler(params: z.infer<typeof createProductSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc("crear_catalogo_producto", {
        p_categoria_id: null,
        p_codigo: params.codigo ?? null,
        p_descripcion: params.descripcion ?? null,
        p_impuesto_porcentaje: params.impuestoPorcentaje,
        p_moneda: params.moneda,
        p_nombre: params.nombre,
        p_precio_base: params.precioBase,
        p_tipo: params.tipo,
        p_unidad_medida: params.unidadMedida,
      });

      if (error) throw new Error(error.message || "No se pudo crear el producto.");

      const created = (data as { producto_id?: string }[] | null)?.[0] ?? null;
      const stockRows =
        params.tipo === "producto" &&
        tenant.activeModules.includes("inventory") &&
        hasPermission(tenant.permissions, "inventory.stock.adjust")
          ? await initializeProductStockRows(supabase, {
              empresaId: tenant.empresaId,
              productId: created?.producto_id,
            })
          : 0;

      return {
        entityId: created?.producto_id ?? null,
        message:
          stockRows > 0
            ? `Producto creado correctamente y agregado a inventario en ${stockRows} bodega(s) con stock 0.`
            : "Producto creado correctamente en Catalogo. Para verlo en Inventario, registra stock o limites en una bodega.",
        result: {
          created: true,
          productId: created?.producto_id ?? null,
          stockRowsInitialized: stockRows,
        },
      };
    },
  }),
  defineConversationAction({
    aliases: ["consultar stock", "ver inventario", "stock de producto"],
    description: "Consulta existencias por producto o bodega.",
    executionMode: "read",
    id: "inventario.consultar_stock",
    module: "inventory",
    name: "Consultar stock",
    requiredPermissions: ["inventory.stock.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: searchSchema,
    async handler(params: z.infer<typeof searchSchema>, { tenant }) {
      const stock = await getInventoryStock(tenant);
      if (!stock.ok) throw new Error(stock.error.message);

      const query = normalizeSearch(params.query);
      const matches = stock.data
        .filter(
          (item) =>
            fuzzyIncludesSearch(item.productoNombre, query) ||
            fuzzyIncludesSearch(item.productoCodigo, query) ||
            fuzzyIncludesSearch(item.bodegaNombre, query),
        )
        .slice(0, params.limit);

      return {
        message:
          matches.length > 0
            ? `Encontre ${matches.length} registro(s) de stock: ${matches
                .slice(0, 3)
                .map((item) => `${item.productoNombre ?? "Producto"} (${item.cantidad})`)
                .join(", ")}.`
            : "No encontre stock con esa busqueda.",
        result: { stock: matches },
      };
    },
  }),
  defineConversationAction({
    aliases: ["crear proforma", "crear cotizacion", "borrador cotizacion"],
    description: "Crea una cotizacion/proforma con items validados.",
    executionMode: "draft",
    id: "proformas.crear_borrador",
    module: "quotes",
    name: "Crear borrador de proforma",
    requiredPermissions: ["quotes.create"],
    requiresConfirmation: true,
    risk: "high",
    schema: createQuoteDraftSchema,
    async handler(params: z.infer<typeof createQuoteDraftSchema>) {
      const itemMessage = getQuoteModalItemValidationMessage(params.items);
      if (itemMessage) throw new Error(itemMessage);

      const supabase = await createClient();
      const { data, error } = await supabase.rpc("crear_cotizacion", {
        p_cliente_id: params.clienteId ?? null,
        p_condiciones: params.condiciones ?? null,
        p_fecha_vencimiento: params.fechaVencimiento ?? null,
        p_items: params.items.map((item, index) => ({
          cantidad: item.cantidad,
          descripcion: item.descripcion,
          descuento: item.descuento,
          impuesto_porcentaje: item.impuestoPorcentaje,
          orden: index + 1,
          precio_unitario: item.precioUnitario,
          producto_id: item.productoId ?? null,
        })),
        p_moneda: params.moneda,
        p_notas: params.notas ?? null,
      });

      if (error) throw new Error(error.message || "No se pudo crear la proforma.");

      const created = (data as { cotizacion_id?: string; numero?: string }[] | null)?.[0] ?? null;
      return {
        entityId: created?.cotizacion_id ?? null,
        message: "Proforma creada correctamente.",
        result: {
          quoteId: created?.cotizacion_id ?? null,
          quoteNumber: created?.numero ?? null,
        },
      };
    },
  }),
  defineConversationAction({
    aliases: ["crear tarea", "crear recordatorio", "crear seguimiento", "agendar tarea"],
    description: "Crea una tarea propia como notificacion operativa enlazada a Agenda.",
    executionMode: "write",
    id: "agenda.crear_tarea",
    module: "agenda",
    name: "Crear tarea",
    requiredPermissions: ["crm.followups.create"],
    requiresConfirmation: false,
    risk: "medium",
    schema: taskSchema,
    async handler(params: z.infer<typeof taskSchema>) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("crear_notificacion_propia", {
        p_entity_id: params.recommendationId ?? null,
        p_entity_type: params.recommendationId ? "brain_recommendation" : "agenda_task",
        p_href: params.href ?? "/agenda/seguimientos",
        p_message: params.description ?? null,
        p_metadata: {
          recommendationId: params.recommendationId ?? null,
          source: "ai_action_registry",
        },
        p_title: params.title,
        p_type: "task",
      });

      if (error) throw new Error(error.message || "No se pudo crear la tarea.");

      return {
        message: `Tarea creada: ${params.title}.`,
        result: { href: params.href ?? "/agenda/seguimientos" },
      };
    },
  }),
  defineConversationAction({
    aliases: ["buscar ventas", "ver ventas", "ventas recientes", "consultar ventas"],
    description: "Consulta ventas recientes o por numero, estado o nota.",
    executionMode: "read",
    id: "ventas.buscar_ventas",
    module: "sales",
    name: "Buscar ventas",
    requiredPermissions: ["sales.orders.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("ventas")
        .select("id, numero, estado, fecha_venta, moneda, total, notas")
        .eq("empresa_id", tenant.empresaId)
        .neq("estado", "cancelada")
        .order("fecha_venta", { ascending: false })
        .limit(50);

      if (error) throw new Error("No se pudieron consultar ventas.");

      const query = normalizeSearch(params.query ?? "");
      const rows = (data ?? [])
        .filter((sale) =>
          query
            ? fuzzyIncludesSearch(sale.numero, query) ||
              fuzzyIncludesSearch(sale.estado, query) ||
              fuzzyIncludesSearch(sale.notas, query)
            : true,
        )
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No encontre ventas con ese criterio.",
          (sale) => `${sale.numero} ${sale.estado} ${Number(sale.total ?? 0).toLocaleString("es-CR")}`,
        ),
        result: { sales: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["consultar cobros vencidos", "cuentas por cobrar vencidas", "cobros pendientes"],
    description: "Consulta cuentas por cobrar vencidas o con saldo pendiente.",
    executionMode: "read",
    id: "pagos.consultar_vencidos",
    module: "payments",
    name: "Consultar cobros vencidos",
    requiredPermissions: ["payments.accounts.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const supabase = await createClient();
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("payments_accounts")
        .select("id, numero, descripcion, estado, saldo, total, fecha_vencimiento, moneda")
        .eq("empresa_id", tenant.empresaId)
        .eq("tipo", "receivable")
        .gt("saldo", 0)
        .in("estado", ["pendiente", "parcial", "vencida"])
        .lt("fecha_vencimiento", today)
        .order("fecha_vencimiento", { ascending: true })
        .limit(50);

      if (error) throw new Error("No se pudieron consultar cobros vencidos.");

      const query = normalizeSearch(params.query ?? "");
      const rows = (data ?? [])
        .filter((account) =>
          query
            ? fuzzyIncludesSearch(account.numero, query) ||
              fuzzyIncludesSearch(account.descripcion, query) ||
              fuzzyIncludesSearch(account.estado, query)
            : true,
        )
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No encontre cuentas por cobrar vencidas.",
          (account) => `${account.numero} saldo ${Number(account.saldo ?? 0).toLocaleString("es-CR")}`,
        ),
        result: { accounts: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["crear recordatorio de cobro", "recordatorio cobro", "preparar cobros"],
    description: "Crea una tarea propia para atender cobros vencidos.",
    executionMode: "write",
    id: "pagos.crear_recordatorio_cobro",
    module: "payments",
    name: "Crear recordatorio de cobro",
    requiredPermissions: ["payments.accounts.view"],
    requiresConfirmation: false,
    risk: "medium",
    schema: taskSchema,
    async handler(params: z.infer<typeof taskSchema>) {
      const supabase = await createClient();
      const { error } = await supabase.rpc("crear_notificacion_propia", {
        p_entity_id: params.recommendationId ?? null,
        p_entity_type: params.recommendationId ? "brain_recommendation" : "payments_collection",
        p_href: "/pagos",
        p_message: params.description ?? "Revisar cuentas por cobrar vencidas y priorizar contacto.",
        p_metadata: {
          recommendationId: params.recommendationId ?? null,
          source: "brain_collections_plan",
        },
        p_title: params.title || "Priorizar cobros vencidos",
        p_type: "task",
      });

      if (error) throw new Error(error.message || "No se pudo crear el recordatorio.");

      return {
        message: "Recordatorio de cobro creado.",
        result: { href: "/pagos" },
      };
    },
  }),
  defineConversationAction({
    aliases: ["consultar ordenes de compra", "compras pendientes", "ordenes pendientes"],
    description: "Consulta ordenes de compra abiertas o emitidas.",
    executionMode: "read",
    id: "compras.consultar_ordenes",
    module: "purchases",
    name: "Consultar ordenes de compra",
    requiredPermissions: ["purchases.orders.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("purchases_orders")
        .select("id, numero, estado, moneda, total, fecha_orden, fecha_recepcion, notas")
        .eq("empresa_id", tenant.empresaId)
        .in("estado", ["borrador", "emitida"])
        .order("fecha_orden", { ascending: false })
        .limit(50);

      if (error) throw new Error("No se pudieron consultar ordenes de compra.");

      const query = normalizeSearch(params.query ?? "");
      const rows = (data ?? [])
        .filter((order) =>
          query
            ? fuzzyIncludesSearch(order.numero, query) ||
              fuzzyIncludesSearch(order.estado, query) ||
              fuzzyIncludesSearch(order.notas, query)
            : true,
        )
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No encontre ordenes de compra pendientes.",
          (order) => `${order.numero} ${order.estado} ${Number(order.total ?? 0).toLocaleString("es-CR")}`,
        ),
        result: { orders: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["sugerir compra", "preparar compra", "que productos comprar", "reorden inventario"],
    description: "Prepara una sugerencia de compra basada en stock bajo.",
    executionMode: "draft",
    id: "compras.preparar_sugerencia_compra",
    module: "purchases",
    name: "Preparar sugerencia de compra",
    requiredPermissions: ["purchases.orders.view", "inventory.stock.view"],
    requiresConfirmation: false,
    risk: "medium",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const stock = await getInventoryStock(tenant);
      if (!stock.ok) throw new Error(stock.error.message);

      const query = normalizeSearch(params.query ?? "");
      const rows = stock.data
        .filter((item) => Number(item.stockMinimo ?? 0) > 0)
        .filter((item) => Number(item.cantidad ?? 0) <= Number(item.stockMinimo ?? 0))
        .filter((item) =>
          query
            ? fuzzyIncludesSearch(item.productoNombre, query) ||
              fuzzyIncludesSearch(item.productoCodigo, query)
            : true,
        )
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No veo productos bajo minimo para sugerir compra.",
          (item) => `${item.productoNombre ?? "Producto"} stock ${item.cantidad}`,
        ),
        result: { reorderSuggestions: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["sugerir reorden", "sugerir ajuste inventario", "revisar inventario bajo"],
    description: "Sugiere reposicion o revision de inventario sin ajustar stock automaticamente.",
    executionMode: "draft",
    id: "inventario.sugerir_reorden",
    module: "inventory",
    name: "Sugerir reorden de inventario",
    requiredPermissions: ["inventory.stock.view"],
    requiresConfirmation: false,
    risk: "medium",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const stock = await getInventoryStock(tenant);
      if (!stock.ok) throw new Error(stock.error.message);

      const rows = stock.data
        .filter((item) => Number(item.stockMinimo ?? 0) > 0)
        .filter((item) => Number(item.cantidad ?? 0) <= Number(item.stockMinimo ?? 0))
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No hay stock bajo minimo.",
          (item) => `${item.productoNombre ?? "Producto"}: ${item.cantidad}/${item.stockMinimo}`,
        ),
        result: { lowStock: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["consultar despachos pendientes", "despachos pendientes", "entregas pendientes"],
    description: "Consulta despachos pendientes, en preparacion, listos o en ruta.",
    executionMode: "read",
    id: "despacho.consultar_pendientes",
    module: "dispatch",
    name: "Consultar despachos pendientes",
    requiredPermissions: ["dispatch.orders.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("despachos")
        .select("id, numero, estado, fecha_programada, contacto_entrega, telefono_entrega")
        .eq("empresa_id", tenant.empresaId)
        .in("estado", ["pendiente", "preparando", "listo", "en_ruta"])
        .order("fecha_programada", { ascending: true, nullsFirst: false })
        .limit(50);

      if (error) throw new Error("No se pudieron consultar despachos.");

      const query = normalizeSearch(params.query ?? "");
      const rows = (data ?? [])
        .filter((dispatch) =>
          query
            ? fuzzyIncludesSearch(dispatch.numero, query) ||
              fuzzyIncludesSearch(dispatch.estado, query) ||
              fuzzyIncludesSearch(dispatch.contacto_entrega, query)
            : true,
        )
        .slice(0, params.limit);

      return {
        message: summarizeRows(
          rows,
          "No encontre despachos pendientes.",
          (dispatch) => `${dispatch.numero} ${dispatch.estado}`,
        ),
        result: { dispatches: rows },
      };
    },
  }),
  defineConversationAction({
    aliases: ["preparar borrador fiscal", "crear borrador fiscal", "preparar factura"],
    description: "Prepara una respuesta de borrador fiscal; no emite documentos.",
    executionMode: "draft",
    id: "facturacion.preparar_borrador",
    module: "billing",
    name: "Preparar borrador fiscal",
    requiredPermissions: ["billing.invoices.create"],
    requiresConfirmation: true,
    risk: "high",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>) {
      return {
        message:
          "Puedo preparar el borrador fiscal, pero la emision real debe confirmarse desde Facturacion.",
        result: {
          href: "/facturacion/documentos",
          query: params.query ?? null,
          status: "draft_prepared",
        },
      };
    },
  }),
  defineConversationAction({
    aliases: ["preparar respuesta", "responder inbox", "respuesta whatsapp"],
    description: "Prepara una respuesta para Inbox/Whapp sin enviarla.",
    executionMode: "draft",
    id: "inbox.preparar_respuesta",
    module: "whapp",
    name: "Preparar respuesta Inbox",
    requiredPermissions: ["inbox.conversations.reply"],
    requiresConfirmation: false,
    risk: "medium",
    schema: optionalSearchSchema,
    async handler(params: z.infer<typeof optionalSearchSchema>, { tenant }) {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("inbox_conversaciones")
        .select("id, canal, contacto_nombre, contacto_telefono, estado, prioridad, ultimo_mensaje")
        .eq("empresa_id", tenant.empresaId)
        .in("estado", ["abierta", "pendiente"])
        .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
        .limit(params.limit);

      if (error) throw new Error("No se pudieron consultar conversaciones.");

      return {
        message:
          "Prepare una respuesta base: Gracias por escribirnos. Ya reviso tu caso y te confirmo la informacion en breve.",
        result: {
          conversations: data ?? [],
          draft:
            "Gracias por escribirnos. Ya reviso tu caso y te confirmo la informacion en breve.",
        },
      };
    },
  }),
  defineConversationAction({
    aliases: ["analiza mi negocio", "analizar negocio", "ejecutar brain", "actualizar brain"],
    description: "Ejecuta el analisis avanzado de Business Brain.",
    executionMode: "write",
    id: "brain.generar_analisis",
    module: "brain",
    name: "Generar analisis Brain",
    requiredPermissions: ["brain.settings.manage"],
    requiresConfirmation: false,
    risk: "medium",
    schema: brainQuestionSchema,
    async handler(_params: z.infer<typeof brainQuestionSchema>, { tenant }) {
      const result = await runAdvancedBrainAnalysis(tenant);
      if (!result.ok) throw new Error(result.error.message);

      return {
        message: `Analisis completado. Senales: ${result.data.signalsCreated ?? 0}. Recomendaciones: ${result.data.recommendationsCreated}.`,
        result: { analysis: result.data },
      };
    },
  }),
  defineConversationAction({
    aliases: [
      "que debo atender hoy",
      "que esta pasando con mis ventas",
      "clientes en riesgo",
      "productos debo comprar",
      "prioridades de la semana",
      "preguntar brain",
    ],
    description: "Responde preguntas estrategicas leyendo Business Brain.",
    executionMode: "read",
    id: "brain.responder_pregunta",
    module: "brain",
    name: "Responder pregunta Brain",
    requiredPermissions: ["brain.insights.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: brainQuestionSchema,
    async handler(params: z.infer<typeof brainQuestionSchema>, { tenant }) {
      const question = params.question ?? params.summary ?? "Analiza mi negocio";
      const result = await answerBrainQuestion(tenant, question);
      if (!result.ok) throw new Error(result.error.message);

      return result.data;
    },
  }),
  defineConversationAction({
    aliases: ["actualizar contexto", "completar contexto del negocio", "abrir contexto"],
    description: "Indica donde completar el contexto de negocio para mejorar el Brain.",
    executionMode: "read",
    id: "brain.actualizar_contexto",
    module: "brain",
    name: "Actualizar contexto Brain",
    requiredPermissions: ["brain.insights.view"],
    requiresConfirmation: false,
    risk: "low",
    schema: brainQuestionSchema,
    async handler() {
      return {
        message: "Completa el contexto de negocio en Administracion > Contexto del negocio.",
        result: { href: "/admin/contexto" },
      };
    },
  }),
];

export function listConversationActions(): PublicConversationAction[] {
  return conversationActionRegistry.map(publicAction);
}

export function listConversationActionsForTenant(tenant: { permissions: readonly string[] }) {
  return conversationActionRegistry
    .filter((action) =>
      hasEveryPermission(
        tenant.permissions as readonly PermissionCode[],
        action.requiredPermissions,
      ),
    )
    .map(publicAction);
}

export function getConversationAction(actionId: string) {
  return conversationActionRegistry.find((action) => action.id === actionId) ?? null;
}

export function resolveConversationAction(value: string | null | undefined) {
  const normalized = normalizeSearch(value ?? "");
  if (!normalized) return null;

  return (
    conversationActionRegistry.find(
      (action) =>
        action.id === normalized ||
        normalizeSearch(action.name) === normalized ||
        action.aliases.some((alias) => normalizeSearch(alias) === normalized),
    ) ?? null
  );
}
