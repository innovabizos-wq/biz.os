import type {
  BrainAgentId,
  BusinessSkillKind,
  CapabilityDefinition,
} from "@/modules/brain/runtime/contracts";
import type { ModuleCode, PermissionCode } from "@/types/core";

type AgentExpansionBlueprint = {
  agentId: BrainAgentId;
  areas: Array<{ description: string; id: string; name: string }>;
  module: ModuleCode;
  permission: PermissionCode;
};

const capabilityActions: Array<{
  description: string;
  id: string;
  kind: BusinessSkillKind;
  name: string;
}> = [
  {
    description: "consultar datos reales y devolver evidencia operativa",
    id: "query",
    kind: "query",
    name: "Consultar",
  },
  {
    description: "analizar patrones, riesgos y oportunidades",
    id: "analyze",
    kind: "analysis",
    name: "Analizar",
  },
  {
    description: "recomendar la siguiente accion con criterio empresarial",
    id: "recommend",
    kind: "analysis",
    name: "Recomendar",
  },
  {
    description: "preparar un borrador o plan aprobable",
    id: "prepare",
    kind: "draft",
    name: "Preparar",
  },
  {
    description: "monitorear cambios y disparar alertas o seguimientos",
    id: "monitor",
    kind: "query",
    name: "Monitorear",
  },
];

export const agentExpansionBlueprints: AgentExpansionBlueprint[] = [
  {
    agentId: "ventas",
    module: "sales",
    permission: "sales.orders.view",
    areas: [
      { description: "prospectos y oportunidades comerciales", id: "prospects", name: "Prospectos" },
      { description: "pipeline y etapas de venta", id: "pipeline", name: "Pipeline" },
      { description: "cotizaciones y proformas", id: "quotes", name: "Cotizaciones" },
      { description: "clientes prioritarios", id: "customers", name: "Clientes" },
      { description: "precios y descuentos", id: "pricing", name: "Precios" },
      { description: "seguimientos comerciales", id: "followups", name: "Seguimientos" },
      { description: "conversion y cierres", id: "conversion", name: "Conversion" },
      { description: "ventas recientes", id: "orders", name: "Ventas" },
      { description: "metas y rendimiento", id: "performance", name: "Rendimiento" },
      { description: "retencion y recompra", id: "retention", name: "Retencion" },
    ],
  },
  {
    agentId: "compras",
    module: "purchases",
    permission: "purchases.orders.view",
    areas: [
      { description: "proveedores activos", id: "suppliers", name: "Proveedores" },
      { description: "ordenes de compra", id: "orders", name: "Ordenes" },
      { description: "reposicion sugerida", id: "replenishment", name: "Reposicion" },
      { description: "costos y variaciones", id: "costs", name: "Costos" },
      { description: "tiempos de entrega", id: "lead-times", name: "Tiempos de entrega" },
      { description: "recepciones pendientes", id: "receipts", name: "Recepciones" },
      { description: "compras vencidas", id: "overdue", name: "Compras vencidas" },
      { description: "negociacion con proveedores", id: "negotiation", name: "Negociacion" },
      { description: "abastecimiento critico", id: "sourcing", name: "Abastecimiento" },
      { description: "calidad de compra", id: "quality", name: "Calidad" },
    ],
  },
  {
    agentId: "finanzas",
    module: "payments",
    permission: "payments.accounts.view",
    areas: [
      { description: "cuentas por cobrar", id: "receivables", name: "Cuentas por cobrar" },
      { description: "cuentas por pagar", id: "payables", name: "Cuentas por pagar" },
      { description: "flujo de caja", id: "cashflow", name: "Flujo de caja" },
      { description: "cobros vencidos", id: "collections", name: "Cobros" },
      { description: "pagos a proveedores", id: "supplier-payments", name: "Pagos proveedor" },
      { description: "margen y rentabilidad", id: "margin", name: "Margen" },
      { description: "riesgo de cartera", id: "credit-risk", name: "Riesgo de cartera" },
      { description: "conciliacion operativa", id: "reconciliation", name: "Conciliacion" },
      { description: "proyecciones financieras", id: "forecast", name: "Proyeccion" },
      { description: "alertas financieras", id: "alerts", name: "Alertas" },
    ],
  },
  {
    agentId: "inventario",
    module: "inventory",
    permission: "inventory.stock.view",
    areas: [
      { description: "stock por producto", id: "stock", name: "Stock" },
      { description: "stock bajo", id: "low-stock", name: "Stock bajo" },
      { description: "bodegas y ubicaciones", id: "warehouses", name: "Bodegas" },
      { description: "movimientos de inventario", id: "movements", name: "Movimientos" },
      { description: "traslados entre bodegas", id: "transfers", name: "Traslados" },
      { description: "productos sin rotacion", id: "dead-stock", name: "Sin rotacion" },
      { description: "quiebres de stock", id: "stockouts", name: "Quiebres" },
      { description: "stock minimo y maximo", id: "thresholds", name: "Minimos y maximos" },
      { description: "conteos y ajustes", id: "counts", name: "Conteos" },
      { description: "valor de inventario", id: "valuation", name: "Valor inventario" },
    ],
  },
  {
    agentId: "logistica",
    module: "dispatch",
    permission: "dispatch.orders.view",
    areas: [
      { description: "despachos pendientes", id: "pending-dispatches", name: "Despachos pendientes" },
      { description: "rutas de entrega", id: "routes", name: "Rutas" },
      { description: "choferes y asignaciones", id: "drivers", name: "Choferes" },
      { description: "preparacion de pedidos", id: "picking", name: "Preparacion" },
      { description: "entregas vencidas", id: "late-deliveries", name: "Entregas vencidas" },
      { description: "capacidad de reparto", id: "capacity", name: "Capacidad" },
      { description: "evidencia de entrega", id: "proof", name: "Evidencia" },
      { description: "incidencias logisticas", id: "incidents", name: "Incidencias" },
      { description: "priorizacion de entregas", id: "priority", name: "Prioridad" },
      { description: "costos logisticos", id: "costs", name: "Costos logisticos" },
    ],
  },
  {
    agentId: "soporte",
    module: "whapp",
    permission: "inbox.conversations.view",
    areas: [
      { description: "conversaciones abiertas", id: "open-conversations", name: "Conversaciones" },
      { description: "SLA y tiempos de respuesta", id: "sla", name: "SLA" },
      { description: "borradores de respuesta", id: "reply-drafts", name: "Respuestas" },
      { description: "asignacion de conversaciones", id: "assignment", name: "Asignacion" },
      { description: "cierre de casos", id: "closing", name: "Cierre" },
      { description: "sentimiento del cliente", id: "sentiment", name: "Sentimiento" },
      { description: "preguntas frecuentes", id: "faq", name: "FAQ" },
      { description: "escalamientos", id: "escalation", name: "Escalamientos" },
      { description: "historial de contacto", id: "history", name: "Historial" },
      { description: "calidad de atencion", id: "quality", name: "Calidad" },
    ],
  },
  {
    agentId: "contenido",
    module: "autoblog",
    permission: "autoblog.view",
    areas: [
      { description: "ideas de articulos", id: "ideas", name: "Ideas" },
      { description: "borradores de blog", id: "drafts", name: "Borradores" },
      { description: "estructura editorial", id: "structure", name: "Estructura" },
      { description: "SEO operativo", id: "seo", name: "SEO" },
      { description: "calidad de contenido", id: "quality", name: "Calidad" },
      { description: "calendario editorial", id: "calendar", name: "Calendario" },
      { description: "contenido comercial", id: "sales-content", name: "Contenido comercial" },
      { description: "reutilizacion de contenido", id: "repurpose", name: "Reutilizacion" },
      { description: "publicacion", id: "publishing", name: "Publicacion" },
      { description: "rendimiento de contenido", id: "performance", name: "Rendimiento" },
    ],
  },
  {
    agentId: "marketing",
    module: "autoblog",
    permission: "autoblog.view",
    areas: [
      { description: "campanas comerciales", id: "campaigns", name: "Campanas" },
      { description: "segmentos de clientes", id: "segments", name: "Segmentos" },
      { description: "mensajes promocionales", id: "messages", name: "Mensajes" },
      { description: "ofertas y promociones", id: "offers", name: "Ofertas" },
      { description: "embudos de conversion", id: "funnels", name: "Embudos" },
      { description: "audiencias", id: "audiences", name: "Audiencias" },
      { description: "contenido para redes", id: "social-content", name: "Redes" },
      { description: "leads generados", id: "leads", name: "Leads" },
      { description: "retorno de campanas", id: "roi", name: "ROI" },
      { description: "experimentos comerciales", id: "experiments", name: "Experimentos" },
      { description: "temas de articulos alineados al negocio, mercado y temporada", id: "article-topics", name: "Temas de articulos" },
      { description: "briefs editoriales con objetivo, audiencia, enfoque y fuentes", id: "article-briefs", name: "Briefs editoriales" },
      { description: "borradores largos para Autoblog con estructura util y accionable", id: "article-drafts", name: "Borradores de articulos" },
      { description: "titulos, subtitulos y angulos para mejorar lectura y conversion", id: "headlines", name: "Titulos y angulos" },
      { description: "SEO de articulos, keywords, meta descripcion y enlaces internos", id: "seo-optimization", name: "SEO de articulos" },
      { description: "calidad editorial, claridad, evidencia y eliminacion de relleno generico", id: "editorial-quality", name: "Calidad editorial" },
      { description: "conversion de articulos en copys para redes, correo y WhatsApp", id: "content-repurpose", name: "Reutilizacion" },
      { description: "calendario editorial, frecuencia, prioridades y estados de publicacion", id: "editorial-calendar", name: "Calendario editorial" },
      { description: "medicion de contenido, temas ganadores y oportunidades de mejora", id: "content-performance", name: "Rendimiento de contenido" },
      { description: "publicacion, aprobacion y preparacion multicanal de articulos", id: "publishing-readiness", name: "Preparacion de publicacion" },
    ],
  },
  {
    agentId: "operaciones",
    module: "brain",
    permission: "brain.insights.view",
    areas: [
      { description: "prioridades del dia", id: "daily-priorities", name: "Prioridades" },
      { description: "salud operativa", id: "health", name: "Salud operativa" },
      { description: "riesgos cruzados", id: "risks", name: "Riesgos" },
      { description: "planes de accion", id: "plans", name: "Planes" },
      { description: "alertas del negocio", id: "alerts", name: "Alertas" },
      { description: "dependencias entre modulos", id: "dependencies", name: "Dependencias" },
      { description: "automatizaciones", id: "automations", name: "Automatizaciones" },
      { description: "indicadores clave", id: "kpis", name: "KPIs" },
      { description: "decisiones pendientes", id: "decisions", name: "Decisiones" },
      { description: "mejora continua", id: "improvement", name: "Mejora continua" },
    ],
  },
  {
    agentId: "rrhh",
    module: "hr",
    permission: "hr.timesheets.view",
    areas: [
      { description: "personal activo", id: "staff", name: "Personal" },
      { description: "asistencia", id: "attendance", name: "Asistencia" },
      { description: "planillas", id: "payroll", name: "Planillas" },
      { description: "horarios", id: "schedules", name: "Horarios" },
      { description: "ausencias", id: "absences", name: "Ausencias" },
      { description: "rendimiento del equipo", id: "performance", name: "Rendimiento" },
      { description: "carga laboral", id: "workload", name: "Carga laboral" },
      { description: "cumplimiento laboral", id: "compliance", name: "Cumplimiento" },
      { description: "onboarding interno", id: "onboarding", name: "Onboarding" },
      { description: "necesidades de capacitacion", id: "training", name: "Capacitacion" },
    ],
  },
];

function toCapabilityId(agentId: BrainAgentId, areaId: string, actionId: string) {
  return `agent.${agentId}.${areaId}.${actionId}`;
}

export const ventasAgentCapabilityBlueprints = agentExpansionBlueprints
  .find((agent) => agent.agentId === "ventas")!
  .areas.flatMap((area) =>
    capabilityActions.map((action) => ({
      actionDescription: action.description,
      actionId: action.id as "analyze" | "monitor" | "prepare" | "query" | "recommend",
      actionName: action.name,
      areaDescription: area.description,
      areaId: area.id,
      areaName: area.name,
      capabilityId: toCapabilityId("ventas", area.id, action.id),
      kind: action.kind,
    })),
  );

export function getAgentCapabilityBlueprints(agentId: BrainAgentId) {
  return agentExpansionBlueprints
    .find((agent) => agent.agentId === agentId)!
    .areas.flatMap((area) =>
      capabilityActions.map((action) => ({
        actionDescription: action.description,
        actionId: action.id as "analyze" | "monitor" | "prepare" | "query" | "recommend",
        actionName: action.name,
        areaDescription: area.description,
        areaId: area.id,
        areaName: area.name,
        capabilityId: toCapabilityId(agentId, area.id, action.id),
        kind: action.kind,
      })),
    );
}

export const agentCapabilityExpansionIds: Record<BrainAgentId, string[]> =
  Object.fromEntries(
    agentExpansionBlueprints.map((agent) => [
      agent.agentId,
      agent.areas.flatMap((area) =>
        capabilityActions.map((action) =>
          toCapabilityId(agent.agentId, area.id, action.id),
        ),
      ),
    ]),
  ) as Record<BrainAgentId, string[]>;

export const plannedAgentCapabilities: CapabilityDefinition[] =
  agentExpansionBlueprints.flatMap((agent) =>
    agent.areas.flatMap((area) =>
      capabilityActions.map((action) => {
        const capabilityId = toCapabilityId(agent.agentId, area.id, action.id);

        const implemented = true;

        return {
          description: `${action.name} ${area.description}: ${action.description}.`,
          enabled: true,
          id: capabilityId,
          kind: action.kind,
          module: agent.module,
          name: `${action.name} ${area.name}`,
          requiredPermissions: [agent.permission],
          skillBindings: [
            {
              capabilityId,
              priority: 100,
              skillId: `${capabilityId}.skill.v1`,
              status: implemented ? "implemented" : "planned",
              version: "1.0.0",
            },
          ],
          status: implemented ? "implemented" : "planned",
          version: "1.0.0",
        } satisfies CapabilityDefinition;
      }),
    ),
  );
