import "server-only";

import type {
  BrainRuntime,
  BusinessSkillExecutor,
} from "@/modules/brain/runtime/contracts";

export function createBrainRuntime(
  executor: BusinessSkillExecutor,
): BrainRuntime {
  return {
    invoke(request) {
      return executor.invoke(request);
    },
  };
}
