import type { BusinessContext } from "@/modules/business-context/types";
import {
  INBOX_SLA_STATUS_LABELS,
  INBOX_STATUS_LABELS,
} from "@/modules/inbox/constants";
import type {
  InboxConversationDetail,
  InboxMessage,
} from "@/modules/inbox/types";
import type { Quote } from "@/modules/quotes/types";
import type { Sale } from "@/modules/sales/types";

type WhappContextualAiPanelProps = {
  businessContext: BusinessContext | null;
  conversation: InboxConversationDetail;
  messages: InboxMessage[];
  quotes: Quote[];
  sales: Sale[];
};

type ContextualInsight = {
  action: string;
  evidence: string;
  priority: "alta" | "media" | "baja";
  title: string;
};

function getLastIncomingMessage(messages: InboxMessage[]) {
  return messages.find((message) => message.direccion === "entrante") ?? null;
}

function truncate(value: string, maxLength = 120) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function buildInsights({
  businessContext,
  conversation,
  messages,
  quotes,
  sales,
}: WhappContextualAiPanelProps): ContextualInsight[] {
  const insights: ContextualInsight[] = [];
  const lastIncoming = getLastIncomingMessage(messages);
  const openQuotes = quotes.filter((quote) =>
    ["borrador", "enviada", "vencida"].includes(quote.estado),
  );
  const activeSales = sales.filter((sale) =>
    ["nueva", "confirmada", "en_proceso"].includes(sale.estado),
  );

  if (conversation.slaStatus === "vencido") {
    insights.push({
      action: "Responder primero y cambiar prioridad antes de nuevas tareas.",
      evidence: conversation.slaDueAt
        ? `SLA vencio ${new Date(conversation.slaDueAt).toLocaleString("es-CR")}.`
        : "La conversacion aparece con SLA vencido.",
      priority: "alta",
      title: "Riesgo de atencion",
    });
  } else if (conversation.slaStatus === "riesgo") {
    insights.push({
      action: "Enviar respuesta breve de contencion y tomar ownership.",
      evidence: conversation.slaDueAt
        ? `SLA vence ${new Date(conversation.slaDueAt).toLocaleString("es-CR")}.`
        : "La conversacion esta cerca del limite de primera respuesta.",
      priority: "media",
      title: "SLA en riesgo",
    });
  }

  if (openQuotes.length > 0) {
    const latestQuote = openQuotes[0];
    insights.push({
      action: `Dar seguimiento a la cotizacion #${latestQuote.numero} antes de abrir una nueva.`,
      evidence: `${latestQuote.estado} por ${latestQuote.moneda} ${latestQuote.total.toLocaleString("es-CR")}.`,
      priority: latestQuote.estado === "vencida" ? "alta" : "media",
      title: "Oportunidad comercial abierta",
    });
  }

  if (activeSales.length > 0) {
    const latestSale = activeSales[0];
    insights.push({
      action: "Revisar estado operativo de la venta antes de prometer fechas.",
      evidence: `Venta #${latestSale.numero} en estado ${latestSale.estado}.`,
      priority: "media",
      title: "Venta activa relacionada",
    });
  }

  if (lastIncoming?.contenido) {
    const content = lastIncoming.contenido.toLowerCase();
    const buyingSignals = ["precio", "cotizacion", "cotización", "comprar", "pagar"];
    const supportSignals = ["problema", "fallo", "error", "no funciona", "reclamo"];

    if (buyingSignals.some((signal) => content.includes(signal))) {
      insights.push({
        action: "Responder con CTA comercial y preparar cotizacion si no hay una abierta.",
        evidence: truncate(lastIncoming.contenido),
        priority: "media",
        title: "Intencion de compra detectada",
      });
    }

    if (supportSignals.some((signal) => content.includes(signal))) {
      insights.push({
        action: "Contener el caso, pedir evidencia y registrar nota interna.",
        evidence: truncate(lastIncoming.contenido),
        priority: "alta",
        title: "Posible soporte o reclamo",
      });
    }
  }

  if (conversation.clienteId && quotes.length === 0 && sales.length === 0) {
    insights.push({
      action: "Calificar necesidad y crear primera cotizacion desde el flujo comercial.",
      evidence: "Cliente vinculado sin historial de cotizaciones ni ventas.",
      priority: "baja",
      title: "Cliente sin historial comercial",
    });
  }

  if (businessContext?.preferredCta) {
    insights.push({
      action: `Usar CTA preferido: ${businessContext.preferredCta}`,
      evidence: "Tomado del contexto del negocio.",
      priority: "baja",
      title: "Alineacion de marca",
    });
  }

  if (businessContext?.customerServiceRules) {
    insights.push({
      action: truncate(businessContext.customerServiceRules, 140),
      evidence: "Reglas de atencion configuradas por la empresa.",
      priority: "baja",
      title: "Regla de servicio",
    });
  }

  if (insights.length === 0) {
    insights.push({
      action: "Mantener respuesta clara, registrar nota interna si hay decision y cerrar cuando quede resuelto.",
      evidence: `Estado ${INBOX_STATUS_LABELS[conversation.estado]}, SLA ${INBOX_SLA_STATUS_LABELS[conversation.slaStatus]}.`,
      priority: "baja",
      title: "Siguiente mejor accion",
    });
  }

  return insights.slice(0, 5);
}

function priorityClassName(priority: ContextualInsight["priority"]) {
  if (priority === "alta") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "media") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function WhappContextualAiPanel(props: WhappContextualAiPanelProps) {
  const insights = buildInsights(props);
  const hasContext = Boolean(props.businessContext);

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">IA contextual</p>
          <p className="text-sm text-muted-foreground">
            Recomendaciones locales con evidencia del chat, CRM, ventas y reglas
            del negocio.
          </p>
        </div>
        <span
          className={[
            "rounded-full border px-2 py-1 text-xs font-bold",
            hasContext
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-slate-200 bg-slate-50 text-slate-700",
          ].join(" ")}
        >
          {hasContext ? "Contexto activo" : "Sin contexto"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {insights.map((insight) => (
          <div className="rounded-md border p-3" key={`${insight.title}-${insight.action}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-xs font-bold",
                  priorityClassName(insight.priority),
                ].join(" ")}
              >
                {insight.priority}
              </span>
              <p className="font-medium">{insight.title}</p>
            </div>
            <p className="mt-2 text-sm">{insight.action}</p>
            <p className="mt-1 text-xs text-muted-foreground">{insight.evidence}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Esta capa no llama a un modelo externo todavia. Sirve como copiloto
        auditable y como contrato de datos para conectar generacion IA con
        proveedor configurado.
      </p>
    </div>
  );
}
