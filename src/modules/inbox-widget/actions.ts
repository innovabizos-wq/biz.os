"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getAssignableUsersForInbox,
  getCustomersForInbox,
  getInboxMessages,
} from "@/modules/inbox/queries";
import type { InboxConversationStatus } from "@/modules/inbox/types";
import {
  sendWhatsAppTextMessage,
} from "@/services/meta/client";
import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

type MetaChannel = "facebook" | "instagram" | "whatsapp";

type MetaSendConfig = {
  access_token?: string;
  account_id?: string;
  api_host?: string | null;
  channel_name?: string;
  channel_type?: MetaChannel;
  recipient_id?: string;
};

type WidgetConversation = {
  canal: MetaChannel | string;
  canal_id: string | null;
  canal_rel:
    | {
        conexion_estado: string;
        estado: string;
        proveedor: string;
      }
    | Array<{
        conexion_estado: string;
        estado: string;
        proveedor: string;
      }>
    | null;
  id: string;
};

type MetaErrorPayload = {
  error?: { message?: string };
  messages?: Array<{ id?: string }>;
  message_id?: string;
};

const META_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const WIDGET_CONVERSATION_STATUSES = ["abierta", "pendiente", "cerrada", "spam"] as const;

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function getAttachmentType(file: File): "audio" | "document" | "image" | "video" {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function getMediaLabel(type: ReturnType<typeof getAttachmentType>, file: File) {
  const labels = {
    audio: "Nota de voz",
    document: "Archivo",
    image: "Imagen",
    video: "Video",
  };

  return `${labels[type]}: ${file.name}`;
}

function getGraphEndpoint(host: string, accountId: string, edge: string) {
  return `https://${host}/${META_GRAPH_API_VERSION}/${encodeURIComponent(accountId)}/${edge}`;
}

async function parseMetaResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as MetaErrorPayload & {
    attachment_id?: string;
    id?: string;
  };

  if (!response.ok) {
    return { error: payload.error?.message ?? "Meta rechazo el envio.", ok: false as const };
  }

  return {
    attachmentId: payload.attachment_id ?? payload.id ?? null,
    messageId: payload.messages?.[0]?.id ?? payload.message_id ?? null,
    ok: true as const,
  };
}

async function uploadAndSendMessagingAttachment({
  accessToken,
  accountId,
  file,
  host,
  includeMessagingType,
  recipientId,
}: {
  accessToken: string;
  accountId: string;
  file: File;
  host: string;
  includeMessagingType: boolean;
  recipientId: string;
}) {
  const type = getAttachmentType(file);
  const uploadBody = new FormData();
  uploadBody.set(
    "message",
    JSON.stringify({ attachment: { payload: { is_reusable: true }, type } }),
  );
  uploadBody.set("filedata", file, file.name);

  const uploaded = await parseMetaResponse(
    await fetch(getGraphEndpoint(host, accountId, "message_attachments"), {
      body: uploadBody,
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "POST",
    }),
  );

  if (!uploaded.ok || !uploaded.attachmentId) {
    return uploaded.ok
      ? { error: "Meta no devolvio el identificador del adjunto.", ok: false as const }
      : uploaded;
  }

  return parseMetaResponse(
    await fetch(getGraphEndpoint(host, accountId, "messages"), {
      body: JSON.stringify({
        message: { attachment: { payload: { attachment_id: uploaded.attachmentId }, type } },
        messaging_type: includeMessagingType ? "RESPONSE" : undefined,
        recipient: { id: recipientId },
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

async function sendMessagingText({
  accessToken,
  accountId,
  body,
  host,
  includeMessagingType,
  recipientId,
}: {
  accessToken: string;
  accountId: string;
  body: string;
  host: string;
  includeMessagingType: boolean;
  recipientId: string;
}) {
  return parseMetaResponse(
    await fetch(getGraphEndpoint(host, accountId, "messages"), {
      body: JSON.stringify({
        message: { text: body.trim() },
        messaging_type: includeMessagingType ? "RESPONSE" : undefined,
        recipient: { id: recipientId },
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

async function uploadAndSendWhatsAppAttachment({
  accessToken,
  file,
  phoneNumberId,
  to,
}: {
  accessToken: string;
  file: File;
  phoneNumberId: string;
  to: string;
}) {
  const type = getAttachmentType(file);
  const uploadBody = new FormData();
  uploadBody.set("file", file, file.name);
  uploadBody.set("messaging_product", "whatsapp");
  uploadBody.set("type", file.type || "application/octet-stream");

  const uploaded = await parseMetaResponse(
    await fetch(getGraphEndpoint("graph.facebook.com", phoneNumberId, "media"), {
      body: uploadBody,
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "POST",
    }),
  );

  if (!uploaded.ok || !uploaded.attachmentId) {
    return uploaded.ok
      ? { error: "Meta no devolvio el identificador del archivo.", ok: false as const }
      : uploaded;
  }

  return parseMetaResponse(
    await fetch(getGraphEndpoint("graph.facebook.com", phoneNumberId, "messages"), {
      body: JSON.stringify({
        [type]: {
          filename: type === "document" ? file.name : undefined,
          id: uploaded.attachmentId,
        },
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function getInboxWidgetMessagesAction(conversationId: string) {
  const result = await getInboxMessages(conversationId);

  if (!result.ok) return [];

  return result.data;
}

export async function getInboxWidgetOperationsAction() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return {
      canAssign: false,
      canChangeStatus: false,
      canReply: false,
      customers: [],
      users: [],
    };
  }

  const [users, customers] = await Promise.all([
    getAssignableUsersForInbox(),
    getCustomersForInbox(),
  ]);

  return {
    canAssign: tenant.data.permissions.includes("inbox.conversations.assign"),
    canChangeStatus: tenant.data.permissions.includes(
      "inbox.conversations.status.change",
    ),
    canReply: tenant.data.permissions.includes("inbox.conversations.reply"),
    customers: customers.ok ? customers.data : [],
    users: users.ok ? users.data : [],
  };
}

export async function getInboxWidgetQuickRepliesAction() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("inbox_eventos")
    .select("metadata")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("tipo", "respuestas_rapidas_widget")
    .is("conversacion_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ metadata: Record<string, unknown> }>();

  return Array.isArray(data?.metadata?.respuestas) ? data.metadata.respuestas : [];
}

export async function saveInboxWidgetQuickRepliesAction(respuestas: unknown[]) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return { error: "No hay empresa activa.", ok: false as const };
  }

  if (!tenant.data.permissions.includes("inbox.conversations.reply")) {
    return { error: "No tienes permiso para administrar respuestas.", ok: false as const };
  }

  const sanitized = respuestas
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .slice(0, 50)
    .map((value) => ({
      accent: typeof value.accent === "string" ? value.accent : "green",
      id: typeof value.id === "string" ? value.id.slice(0, 100) : crypto.randomUUID(),
      text: typeof value.text === "string" ? value.text.trim().slice(0, 2000) : "",
      title: typeof value.title === "string" ? value.title.trim().slice(0, 120) : "",
    }))
    .filter((value) => value.text && value.title);

  const admin = createServiceRoleClient();
  const { error } = await admin.from("inbox_eventos").insert({
    conversacion_id: null,
    created_by: tenant.data.profileId,
    descripcion: "Respuestas rapidas actualizadas desde el popup.",
    empresa_id: tenant.data.empresaId,
    metadata: { respuestas: sanitized },
    tipo: "respuestas_rapidas_widget",
  });

  return error
    ? { error: "No se pudieron guardar las respuestas rapidas.", ok: false as const }
    : { ok: true as const };
}

export async function updateInboxWidgetConversationAction(formData: FormData) {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok || !tenant.data) {
    return { error: "No hay empresa activa.", ok: false as const };
  }

  const conversacionId = String(formData.get("conversacionId") ?? "").trim();
  const operation = String(formData.get("operation") ?? "").trim();
  if (!conversacionId) {
    return { error: "Conversacion invalida.", ok: false as const };
  }

  const supabase = await createClient();

  if (operation === "assign") {
    if (!tenant.data.permissions.includes("inbox.conversations.assign")) {
      return { error: "No tienes permiso para asignar.", ok: false as const };
    }
    const asignadoA = String(formData.get("asignadoA") ?? "").trim() || null;
    const { error } = await supabase.rpc("asignar_inbox_conversacion", {
      p_asignado_a: asignadoA,
      p_conversacion_id: conversacionId,
    });
    if (error) return { error: "No se pudo guardar la asignacion.", ok: false as const };
  } else if (operation === "customer") {
    if (!tenant.data.permissions.includes("inbox.conversations.assign")) {
      return { error: "No tienes permiso para vincular clientes.", ok: false as const };
    }
    const clienteId = String(formData.get("clienteId") ?? "").trim();
    if (!clienteId) return { error: "Selecciona un cliente.", ok: false as const };
    const { error } = await supabase.rpc("vincular_inbox_conversacion_cliente", {
      p_cliente_id: clienteId,
      p_conversacion_id: conversacionId,
    });
    if (error) return { error: "No se pudo vincular el cliente.", ok: false as const };
  } else if (operation === "status") {
    if (!tenant.data.permissions.includes("inbox.conversations.status.change")) {
      return { error: "No tienes permiso para cambiar el estado.", ok: false as const };
    }
    const estado = String(formData.get("estado") ?? "") as InboxConversationStatus;
    if (!WIDGET_CONVERSATION_STATUSES.includes(estado)) {
      return { error: "Estado invalido.", ok: false as const };
    }
    const { error } = await supabase.rpc("cambiar_estado_inbox_conversacion", {
      p_conversacion_id: conversacionId,
      p_estado: estado,
    });
    if (error) return { error: "No se pudo cambiar el estado.", ok: false as const };
  } else if (operation === "note") {
    if (!tenant.data.permissions.includes("inbox.conversations.reply")) {
      return { error: "No tienes permiso para agregar notas.", ok: false as const };
    }
    const contenido = String(formData.get("contenido") ?? "").trim();
    if (!contenido) return { error: "Escribe la nota interna.", ok: false as const };
    const { error } = await supabase.rpc("agregar_mensaje_inbox", {
      p_contenido: contenido,
      p_conversacion_id: conversacionId,
      p_direccion: "interna",
      p_es_nota_interna: true,
    });
    if (error) return { error: "No se pudo guardar la nota.", ok: false as const };
  } else if (operation === "classification") {
    if (!tenant.data.permissions.includes("inbox.conversations.assign")) {
      return { error: "No tienes permiso para clasificar conversaciones.", ok: false as const };
    }
    const etiquetas = String(formData.get("etiquetas") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20);
    const etapaFunnel = String(formData.get("etapaFunnel") ?? "").trim().slice(0, 120);
    const admin = createServiceRoleClient();
    const { error } = await admin.from("inbox_eventos").insert({
      conversacion_id: conversacionId,
      created_by: tenant.data.profileId,
      descripcion: "Clasificacion actualizada desde el popup.",
      empresa_id: tenant.data.empresaId,
      metadata: { etiquetas, etapaFunnel: etapaFunnel || null },
      tipo: "clasificacion_widget",
    });
    if (error) return { error: "No se pudo guardar la clasificacion.", ok: false as const };
  } else {
    return { error: "Operacion no reconocida.", ok: false as const };
  }

  revalidatePath("/inbox");
  revalidatePath("/inbox/conversaciones");
  revalidatePath(`/inbox/conversaciones/${conversacionId}`);
  revalidatePath("/whapp/conversaciones");

  return { ok: true as const };
}

export async function addInboxWidgetMessageAction(formData: FormData) {
  const conversacionId = String(formData.get("conversacionId") ?? "").trim();
  const contenido = String(formData.get("contenido") ?? "").trim();
  const attachment = formData.get("attachment");
  const file = attachment instanceof File && attachment.size > 0 ? attachment : null;

  if (!conversacionId || (!contenido && !file)) {
    return { error: "Escribe un mensaje o selecciona un archivo.", ok: false as const };
  }

  if (file && file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "El archivo supera el limite de 20 MB.", ok: false as const };
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
  const { data: conversation, error: conversationError } = await supabase
    .from("inbox_conversaciones")
    .select(
      "id, canal, canal_id, canal_rel:inbox_canales!inbox_conversaciones_canal_empresa_fkey(proveedor, estado, conexion_estado)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("id", conversacionId)
    .maybeSingle<WidgetConversation>();

  if (conversationError || !conversation) {
    return { error: "No se pudo validar la conversacion.", ok: false as const };
  }

  const channel = firstRelation(conversation.canal_rel);
  if (
    !channel ||
    channel.proveedor !== "meta" ||
    channel.estado !== "activo" ||
    channel.conexion_estado !== "configurado" ||
    !["facebook", "instagram", "whatsapp"].includes(conversation.canal)
  ) {
    return { error: "Esta conversacion no tiene un canal Meta activo.", ok: false as const };
  }

  const { data: lastIncoming } = await supabase
    .from("inbox_mensajes")
    .select("created_at, received_at")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("conversacion_id", conversacionId)
    .eq("direccion", "entrante")
    .eq("es_nota_interna", false)
    .order("received_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ created_at: string; received_at: string | null }>();

  const lastIncomingAt = lastIncoming?.received_at ?? lastIncoming?.created_at;
  if (!lastIncomingAt || Date.now() - new Date(lastIncomingAt).getTime() >= META_REPLY_WINDOW_MS) {
    return {
      error: "La ventana de respuesta de 24 horas cerro; el cliente debe escribir nuevamente.",
      ok: false as const,
    };
  }

  const serviceSupabase = createServiceRoleClient();
  const { data: configRows, error: configError } = await serviceSupabase.rpc(
    "obtener_inbox_meta_send_config_server",
    {
      p_actor_id: tenant.data.profileId,
      p_conversacion_id: conversacionId,
      p_empresa_id: tenant.data.empresaId,
    },
  );
  const config = (configRows as MetaSendConfig[] | null)?.[0];

  if (configError || !config?.access_token || !config.account_id || !config.recipient_id || !config.channel_type) {
    return { error: "El canal no esta listo para enviar por Meta.", ok: false as const };
  }

  const metaResult = file
    ? config.channel_type === "whatsapp"
      ? await uploadAndSendWhatsAppAttachment({
          accessToken: config.access_token,
          file,
          phoneNumberId: config.account_id,
          to: config.recipient_id,
        })
      : await uploadAndSendMessagingAttachment({
          accessToken: config.access_token,
          accountId: config.account_id,
          file,
          host: config.channel_type === "instagram" && config.api_host === "graph.instagram.com"
            ? "graph.instagram.com"
            : "graph.facebook.com",
          includeMessagingType: config.channel_type === "facebook",
          recipientId: config.recipient_id,
        })
    : config.channel_type === "whatsapp"
      ? await sendWhatsAppTextMessage({
          accessToken: config.access_token,
          body: contenido,
          phoneNumberId: config.account_id,
          to: config.recipient_id,
        })
      : config.channel_type === "facebook"
        ? await sendMessagingText({
            accessToken: config.access_token,
            accountId: config.account_id,
            body: contenido,
            host: "graph.facebook.com",
            includeMessagingType: true,
            recipientId: config.recipient_id,
          })
        : await sendMessagingText({
            accessToken: config.access_token,
            accountId: config.account_id,
            body: contenido,
            host: config.api_host === "graph.instagram.com"
              ? "graph.instagram.com"
              : "graph.facebook.com",
            includeMessagingType: false,
            recipientId: config.recipient_id,
          });

  const storedContent = file ? getMediaLabel(getAttachmentType(file), file) : contenido;
  const { error } = await supabase.rpc("registrar_inbox_mensaje_saliente_meta", {
    p_canal_message_id: metaResult.ok ? metaResult.messageId : null,
    p_contenido: storedContent,
    p_conversacion_id: conversacionId,
    p_error: metaResult.ok ? null : metaResult.error,
    p_estado: metaResult.ok ? "enviado" : "fallido",
  });

  if (error) {
    return { error: "Meta respondio, pero no se pudo registrar el mensaje.", ok: false as const };
  }

  if (!metaResult.ok) {
    return { error: `Meta no envio el mensaje: ${metaResult.error}`, ok: false as const };
  }

  revalidatePath("/inbox");
  revalidatePath("/inbox/conversaciones");
  revalidatePath(`/inbox/conversaciones/${conversacionId}`);
  revalidatePath("/whapp");
  revalidatePath("/whapp/conversaciones");

  const messages = await getInboxWidgetMessagesAction(conversacionId);

  return { messages, ok: true as const };
}
