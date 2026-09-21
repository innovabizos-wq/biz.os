import "server-only";

import type {
  BusinessIntentDefinition,
  BusinessIntentRegistry,
} from "@/modules/brain/runtime/contracts";

export function createBusinessIntentRegistry(
  initialIntents: BusinessIntentDefinition[] = [],
): BusinessIntentRegistry {
  const intents = new Map<string, BusinessIntentDefinition>();

  for (const intent of initialIntents) {
    intents.set(intent.id, intent);
  }

  return {
    get(intentId) {
      return intents.get(intentId) ?? null;
    },
    list() {
      return Array.from(intents.values());
    },
  };
}
