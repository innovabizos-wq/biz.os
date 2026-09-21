import {
  Activity,
  Bot,
  Brain,
  ClipboardCheck,
  Cpu,
  Gauge,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  approveBrainRecommendationAction,
  executeBrainActionPlanAction,
  runBrainAnalysisAction,
} from "@/modules/brain/actions";
import { listBrainAgentsForTenant } from "@/modules/brain/agent-service";
import { getBrainCoreConfiguration } from "@/modules/brain/core";
import { getBrainTaskMetrics } from "@/modules/brain/metrics-service";
import { listBrainAutomationJobs } from "@/modules/brain/automation-service";
import { BrainChat } from "@/modules/brain/components/brain-chat";
import { businessSkillRegistry } from "@/modules/brain/runtime";
import {
  canManageBrain,
  getBrainActionPlans,
  getBrainInsights,
  getBrainMemory,
  getBrainRecommendations,
  getBrainSignals,
  getLatestBrainDailyMetrics,
} from "@/modules/brain/queries";
import type {
  BrainActionPlan,
  BrainDailyMetrics,
  BrainInsightSeverity,
  BrainRecommendationRisk,
  BrainSignal,
} from "@/modules/brain/types";

type BrainPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin snapshot";

  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function severityLabel(severity: BrainInsightSeverity | BrainRecommendationRisk) {
  const labels = {
    critical: "Critico",
    high: "Alto",
    low: "Bajo",
    medium: "Medio",
  } as const;

  return labels[severity];
}

function MetricGrid({ metrics }: { metrics: BrainDailyMetrics | null }) {
  const items = metrics
    ? [
        ["Clientes CRM", metrics.crmCustomersCount.toLocaleString("es-CR")],
        ["Prospectos", metrics.crmProspectsCount.toLocaleString("es-CR")],
        ["Seguimientos vencidos", metrics.followupsOverdueCount.toLocaleString("es-CR")],
        ["Cotizaciones abiertas", metrics.quotesOpenCount.toLocaleString("es-CR")],
        ["Ventas 30 dias", formatCurrency(metrics.sales30dTotal)],
        ["Productos bajo minimo", metrics.inventoryLowStockCount.toLocaleString("es-CR")],
        ["CxC vencidas", metrics.paymentsOverdueCount.toLocaleString("es-CR")],
        ["Whapp abiertas", metrics.whappOpenConversationsCount.toLocaleString("es-CR")],
      ]
    : [
        ["Clientes CRM", "0"],
        ["Prospectos", "0"],
        ["Seguimientos vencidos", "0"],
        ["Cotizaciones abiertas", "0"],
      ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div className="rounded-lg border bg-background p-5 shadow-sm" key={label}>
          <p className="text-sm text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-2xl">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function SignalsPanel({ signals }: { signals: BrainSignal[] }) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex items-center gap-2">
        <Activity aria-hidden="true" size={20} />
        <h2 className="text-base font-semibold">Senales por modulo</h2>
      </div>

      <div className="mt-4 grid gap-3">
        {signals.length === 0 ? (
          <EmptyState
            description="Ejecuta Analizar negocio para refrescar senales transversales."
            title="Sin senales activas"
          />
        ) : (
          signals.slice(0, 8).map((signal) => (
            <article className="rounded-md border p-4" key={signal.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{signal.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {signal.description}
                  </p>
                </div>
                <span className="rounded-md border px-2 py-1 text-xs font-medium">
                  {signal.moduleCode}
                </span>
              </div>
              <p className="mt-3 text-xs uppercase text-muted-foreground">
                Severidad: {severityLabel(signal.severity)}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function RuntimePanel({
  agents,
  jobs,
  taskMetrics,
}: {
  agents: ReturnType<typeof listBrainAgentsForTenant>;
  jobs: ReturnType<typeof listBrainAutomationJobs>;
  taskMetrics: Awaited<ReturnType<typeof getBrainTaskMetrics>>["data"] | null;
}) {
  const availableAgents = agents.filter((agent) => agent.available).length;
  const executableCapabilities = agents.reduce(
    (total, agent) => total + agent.executableCapabilityCount,
    0,
  );
  const activeJobs = jobs.filter((job) => job.available).length;
  const cards = [
    ["Tareas completadas", taskMetrics?.taskCompleted.toLocaleString("es-CR") ?? "0"],
    ["Fallidas", taskMetrics?.taskFailed.toLocaleString("es-CR") ?? "0"],
    ["Pendientes de aprobacion", taskMetrics?.pendingApproval.toLocaleString("es-CR") ?? "0"],
    ["Eventos auditados", taskMetrics?.totalEvents.toLocaleString("es-CR") ?? "0"],
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-lg border bg-background p-5 xl:col-span-2">
        <div className="flex items-center gap-2">
          <Bot aria-hidden="true" size={20} />
          <h2 className="text-base font-semibold">Agentes especializados</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {availableAgents} de {agents.length} agentes disponibles con{" "}
          {executableCapabilities} capabilities ejecutables para esta empresa.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {agents.map((agent) => (
            <article className="rounded-md border p-3" key={agent.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{agent.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {agent.executableCapabilityCount}/{agent.capabilityCount} capabilities listas
                  </p>
                </div>
                <span className="rounded-md border px-2 py-1 text-xs">
                  {agent.available ? "Activo" : "Limitado"}
                </span>
              </div>
              {agent.reason ? (
                <p className="mt-2 text-xs text-muted-foreground">{agent.reason}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-lg border bg-background p-5">
          <div className="flex items-center gap-2">
            <Timer aria-hidden="true" size={20} />
            <h2 className="text-base font-semibold">Automatizaciones</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeJobs} de {jobs.length} jobs automaticos disponibles.
          </p>
          <div className="mt-4 grid gap-2">
            {jobs.map((job) => (
              <div className="rounded-md border p-3" key={job.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{job.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {job.available ? job.schedule : "No disponible"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-background p-5">
          <div className="flex items-center gap-2">
            <Gauge aria-hidden="true" size={20} />
            <h2 className="text-base font-semibold">Exito por tareas</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {cards.map(([label, value]) => (
              <div className="rounded-md border p-3" key={label}>
                <p className="text-xs uppercase text-muted-foreground">{label}</p>
                <strong className="mt-1 block text-sm">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlansPanel({
  canAnalyze,
  plans,
}: {
  canAnalyze: boolean;
  plans: BrainActionPlan[];
}) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck aria-hidden="true" size={20} />
        <h2 className="text-base font-semibold">Planes accionables</h2>
      </div>

      <div className="mt-4 grid gap-3">
        {plans.length === 0 ? (
          <EmptyState
            description="Al aprobar una recomendacion, Brain crea un plan conectado al Action Registry."
            title="Sin planes pendientes"
          />
        ) : (
          plans.map((plan) => (
            <article className="rounded-md border p-4" key={plan.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{plan.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>
                <span className="rounded-md border px-2 py-1 text-xs font-medium">
                  {plan.status}
                </span>
              </div>
              <p className="mt-3 text-xs uppercase text-muted-foreground">
                Pasos: {plan.steps.length} · Riesgo {severityLabel(plan.riskLevel)}
              </p>
              {canAnalyze && plan.status === "approved" ? (
                <form action={executeBrainActionPlanAction} className="mt-4">
                  <input name="id" type="hidden" value={plan.id} />
                  <PendingSubmitButton pendingLabel="Ejecutando" size="sm">
                    Ejecutar plan
                  </PendingSubmitButton>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

export default async function BrainPage({ searchParams }: BrainPageProps) {
  const [params, tenantResult] = await Promise.all([
    searchParams,
    getCurrentTenantContext(),
  ]);

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const [
    metricsResult,
    insightsResult,
    recommendationsResult,
    signalsResult,
    actionPlansResult,
    memoryResult,
    coreConfigurationResult,
    taskMetricsResult,
  ] = await Promise.all([
    getLatestBrainDailyMetrics(tenant),
    getBrainInsights(tenant),
    getBrainRecommendations(tenant),
    getBrainSignals(tenant),
    getBrainActionPlans(tenant),
    getBrainMemory(tenant),
    getBrainCoreConfiguration(tenant),
    getBrainTaskMetrics(tenant),
  ]);

  if (!metricsResult.ok) {
    return (
      <section className="space-y-6">
        <PageHeader
          description={metricsResult.error.message}
          eyebrow="Inteligencia"
          title="Business Brain"
        />
      </section>
    );
  }

  const metrics = metricsResult.data;
  const insights = insightsResult.ok ? insightsResult.data : [];
  const recommendations = recommendationsResult.ok ? recommendationsResult.data : [];
  const signals = signalsResult.ok ? signalsResult.data : [];
  const actionPlans = actionPlansResult.ok ? actionPlansResult.data : [];
  const memories = memoryResult.ok ? memoryResult.data : [];
  const coreConfiguration = coreConfigurationResult.ok ? coreConfigurationResult.data : null;
  const taskMetrics = taskMetricsResult.ok ? taskMetricsResult.data : null;
  const canAnalyze = canManageBrain(tenant);
  const registeredSkillsCount = businessSkillRegistry.list().length;
  const runtimeAgents = listBrainAgentsForTenant(tenant);
  const automationJobs = listBrainAutomationJobs(tenant);
  const healthItems = [
    ["Senales activas", signals.length.toLocaleString("es-CR")],
    ["Insights activos", insights.length.toLocaleString("es-CR")],
    ["Recomendaciones", recommendations.length.toLocaleString("es-CR")],
    ["Planes pendientes", actionPlans.filter((plan) => plan.status !== "completed").length.toLocaleString("es-CR")],
    ["Memoria Brain", memories.length.toLocaleString("es-CR")],
    ["Contexto", metrics?.businessContextReady ? "Listo" : "Pendiente"],
  ];

  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          canAnalyze ? (
            <form action={runBrainAnalysisAction}>
              <input name="intent" type="hidden" value="analyze-business" />
              <PendingSubmitButton pendingLabel="Analizando">
                Analizar negocio
              </PendingSubmitButton>
            </form>
          ) : null
        }
        description="Brain lee datos reales, detecta senales, recomienda acciones y crea planes aprobables conectados a la barra IA."
        eyebrow="Inteligencia transversal"
        title="Business Brain"
      />

      {params?.error || params?.success ? (
        <EphemeralPageAlert error={params.error} success={params.success} />
      ) : null}

      <BrainChat variant="page" />

      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Ultimo snapshot</h2>
            <p className="text-sm text-muted-foreground">
              {metrics
                ? `Generado el ${formatDate(metrics.createdAt)}`
                : "Ejecuta el primer analisis para crear metricas base."}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Brain aria-hidden="true" size={18} />
            {metrics?.businessContextReady ? "Contexto listo" : "Contexto pendiente"}
          </div>
        </div>
        <div className="mt-5">
          <MetricGrid metrics={metrics} />
        </div>
      </div>

      <div className="rounded-lg border bg-background p-5">
        <div className="flex items-center gap-2">
          <Cpu aria-hidden="true" size={20} />
          <h2 className="text-base font-semibold">AI Core</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Proveedor activo</p>
            <strong className="mt-1 block text-sm">
              {coreConfiguration?.activeProvider ?? "No configurado"}
            </strong>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Modelo</p>
            <strong className="mt-1 block break-words text-sm">
              {coreConfiguration?.model ?? "No configurado"}
            </strong>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Credenciales</p>
            <strong className="mt-1 block text-sm">
              {coreConfiguration?.hasApiKey ? "Configuradas" : "Pendientes"}
            </strong>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase text-muted-foreground">Business Skills</p>
            <strong className="mt-1 block text-sm">
              {registeredSkillsCount.toLocaleString("es-CR")} capacidades registradas
            </strong>
          </div>
        </div>
      </div>

      <RuntimePanel
        agents={runtimeAgents}
        jobs={automationJobs}
        taskMetrics={taskMetrics}
      />

      <div className="rounded-lg border bg-background p-5">
        <div className="flex items-center gap-2">
          <ListChecks aria-hidden="true" size={20} />
          <h2 className="text-base font-semibold">Salud del Brain</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {healthItems.map(([label, value]) => (
            <div className="rounded-md border p-3" key={label}>
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              <strong className="mt-1 block text-sm">{value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SignalsPanel signals={signals} />

        <div className="rounded-lg border bg-background p-5">
          <div className="flex items-center gap-2">
            <Lightbulb aria-hidden="true" size={20} />
            <h2 className="text-base font-semibold">Insights activos</h2>
          </div>

          <div className="mt-4 grid gap-3">
            {insights.length === 0 ? (
              <EmptyState
                description="Ejecuta Analizar negocio para generar insights basicos con reglas deterministicas."
                title="Sin insights activos"
              />
            ) : (
              insights.map((insight) => (
                <article className="rounded-md border p-4" key={insight.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{insight.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {insight.description}
                      </p>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">
                      {severityLabel(insight.severity)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase text-muted-foreground">
                    Fuente: {insight.source}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert aria-hidden="true" size={20} />
            <h2 className="text-base font-semibold">Recomendaciones</h2>
          </div>

          <div className="mt-4 grid gap-3">
            {recommendations.length === 0 ? (
              <EmptyState
                description="Las recomendaciones se crean desde insights activos y quedan pendientes para revision humana."
                title="Sin recomendaciones pendientes"
              />
            ) : (
              recommendations.map((recommendation) => (
                <article className="rounded-md border p-4" key={recommendation.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{recommendation.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {recommendation.description}
                      </p>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-xs font-medium">
                      Riesgo {severityLabel(recommendation.riskLevel)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase text-muted-foreground">
                    Estado: {recommendation.status} · Accion:{" "}
                    {recommendation.actionId ?? "sin accion"}
                  </p>
                  {recommendation.expectedImpact ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Impacto esperado: {recommendation.expectedImpact}
                    </p>
                  ) : null}
                  {canAnalyze && recommendation.status === "pending" ? (
                    <form action={approveBrainRecommendationAction} className="mt-4">
                      <input name="id" type="hidden" value={recommendation.id} />
                      <PendingSubmitButton pendingLabel="Aprobando" size="sm">
                        Aprobar y crear plan
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>

        <PlansPanel canAnalyze={canAnalyze} plans={actionPlans} />
      </div>

      <div className="rounded-lg border bg-background p-5">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" size={20} />
          <h2 className="text-base font-semibold">Alcance de esta version</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          La barra IA interpreta la entrada del usuario. Business Brain razona sobre
          datos reales y propone acciones. El Execution Bridge ejecuta solo acciones
          registradas, con permisos, auditoria y confirmacion cuando corresponde.
        </p>
      </div>
    </section>
  );
}
