import { redirect } from "next/navigation";

import { DashboardBoardNavigation } from "@/app/(app)/dashboard/dashboard-board-navigation";
import {
  Dashboard2Experience,
  type Dashboard2Agent,
  type Dashboard2Decision,
  type Dashboard2Objective,
  type Dashboard2Payload,
  type Dashboard2Priority,
} from "@/app/(app)/dashboard/dashboard2-experience";
import { getCurrentProfile, getCurrentTenantContext } from "@/lib/auth/session";
import { listBrainAgentsForTenant } from "@/modules/brain/agent-service";
import { listBrainAutomationJobs } from "@/modules/brain/automation-service";
import { getBrainTaskMetrics } from "@/modules/brain/metrics-service";
import {
  getBrainActionPlans,
  getBrainRecommendations,
  getBrainSignals,
  getLatestBrainDailyMetrics,
} from "@/modules/brain/queries";
import { getAgendaSummary } from "@/modules/agenda/queries";
import { getCrmSummary } from "@/modules/crm/queries";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import { getInboxSummary } from "@/modules/inbox/queries";
import { getInventorySummary } from "@/modules/inventory/queries";
import { getPaymentsSummary } from "@/modules/payments/queries";
import { getPurchasesSummary } from "@/modules/purchases/queries";
import type { CoreResult, TenantContext } from "@/types/core";

export const dynamic = "force-dynamic";

type AgentBlueprint = {
  accent: string;
  href: string;
  id: Dashboard2Agent["id"];
  label: string;
  position: Dashboard2Agent["position"];
  role: string;
};

const AGENT_BLUEPRINTS: AgentBlueprint[] = [
  {
    accent: "#f8c84a",
    href: "/brain",
    id: "operaciones",
    label: "CEO AI",
    position: { x: 43, y: 48 },
    role: "Director General",
  },
  {
    accent: "#22c55e",
    href: "/ventas",
    id: "ventas",
    label: "Ventas AI",
    position: { x: 8, y: 63 },
    role: "Gestionando oportunidades",
  },
  {
    accent: "#f59e0b",
    href: "/compras",
    id: "compras",
    label: "Compras AI",
    position: { x: 20, y: 50 },
    role: "Evaluando proveedores",
  },
  {
    accent: "#f97316",
    href: "/inventario",
    id: "inventario",
    label: "Inventario AI",
    position: { x: 42, y: 72 },
    role: "Monitoreando stock",
  },
  {
    accent: "#38bdf8",
    href: "/pagos",
    id: "finanzas",
    label: "Finanzas AI",
    position: { x: 17, y: 83 },
    role: "Analizando flujo de caja",
  },
  {
    accent: "#8b5cf6",
    href: "/rrhh",
    id: "rrhh",
    label: "RRHH AI",
    position: { x: 60, y: 80 },
    role: "Revisando desempeno",
  },
  {
    accent: "#3b82f6",
    href: "/despacho",
    id: "logistica",
    label: "Logistica AI",
    position: { x: 78, y: 58 },
    role: "Optimizando entregas",
  },
  {
    accent: "#06b6d4",
    href: "/admin/automatizaciones",
    id: "contenido",
    label: "Automation AI",
    position: { x: 63, y: 48 },
    role: "Vigilando flujos",
  },
  {
    accent: "#ec4899",
    href: "/autoblog",
    id: "marketing",
    label: "Marketing AI",
    position: { x: 92, y: 63 },
    role: "Preparando campanas",
  },
  {
    accent: "#25d366",
    href: "/inbox",
    id: "soporte",
    label: "WhatsApp AI",
    position: { x: 84, y: 84 },
    role: "Atendiendo conversaciones",
  },
];

async function readResult<T>(
  promise: Promise<CoreResult<T>>,
  fallback: T,
): Promise<T> {
  try {
    const result = await promise;
    return result.ok ? result.data : fallback;
  } catch {
    return fallback;
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function statusFor(value: number, completeWhenZero = false) {
  if (completeWhenZero && value === 0) return "done" as const;
  if (value > 0) return "active" as const;
  return "waiting" as const;
}

function buildAgentDetail(
  agentId: Dashboard2Agent["id"],
  data: Awaited<ReturnType<typeof loadDashboard2Data>>,
) {
  if (agentId === "ventas") {
    return data.dailyMetrics
      ? `${data.dailyMetrics.sales30dCount} ventas en 30 dias`
      : `${data.crm.totalCustomers} clientes en CRM`;
  }

  if (agentId === "compras") {
    return `${data.purchases.ordenesEmitidas + data.purchases.ordenesParciales} orden(es) abiertas`;
  }

  if (agentId === "inventario") {
    return `${data.inventory.productosBajoStock} producto(s) bajos`;
  }

  if (agentId === "finanzas") {
    return `${formatCurrency(data.payments.saldoPorCobrar)} por cobrar`;
  }

  if (agentId === "logistica") {
    return `${data.dispatchPending} despacho(s) pendientes`;
  }

  if (agentId === "soporte") {
    return `${data.inbox.openConversations} conversacion(es) abiertas`;
  }

  if (agentId === "contenido" || agentId === "marketing") {
    return `${data.jobsAvailable} job(s) listo(s)`;
  }

  if (agentId === "rrhh") {
    return `${data.agendaToday + data.agendaOverdue} seguimiento(s) activos`;
  }

  return `${data.signals.length + data.recommendations.length} prioridad(es) detectadas`;
}

async function loadDashboard2Data(tenant: TenantContext) {
  const [
    dailyMetrics,
    signals,
    recommendations,
    actionPlans,
    taskMetrics,
    crm,
    inventory,
    payments,
    purchases,
    agenda,
    inbox,
    dispatchOrders,
  ] = await Promise.all([
    readResult(getLatestBrainDailyMetrics(tenant), null),
    readResult(getBrainSignals(tenant), []),
    readResult(getBrainRecommendations(tenant), []),
    readResult(getBrainActionPlans(tenant), []),
    readResult(getBrainTaskMetrics(tenant), null),
    readResult(getCrmSummary(tenant), { pendingFollowups: 0, totalCustomers: 0 }),
    readResult(getInventorySummary(tenant), {
      bodegasActivas: 0,
      movimientosRecientes: 0,
      productosBajoStock: 0,
      productosConStock: 0,
    }),
    readResult(getPaymentsSummary(tenant), {
      cuentasPorCobrarPendientes: 0,
      cuentasPorPagarPendientes: 0,
      cuentasVencidas: 0,
      saldoPorCobrar: 0,
      saldoPorPagar: 0,
      totalCobrado: 0,
      totalPagado: 0,
    }),
    readResult(getPurchasesSummary(tenant), {
      ordenesBorrador: 0,
      ordenesEmitidas: 0,
      ordenesParciales: 0,
      ordenesRecibidas: 0,
      proveedoresActivos: 0,
      totalComprado: 0,
      totalPendienteRecepcion: 0,
    }),
    readResult(getAgendaSummary(tenant, { tolerateErrors: true }), {
      completadosRecientes: [],
      hoy: [],
      proximos: [],
      vencidos: [],
    }),
    readResult(getInboxSummary(), {
      activeChannels: 0,
      openConversations: 0,
      pendingConversations: 0,
      recentlyClosedConversations: 0,
    }),
    readResult(getDispatchOrders(tenant, "todos"), []),
  ]);
  const agents = listBrainAgentsForTenant(tenant);
  const jobs = listBrainAutomationJobs(tenant);
  const dispatchPending = dispatchOrders.filter((order) =>
    ["pendiente", "preparacion", "ruta"].includes(order.estado),
  ).length;

  return {
    actionPlans,
    agendaOverdue: agenda.vencidos.length,
    agendaToday: agenda.hoy.length,
    agents,
    crm,
    dailyMetrics,
    dispatchPending,
    inbox,
    inventory,
    jobs,
    jobsAvailable: jobs.filter((job) => job.available).length,
    payments,
    purchases,
    recommendations,
    signals,
    taskMetrics,
  };
}

function buildObjectives(data: Awaited<ReturnType<typeof loadDashboard2Data>>): Dashboard2Objective[] {
  const openQuotes = data.dailyMetrics?.quotesOpenCount ?? 0;
  const expiredQuotes = data.dailyMetrics?.quotesExpiredCount ?? 0;

  return [
    {
      label: "Revisar ventas del dia",
      status: data.taskMetrics && data.taskMetrics.taskCompleted > 0 ? "done" : "active",
      value: data.dailyMetrics
        ? `${data.dailyMetrics.sales30dCount} ventas recientes`
        : "Sin snapshot aun",
    },
    {
      label: "Analizar oportunidades",
      status: statusFor(data.signals.length),
      value: `${data.signals.length} senal(es) activas`,
    },
    {
      label: "Aprobar cotizaciones",
      status: statusFor(expiredQuotes + openQuotes),
      value: `${openQuotes} abierta(s), ${expiredQuotes} vencida(s)`,
    },
    {
      label: "Revisar flujo de caja",
      status: statusFor(data.payments.cuentasVencidas, true),
      value: `${data.payments.cuentasVencidas} cuenta(s) vencidas`,
    },
    {
      label: "Coordinar seguimiento",
      status: statusFor(data.agendaOverdue + data.agendaToday, true),
      value: `${data.agendaOverdue} vencido(s), ${data.agendaToday} hoy`,
    },
  ];
}

function buildDecisions(data: Awaited<ReturnType<typeof loadDashboard2Data>>): Dashboard2Decision[] {
  const planDecisions = data.actionPlans
    .filter((plan) => plan.status === "pending_approval")
    .slice(0, 3)
    .map((plan) => ({
      detail: plan.expectedImpact ?? "Pendiente de aprobacion",
      href: "/brain",
      label: plan.title,
      tone: plan.riskLevel === "critical" || plan.riskLevel === "high"
        ? "danger" as const
        : "info" as const,
    }));

  if (planDecisions.length > 0) return planDecisions;

  const recommendationDecisions = data.recommendations
    .filter((recommendation) => recommendation.approvalRequired)
    .slice(0, 3)
    .map((recommendation) => ({
      detail: recommendation.expectedImpact ?? "Requiere decision",
      href: "/brain",
      label: recommendation.title,
      tone: recommendation.riskLevel === "critical" || recommendation.riskLevel === "high"
        ? "danger" as const
        : "info" as const,
    }));

  if (recommendationDecisions.length > 0) return recommendationDecisions;

  return [
    {
      detail: "Brain no encontro aprobaciones urgentes.",
      href: "/brain",
      label: "Sin decisiones pendientes",
      tone: "success",
    },
  ];
}

function buildPriorities(data: Awaited<ReturnType<typeof loadDashboard2Data>>): Dashboard2Priority[] {
  const signalPriorities = data.signals.slice(0, 4).map((signal) => ({
    href: "/brain",
    label: signal.title,
    source: signal.moduleCode,
    tone: signal.severity,
  }));

  if (signalPriorities.length >= 3) return signalPriorities;

  const fallbackPriorities: Dashboard2Priority[] = [
    {
      href: "/inventario",
      label: `${data.inventory.productosBajoStock} producto(s) con stock bajo`,
      source: "Inventario",
      tone: data.inventory.productosBajoStock > 0 ? "high" : "low",
    },
    {
      href: "/pagos",
      label: `${data.payments.cuentasVencidas} cobro(s) vencidos`,
      source: "Finanzas",
      tone: data.payments.cuentasVencidas > 0 ? "high" : "low",
    },
    {
      href: "/despacho",
      label: `${data.dispatchPending} entrega(s) pendientes`,
      source: "Logistica",
      tone: data.dispatchPending > 0 ? "medium" : "low",
    },
  ];

  return [...signalPriorities, ...fallbackPriorities].slice(0, 4);
}

export default async function DireccionDashboardPage() {
  const [profileResult, tenantResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentTenantContext(),
  ]);

  if (!profileResult.ok || !tenantResult.ok) {
    redirect("/login");
  }

  if (!profileResult.data || !tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const dashboardData = await loadDashboard2Data(tenant);
  const runtimeAgents = new Map(
    dashboardData.agents.map((agent) => [agent.id, agent]),
  );
  const agents: Dashboard2Agent[] = AGENT_BLUEPRINTS.map((blueprint) => {
    const runtimeAgent = runtimeAgents.get(blueprint.id);

    return {
      ...blueprint,
      active: Boolean(runtimeAgent?.available),
      capabilities: runtimeAgent?.capabilityCount ?? 0,
      detail: buildAgentDetail(blueprint.id, dashboardData),
      executable: runtimeAgent?.executableCapabilityCount ?? 0,
      planned: runtimeAgent?.plannedCapabilityCount ?? 0,
      reason: runtimeAgent?.reason ?? null,
    };
  });
  const payload: Dashboard2Payload = {
    agents,
    companyName: "Biz.OS",
    decisions: buildDecisions(dashboardData),
    generatedAt: new Date().toISOString(),
    jobs: {
      available: dashboardData.jobsAvailable,
      total: dashboardData.jobs.length,
    },
    objectives: buildObjectives(dashboardData),
    priorities: buildPriorities(dashboardData),
    runtime: {
      automationEvents: dashboardData.taskMetrics?.sourceTotals.automation ?? 0,
      completedTasks: dashboardData.taskMetrics?.taskCompleted ?? 0,
      failedTasks: dashboardData.taskMetrics?.taskFailed ?? 0,
      pendingApproval: dashboardData.taskMetrics?.taskPendingApproval ?? 0,
      totalCapabilities: agents.reduce((sum, agent) => sum + agent.capabilities, 0),
      totalExecutable: agents.reduce((sum, agent) => sum + agent.executable, 0),
    },
    summary: {
      agendaToday: dashboardData.agendaToday,
      dispatchPending: dashboardData.dispatchPending,
      inventoryLowStock: dashboardData.inventory.productosBajoStock,
      overdueCollections: dashboardData.payments.cuentasVencidas,
      openConversations: dashboardData.inbox.openConversations,
      sales30dTotal: dashboardData.dailyMetrics?.sales30dTotal ?? 0,
    },
    userName: profileResult.data.nombre ?? "Equipo",
  };

  return (
    <>
      <DashboardBoardNavigation />
      <Dashboard2Experience data={payload} />
    </>
  );
}
