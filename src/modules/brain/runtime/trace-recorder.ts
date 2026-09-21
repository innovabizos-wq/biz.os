import "server-only";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import type {
  BrainSkillTraceEvent,
  BrainSkillTraceRecorder,
} from "@/modules/brain/runtime/contracts";
import type { JsonRecord } from "@/types/core";

function publicTrace(event: BrainSkillTraceEvent) {
  return {
    durationMs: event.durationMs,
    errorCode: event.errorCode ?? null,
    invocationId: event.invocationId,
    occurredAt: event.occurredAt,
    skillId: event.skillId,
    source: event.source,
    status: event.status,
    tenantId: event.tenant.empresaId,
    userId: event.tenant.profileId,
  };
}

export function createBrainSkillTraceRecorder(): BrainSkillTraceRecorder {
  return {
    async record(event) {
      const trace = publicTrace(event);
      console.info("[biz.brain.skill]", JSON.stringify(trace));

      if (!hasPermission(event.tenant.permissions, "ai.reports.use")) return;

      try {
        const supabase = await createClient();
        await supabase.rpc("registrar_ai_usage_event", {
          p_completion_tokens: 0,
          p_feature: `brain.skill.${event.skillId}`,
          p_metadata: trace as unknown as JsonRecord,
          p_prompt_tokens: 0,
          p_provider: null,
          p_status: event.status === "success" ? "logged" : event.status,
        });
      } catch {
        // Structured server logs remain the baseline trace when usage logging is unavailable.
      }
    },
  };
}

export const brainSkillTraceRecorder = createBrainSkillTraceRecorder();
