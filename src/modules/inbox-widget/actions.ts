"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { getInboxMessages } from "@/modules/inbox/queries";
import { addInboxMessageSchema } from "@/modules/inbox/schemas";

export async function getInboxWidgetMessagesAction(conversationId: string) {
  const result = await getInboxMessages(conversationId);

  if (!result.ok) return [];

  return result.data;
}

export async function addInboxWidgetMessageAction(input: {
  contenido: string;
  conversacionId: string;
}) {
  const parsed = addInboxMessageSchema.safeParse({
    contenido: input.contenido,
    conversacionId: input.conversacionId,
    direccion: "saliente",
    esNotaInterna: false,
  });

  if (!parsed.success) {
    return { error: "Datos de mensaje invalidos.", ok: false as const };
  }

  const tenant = await getCurrentTenantContext();

  if (!tenant.ok || !tenant.data) {
    return { error: "No hay empresa activa.", ok: false as const };
  }

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.conversations.reply",
      "inbox.conversations.create",
    ])
  ) {
    return { error: "No tienes permiso para responder conversaciones.", ok: false as const };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_mensaje_inbox", {
    p_contenido: parsed.data.contenido,
    p_conversacion_id: parsed.data.conversacionId,
    p_direccion: "saliente",
    p_es_nota_interna: false,
  });

  if (error) {
    return { error: "No se pudo registrar el mensaje.", ok: false as const };
  }

  revalidatePath("/inbox");
  revalidatePath("/inbox/conversaciones");
  revalidatePath(`/inbox/conversaciones/${parsed.data.conversacionId}`);
  revalidatePath("/whapp");
  revalidatePath("/whapp/conversaciones");

  const messages = await getInboxWidgetMessagesAction(parsed.data.conversacionId);

  return { messages, ok: true as const };
}
