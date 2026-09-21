import "server-only";

import { z } from "zod";

import {
  getOverdueFollowups,
  getTodayFollowups,
} from "@/modules/agenda/queries";
import {
  agentCapabilityExpansionIds,
  ventasAgentCapabilityBlueprints,
} from "@/modules/brain/runtime/agent-capability-expansion";
import type {
  BrainEvidence,
  BrainResultLink,
  BusinessSkillDefinition,
  BusinessSkillKind,
} from "@/modules/brain/runtime/contracts";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import { getCrmCustomers } from "@/modules/crm/queries";
import type { CrmCustomer } from "@/modules/crm/types";
import { getQuotes } from "@/modules/quotes/queries";
import type { Quote } from "@/modules/quotes/types";
import { getSales } from "@/modules/sales/queries";
import type { Sale } from "@/modules/sales/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

type SalesAgentAction = "analyze" | "monitor" | "prepare" | "query" | "recommend";

type SalesAgentCapabilityBlueprint = {
  actionDescription: string;
  actionId: SalesAgentAction;
  actionName: string;
  areaDescription: string;
  areaId: string;
  areaName: string;
  capabilityId: string;
  kind: BusinessSkillKind;
};

type SalesCrmDataset = {
  customers: CrmCustomer[];
  overdueFollowups: JsonRecord[];
  quotes: Quote[];
  sales: Sale[];
  todayFollowups: JsonRecord[];
};

type SalesCrmSummary = {
  acceptedQuotes: number;
  customers: number;
  openQuotes: number;
  openQuotesTotal: number;
  overdueFollowups: number;
  sales: number;
  salesTotal: number;
  todayFollowups: number;
};

const salesAgentInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  query: z.string().trim().optional(),
});

const salesAgentOutputSchema = z.object({
  action: z.string(),
  area: z.string(),
  highlights: z.array(z.string()),
  items: z.array(z.record(z.string(), z.unknown())),
  recommendations: z.array(z.string()),
  summary: z.record(z.string(), z.unknown()),
});

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function dataOrEmpty<T>(result: CoreResult<T[]>): T[] {
  return result.ok ? result.data : [];
}

async function loadSalesCrmDataset(tenant: TenantContext): Promise<SalesCrmDataset> {
  const [customers, quotes, sales, todayFollowups, overdueFollowups] =
    await Promise.all([
      getCrmCustomers(tenant),
      getQuotes(tenant, "todos"),
      getSales(tenant, "todos"),
      getTodayFollowups(tenant, { source: "agenda" }),
      getOverdueFollowups(tenant, { source: "agenda" }),
    ]);

  return {
    customers: dataOrEmpty(customers),
    overdueFollowups: dataOrEmpty(overdueFollowups) as unknown as JsonRecord[],
    quotes: dataOrEmpty(quotes),
    sales: dataOrEmpty(sales),
    todayFollowups: dataOrEmpty(todayFollowups) as unknown as JsonRecord[],
  };
}

function matchesQuery(record: JsonRecord, query?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  return Object.values(record).some((value) =>
    normalize(value).includes(normalizedQuery),
  );
}

function daysSince(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / 86_400_000);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function topBy<T>(items: T[], score: (item: T) => number, limit: number) {
  return [...items].sort((left, right) => score(right) - score(left)).slice(0, limit);
}

function quoteIsOpen(quote: Quote) {
  return quote.estado === "borrador" || quote.estado === "enviada";
}

function customerScore(customer: CrmCustomer) {
  const staleDays = daysSince(customer.lastActivityAt) ?? 90;
  return (
    customer.pendingFollowupsCount * 25 +
    customer.quotesCount * 12 +
    customer.salesCount * 8 +
    Math.min(staleDays, 30)
  );
}

function baseSummary(dataset: SalesCrmDataset): SalesCrmSummary {
  const openQuotes = dataset.quotes.filter(quoteIsOpen);
  const acceptedQuotes = dataset.quotes.filter((quote) => quote.estado === "aceptada");
  const confirmedSales = dataset.sales.filter((sale) => sale.estado !== "cancelada");

  return {
    acceptedQuotes: acceptedQuotes.length,
    customers: dataset.customers.length,
    openQuotes: openQuotes.length,
    openQuotesTotal: sum(openQuotes.map((quote) => quote.total)),
    overdueFollowups: dataset.overdueFollowups.length,
    sales: dataset.sales.length,
    salesTotal: sum(confirmedSales.map((sale) => sale.total)),
    todayFollowups: dataset.todayFollowups.length,
  };
}

function areaItems(
  blueprint: SalesAgentCapabilityBlueprint,
  dataset: SalesCrmDataset,
  limit: number,
  query?: string,
): JsonRecord[] {
  const customers = dataset.customers.filter((customer) =>
    matchesQuery(customer as unknown as JsonRecord, query),
  );
  const quotes = dataset.quotes.filter((quote) =>
    matchesQuery(quote as unknown as JsonRecord, query),
  );
  const sales = dataset.sales.filter((sale) =>
    matchesQuery(sale as unknown as JsonRecord, query),
  );

  switch (blueprint.areaId) {
    case "prospects":
      return topBy(
        customers.filter((customer) => customer.tipo === "prospecto"),
        customerScore,
        limit,
      ) as unknown as JsonRecord[];
    case "pipeline":
    case "quotes":
      return topBy(
        quotes.filter(quoteIsOpen),
        (quote) => quote.total,
        limit,
      ) as unknown as JsonRecord[];
    case "customers":
    case "retention":
      return topBy(customers, customerScore, limit) as unknown as JsonRecord[];
    case "pricing":
      return topBy(
        quotes.filter((quote) => quote.descuentoTotal > 0),
        (quote) => quote.descuentoTotal,
        limit,
      ) as unknown as JsonRecord[];
    case "followups":
      return [
        ...dataset.overdueFollowups,
        ...dataset.todayFollowups,
      ].slice(0, limit);
    case "conversion":
      return topBy(
        quotes.filter((quote) => quote.estado === "enviada" || quote.estado === "aceptada"),
        (quote) => quote.total,
        limit,
      ) as unknown as JsonRecord[];
    case "orders":
      return sales.slice(0, limit) as unknown as JsonRecord[];
    case "performance":
      return topBy(sales, (sale) => sale.total, limit) as unknown as JsonRecord[];
    default:
      return topBy(customers, customerScore, limit) as unknown as JsonRecord[];
  }
}

function buildRecommendations(
  blueprint: SalesAgentCapabilityBlueprint,
  dataset: SalesCrmDataset,
  items: JsonRecord[],
) {
  const recommendations: string[] = [];
  const summary = baseSummary(dataset);

  if (summary.overdueFollowups > 0) {
    recommendations.push(
      `Atender ${summary.overdueFollowups} seguimiento(s) vencido(s) antes de abrir nuevas oportunidades.`,
    );
  }

  if (summary.openQuotes > 0) {
    recommendations.push(
      `Revisar ${summary.openQuotes} cotizacion(es) abierta(s) por un total de ${summary.openQuotesTotal}.`,
    );
  }

  if (blueprint.areaId === "prospects" && items.length > 0) {
    recommendations.push("Priorizar prospectos con cotizaciones o seguimientos pendientes.");
  }

  if (blueprint.areaId === "pricing") {
    recommendations.push("Validar descuentos altos contra margen antes de confirmar ventas.");
  }

  if (blueprint.areaId === "retention") {
    recommendations.push("Crear seguimiento a clientes sin actividad reciente y ventas previas.");
  }

  if (recommendations.length === 0) {
    recommendations.push("No hay alertas criticas con los datos disponibles.");
  }

  return recommendations.slice(0, 5);
}

function buildHighlights(
  blueprint: SalesAgentCapabilityBlueprint,
  dataset: SalesCrmDataset,
  items: JsonRecord[],
) {
  const summary = baseSummary(dataset);
  const highlights = [
    `Clientes/prospectos visibles: ${summary.customers}.`,
    `Cotizaciones abiertas: ${summary.openQuotes}.`,
    `Ventas consultadas: ${summary.sales}.`,
    `Seguimientos de hoy/vencidos: ${summary.todayFollowups}/${summary.overdueFollowups}.`,
  ];

  if (items.length === 0) {
    highlights.push(`No encontre elementos especificos para ${blueprint.areaName}.`);
  } else {
    highlights.push(`Elementos priorizados para ${blueprint.areaName}: ${items.length}.`);
  }

  return highlights;
}

function messageFor(
  blueprint: SalesAgentCapabilityBlueprint,
  items: JsonRecord[],
  recommendations: string[],
) {
  if (blueprint.actionId === "prepare") {
    return `Prepare un borrador de plan para ${blueprint.areaName} con ${items.length} elemento(s) y ${recommendations.length} recomendacion(es).`;
  }

  if (blueprint.actionId === "recommend") {
    return `Recomendacion para ${blueprint.areaName}: ${recommendations[0]}`;
  }

  if (blueprint.actionId === "monitor") {
    return `Monitoreo de ${blueprint.areaName}: ${items.length} elemento(s) relevantes encontrados.`;
  }

  if (blueprint.actionId === "analyze") {
    return `Analisis de ${blueprint.areaName}: ${recommendations.length} punto(s) accionable(s).`;
  }

  return `Consulta de ${blueprint.areaName}: ${items.length} elemento(s) encontrados.`;
}

function linksFor(blueprint: SalesAgentCapabilityBlueprint): BrainResultLink[] {
  if (blueprint.areaId === "quotes" || blueprint.areaId === "pipeline") {
    return [{ href: "/cotizaciones", label: "Abrir cotizaciones" }];
  }

  if (blueprint.areaId === "orders" || blueprint.areaId === "performance") {
    return [{ href: "/ventas", label: "Abrir ventas" }];
  }

  if (blueprint.areaId === "followups") {
    return [{ href: "/agenda", label: "Abrir agenda" }];
  }

  return [{ href: "/crm/clientes", label: "Abrir CRM" }];
}

function createSalesCrmAgentSkill(
  blueprint: SalesAgentCapabilityBlueprint,
): BusinessSkillDefinition {
  return defineBusinessSkill({
    description: `${blueprint.actionName} ${blueprint.areaDescription} usando CRM, cotizaciones, ventas y seguimientos reales.`,
    enabled: true,
    id: `${blueprint.capabilityId}.skill.v1`,
    idempotency: "none",
    inputSchema: salesAgentInputSchema,
    kind: blueprint.kind,
    module: "sales",
    name: `${blueprint.actionName} ${blueprint.areaName}`,
    outputSchema: salesAgentOutputSchema,
    requiredPermissions: [
      "crm.customers.view",
      "quotes.view",
      "sales.orders.view",
    ],
    requiresConfirmation: false,
    risk: "low",
    version: "1.0.0",
    async execute(input, context) {
      const dataset = await loadSalesCrmDataset(context.tenant);
      const items = areaItems(blueprint, dataset, input.limit, input.query);
      const recommendations = buildRecommendations(blueprint, dataset, items);
      const highlights = buildHighlights(blueprint, dataset, items);

      return ok({
        data: {
          action: blueprint.actionId,
          area: blueprint.areaId,
          highlights,
          items,
          recommendations,
          summary: baseSummary(dataset),
        },
        evidence: [
          ...sourceEvidence("crm_clientes", dataset.customers.length),
          ...sourceEvidence("cotizaciones", dataset.quotes.length),
          ...sourceEvidence("ventas", dataset.sales.length),
          ...sourceEvidence(
            "agenda_followups",
            dataset.todayFollowups.length + dataset.overdueFollowups.length,
          ),
        ],
        links: linksFor(blueprint),
        message: messageFor(blueprint, items, recommendations),
      });
    },
  });
}

export function createSalesCrmAgentBusinessSkills(): BusinessSkillDefinition[] {
  const expectedCapabilityIds = new Set(agentCapabilityExpansionIds.ventas);

  return ventasAgentCapabilityBlueprints
    .filter((blueprint) => expectedCapabilityIds.has(blueprint.capabilityId))
    .map(createSalesCrmAgentSkill);
}
