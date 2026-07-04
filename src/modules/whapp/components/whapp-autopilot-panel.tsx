import {
  INBOX_AUTOMATION_ACTION_LABELS,
  INBOX_AUTOMATION_MODE_LABELS,
  INBOX_AUTOMATION_TRIGGER_LABELS,
} from "@/modules/inbox/constants";
import { recordInboxAutomationExecutionAction } from "@/modules/inbox/actions";
import type {
  InboxAutomationRule,
  InboxConversationDetail,
  InboxMessage,
} from "@/modules/inbox/types";

type WhappAutopilotPanelProps = {
  automations: InboxAutomationRule[];
  canReply: boolean;
  conversation: InboxConversationDetail;
  messages: InboxMessage[];
  redirectTo: string;
};

type AutopilotSuggestion = {
  evidence: string;
  rule: InboxAutomationRule;
};

function getLastIncomingMessage(messages: InboxMessage[]) {
  return messages.find((message) => message.direccion === "entrante") ?? null;
}

function getStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getConditionText(rule: InboxAutomationRule) {
  const value = rule.condiciones.notas ?? rule.condiciones.texto;
  return typeof value === "string" ? value : null;
}

function matchesRule(
  rule: InboxAutomationRule,
  conversation: InboxConversationDetail,
  messages: InboxMessage[],
): AutopilotSuggestion | null {
  if (rule.estado !== "activa") return null;
  if (rule.canalId && rule.canalId !== conversation.canalId) return null;

  const lastIncoming = getLastIncomingMessage(messages);
  const lastIncomingText = lastIncoming?.contenido?.toLowerCase() ?? "";

  if (rule.triggerTipo === "conversacion_creada") {
    return {
      evidence: "La regla aplica a conversaciones existentes y nuevas.",
      rule,
    };
  }

  if (rule.triggerTipo === "mensaje_entrante" && lastIncoming) {
    return {
      evidence: lastIncoming.contenido ?? "Hay mensaje entrante reciente.",
      rule,
    };
  }

  if (rule.triggerTipo === "palabra_clave" && lastIncomingText) {
    const keywords = getStringList(rule.condiciones.palabras);
    const fallbackText = getConditionText(rule);
    const matched = keywords.some((keyword) =>
      lastIncomingText.includes(keyword.toLowerCase()),
    );
    const fallbackMatched = fallbackText
      ? lastIncomingText.includes(fallbackText.toLowerCase())
      : false;

    if (matched || fallbackMatched) {
      return {
        evidence: lastIncoming?.contenido ?? "Palabra clave detectada.",
        rule,
      };
    }
  }

  if (
    rule.triggerTipo === "sla_en_riesgo" &&
    conversation.slaStatus === "riesgo"
  ) {
    return {
      evidence: conversation.slaDueAt
        ? `SLA vence ${new Date(conversation.slaDueAt).toLocaleString("es-CR")}.`
        : "La conversacion esta en riesgo de SLA.",
      rule,
    };
  }

  if (rule.triggerTipo === "sla_vencido" && conversation.slaStatus === "vencido") {
    return {
      evidence: conversation.slaDueAt
        ? `SLA vencio ${new Date(conversation.slaDueAt).toLocaleString("es-CR")}.`
        : "La conversacion tiene SLA vencido.",
      rule,
    };
  }

  return null;
}

function getActionSummary(rule: InboxAutomationRule) {
  const note = rule.accionConfig.nota ?? rule.accionConfig.notas;
  if (typeof note === "string" && note.trim()) return note.trim();

  const template = rule.accionConfig.plantilla ?? rule.accionConfig.template;
  if (typeof template === "string" && template.trim()) {
    return `Plantilla/configuracion: ${template.trim()}`;
  }

  return INBOX_AUTOMATION_ACTION_LABELS[rule.accionTipo];
}

export function WhappAutopilotPanel({
  automations,
  canReply,
  conversation,
  messages,
  redirectTo,
}: WhappAutopilotPanelProps) {
  const suggestions = automations
    .map((rule) => matchesRule(rule, conversation, messages))
    .filter((suggestion): suggestion is AutopilotSuggestion => Boolean(suggestion))
    .slice(0, 5);

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Autopilot asistido</p>
          <p className="text-sm text-muted-foreground">
            Reglas activas que aplican a esta conversacion y pueden auditarse
            antes de automatizar.
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
          {suggestions.length} sugerencia{suggestions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {suggestions.map(({ evidence, rule }) => (
          <div className="rounded-md border p-3" key={rule.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-bold">
                {INBOX_AUTOMATION_MODE_LABELS[rule.modo]}
              </span>
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-bold">
                {INBOX_AUTOMATION_TRIGGER_LABELS[rule.triggerTipo]}
              </span>
            </div>
            <p className="mt-2 font-medium">{rule.nombre}</p>
            <p className="mt-1 text-sm">{getActionSummary(rule)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{evidence}</p>

            {canReply ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["sugerida", "ejecutada", "omitida"] as const).map((status) => (
                  <form action={recordInboxAutomationExecutionAction} key={status}>
                    <input name="automationId" type="hidden" value={rule.id} />
                    <input
                      name="conversacionId"
                      type="hidden"
                      value={conversation.id}
                    />
                    <input name="estado" type="hidden" value={status} />
                    <input
                      name="resultado"
                      type="hidden"
                      value={`${rule.nombre}: ${getActionSummary(rule)}`}
                    />
                    <input name="redirectTo" type="hidden" value={redirectTo} />
                    <button
                      className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted"
                      type="submit"
                    >
                      Marcar {status}
                    </button>
                  </form>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {suggestions.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No hay reglas activas que apliquen a esta conversacion.
          </p>
        ) : null}
      </div>
    </div>
  );
}
