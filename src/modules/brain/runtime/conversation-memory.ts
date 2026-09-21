import type {
  BusinessIntentDefinition,
} from "@/modules/brain/runtime/contracts";
import type { JsonRecord } from "@/types/core";

export type BrainConversationMemory = {
  lastConversationReference?: string;
  lastCustomerId?: string;
  lastCustomerName?: string;
  lastProductId?: string;
  lastProductName?: string;
  lastQuoteReference?: string;
  lastSaleReference?: string;
};

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readCurrentConversationReference(context?: Record<string, unknown>) {
  const currentPath = readString(context?.currentPath);
  const match = currentPath?.match(
    /^\/(?:whapp|inbox)\/conversaciones\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );

  return match?.[1];
}

function readMemory(context?: Record<string, unknown>): BrainConversationMemory {
  const raw = readRecord(
    context?.conversationMemory ??
      context?.brainConversationMemory ??
      context?.memory,
  );

  return {
    lastConversationReference:
      readString(raw.lastConversationReference) ??
      readCurrentConversationReference(context),
    lastCustomerId: readString(raw.lastCustomerId),
    lastCustomerName: readString(raw.lastCustomerName),
    lastProductId: readString(raw.lastProductId),
    lastProductName: readString(raw.lastProductName),
    lastQuoteReference: readString(raw.lastQuoteReference),
    lastSaleReference: readString(raw.lastSaleReference),
  };
}

function isVagueReference(value: unknown) {
  if (typeof value !== "string") return !value;

  return /^(ese|esa|eso|este|esta|esto|el mismo|la misma|mismo|misma)(\s+(cliente|producto|venta|cotizacion|proforma|whatsapp|chat|conversacion))?$/i
    .test(value.trim());
}

function bestCustomerReference(memory: BrainConversationMemory) {
  return memory.lastCustomerName ?? memory.lastCustomerId;
}

function bestProductReference(memory: BrainConversationMemory) {
  return memory.lastProductName ?? memory.lastProductId;
}

function setIfVague(
  entities: JsonRecord,
  key: string,
  value: string | undefined,
) {
  if (value && isVagueReference(entities[key])) {
    entities[key] = value;
  }
}

export function enrichIntentEntitiesFromMemory(
  intent: BusinessIntentDefinition,
  entities: JsonRecord,
  context?: Record<string, unknown>,
) {
  const memory = readMemory(context);
  const enriched: JsonRecord = { ...entities };
  const slotNames = new Set(
    [...intent.requiredSlots, ...(intent.optionalSlots ?? [])].map((slot) => slot.name),
  );

  if (
    slotNames.has("customerQuery") ||
    intent.capabilityId.startsWith("crm.") ||
    intent.capabilityId === "payments.account.statement"
  ) {
    setIfVague(enriched, "customerQuery", bestCustomerReference(memory));
    setIfVague(enriched, "query", bestCustomerReference(memory));
  }

  if (slotNames.has("productQuery") || intent.capabilityId.startsWith("inventory.")) {
    setIfVague(enriched, "productQuery", bestProductReference(memory));
    setIfVague(enriched, "query", bestProductReference(memory));
  }

  if (slotNames.has("saleReference")) {
    setIfVague(enriched, "saleReference", memory.lastSaleReference);
  }

  if (slotNames.has("quoteReference")) {
    setIfVague(enriched, "quoteReference", memory.lastQuoteReference);
  }

  if (slotNames.has("conversationReference")) {
    setIfVague(enriched, "conversationReference", memory.lastConversationReference);
  }

  return enriched;
}
