import "server-only";

import type {
  CapabilityDefinition,
  CapabilityRegistry,
  SkillBinding,
} from "@/modules/brain/runtime/contracts";

export function createCapabilityRegistry(
  initialCapabilities: CapabilityDefinition[] = [],
): CapabilityRegistry {
  const capabilities = new Map<string, CapabilityDefinition>();

  for (const capability of initialCapabilities) {
    capabilities.set(capability.id, capability);
  }

  return {
    get(capabilityId) {
      return capabilities.get(capabilityId) ?? null;
    },
    getImplementedBinding(capabilityId): SkillBinding | null {
      const capability = capabilities.get(capabilityId);
      if (!capability?.enabled || capability.status !== "implemented") return null;

      return (
        capability.skillBindings
          .filter((binding) => binding.status === "implemented")
          .sort((left, right) => right.priority - left.priority)[0] ?? null
      );
    },
    list() {
      return Array.from(capabilities.values());
    },
  };
}
