import "server-only";

import { z } from "zod";

import { getAutoblogArticles, getAutoblogTopics } from "@/modules/autoblog/queries";
import { getAgentCapabilityBlueprints } from "@/modules/brain/runtime/agent-capability-expansion";
import type {
  BrainAgentId,
  BrainEvidence,
  BrainResultLink,
  BusinessSkillDefinition,
  BusinessSkillKind,
} from "@/modules/brain/runtime/contracts";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import {
  getBrainActionPlans,
  getBrainMemory,
  getBrainRecommendations,
  getBrainSignals,
  getLatestBrainDailyMetrics,
} from "@/modules/brain/queries";
import { getDispatchOrders, getAssignableUsersForDispatch } from "@/modules/dispatch/queries";
import {
  getInboxAutomationRules,
  getInboxCampaigns,
  getInboxChannels,
  getInboxConversations,
  getInboxSummary,
} from "@/modules/inbox/queries";
import { getPaymentAccounts, getPaymentsSummary, getPaymentTransactions } from "@/modules/payments/queries";
import { getAccessibleUsersForCurrentTenant, getAssignableRolesForCurrentTenant } from "@/modules/users/queries";
import type { CoreResult, JsonRecord, PermissionCode, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

type RemainingAgentId =
  | "contenido"
  | "finanzas"
  | "logistica"
  | "marketing"
  | "operaciones"
  | "rrhh"
  | "soporte";

type AgentAction = "analyze" | "monitor" | "prepare" | "query" | "recommend";

type AgentBlueprint = {
  actionDescription: string;
  actionId: AgentAction;
  actionName: string;
  areaDescription: string;
  areaId: string;
  areaName: string;
  capabilityId: string;
  kind: BusinessSkillKind;
};

type DomainDataset = {
  evidence: Array<{ count: number; source: string }>;
  records: JsonRecord[];
  summary: JsonRecord;
};

const remainingAgentIds: RemainingAgentId[] = [
  "finanzas",
  "logistica",
  "soporte",
  "operaciones",
  "marketing",
  "contenido",
  "rrhh",
];

const inputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  query: z.string().trim().optional(),
});

const outputSchema = z.object({
  action: z.string(),
  agent: z.string(),
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

function evidence(source: string, count: number): BrainEvidence[] {
  return [{ count, freshnessAt: new Date().toISOString(), source }];
}

function dataOrEmpty<T>(result: CoreResult<T[]>): T[] {
  return result.ok ? result.data : [];
}

function dataOrNull<T>(result: CoreResult<T>): T | null {
  return result.ok ? result.data : null;
}

function matches(record: JsonRecord, query?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  return Object.values(record).some((value) => normalize(value).includes(normalizedQuery));
}

function topBy<T>(items: T[], score: (item: T) => number, limit: number) {
  return [...items].sort((left, right) => score(right) - score(left)).slice(0, limit);
}

async function loadFinanzas(tenant: TenantContext): Promise<DomainDataset> {
  const [accounts, transactions, summary] = await Promise.all([
    getPaymentAccounts(tenant, "all"),
    getPaymentTransactions(tenant),
    getPaymentsSummary(tenant),
  ]);
  const accountRows = dataOrEmpty(accounts);
  const transactionRows = dataOrEmpty(transactions);
  const summaryData = dataOrNull(summary) ?? {};
  const records = [
    ...accountRows.map((account) => ({ ...account, recordType: "account" })),
    ...transactionRows.map((transaction) => ({ ...transaction, recordType: "transaction" })),
  ] as JsonRecord[];

  return {
    evidence: [
      { count: accountRows.length, source: "payments_accounts" },
      { count: transactionRows.length, source: "payments_transactions" },
    ],
    records,
    summary: summaryData as JsonRecord,
  };
}

async function loadLogistica(tenant: TenantContext): Promise<DomainDataset> {
  const [orders, users] = await Promise.all([
    getDispatchOrders(tenant, "todos"),
    getAssignableUsersForDispatch(tenant),
  ]);
  const orderRows = dataOrEmpty(orders);
  const userRows = dataOrEmpty(users);

  return {
    evidence: [
      { count: orderRows.length, source: "despachos" },
      { count: userRows.length, source: "profiles" },
    ],
    records: [
      ...orderRows.map((order) => ({ ...order, recordType: "dispatch" })),
      ...userRows.map((user) => ({ ...user, recordType: "dispatch_user" })),
    ] as JsonRecord[],
    summary: {
      assignedUsers: userRows.length,
      delivered: orderRows.filter((order) => order.estado === "entregado").length,
      inRoute: orderRows.filter((order) => order.estado === "en_ruta").length,
      pending: orderRows.filter((order) => ["pendiente", "preparando", "listo"].includes(order.estado)).length,
      total: orderRows.length,
    },
  };
}

async function loadSoporte(): Promise<DomainDataset> {
  const [summary, channels, conversations, campaigns, automations] = await Promise.all([
    getInboxSummary(),
    getInboxChannels(),
    getInboxConversations(),
    getInboxCampaigns(),
    getInboxAutomationRules(),
  ]);
  const channelRows = dataOrEmpty(channels);
  const conversationRows = dataOrEmpty(conversations);
  const campaignRows = dataOrEmpty(campaigns);
  const automationRows = dataOrEmpty(automations);

  return {
    evidence: [
      { count: channelRows.length, source: "inbox_canales" },
      { count: conversationRows.length, source: "inbox_conversaciones" },
      { count: campaignRows.length, source: "inbox_campaigns" },
      { count: automationRows.length, source: "inbox_automation_rules" },
    ],
    records: [
      ...conversationRows.map((row) => ({ ...row, recordType: "conversation" })),
      ...channelRows.map((row) => ({ ...row, recordType: "channel" })),
      ...campaignRows.map((row) => ({ ...row, recordType: "campaign" })),
      ...automationRows.map((row) => ({ ...row, recordType: "automation" })),
    ] as JsonRecord[],
    summary: dataOrNull(summary) as JsonRecord ?? {},
  };
}

async function loadOperaciones(tenant: TenantContext): Promise<DomainDataset> {
  const [metrics, signals, recommendations, plans, memory] = await Promise.all([
    getLatestBrainDailyMetrics(tenant),
    getBrainSignals(tenant),
    getBrainRecommendations(tenant),
    getBrainActionPlans(tenant),
    getBrainMemory(tenant),
  ]);
  const signalRows = dataOrEmpty(signals);
  const recommendationRows = dataOrEmpty(recommendations);
  const planRows = dataOrEmpty(plans);
  const memoryRows = dataOrEmpty(memory);

  return {
    evidence: [
      { count: signalRows.length, source: "brain_signals" },
      { count: recommendationRows.length, source: "brain_recommendations" },
      { count: planRows.length, source: "brain_action_plans" },
      { count: memoryRows.length, source: "brain_memory" },
    ],
    records: [
      ...signalRows.map((row) => ({ ...row, recordType: "signal" })),
      ...recommendationRows.map((row) => ({ ...row, recordType: "recommendation" })),
      ...planRows.map((row) => ({ ...row, recordType: "plan" })),
      ...memoryRows.map((row) => ({ ...row, recordType: "memory" })),
    ] as JsonRecord[],
    summary: {
      latestMetrics: dataOrNull(metrics),
      memory: memoryRows.length,
      plans: planRows.length,
      recommendations: recommendationRows.length,
      signals: signalRows.length,
    },
  };
}

async function loadContentMarketing(tenant: TenantContext): Promise<DomainDataset> {
  const [articles, topics] = await Promise.all([
    getAutoblogArticles(tenant, null, 100),
    getAutoblogTopics(tenant, null, 100),
  ]);
  const articleRows = dataOrEmpty(articles);
  const topicRows = dataOrEmpty(topics);

  return {
    evidence: [
      { count: articleRows.length, source: "autoblog_articles" },
      { count: topicRows.length, source: "autoblog_topics" },
    ],
    records: [
      ...articleRows.map((row) => ({ ...row, recordType: "article" })),
      ...topicRows.map((row) => ({ ...row, recordType: "topic" })),
    ] as JsonRecord[],
    summary: {
      approved: articleRows.filter((article) => article.status === "approved").length,
      drafts: articleRows.filter((article) => article.status === "draft").length,
      ready: articleRows.filter((article) => article.status === "ready_to_publish").length,
      selectedTopics: topicRows.filter((topic) => topic.status === "selected").length,
      topics: topicRows.length,
      totalArticles: articleRows.length,
    },
  };
}

async function loadRrhh(tenant: TenantContext): Promise<DomainDataset> {
  const [users, roles] = await Promise.all([
    getAccessibleUsersForCurrentTenant(tenant),
    getAssignableRolesForCurrentTenant(tenant),
  ]);
  const userRows = dataOrEmpty(users);
  const roleRows = dataOrEmpty(roles);

  return {
    evidence: [
      { count: userRows.length, source: "profiles" },
      { count: roleRows.length, source: "roles" },
    ],
    records: [
      ...userRows.map((row) => ({ ...row, recordType: "profile" })),
      ...roleRows.map((row) => ({ ...row, recordType: "role" })),
    ] as JsonRecord[],
    summary: {
      activeUsers: userRows.filter((user) => user.estado === "activo").length,
      forcedPasswordChange: userRows.filter((user) => user.requiereCambioContrasena).length,
      inactiveUsers: userRows.filter((user) => user.estado !== "activo").length,
      roles: roleRows.length,
      users: userRows.length,
    },
  };
}

async function loadDataset(agentId: RemainingAgentId, tenant: TenantContext) {
  if (agentId === "finanzas") return loadFinanzas(tenant);
  if (agentId === "logistica") return loadLogistica(tenant);
  if (agentId === "soporte") return loadSoporte();
  if (agentId === "operaciones") return loadOperaciones(tenant);
  if (agentId === "marketing" || agentId === "contenido") return loadContentMarketing(tenant);
  return loadRrhh(tenant);
}

function scoreRecord(agentId: RemainingAgentId, record: JsonRecord) {
  if (agentId === "finanzas") return Number(record.saldo ?? record.monto ?? record.total ?? 0);
  if (agentId === "logistica") return Number(record.totalVenta ?? 0) + (record.estado === "fallido" ? 100000 : 0);
  if (agentId === "soporte") return Number(record.unreadCount ?? 0) + (record.slaStatus === "vencido" ? 1000 : 0);
  if (agentId === "operaciones") return Number(record.priorityScore ?? record.confidence ?? 0);
  if (agentId === "marketing" || agentId === "contenido") return Number(record.relevanceScore ?? 0);
  return record.estado === "activo" ? 10 : 0;
}

function selectItems(
  agentId: RemainingAgentId,
  blueprint: AgentBlueprint,
  dataset: DomainDataset,
  limit: number,
  query?: string,
) {
  const filtered = dataset.records.filter((record) => matches(record, query));

  if (blueprint.actionId === "query") return filtered.slice(0, limit);
  return topBy(filtered, (record) => scoreRecord(agentId, record), limit);
}

function recommendationsFor(
  agentId: RemainingAgentId,
  blueprint: AgentBlueprint,
  dataset: DomainDataset,
  items: JsonRecord[],
) {
  const recommendations: string[] = [];
  const summary = dataset.summary;

  if (agentId === "finanzas") {
    if (Number(summary.cuentasVencidas ?? 0) > 0) recommendations.push(`Priorizar ${summary.cuentasVencidas} cuenta(s) vencida(s).`);
    if (Number(summary.saldoPorCobrar ?? 0) > 0) recommendations.push(`Revisar cartera por cobrar con saldo ${summary.saldoPorCobrar}.`);
  } else if (agentId === "logistica") {
    if (Number(summary.pending ?? 0) > 0) recommendations.push(`Coordinar ${summary.pending} despacho(s) pendiente(s).`);
    if (Number(summary.inRoute ?? 0) > 0) recommendations.push(`Monitorear ${summary.inRoute} entrega(s) en ruta.`);
  } else if (agentId === "soporte") {
    if (Number(summary.openConversations ?? 0) > 0) recommendations.push(`Atender ${summary.openConversations} conversacion(es) abierta(s).`);
    if (Number(summary.pendingConversations ?? 0) > 0) recommendations.push(`Resolver ${summary.pendingConversations} conversacion(es) pendiente(s).`);
  } else if (agentId === "operaciones") {
    if (Number(summary.signals ?? 0) > 0) recommendations.push(`Revisar ${summary.signals} senal(es) operativa(s) activa(s).`);
    if (Number(summary.plans ?? 0) > 0) recommendations.push(`Dar seguimiento a ${summary.plans} plan(es) Brain abierto(s).`);
  } else if (agentId === "marketing" || agentId === "contenido") {
    if (Number(summary.drafts ?? 0) > 0) recommendations.push(`Revisar ${summary.drafts} borrador(es) de contenido.`);
    if (Number(summary.selectedTopics ?? 0) > 0) recommendations.push(`Convertir ${summary.selectedTopics} tema(s) seleccionado(s) en contenido.`);
  } else {
    if (Number(summary.forcedPasswordChange ?? 0) > 0) recommendations.push(`Acompanhar ${summary.forcedPasswordChange} usuario(s) con cambio de contrasena pendiente.`);
    if (Number(summary.inactiveUsers ?? 0) > 0) recommendations.push(`Revisar ${summary.inactiveUsers} usuario(s) inactivo(s).`);
  }

  if (items.length === 0) recommendations.push(`No encontre elementos especificos para ${blueprint.areaName}.`);
  return recommendations.length > 0 ? recommendations.slice(0, 5) : ["No hay alertas criticas con los datos disponibles."];
}

function linksFor(agentId: RemainingAgentId): BrainResultLink[] {
  if (agentId === "finanzas") return [{ href: "/pagos", label: "Abrir pagos" }];
  if (agentId === "logistica") return [{ href: "/despacho", label: "Abrir despacho" }];
  if (agentId === "soporte") return [{ href: "/inbox", label: "Abrir Inbox" }];
  if (agentId === "operaciones") return [{ href: "/brain", label: "Abrir Brain" }];
  if (agentId === "marketing" || agentId === "contenido") return [{ href: "/autoblog", label: "Abrir Autoblog" }];
  return [{ href: "/rrhh/personal", label: "Abrir RRHH" }];
}

function permissionsFor(agentId: RemainingAgentId): PermissionCode[] {
  if (agentId === "finanzas") return ["payments.accounts.view"];
  if (agentId === "logistica") return ["dispatch.orders.view"];
  if (agentId === "soporte") return ["inbox.conversations.view"];
  if (agentId === "operaciones") return ["brain.insights.view"];
  if (agentId === "marketing" || agentId === "contenido") return ["autoblog.view"];
  return ["hr.timesheets.view"];
}

function moduleFor(agentId: RemainingAgentId) {
  if (agentId === "finanzas") return "payments";
  if (agentId === "logistica") return "dispatch";
  if (agentId === "soporte") return "whapp";
  if (agentId === "operaciones") return "brain";
  if (agentId === "marketing" || agentId === "contenido") return "autoblog";
  return "hr";
}

function messageFor(agentId: RemainingAgentId, blueprint: AgentBlueprint, count: number, recommendations: string[]) {
  const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
  if (blueprint.actionId === "recommend") return `${agentName}: recomendacion para ${blueprint.areaName}: ${recommendations[0]}`;
  if (blueprint.actionId === "prepare") return `${agentName}: prepare un borrador para ${blueprint.areaName} con ${count} elemento(s).`;
  if (blueprint.actionId === "monitor") return `${agentName}: monitoreo de ${blueprint.areaName} encontro ${count} elemento(s).`;
  if (blueprint.actionId === "analyze") return `${agentName}: analisis de ${blueprint.areaName} con ${recommendations.length} punto(s).`;
  return `${agentName}: consulta de ${blueprint.areaName} encontro ${count} elemento(s).`;
}

function createRemainingAgentSkill(
  agentId: RemainingAgentId,
  blueprint: AgentBlueprint,
): BusinessSkillDefinition {
  return defineBusinessSkill({
    description: `${blueprint.actionName} ${blueprint.areaDescription} usando datos reales del modulo.`,
    enabled: true,
    id: `${blueprint.capabilityId}.skill.v1`,
    idempotency: "none",
    inputSchema,
    kind: blueprint.kind,
    module: moduleFor(agentId),
    name: `${blueprint.actionName} ${blueprint.areaName}`,
    outputSchema,
    requiredPermissions: permissionsFor(agentId),
    requiresConfirmation: false,
    risk: "low",
    version: "1.0.0",
    async execute(input, context) {
      const dataset = await loadDataset(agentId, context.tenant);
      const items = selectItems(agentId, blueprint, dataset, input.limit, input.query);
      const recommendations = recommendationsFor(agentId, blueprint, dataset, items);
      const highlights = [
        `Fuentes revisadas: ${dataset.evidence.map((item) => `${item.source}(${item.count})`).join(", ")}.`,
        `Elementos priorizados para ${blueprint.areaName}: ${items.length}.`,
      ];

      return ok({
        data: {
          action: blueprint.actionId,
          agent: agentId,
          area: blueprint.areaId,
          highlights,
          items,
          recommendations,
          summary: dataset.summary,
        },
        evidence: dataset.evidence.flatMap((item) => evidence(item.source, item.count)),
        links: linksFor(agentId),
        message: messageFor(agentId, blueprint, items.length, recommendations),
      });
    },
  });
}

export function createRemainingAgentBusinessSkills(): BusinessSkillDefinition[] {
  return remainingAgentIds.flatMap((agentId) =>
    getAgentCapabilityBlueprints(agentId as BrainAgentId).map((blueprint) =>
      createRemainingAgentSkill(agentId, blueprint),
    ),
  );
}
