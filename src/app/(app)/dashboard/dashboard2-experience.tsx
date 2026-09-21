"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock3,
  Cpu,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type Dashboard2Agent = {
  accent: string;
  active: boolean;
  capabilities: number;
  detail: string;
  executable: number;
  href: string;
  id:
    | "compras"
    | "contenido"
    | "finanzas"
    | "inventario"
    | "logistica"
    | "marketing"
    | "operaciones"
    | "rrhh"
    | "soporte"
    | "ventas";
  label: string;
  planned: number;
  position: { x: number; y: number };
  reason: string | null;
  role: string;
};

export type Dashboard2Objective = {
  label: string;
  status: "active" | "done" | "waiting";
  value: string;
};

export type Dashboard2Decision = {
  detail: string;
  href: string;
  label: string;
  tone: "danger" | "info" | "success";
};

export type Dashboard2Priority = {
  href: string;
  label: string;
  source: string;
  tone: "critical" | "high" | "low" | "medium";
};

export type Dashboard2Payload = {
  agents: Dashboard2Agent[];
  companyName: string;
  decisions: Dashboard2Decision[];
  generatedAt: string;
  jobs: {
    available: number;
    total: number;
  };
  objectives: Dashboard2Objective[];
  priorities: Dashboard2Priority[];
  runtime: {
    automationEvents: number;
    completedTasks: number;
    failedTasks: number;
    pendingApproval: number;
    totalCapabilities: number;
    totalExecutable: number;
  };
  summary: {
    agendaToday: number;
    dispatchPending: number;
    inventoryLowStock: number;
    openConversations: number;
    overdueCollections: number;
    sales30dTotal: number;
  };
  userName: string;
};

function getPeriod(dateValue: string) {
  const hour = new Date(dateValue).getHours();

  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

function formatClock(dateValue: string) {
  return new Intl.DateTimeFormat("es-CR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    notation: "compact",
    style: "currency",
  }).format(value);
}

function periodLabel(period: string) {
  if (period === "morning") return "Manana";
  if (period === "midday") return "Mediodia";
  if (period === "evening") return "Atardecer";
  return "Noche";
}

function objectiveIcon(status: Dashboard2Objective["status"]) {
  if (status === "done") return <CheckCircle2 aria-hidden="true" />;
  if (status === "active") return <Zap aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

function RobotAvatar({ accent, large = false }: { accent: string; large?: boolean }) {
  return (
    <div
      className={large ? "dashboard2-robot dashboard2-robot-large" : "dashboard2-robot"}
      style={{ "--agent-accent": accent } as CSSProperties}
    >
      <div className="dashboard2-robot-head">
        <span />
        <span />
      </div>
      <div className="dashboard2-robot-body" />
    </div>
  );
}

function AgentNode({
  agent,
  selected,
  onSelect,
}: {
  agent: Dashboard2Agent;
  onSelect: (agent: Dashboard2Agent) => void;
  selected: boolean;
}) {
  return (
    <button
      className={selected ? "dashboard2-agent-node is-selected" : "dashboard2-agent-node"}
      onClick={() => onSelect(agent)}
      style={
        {
          "--agent-accent": agent.accent,
          "--agent-x": `${agent.position.x}%`,
          "--agent-y": `${agent.position.y}%`,
        } as CSSProperties
      }
      type="button"
    >
      <RobotAvatar accent={agent.accent} />
      <span className="dashboard2-agent-bubble">
        <span className="dashboard2-agent-name">{agent.label}</span>
        <span className="dashboard2-agent-role">{agent.detail}</span>
      </span>
    </button>
  );
}

export function Dashboard2Experience({ data }: { data: Dashboard2Payload }) {
  const [now, setNow] = useState(data.generatedAt);
  const [selectedId, setSelectedId] = useState<Dashboard2Agent["id"]>("operaciones");
  const selectedAgent = useMemo(
    () =>
      data.agents.find((agent) => agent.id === selectedId) ??
      data.agents.find((agent) => agent.id === "operaciones") ??
      data.agents[0],
    [data.agents, selectedId],
  );
  const period = getPeriod(now);
  const activeAgents = data.agents.filter((agent) => agent.active).length;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date().toISOString());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className={`dashboard2-screen dashboard2-${period}`}>
      <div className="dashboard2-scene">
        <div className="dashboard2-window" aria-hidden="true">
          <div className="dashboard2-skyline" />
        </div>
        <div className="dashboard2-office-depth" aria-hidden="true" />
        <div className="dashboard2-floor" aria-hidden="true" />
        <div className="dashboard2-light-sweep" aria-hidden="true" />
        <div className="dashboard2-ceiling" aria-hidden="true" />
        <div className="dashboard2-wall-panels" aria-hidden="true" />
        <div className="dashboard2-bookshelf" aria-hidden="true" />
        <div className="dashboard2-monitor dashboard2-monitor-left" aria-hidden="true" />
        <div className="dashboard2-monitor dashboard2-monitor-center" aria-hidden="true" />
        <div className="dashboard2-monitor dashboard2-monitor-right" aria-hidden="true" />

        <header className="dashboard2-hero">
          <div className="dashboard2-time">
            <Sparkles aria-hidden="true" />
            <div>
              <strong>{formatClock(now)}</strong>
              <span>{periodLabel(period)}</span>
            </div>
          </div>
          <div>
            <h1>Una oficina. Un equipo imparable.</h1>
            <p>
              Agentes IA trabajando <strong>24/7</strong> para hacer crecer tu
              negocio.
            </p>
          </div>
        </header>

        <aside className="dashboard2-objectives" aria-label="Objetivos del dia">
          <div className="dashboard2-panel-title">Objetivos del dia</div>
          <div className="dashboard2-objective-list">
            {data.objectives.map((objective) => (
              <Link
                className={`dashboard2-objective is-${objective.status}`}
                href="/brain"
                key={objective.label}
              >
                <span>
                  <strong>{objective.label}</strong>
                  <small>{objective.value}</small>
                </span>
                {objectiveIcon(objective.status)}
              </Link>
            ))}
          </div>
        </aside>

        <aside className="dashboard2-decisions" aria-label="Decisiones pendientes">
          <div className="dashboard2-panel-title">Decisiones pendientes</div>
          <div className="dashboard2-decision-list">
            {data.decisions.map((decision) => (
              <Link
                className={`dashboard2-decision is-${decision.tone}`}
                href={decision.href}
                key={decision.label}
              >
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>{decision.label}</strong>
                  <small>{decision.detail}</small>
                </span>
              </Link>
            ))}
          </div>
        </aside>

        <section className="dashboard2-ceo-card" aria-label="Direccion general">
          <Brain aria-hidden="true" />
          <h2>CEO AI</h2>
          <p>Director General</p>
          <span>Analizando la situacion</span>
          <div className="dashboard2-progress">
            <i style={{ width: `${Math.min(92, 42 + activeAgents * 5)}%` }} />
          </div>
          <small>
            {activeAgents}/{data.agents.length} agentes activos
          </small>
        </section>

        <div className="dashboard2-message">
          <p>Aqui no hay empleados.</p>
          <strong>Hay agentes de inteligencia trabajando para ti.</strong>
        </div>

        <div className="dashboard2-desk dashboard2-desk-main" aria-hidden="true" />
        <div className="dashboard2-desk dashboard2-desk-left" aria-hidden="true" />
        <div className="dashboard2-desk dashboard2-desk-right" aria-hidden="true" />
        <div className="dashboard2-plant dashboard2-plant-left" aria-hidden="true" />
        <div className="dashboard2-plant dashboard2-plant-center" aria-hidden="true" />
        <div className="dashboard2-plant dashboard2-plant-right" aria-hidden="true" />

        {data.agents.map((agent) => (
          <AgentNode
            agent={agent}
            key={agent.id}
            onSelect={(nextAgent) => setSelectedId(nextAgent.id)}
            selected={selectedAgent?.id === agent.id}
          />
        ))}

        {selectedAgent ? (
          <aside className="dashboard2-agent-panel">
            <div className="dashboard2-agent-panel-head">
              <RobotAvatar accent={selectedAgent.accent} large />
              <div>
                <span>{selectedAgent.label}</span>
                <h2>{selectedAgent.role}</h2>
              </div>
            </div>
            <p>{selectedAgent.detail}</p>
            <div className="dashboard2-agent-stats">
              <span>
                <strong>{selectedAgent.executable}</strong>
                Skills listas
              </span>
              <span>
                <strong>{selectedAgent.capabilities}</strong>
                Capacidades
              </span>
              <span>
                <strong>{selectedAgent.planned}</strong>
                Planificadas
              </span>
            </div>
            {selectedAgent.reason ? (
              <small className="dashboard2-agent-warning">{selectedAgent.reason}</small>
            ) : null}
            <Link className="dashboard2-agent-link" href={selectedAgent.href}>
              Abrir modulo
              <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        ) : null}

        <footer className="dashboard2-runtime">
          <div>
            <Cpu aria-hidden="true" />
            <span>
              <strong>{data.runtime.totalExecutable}</strong>
              Skills ejecutables
            </span>
          </div>
          <div>
            <Activity aria-hidden="true" />
            <span>
              <strong>{data.runtime.completedTasks}</strong>
              Tareas completadas
            </span>
          </div>
          <div>
            <PackageCheck aria-hidden="true" />
            <span>
              <strong>{data.jobs.available}/{data.jobs.total}</strong>
              Jobs listos
            </span>
          </div>
          <div>
            <Bot aria-hidden="true" />
            <span>
              <strong>{formatCurrency(data.summary.sales30dTotal)}</strong>
              Ventas 30 dias
            </span>
          </div>
        </footer>
      </div>

      <section className="dashboard2-mobile-priorities">
        <div>
          <h2>Prioridades operativas</h2>
          <p>{data.userName}, estas son las senales que Brain encontro ahora.</p>
        </div>
        <div className="dashboard2-priority-grid">
          {data.priorities.map((priority) => (
            <Link
              className={`dashboard2-priority is-${priority.tone}`}
              href={priority.href}
              key={`${priority.source}-${priority.label}`}
            >
              <span>{priority.source}</span>
              <strong>{priority.label}</strong>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
