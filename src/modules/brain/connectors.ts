import "server-only";

import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import type { BrainInsightSeverity, BrainRecommendationType } from "@/modules/brain/types";
import type { JsonRecord, ModuleCode, TenantContext } from "@/types/core";

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type CountQuery = PromiseLike<CountResult> & {
  eq(column: string, value: unknown): CountQuery;
  gt(column: string, value: unknown): CountQuery;
  gte(column: string, value: unknown): CountQuery;
  in(column: string, values: readonly unknown[]): CountQuery;
  lt(column: string, value: unknown): CountQuery;
  neq(column: string, value: unknown): CountQuery;
  not(column: string, operator: string, value: unknown): CountQuery;
};

export type BrainSignalDraft = {
  actionId?: string | null;
  description: string;
  entityId?: string | null;
  entityType?: string | null;
  evidence: JsonRecord;
  expectedImpact?: string | null;
  moduleCode: ModuleCode | "business-context";
  priorityScore: number;
  recommendationTitle?: string | null;
  recommendationType: BrainRecommendationType;
  severity: BrainInsightSeverity;
  signalType: string;
  sourceModules: string[];
  title: string;
};

async function countRows(
  table: string,
  tenant: TenantContext,
  apply?: (query: CountQuery) => CountQuery,
) {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", tenant.empresaId) as unknown as CountQuery;

  if (apply) query = apply(query);

  const { count, error } = await query;
  if (error) return 0;

  return count ?? 0;
}

async function countLowStock(tenant: TenantContext) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventario_stock")
    .select("id, cantidad, stock_minimo")
    .eq("empresa_id", tenant.empresaId)
    .gt("stock_minimo", 0)
    .limit(5000);

  if (error) return 0;

  return (data ?? []).filter(
    (item) => Number(item.cantidad ?? 0) <= Number(item.stock_minimo ?? 0),
  ).length;
}

function active(tenant: TenantContext, moduleCode: ModuleCode) {
  return isModuleActive(tenant.activeModules, moduleCode);
}

export async function collectBrainSignals(
  tenant: TenantContext,
): Promise<BrainSignalDraft[]> {
  const signals: BrainSignalDraft[] = [];

  if (active(tenant, "crm")) {
    const [prospects, followupsOverdue] = await Promise.all([
      countRows("crm_clientes", tenant, (query) => query.eq("tipo", "prospecto")),
      countRows("crm_seguimientos", tenant, (query) =>
        query.eq("estado", "pendiente").lt("fecha_programada", new Date().toISOString()),
      ),
    ]);

    if (prospects > 0) {
      signals.push({
        actionId: "clientes.buscar_cliente",
        description: "Hay prospectos registrados que pueden requerir seguimiento comercial.",
        evidence: { prospects },
        expectedImpact: "Mejorar conversion y evitar perdida de oportunidades.",
        moduleCode: "crm",
        priorityScore: Math.min(80, 30 + prospects),
        recommendationTitle: "Priorizar prospectos sin cierre",
        recommendationType: "commercial",
        severity: prospects > 20 ? "high" : "medium",
        signalType: "crm_prospects",
        sourceModules: ["crm", "agenda"],
        title: "Prospectos por atender",
      });
    }

    if (followupsOverdue > 0) {
      signals.push({
        actionId: "agenda.crear_tarea",
        description: "Existen seguimientos comerciales vencidos.",
        evidence: { followupsOverdue },
        expectedImpact: "Reducir perdida de ventas por falta de seguimiento.",
        moduleCode: "agenda",
        priorityScore: Math.min(95, 60 + followupsOverdue * 3),
        recommendationTitle: "Atender seguimientos vencidos hoy",
        recommendationType: "operational",
        severity: followupsOverdue > 5 ? "high" : "medium",
        signalType: "followups_overdue",
        sourceModules: ["crm", "agenda"],
        title: "Seguimientos vencidos",
      });
    }
  }

  if (active(tenant, "catalog")) {
    const productsWithoutPrice = await countRows("catalogo_productos", tenant, (query) =>
      query.eq("estado", "activo").eq("precio_base", 0),
    );

    if (productsWithoutPrice > 0) {
      signals.push({
        actionId: "productos.buscar_producto",
        description: "Hay productos o servicios activos sin precio base.",
        evidence: { productsWithoutPrice },
        expectedImpact: "Mejorar calidad del catalogo y evitar cotizaciones incompletas.",
        moduleCode: "catalog",
        priorityScore: Math.min(75, 35 + productsWithoutPrice),
        recommendationTitle: "Completar precios del catalogo",
        recommendationType: "data_quality",
        severity: "medium",
        signalType: "catalog_products_without_price",
        sourceModules: ["catalog", "quotes"],
        title: "Catalogo con precios pendientes",
      });
    }
  }

  if (active(tenant, "inventory")) {
    const lowStock = await countLowStock(tenant);

    if (lowStock > 0) {
      signals.push({
        actionId: "inventario.sugerir_reorden",
        description: "Hay productos con cantidad igual o menor al minimo configurado.",
        evidence: { lowStock },
        expectedImpact: "Evitar promesas de entrega sin disponibilidad.",
        moduleCode: "inventory",
        priorityScore: Math.min(95, 60 + lowStock * 2),
        recommendationTitle: "Revisar reposicion de inventario",
        recommendationType: "inventory",
        severity: lowStock > 10 ? "high" : "medium",
        signalType: "inventory_low_stock",
        sourceModules: ["inventory", "purchases", "sales"],
        title: "Inventario bajo minimo",
      });
    }
  }

  if (active(tenant, "quotes")) {
    const expiredQuotes = await countRows("cotizaciones", tenant, (query) =>
      query
        .in("estado", ["borrador", "enviada", "vencida"])
        .not("fecha_vencimiento", "is", null)
        .lt("fecha_vencimiento", new Date().toISOString().slice(0, 10)),
    );

    if (expiredQuotes > 0) {
      signals.push({
        actionId: "agenda.crear_tarea",
        description: "Hay cotizaciones abiertas con fecha vencida.",
        evidence: { expiredQuotes },
        expectedImpact: "Recuperar oportunidades comerciales antes de que se enfrien.",
        moduleCode: "quotes",
        priorityScore: Math.min(90, 50 + expiredQuotes * 3),
        recommendationTitle: "Reactivar cotizaciones vencidas",
        recommendationType: "commercial",
        severity: expiredQuotes > 10 ? "high" : "medium",
        signalType: "quotes_expired",
        sourceModules: ["quotes", "crm", "sales"],
        title: "Cotizaciones vencidas",
      });
    }
  }

  if (active(tenant, "sales")) {
    const sales30d = await countRows("ventas", tenant, (query) =>
      query
        .gte("fecha_venta", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .neq("estado", "cancelada"),
    );

    signals.push({
      actionId: "ventas.buscar_ventas",
      description: "Resumen comercial de ventas de los ultimos 30 dias.",
      evidence: { sales30d },
      expectedImpact: "Dar contexto de desempeno comercial reciente.",
      moduleCode: "sales",
      priorityScore: sales30d > 0 ? 35 : 65,
      recommendationTitle: sales30d > 0 ? null : "Revisar ausencia de ventas recientes",
      recommendationType: "management",
      severity: sales30d > 0 ? "low" : "high",
      signalType: "sales_30d_activity",
      sourceModules: ["sales", "crm", "quotes"],
      title: sales30d > 0 ? "Ventas recientes registradas" : "Sin ventas recientes",
    });
  }

  if (active(tenant, "payments")) {
    const overdueReceivables = await countRows("payments_accounts", tenant, (query) =>
      query.eq("tipo", "receivable").gt("saldo", 0).in("estado", ["pendiente", "parcial", "vencida"]).lt("fecha_vencimiento", new Date().toISOString().slice(0, 10)),
    );

    if (overdueReceivables > 0) {
      signals.push({
        actionId: "pagos.crear_recordatorio_cobro",
        description: "Hay cuentas por cobrar vencidas o con saldo pendiente.",
        evidence: { overdueReceivables },
        expectedImpact: "Mejorar flujo de caja y priorizar cobros.",
        moduleCode: "payments",
        priorityScore: Math.min(95, 65 + overdueReceivables * 3),
        recommendationTitle: "Priorizar cobros vencidos",
        recommendationType: "collections",
        severity: overdueReceivables > 5 ? "high" : "medium",
        signalType: "payments_overdue_receivables",
        sourceModules: ["payments", "sales", "crm"],
        title: "Cuentas por cobrar vencidas",
      });
    }
  }

  if (active(tenant, "purchases")) {
    const openPurchaseOrders = await countRows("purchases_orders", tenant, (query) =>
      query.in("estado", ["borrador", "emitida"]),
    );

    if (openPurchaseOrders > 0) {
      signals.push({
        actionId: "compras.consultar_ordenes",
        description: "Hay ordenes de compra abiertas o parcialmente recibidas.",
        evidence: { openPurchaseOrders },
        expectedImpact: "Controlar recepciones pendientes y disponibilidad futura.",
        moduleCode: "purchases",
        priorityScore: Math.min(80, 40 + openPurchaseOrders * 2),
        recommendationTitle: "Revisar compras pendientes",
        recommendationType: "operational",
        severity: "medium",
        signalType: "purchases_open_orders",
        sourceModules: ["purchases", "inventory"],
        title: "Compras pendientes",
      });
    }
  }

  if (active(tenant, "billing")) {
    const pendingFiscalDocuments = await countRows("fiscal_documents", tenant, (query) =>
      query.in("status", [
        "draft",
        "validated",
        "xml_generated",
        "signed",
        "sent",
        "processing",
        "error_validation",
        "error_xml",
        "error_signing",
        "error_sending",
      ]),
    );

    if (pendingFiscalDocuments > 0) {
      signals.push({
        actionId: "facturacion.preparar_borrador",
        description: "Hay documentos fiscales en borrador, pendientes o con error.",
        evidence: { pendingFiscalDocuments },
        expectedImpact: "Reducir atrasos fiscales y errores operativos.",
        moduleCode: "billing",
        priorityScore: Math.min(90, 50 + pendingFiscalDocuments * 3),
        recommendationTitle: "Revisar documentos fiscales pendientes",
        recommendationType: "operational",
        severity: pendingFiscalDocuments > 3 ? "high" : "medium",
        signalType: "billing_pending_documents",
        sourceModules: ["billing", "sales"],
        title: "Facturacion pendiente",
      });
    }
  }

  if (active(tenant, "dispatch")) {
    const pendingDispatches = await countRows("despachos", tenant, (query) =>
      query.in("estado", ["pendiente", "preparando", "listo", "en_ruta"]),
    );

    if (pendingDispatches > 0) {
      signals.push({
        actionId: "despacho.consultar_pendientes",
        description: "Hay despachos pendientes, programados o en ruta.",
        evidence: { pendingDispatches },
        expectedImpact: "Mejorar seguimiento operativo de entregas.",
        moduleCode: "dispatch",
        priorityScore: Math.min(75, 35 + pendingDispatches * 2),
        recommendationTitle: "Revisar entregas pendientes",
        recommendationType: "operational",
        severity: "medium",
        signalType: "dispatch_pending",
        sourceModules: ["dispatch", "sales"],
        title: "Despachos pendientes",
      });
    }
  }

  if (active(tenant, "whapp")) {
    const openConversations = await countRows("inbox_conversaciones", tenant, (query) =>
      query.in("estado", ["abierta", "pendiente"]),
    );

    if (openConversations > 0) {
      signals.push({
        actionId: "inbox.preparar_respuesta",
        description: "Hay conversaciones abiertas o pendientes de respuesta.",
        evidence: { openConversations },
        expectedImpact: "Reducir tiempos de respuesta y capturar oportunidades.",
        moduleCode: "whapp",
        priorityScore: Math.min(85, 45 + openConversations * 2),
        recommendationTitle: "Atender conversaciones abiertas",
        recommendationType: "service",
        severity: openConversations > 10 ? "high" : "medium",
        signalType: "inbox_open_conversations",
        sourceModules: ["inbox", "whapp", "crm"],
        title: "Conversaciones abiertas",
      });
    }
  }

  const businessContext = await countRows("business_context", tenant);
  if (businessContext === 0) {
    signals.push({
      actionId: "brain.actualizar_contexto",
      description: "El contexto de negocio no esta completo, lo que limita recomendaciones avanzadas.",
      evidence: { businessContextReady: false },
      expectedImpact: "Mejorar la precision de recomendaciones y priorizacion.",
      moduleCode: "business-context",
      priorityScore: 88,
      recommendationTitle: "Completar contexto del negocio",
      recommendationType: "data_quality",
      severity: "high",
      signalType: "business_context_missing",
      sourceModules: ["admin", "brain"],
      title: "Contexto de negocio pendiente",
    });
  }

  return signals;
}
