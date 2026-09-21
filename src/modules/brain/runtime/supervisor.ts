import "server-only";

import { randomUUID } from "node:crypto";

import { listBrainAgentsForTenant } from "@/modules/brain/agent-service";
import { initialBrainAgents } from "@/modules/brain/runtime/orchestration-catalog";
import type {
  BrainAgentId,
  BrainTeamPlan,
  BrainTeamTask,
} from "@/modules/brain/runtime/contracts";
import type { TenantContext } from "@/types/core";

const AGENT_TERMS: Record<BrainAgentId, string[]> = {
  compras: ["compra", "compras", "proveedor", "reabaste", "reposicion"],
  contenido: ["contenido", "articulo", "blog", "redact", "publicacion"],
  finanzas: ["finanzas", "pago", "cobro", "cartera", "factura", "margen"],
  inventario: ["inventario", "stock", "bodega", "existencia", "producto"],
  logistica: ["despacho", "entrega", "logistica", "ruta", "envio"],
  marketing: ["marketing", "campana", "seo", "audiencia", "promocion"],
  operaciones: ["operacion", "incidente", "coordina", "plan", "equipo"],
  rrhh: ["rrhh", "personal", "empleado", "planilla", "equipo humano"],
  soporte: ["soporte", "cliente", "queja", "inbox", "whatsapp", "sla"],
  ventas: ["venta", "cliente", "cotizacion", "oportunidad", "comercial"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function selectAgents(
  tenant: TenantContext,
  objective: string,
  requested?: BrainAgentId[],
) {
  const available = new Set(
    listBrainAgentsForTenant(tenant)
      .filter((agent) => agent.available)
      .map((agent) => agent.id),
  );
  const explicit = (requested ?? []).filter((agentId) => available.has(agentId));
  if (explicit.length > 0) return [...new Set(explicit)].slice(0, 5);

  const value = normalize(objective);
  const scored = initialBrainAgents
    .filter((agent) => available.has(agent.id))
    .map((agent) => ({
      agentId: agent.id,
      score: AGENT_TERMS[agent.id].filter((term) => value.includes(term)).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((candidate) => candidate.agentId);

  const selected = scored.slice(0, 4);
  if (selected.length === 0 && available.has("operaciones")) selected.push("operaciones");
  if (selected.length === 1 && selected[0] !== "operaciones" && available.has("operaciones")) {
    selected.push("operaciones");
  }
  return selected;
}

export function planBrainTeam(input: {
  maxConcurrency?: number;
  objective: string;
  requestedAgents?: BrainAgentId[];
  tenant: TenantContext;
}): BrainTeamPlan {
  const objective = input.objective.trim();
  if (!objective) throw new Error("El objetivo del equipo no puede estar vacio.");
  const selected = selectAgents(input.tenant, objective, input.requestedAgents);
  if (selected.length === 0) {
    throw new Error("No hay agentes autorizados con capacidades utiles para este objetivo.");
  }

  const workers = selected.filter((agentId) => agentId !== "operaciones");
  const workerIds = (workers.length > 0 ? workers : selected).map((agentId) => `agent-${agentId}`);
  const tasks: BrainTeamTask[] = (workers.length > 0 ? workers : selected).map((agentId) => {
    const agent = initialBrainAgents.find((candidate) => candidate.id === agentId);
    return {
      agentId,
      dependsOn: [],
      description: `Resolver la parte de ${agent?.name ?? agentId} del objetivo: ${objective}`,
      id: `agent-${agentId}`,
      input: { objective },
      skillId: `brain.agent.${agentId}.run`,
      status: "pending" as const,
      successCriteria: agent?.successCriteria.join(" ") ?? "Entregar un resultado verificable.",
    };
  });

  if (workers.length > 0 && selected.includes("operaciones")) {
    const verifier = initialBrainAgents.find((agent) => agent.id === "operaciones");
    tasks.push({
      agentId: "operaciones",
      dependsOn: workerIds,
      description: `Verificar, integrar y cerrar los resultados del equipo para: ${objective}`,
      id: "agent-operaciones-verifier",
      input: { objective, role: "final_verifier" },
      skillId: "brain.agent.operaciones.run",
      status: "pending",
      successCriteria: verifier?.successCriteria.join(" ") ?? "Validar el resultado final.",
    });
  }

  const agents = selected
    .map((agentId) => initialBrainAgents.find((agent) => agent.id === agentId))
    .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent));

  return {
    budget: {
      maxCostUsd: Number(agents.reduce((total, agent) => total + agent.budget.maxCostUsd, 0).toFixed(6)),
      maxDurationSeconds: Math.max(...agents.map((agent) => agent.budget.maxDurationSeconds)),
      maxTokens: agents.reduce((total, agent) => total + agent.budget.maxTokens, 0),
    },
    id: randomUUID(),
    maxConcurrency: Math.min(Math.max(input.maxConcurrency ?? 3, 1), 5),
    objective,
    tasks,
  };
}

export function decideBrainExecutionMode(input: {
  objective: string;
  requestedTeam?: boolean;
}) {
  const value = normalize(input.objective);
  const domains = Object.values(AGENT_TERMS).filter((terms) =>
    terms.some((term) => value.includes(term)),
  ).length;
  if (input.requestedTeam || domains >= 2 || /equipo|paralelo|coordina|proyecto/.test(value)) {
    return { mode: "team" as const, reason: "El objetivo cruza varios responsables o pide coordinacion." };
  }
  if (/asigna|persona|humano|revisa manual/.test(value)) {
    return { mode: "human" as const, reason: "El objetivo necesita trabajo o criterio humano." };
  }
  if (/analiza|investiga|estrategia|planifica/.test(value)) {
    return { mode: "agent" as const, reason: "El objetivo requiere razonamiento especializado." };
  }
  return { mode: "skill" as const, reason: "Una Skill directa es suficiente." };
}
