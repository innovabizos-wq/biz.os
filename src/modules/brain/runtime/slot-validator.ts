import "server-only";

import type {
  BusinessIntentDefinition,
  ClarificationResult,
  SlotRequirement,
} from "@/modules/brain/runtime/contracts";
import type { CoreResult, JsonRecord } from "@/types/core";
import { ok } from "@/types/core";

function hasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

function isReferenceSlot(slot: SlotRequirement) {
  return /(?:Reference|Query)$/.test(slot.name);
}

function isUnresolvedReference(value: unknown) {
  if (typeof value !== "string") return false;

  return /^(ese|esa|eso|este|esta|esto|ultimo|ultima|el mismo|la misma|mismo|misma)(\s+(cliente|producto|venta|cotizacion|proforma|whatsapp|chat|conversacion|mensaje))?$/i
    .test(value.trim());
}

function readSlotValue(params: JsonRecord, slot: SlotRequirement) {
  if (
    hasValue(params[slot.name]) &&
    !(isReferenceSlot(slot) && isUnresolvedReference(params[slot.name]))
  ) {
    return params[slot.name];
  }

  for (const alias of slot.aliases ?? []) {
    if (
      hasValue(params[alias]) &&
      !(isReferenceSlot(slot) && isUnresolvedReference(params[alias]))
    ) {
      return params[alias];
    }
  }

  return undefined;
}

function normalizeSlots(
  slots: SlotRequirement[],
  params: JsonRecord,
) {
  return slots.reduce<JsonRecord>((normalized, slot) => {
    const value = readSlotValue(params, slot);
    if (hasValue(value) && !hasValue(normalized[slot.name])) {
      normalized[slot.name] = value as JsonRecord[string];
    }

    return normalized;
  }, { ...params });
}

function buildClarificationMessage(missingSlots: SlotRequirement[]) {
  const [first, ...rest] = missingSlots;
  if (!first) return "Faltan datos para ejecutar esta capacidad.";

  if (rest.length === 0) return first.clarification;

  const remaining = rest
    .map((slot) => slot.clarification.replace(/[.?]+$/g, ""))
    .join("; ");

  return `${first.clarification} Tambien necesito: ${remaining}.`;
}

export function validateIntentSlots(
  intent: BusinessIntentDefinition,
  params: JsonRecord,
): CoreResult<{ params: JsonRecord } | ClarificationResult> {
  const missingSlots = intent.requiredSlots.filter(
    (slot) => !hasValue(readSlotValue(params, slot)),
  );

  if (missingSlots.length > 0) {
    return ok({
      capabilityId: intent.capabilityId,
      intentId: intent.id,
      message: buildClarificationMessage(missingSlots),
      missingSlots,
    });
  }

  return ok({
    params: normalizeSlots(
      [...intent.requiredSlots, ...(intent.optionalSlots ?? [])],
      params,
    ),
  });
}

export function isClarificationResult(
  value: { params?: JsonRecord } | ClarificationResult,
): value is ClarificationResult {
  return "missingSlots" in value;
}
