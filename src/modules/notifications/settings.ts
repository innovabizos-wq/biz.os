import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

export const DEFAULT_FOLLOWUP_REMINDER_LEAD_MINUTES = 30;
const NOTIFICATIONS_SETTINGS_KEY = "notifications";

const notificationSettingsSchema = z.object({
  followupReminderLeadMinutes: z.coerce.number().int().min(1).max(1440).default(
    DEFAULT_FOLLOWUP_REMINDER_LEAD_MINUTES,
  ),
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

function normalizeNotificationSettings(value: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(value);

  if (parsed.success) return parsed.data;

  return {
    followupReminderLeadMinutes: DEFAULT_FOLLOWUP_REMINDER_LEAD_MINUTES,
  };
}

function logNotificationSettingsError(
  actionName: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[${actionName}] notification settings failed`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

export async function getNotificationSettings(
  tenant: TenantContext,
): Promise<CoreResult<NotificationSettings>> {
  void tenant;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_configuracion_empresa", {
    p_clave: NOTIFICATIONS_SETTINGS_KEY,
  });

  if (error) {
    logNotificationSettingsError("getNotificationSettings", error);
    return ok(normalizeNotificationSettings(null));
  }

  return ok(normalizeNotificationSettings(data ?? null));
}

export async function saveNotificationSettingsAction(formData: FormData) {
  "use server";

  const { requireAdminAccess } = await import("@/modules/tenant/admin-access");
  const access = await requireAdminAccess();
  const canManage = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.manage",
  ]);

  if (!canManage) {
    redirect(
      "/admin/apariencia?error=No%20tienes%20permiso%20para%20guardar%20notificaciones.",
    );
  }

  const parsed = notificationSettingsSchema.safeParse({
    followupReminderLeadMinutes: formData.get("followupReminderLeadMinutes"),
  });

  if (!parsed.success) {
    redirect(
      "/admin/apariencia?error=Configura%20un%20tiempo%20de%20recordatorio%20valido.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_configuracion_empresa", {
    p_clave: NOTIFICATIONS_SETTINGS_KEY,
    p_valor: parsed.data as JsonRecord,
  });

  if (error) {
    logNotificationSettingsError("saveNotificationSettingsAction", error);
    redirect(
      "/admin/apariencia?error=No%20se%20pudo%20guardar%20la%20configuracion%20de%20notificaciones.",
    );
  }

  revalidatePath("/admin/apariencia");
  redirect("/admin/apariencia?success=Configuracion%20de%20notificaciones%20guardada.");
}
