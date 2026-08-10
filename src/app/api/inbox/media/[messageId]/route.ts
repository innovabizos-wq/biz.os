import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<string, unknown>;

type MediaMessageRow = {
  canal_message_id: string | null;
  conversacion_id: string;
  direccion: string;
  tipo: string;
  conversation:
    | { canal: string; canal_id: string | null }
    | Array<{ canal: string; canal_id: string | null }>
    | null;
};

type SendConfigRow = {
  access_token?: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function findWhatsAppMedia(payload: unknown, externalMessageId: string) {
  for (const entry of asArray(asRecord(payload).entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const value = asRecord(asRecord(change).value);
      for (const item of asArray(value.messages)) {
        const message = asRecord(item);
        if (message.id !== externalMessageId) continue;
        const type = typeof message.type === "string" ? message.type : "";
        const media = asRecord(message[type]);
        return {
          filename: typeof media.filename === "string" ? media.filename : null,
          id: typeof media.id === "string" ? media.id : null,
          mimeType: typeof media.mime_type === "string" ? media.mime_type : null,
        };
      }
    }
  }

  return null;
}

function findMessagingMedia(payload: unknown, externalMessageId: string) {
  for (const entry of asArray(asRecord(payload).entry)) {
    for (const item of asArray(asRecord(entry).messaging)) {
      const message = asRecord(asRecord(item).message);
      if (message.mid !== externalMessageId) continue;
      const attachment = asRecord(asArray(message.attachments)[0]);
      const mediaPayload = asRecord(attachment.payload);
      return {
        filename: typeof attachment.name === "string" ? attachment.name : null,
        mimeType: null,
        url: typeof mediaPayload.url === "string" ? mediaPayload.url : null,
      };
    }
  }

  return null;
}

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const { messageId } = await params;
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok || !tenant.data) return errorResponse("No autorizado.", 401);
  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.conversations.view",
      "inbox.conversations.reply",
    ])
  ) {
    return errorResponse("Sin permiso para consultar adjuntos.", 403);
  }

  const supabase = await createClient();
  const { data: message } = await supabase
    .from("inbox_mensajes")
    .select(
      "conversacion_id, direccion, tipo, canal_message_id, conversation:inbox_conversaciones!inbox_mensajes_conversacion_empresa_fkey(canal, canal_id)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("id", messageId)
    .maybeSingle<MediaMessageRow>();

  const conversation = firstRelation(message?.conversation ?? null);
  if (
    !message ||
    !conversation?.canal_id ||
    !message.canal_message_id ||
    message.direccion !== "entrante" ||
    !["imagen", "audio", "video", "documento"].includes(message.tipo)
  ) {
    return errorResponse("Adjunto no encontrado.", 404);
  }

  const { data: event } = await supabase
    .from("inbox_webhook_eventos")
    .select("payload")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("canal_id", conversation.canal_id)
    .eq("external_message_id", message.canal_message_id)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ payload: unknown }>();

  if (!event?.payload) return errorResponse("Referencia del adjunto no encontrada.", 404);

  const admin = createServiceRoleClient();
  const { data: configRows } = await admin.rpc("obtener_inbox_meta_send_config_server", {
    p_actor_id: tenant.data.profileId,
    p_conversacion_id: message.conversacion_id,
    p_empresa_id: tenant.data.empresaId,
  });
  const accessToken = ((configRows as SendConfigRow[] | null)?.[0]?.access_token ?? "").trim();
  if (!accessToken) return errorResponse("Canal sin credenciales para descargar.", 409);

  let mediaUrl: string | null = null;
  let filename: string | null = null;
  let mimeType: string | null = null;

  if (conversation.canal === "whatsapp") {
    const media = findWhatsAppMedia(event.payload, message.canal_message_id);
    if (!media?.id) return errorResponse("Archivo de WhatsApp no encontrado.", 404);

    const metadataResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(media.id)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const metadata = asRecord(await metadataResponse.json().catch(() => ({})));
    mediaUrl = typeof metadata.url === "string" ? metadata.url : null;
    filename = media.filename;
    mimeType = media.mimeType;
  } else {
    const media = findMessagingMedia(event.payload, message.canal_message_id);
    mediaUrl = media?.url ?? null;
    filename = media?.filename ?? null;
  }

  if (!mediaUrl) return errorResponse("Meta no devolvio el archivo.", 404);

  const mediaResponse = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!mediaResponse.ok || !mediaResponse.body) {
    return errorResponse("No se pudo descargar el archivo desde Meta.", 502);
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Cache-Control", "private, no-store");
  responseHeaders.set(
    "Content-Type",
    mimeType ?? mediaResponse.headers.get("content-type") ?? "application/octet-stream",
  );
  responseHeaders.set(
    "Content-Disposition",
    `inline; filename="${(filename ?? `adjunto-${messageId}`).replace(/["\r\n]/g, "")}"`,
  );

  return new Response(mediaResponse.body, { headers: responseHeaders });
}
