import "server-only";

import { isStepCount, tool, ToolLoopAgent, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getBusinessContext } from "@/modules/business-context/queries";
import {
  appendBrainRunEvent,
  recordBrainRunStep,
} from "@/modules/brain/runtime/conversation-repository";
import type {
  BusinessSkillDefinition,
  BusinessSkillRisk,
} from "@/modules/brain/runtime/contracts";
import { businessSkillRegistry } from "@/modules/brain/runtime/default-runtime";
import { executeBusinessSkillDurably } from "@/modules/brain/runtime/durable-skill-workflow";
import { requiresBrainApproval } from "@/modules/brain/runtime/policy-engine";
import { rankBusinessSkills, toSafeToolName } from "@/modules/brain/runtime/skill-search";
import { brainRuntime } from "@/modules/brain/runtime/default-runtime";
import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";
import type { JsonRecord, ModuleCode, TenantContext } from "@/types/core";

const NAVIGATION_ROUTES: Array<{
  href: string;
  keywords: string[];
  label: string;
  module?: ModuleCode;
}> = [
  { href: "/dashboard", keywords: ["inicio", "dashboard", "panel"], label: "Dashboard" },
  { href: "/crm/clientes", keywords: ["crm", "cliente", "clientes", "prospectos"], label: "Clientes", module: "crm" },
  { href: "/catalogo/productos", keywords: ["catalogo", "producto", "productos", "servicios"], label: "Productos", module: "catalog" },
  { href: "/cotizaciones", keywords: ["cotizacion", "cotizaciones", "presupuestos"], label: "Cotizaciones", module: "quotes" },
  { href: "/ventas", keywords: ["venta", "ventas", "pedidos"], label: "Ventas", module: "sales" },
  { href: "/inventario", keywords: ["inventario", "stock", "bodegas"], label: "Inventario", module: "inventory" },
  { href: "/compras", keywords: ["compra", "compras", "proveedores"], label: "Compras", module: "purchases" },
  { href: "/pagos", keywords: ["pagos", "cobros", "cuentas"], label: "Pagos y cobros", module: "payments" },
  { href: "/facturacion", keywords: ["factura", "facturacion", "fiscal"], label: "Facturación", module: "billing" },
  { href: "/despacho", keywords: ["despacho", "despachos", "entregas"], label: "Despachos", module: "dispatch" },
  { href: "/agenda", keywords: ["agenda", "tareas", "seguimientos"], label: "Agenda", module: "agenda" },
  { href: "/inbox", keywords: ["inbox", "whatsapp", "mensajes", "chats"], label: "Inbox", module: "whapp" },
  { href: "/autoblog", keywords: ["autoblog", "blog", "contenido"], label: "Autoblog", module: "autoblog" },
  { href: "/facturacion/reportes", keywords: ["reporte", "reportes", "informes"], label: "Reportes", module: "reports" },
  { href: "/brain", keywords: ["brain", "inteligencia", "asistente"], label: "Brain", module: "brain" },
];

function isDurableSkill(skill: BusinessSkillDefinition) {
  return skill.kind !== "query" || skill.idempotency === "required" || skill.risk !== "low";
}

function shouldRequireApproval(skill: BusinessSkillDefinition) {
  return requiresBrainApproval(skill);
}

async function createCompanyContext(tenant: TenantContext) {
  const supabase = await createClient();
  const result = await supabase
    .from("empresas")
    .select("nombre, nombre_comercial, identificacion_fiscal, correo, telefono")
    .eq("id", tenant.empresaId)
    .maybeSingle<{
      correo: string | null;
      identificacion_fiscal: string | null;
      nombre: string;
      nombre_comercial: string | null;
      telefono: string | null;
    }>();
  if (result.error || !result.data) return { id: tenant.empresaId };
  return {
    email: result.data.correo,
    fiscalId: result.data.identificacion_fiscal,
    id: tenant.empresaId,
    legalName: result.data.nombre,
    phone: result.data.telefono,
    tradingName: result.data.nombre_comercial,
  };
}

async function buildBusinessInstructions(tenant: TenantContext) {
  const [context, companyResult] = await Promise.all([
    getBusinessContext(tenant),
    createCompanyContext(tenant),
  ]);
  const value = context.ok ? context.data : null;
  return JSON.stringify({
    company: companyResult,
    declaredContext: value ? {
      aiInstructions: value.aiInstructions,
      brandPersonality: value.brandPersonality,
      businessHours: value.businessHours,
      businessSummary: value.businessSummary,
      customerServiceRules: value.customerServiceRules,
      forbiddenTopics: value.forbiddenTopics,
      mainOffers: value.mainOffers,
      operationalRules: value.operationalRules,
      productsServices: value.productsServices,
      salesRules: value.salesRules,
      toneOfVoice: value.toneOfVoice,
    } : "No disponible para el rol actual.",
  }).slice(0, 8_000);
}

function instructions(input: {
  businessContext: string;
  currentModule?: string | null;
  currentPath?: string | null;
  entity?: { id?: string; label?: string; type: string };
  profileName?: string;
  selection?: string;
  timezone?: string;
}) {
  return `Eres Brain, la inteligencia operativa central de Biz.OS. Hablas español natural, claro y directo.

Tu trabajo es comprender la intención del usuario aunque no use nombres técnicos y controlar el sistema mediante las herramientas disponibles.

REGLAS OBLIGATORIAS:
- Para datos del negocio, cifras, estados o entidades, usa herramientas; nunca inventes información que Biz.OS pueda consultar.
- Puedes encadenar varias herramientas en una misma petición y sintetizar sus resultados.
- Si falta un dato imprescindible, pregunta solo por ese dato en lenguaje natural.
- No menciones IDs de Skills, nombres internos de tools, schemas ni detalles del runtime.
- Las herramientas sensibles pedirán aprobación. Explica en una frase qué ocurrirá y espera la decisión.
- No afirmes que una acción se completó hasta recibir el resultado de la herramienta.
- Si el usuario pide abrir o ir a una pantalla, usa la herramienta de navegación.
- Conserva el contexto de mensajes anteriores y resuelve referencias como “ese cliente”, “la anterior” o “hazlo”.
- Presenta cifras concretas, evidencia y enlaces devueltos por las herramientas.
- Si ninguna herramienta cubre el pedido, dilo con precisión y explica qué capacidad falta; no sustituyas la respuesta con señales genéricas.
- Si el trabajo requiere varias especialidades, usa un equipo de agentes. Si requiere juicio, validación o trabajo fuera del sistema, asigna una tarea humana.
- Cuando necesites una habilidad que no aparezca inicialmente, busca capacidades autorizadas antes de concluir que no existe.

Usuario: ${input.profileName ?? "usuario autenticado"}.
Pantalla actual: ${input.currentPath ?? "desconocida"}.
Módulo actual: ${input.currentModule ?? "desconocido"}.
Entidad enfocada: ${input.entity ? JSON.stringify(input.entity) : "ninguna"}.
Selección actual: ${input.selection?.slice(0, 2_000) || "ninguna"}.
Zona horaria: ${input.timezone ?? "desconocida"}.
Contexto autorizado del negocio: ${input.businessContext}`;
}

function makeNavigationTool(tenant: TenantContext) {
  const routes = NAVIGATION_ROUTES.filter(
    (route) => !route.module || tenant.activeModules.includes(route.module),
  );
  return tool({
    description: `Abre una pantalla de Biz.OS. Rutas disponibles: ${routes
      .map((route) => `${route.label} (${route.keywords.join(", ")})`)
      .join("; ")}.`,
    inputSchema: z.object({
      destination: z.string().describe("Pantalla o módulo que el usuario quiere abrir"),
    }),
    execute: async ({ destination }) => {
      const normalized = destination
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const route = routes.find((candidate) =>
        candidate.keywords.some((keyword) => normalized.includes(keyword)),
      );
      if (!route) {
        return {
          available: routes.map((candidate) => candidate.label),
          message: "No encontré una pantalla autorizada con ese nombre.",
        };
      }
      return {
        links: [{ href: route.href, label: `Abrir ${route.label}` }],
        message: `Abriendo ${route.label}.`,
        navigateTo: route.href,
      };
    },
  });
}

export async function createCentralBrainAgent(input: {
  conversationId: string;
  currentModule?: string | null;
  currentPath?: string | null;
  entity?: { id?: string; label?: string; type: string };
  historicalToolNames?: string[];
  message: string;
  model: LanguageModel;
  runId: string;
  selection?: string;
  settings: ConversationLayerSettingsForProvider;
  tenant: TenantContext;
  timezone?: string;
}) {
  const available = businessSkillRegistry.getAvailable(input.tenant);
  const selected = rankBusinessSkills({
    currentModule: input.currentModule,
    limit: 20,
    message: input.message,
    skills: available,
  });
  const historicalToolNames = new Set(input.historicalToolNames ?? []);
  for (const skill of available) {
    if (
      historicalToolNames.has(toSafeToolName(skill.id)) &&
      !selected.some((candidate) => candidate.id === skill.id)
    ) {
      selected.push(skill);
    }
  }
  const tools: ToolSet = {};
  const riskByTool: Record<string, BusinessSkillRisk> = {};
  const approvalByTool: Record<string, "approved" | "user-approval"> = {};

  for (const skill of selected) {
    const toolName = toSafeToolName(skill.id);
    riskByTool[toolName] = skill.risk;
    approvalByTool[toolName] = shouldRequireApproval(skill) ? "user-approval" : "approved";
    tools[toolName] = tool({
      description: `${skill.name}. ${skill.description} Módulo: ${skill.module}. Riesgo: ${skill.risk}.`,
      inputSchema: skill.inputSchema,
      execute: async (toolInput, { toolCallId }) => {
        const stepId = toolCallId || `${input.runId}:${toolName}`;
        await recordBrainRunStep({
          runId: input.runId,
          status: "running",
          stepId,
          tenant: input.tenant,
          toolName,
        });
        const invocation = {
          approval: shouldRequireApproval(skill)
            ? { confirmed: true, reference: stepId }
            : undefined,
          idempotencyKey:
            skill.idempotency === "required" ? `${input.runId}:${stepId}` : undefined,
          input: toolInput as JsonRecord,
          skillId: skill.id,
          source: {
            audience: "internal" as const,
            channel: "brain" as const,
            correlationId: input.runId,
            entity: input.entity,
            module: skill.module,
            selection: input.selection,
            surface: input.currentPath ?? "brain_chat",
            timezone: input.timezone,
          },
          tenant: input.tenant,
        };
        const execution = isDurableSkill(skill)
          ? await executeBusinessSkillDurably(invocation)
          : { result: await brainRuntime.invoke(invocation), workflowRunId: null };
        const result = execution.result;
        await recordBrainRunStep({
          error: result.ok ? undefined : result.error,
          output: result.ok ? result.data : undefined,
          runId: input.runId,
          status: result.ok ? "completed" : "failed",
          stepId,
          tenant: input.tenant,
          toolName,
        });
        await appendBrainRunEvent(
          input.tenant,
          input.runId,
          result.ok ? "tool.completed" : "tool.failed",
          {
            skillId: skill.id,
            toolCallId: stepId,
            workflowRunId: execution.workflowRunId,
          },
        );
        return result.ok
          ? {
              data: result.data.data,
              evidence: result.data.evidence,
              links: result.data.links,
              message: result.data.message,
              ok: true,
            }
          : {
              error: { code: result.error.code, message: result.error.message },
              ok: false,
            };
      },
    });
  }

  const navigationToolName = "biz_navigation_open";
  tools[navigationToolName] = makeNavigationTool(input.tenant);
  riskByTool[navigationToolName] = "low";
  approvalByTool[navigationToolName] = "approved";

  const capabilitySearchToolName = "brain_capability_search";
  tools[capabilitySearchToolName] = tool({
    description: "Busca habilidades autorizadas de Biz.OS cuando las tools iniciales no cubren el pedido.",
    inputSchema: z.object({ query: z.string().trim().min(2).max(2_000) }),
    execute: async ({ query }) => ({
      capabilities: rankBusinessSkills({
        currentModule: input.currentModule,
        limit: 15,
        message: query,
        skills: available,
      }).map((skill) => ({
        description: skill.description,
        id: skill.id,
        kind: skill.kind,
        module: skill.module,
        name: skill.name,
        requiresApproval: shouldRequireApproval(skill),
      })),
      message: "Capacidades autorizadas encontradas. Usa la herramienta concreta si está disponible o explica el siguiente paso.",
    }),
  });
  riskByTool[capabilitySearchToolName] = "low";
  approvalByTool[capabilitySearchToolName] = "approved";

  const teamToolName = "brain_team_start";
  tools[teamToolName] = tool({
    description: "Inicia un equipo durable de agentes especialistas en paralelo para un objetivo transversal.",
    inputSchema: z.object({
      maxConcurrency: z.number().int().min(1).max(5).default(3),
      objective: z.string().trim().min(10).max(4_000),
      requestedAgents: z.array(z.enum([
        "compras", "contenido", "finanzas", "inventario", "logistica",
        "marketing", "operaciones", "rrhh", "soporte", "ventas",
      ])).max(5).optional(),
    }),
    execute: async (teamInput) => {
      const { startBrainTeam } = await import("@/modules/brain/team-service");
      return startBrainTeam({
        ...teamInput,
        idempotencyKey: `${input.runId}:team`,
        parentRunId: input.runId,
        tenant: input.tenant,
      });
    },
  });
  riskByTool[teamToolName] = "medium";
  approvalByTool[teamToolName] = "user-approval";

  const humanToolName = "brain_human_work_assign";
  tools[humanToolName] = tool({
    description: "Asigna una tarea durable a una persona por nombre o correo y espera su respuesta sin bloquear Brain.",
    inputSchema: z.object({
      assignee: z.string().trim().min(2).max(200),
      description: z.string().trim().min(10).max(8_000),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      slaDueAt: z.string().datetime().nullable().optional(),
      title: z.string().trim().min(3).max(200),
    }),
    execute: async (workInput) => {
      const { startBrainHumanWorkItemByAssignee } = await import("@/modules/brain/work-item-service");
      return startBrainHumanWorkItemByAssignee({
        ...workInput,
        runId: input.runId,
        tenant: input.tenant,
      });
    },
  });
  riskByTool[humanToolName] = "medium";
  approvalByTool[humanToolName] = "user-approval";
  const businessContext = await buildBusinessInstructions(input.tenant);

  const agent = new ToolLoopAgent({
    id: "biz-brain-central",
    instructions: instructions({
      businessContext,
      currentModule: input.currentModule,
      currentPath: input.currentPath,
      entity: input.entity,
      profileName: input.tenant.profileName,
      selection: input.selection,
      timezone: input.timezone,
    }),
    maxOutputTokens: input.settings.maxTokens,
    maxRetries: 2,
    model: input.model,
    stopWhen: isStepCount(10),
    temperature: input.settings.temperature,
    toolApproval: ({ toolCall }) => approvalByTool[toolCall.toolName] ?? "user-approval",
    tools,
  });

  return { agent, riskByTool, selectedSkillIds: selected.map((skill) => skill.id) };
}
