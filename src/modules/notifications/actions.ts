"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createOwnNotificationSchema,
  markNotificationReadSchema,
} from "@/modules/notifications/schemas";
import type { NotificationType } from "@/modules/notifications/types";
import type { JsonRecord } from "@/types/core";

type CreateOwnNotificationInput = {
  entityId?: string | null;
  entityType?: string | null;
  href?: string | null;
  message?: string | null;
  metadata?: JsonRecord;
  title: string;
  type: NotificationType;
};

function revalidateNotificationSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/consultas/nueva");
  revalidatePath("/crm");
}

function logNotificationActionError(
  actionName: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

export async function markNotificationReadAction(input: {
  notificationId: string;
}) {
  const parsed = markNotificationReadSchema.safeParse(input);

  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_notificacion_leida", {
    p_notification_id: parsed.data.notificationId,
  });

  if (error) {
    logNotificationActionError("markNotificationReadAction", error);
    return { ok: false };
  }

  revalidateNotificationSurfaces();

  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "marcar_todas_mis_notificaciones_leidas",
  );

  if (error) {
    logNotificationActionError("markAllNotificationsReadAction", error);
    return { ok: false };
  }

  revalidateNotificationSurfaces();

  return { ok: true };
}

export async function createOwnNotificationAction(
  input: CreateOwnNotificationInput,
) {
  const parsed = createOwnNotificationSchema.safeParse(input);

  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_notificacion_propia", {
    p_entity_id: parsed.data.entityId ?? null,
    p_entity_type: parsed.data.entityType ?? null,
    p_href: parsed.data.href ?? null,
    p_message: parsed.data.message ?? null,
    p_metadata: parsed.data.metadata ?? {},
    p_title: parsed.data.title,
    p_type: parsed.data.type,
  });

  if (error) {
    logNotificationActionError("createOwnNotificationAction", error);
    return { ok: false };
  }

  revalidateNotificationSurfaces();

  return { ok: true };
}

export async function createUserNotificationServerOnly(
  input: CreateOwnNotificationInput & { recipientProfileId: string },
) {
  const parsed = createOwnNotificationSchema.safeParse(input);

  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_notificacion_usuario", {
    p_entity_id: parsed.data.entityId ?? null,
    p_entity_type: parsed.data.entityType ?? null,
    p_href: parsed.data.href ?? null,
    p_message: parsed.data.message ?? null,
    p_metadata: parsed.data.metadata ?? {},
    p_recipient_profile_id: input.recipientProfileId,
    p_title: parsed.data.title,
    p_type: parsed.data.type,
  });

  if (error) {
    logNotificationActionError("createUserNotificationServerOnly", error);
    return { ok: false };
  }

  revalidateNotificationSurfaces();

  return { ok: true };
}
