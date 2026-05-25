import { createClient } from "@/lib/supabase/server";
import type { UserNotification } from "@/modules/notifications/types";
import type { CoreResult, JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

type NotificationRow = {
  actor_name: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string | null;
  href: string | null;
  id: string;
  is_read: boolean;
  message: string | null;
  metadata: JsonRecord;
  read_at: string | null;
  title: string;
  type: UserNotification["type"];
};

function mapNotification(row: NotificationRow): UserNotification {
  return {
    actorName: row.actor_name,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    href: row.href,
    id: row.id,
    isRead: row.is_read,
    message: row.message,
    metadata: row.metadata,
    readAt: row.read_at,
    title: row.title,
    type: row.type,
  };
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  return (
    error.code === "42883" ||
    error.message?.includes("Could not find the function") ||
    error.message?.includes("function public.")
  );
}

export async function getMyNotifications({
  limit = 20,
  onlyUnread = false,
}: {
  limit?: number;
  onlyUnread?: boolean;
} = {}): Promise<CoreResult<UserNotification[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_mis_notificaciones", {
    p_limit: limit,
    p_only_unread: onlyUnread,
  });

  if (error) {
    if (isMissingRpcError(error)) return ok([]);

    return fail("PERMISSION_DENIED", "No se pudieron cargar las notificaciones.", error);
  }

  return ok(((data ?? []) as NotificationRow[]).map(mapNotification));
}

export async function getMyUnreadNotificationCount(): Promise<CoreResult<number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "contar_mis_notificaciones_no_leidas",
  );

  if (error) {
    if (isMissingRpcError(error)) return ok(0);

    return fail("PERMISSION_DENIED", "No se pudo contar las notificaciones.", error);
  }

  return ok(typeof data === "number" ? data : 0);
}
