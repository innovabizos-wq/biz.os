import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type FollowupReminderJobResult = {
  created: number;
  reviewed: number;
  skipped: number;
};

function normalizeResult(value: unknown): FollowupReminderJobResult {
  if (!value || typeof value !== "object") {
    return { created: 0, reviewed: 0, skipped: 0 };
  }

  const result = value as Record<string, unknown>;
  return {
    created: typeof result.created === "number" ? result.created : 0,
    reviewed: typeof result.reviewed === "number" ? result.reviewed : 0,
    skipped: typeof result.skipped === "number" ? result.skipped : 0,
  };
}

export async function runDueFollowupReminderJob(limit: number) {
  const { data, error } = await createServiceRoleClient().rpc(
    "enqueue_due_followup_reminders",
    { p_limit: limit },
  );

  if (error) {
    throw new Error(`No se pudieron crear los recordatorios de agenda: ${error.message}`);
  }

  return normalizeResult(data);
}
