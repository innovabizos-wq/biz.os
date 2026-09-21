import type { BrainWorkflowId } from "@/modules/brain/runtime/contracts";
import type { JsonRecord } from "@/types/core";

export type BrainWorkflowIntentResolution = {
  confidence: number;
  inputsByStep: Record<string, JsonRecord>;
  workflowId: BrainWorkflowId;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function firstMatch(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const found = match?.[1]?.trim();
    if (found) return found.replace(/[.,;:]+$/, "");
  }

  return null;
}

function extractWorkflowInputs(message: string) {
  const quoteReference = firstMatch(message, [
    /\b(?:cotizacion|cotización|proforma)\s+(?:numero\s+|#\s*)?([a-z0-9][\w.-]*)/i,
    /\b(?:cot|prof)-?([a-z0-9][\w.-]*)/i,
  ]);
  const saleReference = firstMatch(message, [
    /\b(?:venta|pedido)\s+(?:numero\s+|#\s*)?([a-z0-9][\w.-]*)/i,
    /\bven-?([a-z0-9][\w.-]*)/i,
  ]);
  const customerQuery = firstMatch(message, [
    /\bcliente\s+(.+?)(?:\s+(?:para|con|y|mañana|manana|despues|después)\b|$)/i,
    /\ba\s+(.+?)(?:\s+(?:mañana|manana|despues|después)\b|$)/i,
  ]);

  return {
    customerQuery,
    quoteReference,
    saleReference,
  };
}

function compactInputs(input: Record<string, JsonRecord>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => Object.keys(value).length > 0),
  );
}

export function resolveBrainWorkflowIntent(
  message: string,
): BrainWorkflowIntentResolution | null {
  const normalized = normalize(message);
  const extracted = extractWorkflowInputs(message);

  if (
    /(plan|workflow|proceso|flujo)/.test(normalized) &&
    /(cotizacion|proforma)/.test(normalized) &&
    /(despacho|entrega|venta|cxc|cuenta por cobrar)/.test(normalized)
  ) {
    return {
      confidence: 0.92,
      inputsByStep: compactInputs({
        confirm_sale: extracted.quoteReference
          ? { quoteReference: extracted.quoteReference }
          : {},
        create_followup: {
          ...(extracted.customerQuery ? { customerQuery: extracted.customerQuery } : {}),
          ...(extracted.quoteReference ? { quoteReference: extracted.quoteReference } : {}),
          ...(extracted.saleReference ? { saleReference: extracted.saleReference } : {}),
          title: "Seguimiento despues del flujo comercial",
        },
        generate_receivable: extracted.saleReference
          ? { saleReference: extracted.saleReference }
          : {},
        prepare_dispatch: extracted.saleReference
          ? { saleReference: extracted.saleReference }
          : {},
      }),
      workflowId: "commercial.quote_to_dispatch",
    };
  }

  if (
    /(confirmar|convierte|pasar)/.test(normalized) &&
    /(cotizacion|proforma)/.test(normalized) &&
    /(venta|cuenta por cobrar|cxc)/.test(normalized)
  ) {
    return {
      confidence: 0.88,
      inputsByStep: compactInputs({
        confirm_sale: extracted.quoteReference
          ? { quoteReference: extracted.quoteReference }
          : {},
        generate_receivable: extracted.saleReference
          ? { saleReference: extracted.saleReference }
          : {},
      }),
      workflowId: "commercial.sale_confirmation",
    };
  }

  if (
    /(seguimiento|followup|tarea)/.test(normalized) &&
    /(venta|cliente|conversacion|despues)/.test(normalized)
  ) {
    return {
      confidence: 0.82,
      inputsByStep: compactInputs({
        create_followup: {
          ...(extracted.customerQuery ? { customerQuery: extracted.customerQuery } : {}),
          ...(extracted.quoteReference ? { quoteReference: extracted.quoteReference } : {}),
          ...(extracted.saleReference ? { saleReference: extracted.saleReference } : {}),
          title: "Seguimiento solicitado desde Brain",
        },
      }),
      workflowId: "crm.followup_after_sale",
    };
  }

  return null;
}
