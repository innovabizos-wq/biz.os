import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

type MetaMessaging = {
  delivery?: { mids?: string[]; watermark?: number };
  message?: { is_echo?: boolean; mid?: string };
  reaction?: { action?: string; emoji?: string; mid?: string };
  read?: { watermark?: number };
  recipient?: { id?: string };
  seen?: { watermark?: number };
  sender?: { id?: string };
  timestamp?: number;
};

type MetaEntry = { id?: string; messaging?: MetaMessaging[] };
type MetaPayload = { entry?: MetaEntry[]; object?: string };

function asMetaPayload(value: unknown): MetaPayload {
  return value && typeof value === "object" ? value as MetaPayload : {};
}

async function findChannel(accountId: string, channel: "facebook" | "instagram") {
  const admin = createServiceRoleClient();
  const publicConfigKey = channel === "instagram"
    ? "instagram_business_account_id"
    : "page_id";
  const direct = await admin
    .from("inbox_canales")
    .select("id, empresa_id")
    .eq("proveedor", "meta")
    .eq("canal", channel)
    .neq("estado", "inactivo")
    .eq("identificador_externo", accountId)
    .limit(1)
    .maybeSingle<{ empresa_id: string; id: string }>();
  if (direct.error) throw direct.error;
  if (direct.data) return direct.data;

  const configured = await admin
    .from("inbox_canales")
    .select("id, empresa_id")
    .eq("proveedor", "meta")
    .eq("canal", channel)
    .neq("estado", "inactivo")
    .contains("configuracion_publica", { [publicConfigKey]: accountId })
    .limit(1)
    .maybeSingle<{ empresa_id: string; id: string }>();
  if (configured.error) throw configured.error;
  return configured.data;
}

async function updateMessageIds({
  empresaId,
  messageIds,
  status,
  timestamp,
}: {
  empresaId: string;
  messageIds: string[];
  status: "entregado" | "leido";
  timestamp: string;
}) {
  if (messageIds.length === 0) return;
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("inbox_mensajes")
    .update({ estado: status })
    .eq("empresa_id", empresaId)
    .eq("direccion", "saliente")
    .in("canal_message_id", messageIds)
    .neq("estado", "fallido");
  if (error) throw error;

  const recipientUpdate = status === "leido"
    ? { delivered_at: timestamp, estado: "leido", read_at: timestamp }
    : { delivered_at: timestamp, estado: "entregado" };
  const { error: recipientError } = await admin
    .from("inbox_campana_destinatarios")
    .update(recipientUpdate)
    .eq("empresa_id", empresaId)
    .in("canal_message_id", messageIds)
    .neq("estado", "fallido");
  if (recipientError) throw recipientError;
}

async function updateReadWatermark({
  channelId,
  contactId,
  empresaId,
  watermark,
}: {
  channelId: string;
  contactId?: string;
  empresaId: string;
  watermark: number;
}) {
  if (!contactId || !Number.isFinite(watermark)) return;
  const admin = createServiceRoleClient();
  const { data: conversations, error } = await admin
    .from("inbox_conversaciones")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("canal_id", channelId)
    .eq("contacto_identificador", contactId);
  if (error) throw error;
  const conversationIds = (conversations ?? []).map((conversation) => conversation.id as string);
  if (conversationIds.length === 0) return;

  const readAt = new Date(watermark).toISOString();
  const { data: messages, error: messageError } = await admin
    .from("inbox_mensajes")
    .select("canal_message_id")
    .eq("empresa_id", empresaId)
    .eq("direccion", "saliente")
    .in("conversacion_id", conversationIds)
    .lte("sent_at", readAt)
    .not("canal_message_id", "is", null);
  if (messageError) throw messageError;
  await updateMessageIds({
    empresaId,
    messageIds: (messages ?? []).flatMap((message) =>
      typeof message.canal_message_id === "string" ? [message.canal_message_id] : []),
    status: "leido",
    timestamp: readAt,
  });
}

export async function processMetaWebhookSignals(payload: unknown) {
  const parsed = asMetaPayload(payload);
  if (parsed.object !== "page" && parsed.object !== "instagram") return;
  const channel = parsed.object === "instagram" ? "instagram" : "facebook";
  const admin = createServiceRoleClient();

  for (const entry of parsed.entry ?? []) {
    if (!entry.id) continue;
    const channelRow = await findChannel(entry.id, channel);
    if (!channelRow) continue;

    for (const messaging of entry.messaging ?? []) {
      const timestamp = new Date(messaging.timestamp ?? Date.now()).toISOString();
      await updateMessageIds({
        empresaId: channelRow.empresa_id,
        messageIds: messaging.delivery?.mids ?? [],
        status: "entregado",
        timestamp,
      });

      const watermark = messaging.read?.watermark ?? messaging.seen?.watermark;
      if (watermark) {
        const contactId = messaging.sender?.id === entry.id
          ? messaging.recipient?.id
          : messaging.sender?.id;
        await updateReadWatermark({
          channelId: channelRow.id,
          contactId,
          empresaId: channelRow.empresa_id,
          watermark,
        });
      }

      if (messaging.message?.is_echo && messaging.message.mid) {
        const { error } = await admin
          .from("inbox_mensajes")
          .update({ estado: "enviado" })
          .eq("empresa_id", channelRow.empresa_id)
          .eq("canal_message_id", messaging.message.mid)
          .eq("direccion", "saliente")
          .eq("estado", "registrado");
        if (error) throw error;
      }

      if (messaging.reaction?.mid) {
        const { data: message, error } = await admin
          .from("inbox_mensajes")
          .select("conversacion_id")
          .eq("empresa_id", channelRow.empresa_id)
          .eq("canal_message_id", messaging.reaction.mid)
          .limit(1)
          .maybeSingle<{ conversacion_id: string }>();
        if (error) throw error;
        if (message) {
          const { data: existingReaction, error: existingReactionError } = await admin
            .from("inbox_eventos")
            .select("id")
            .eq("empresa_id", channelRow.empresa_id)
            .eq("conversacion_id", message.conversacion_id)
            .eq("tipo", "reaccion_meta")
            .contains("metadata", messaging.reaction)
            .limit(1)
            .maybeSingle<{ id: string }>();
          if (existingReactionError) throw existingReactionError;
          if (!existingReaction) {
            const { error: eventError } = await admin.from("inbox_eventos").insert({
              conversacion_id: message.conversacion_id,
              descripcion: "Reaccion recibida desde Meta.",
              empresa_id: channelRow.empresa_id,
              metadata: messaging.reaction,
              tipo: "reaccion_meta",
            });
            if (eventError) throw eventError;
          }
        }
      }
    }
  }
}
