import { createClient } from "@/lib/supabase/server";
import type { CoreResult } from "@/types/core";
import { ok } from "@/types/core";

type ReminderRunResult = {
  created: number;
  reviewed: number;
  skipped: number;
};

function normalizeResult(value: unknown): ReminderRunResult {
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

function logFollowupReminderError(
  actionName: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  console.warn(`[${actionName}] followup reminder failed`, {
    code: error.code,
    details: error.details,
    hint: error.hint,
    message: error.message,
  });
}

export async function createDueFollowupReminderNotifications(input: {
  leadMinutes: number;
}): Promise<CoreResult<ReminderRunResult>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enqueue_my_due_followup_reminders", {
    p_lead_minutes: input.leadMinutes,
    p_limit: 50,
  });

  if (error) {
    logFollowupReminderError("createDueFollowupReminderNotifications", error);
    return ok({ created: 0, reviewed: 0, skipped: 0 });
  }

  return ok(normalizeResult(data));
}
