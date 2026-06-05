import { createClient } from "@/lib/supabase/server";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

type ReminderKind = "before_due" | "due_now";

type FollowupReminderRow = {
  asunto: string;
  cliente_id: string;
  crm_clientes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  fecha_programada: string;
  id: string;
};

type ExistingNotificationRow = {
  entity_id: string | null;
  metadata: JsonRecord;
};

function getCustomerName(row: FollowupReminderRow) {
  const relation = Array.isArray(row.crm_clientes)
    ? row.crm_clientes[0]
    : row.crm_clientes;

  return relation?.nombre ?? "un cliente";
}

function isReminderKind(value: unknown, kind: ReminderKind) {
  return (
    value &&
    typeof value === "object" &&
    "reminderKind" in value &&
    (value as { reminderKind?: unknown }).reminderKind === kind
  );
}

function logFollowupReminderError(
  actionName: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[${actionName}] followup reminder failed`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

async function createReminderNotification(input: {
  followup: FollowupReminderRow;
  kind: ReminderKind;
  leadMinutes: number;
}) {
  const supabase = await createClient();
  const customerName = getCustomerName(input.followup);
  const title =
    input.kind === "before_due"
      ? "Seguimiento proximo"
      : "Seguimiento pendiente ahora";
  const message =
    input.kind === "before_due"
      ? `Tienes un seguimiento para ${customerName} en ${input.leadMinutes} minutos o menos.`
      : `Ya es momento de trabajar el seguimiento de ${customerName}.`;

  const { error } = await supabase.rpc("crear_notificacion_propia", {
    p_entity_id: input.followup.id,
    p_entity_type: "crm_followup",
    p_href: "/agenda/seguimientos",
    p_message: message,
    p_metadata: {
      clienteId: input.followup.cliente_id,
      leadMinutes: input.leadMinutes,
      reminderKind: input.kind,
      scheduledAt: input.followup.fecha_programada,
      source: "followup_reminder",
    },
    p_title: title,
    p_type: "task",
  });

  if (error) {
    logFollowupReminderError("createReminderNotification", error);
  }
}

export async function createDueFollowupReminderNotifications(input: {
  leadMinutes: number;
  profileId: string;
  tenant: TenantContext;
}): Promise<CoreResult<{ created: number }>> {
  const supabase = await createClient();
  const now = new Date();
  const leadLimit = new Date(now.getTime() + input.leadMinutes * 60_000);

  const { data: followups, error: followupsError } = await supabase
    .from("crm_seguimientos")
    .select("id, cliente_id, asunto, fecha_programada, crm_clientes(nombre)")
    .eq("empresa_id", input.tenant.empresaId)
    .eq("asignado_a", input.profileId)
    .eq("estado", "pendiente")
    .lte("fecha_programada", leadLimit.toISOString())
    .order("fecha_programada", { ascending: true })
    .limit(50)
    .returns<FollowupReminderRow[]>();

  if (followupsError) {
    logFollowupReminderError("createDueFollowupReminderNotifications.query", followupsError);
    return ok({ created: 0 });
  }

  if (!followups || followups.length === 0) {
    return ok({ created: 0 });
  }

  const followupIds = followups.map((followup) => followup.id);
  const { data: existing, error: existingError } = await supabase
    .from("user_notifications")
    .select("entity_id, metadata")
    .eq("empresa_id", input.tenant.empresaId)
    .eq("recipient_profile_id", input.profileId)
    .eq("entity_type", "crm_followup")
    .in("entity_id", followupIds)
    .returns<ExistingNotificationRow[]>();

  if (existingError) {
    logFollowupReminderError("createDueFollowupReminderNotifications.existing", existingError);
    return ok({ created: 0 });
  }

  const existingKeys = new Set(
    (existing ?? []).flatMap((notification) => {
      const keys: string[] = [];

      if (isReminderKind(notification.metadata, "before_due")) {
        keys.push(`${notification.entity_id}:before_due`);
      }

      if (isReminderKind(notification.metadata, "due_now")) {
        keys.push(`${notification.entity_id}:due_now`);
      }

      return keys;
    }),
  );
  let created = 0;

  for (const followup of followups) {
    const scheduledAt = new Date(followup.fecha_programada);
    const dueNow = scheduledAt.getTime() <= now.getTime();
    const reminders: ReminderKind[] = dueNow ? ["due_now"] : ["before_due"];

    for (const reminderKind of reminders) {
      const key = `${followup.id}:${reminderKind}`;

      if (existingKeys.has(key)) continue;

      await createReminderNotification({
        followup,
        kind: reminderKind,
        leadMinutes: input.leadMinutes,
      });
      existingKeys.add(key);
      created += 1;
    }
  }

  return ok({ created });
}
