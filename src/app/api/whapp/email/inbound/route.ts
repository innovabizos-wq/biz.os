import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inboundEmailSchema = z.object({
  canalId: z.string().uuid(),
  empresaId: z.string().uuid(),
  externalMessageId: z.string().trim().min(1).max(512),
  fromEmail: z.string().trim().email().max(320),
  fromName: z.string().trim().max(200).optional(),
  html: z.string().trim().max(50000).optional(),
  receivedAt: z.string().datetime().optional(),
  subject: z.string().trim().max(300).optional(),
  text: z.string().trim().max(50000).optional(),
  threadId: z.string().trim().max(512).optional(),
  toEmail: z.string().trim().email().max(320).optional(),
});

type EmailChannelRow = {
  canal: string;
  estado: string;
  id: string;
  nombre: string;
  proveedor: string;
};

type EmailConversationRow = {
  id: string;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme.toLowerCase() === "bearer" && token) return token;

  return request.headers.get("x-whapp-email-secret");
}

function isAuthorized(request: Request) {
  const expected = process.env.WHAPP_EMAIL_INBOUND_SECRET;
  const received = getBearerToken(request);

  return Boolean(expected && received && received === expected);
}

function buildEmailContent(payload: z.infer<typeof inboundEmailSchema>) {
  const subject = payload.subject ? `Asunto: ${payload.subject}` : "Sin asunto";
  const sender = payload.fromName
    ? `${payload.fromName} <${payload.fromEmail}>`
    : payload.fromEmail;
  const recipient = payload.toEmail ? `Para: ${payload.toEmail}` : null;
  const body = payload.text || payload.html || "(Correo sin contenido legible)";

  return [subject, `De: ${sender}`, recipient, "", body]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const parsed = inboundEmailSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  const payload = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: channel, error: channelError } = await supabase
    .from("inbox_canales")
    .select("id, nombre, canal, proveedor, estado")
    .eq("empresa_id", payload.empresaId)
    .eq("id", payload.canalId)
    .maybeSingle<EmailChannelRow>();

  if (channelError) {
    return jsonResponse({ error: channelError.message }, 500);
  }

  if (
    !channel ||
    channel.canal !== "email" ||
    channel.proveedor !== "email" ||
    channel.estado !== "activo"
  ) {
    return jsonResponse({ error: "Email channel is not active" }, 422);
  }

  const { data: existingMessage, error: existingMessageError } = await supabase
    .from("inbox_mensajes")
    .select("id, conversacion_id")
    .eq("empresa_id", payload.empresaId)
    .eq("canal_message_id", payload.externalMessageId)
    .maybeSingle<{ conversacion_id: string; id: string }>();

  if (existingMessageError) {
    return jsonResponse({ error: existingMessageError.message }, 500);
  }

  if (existingMessage) {
    return jsonResponse({
      conversationId: existingMessage.conversacion_id,
      deduplicated: true,
      messageId: existingMessage.id,
    });
  }

  const contactIdentifier = payload.threadId ?? payload.fromEmail.toLowerCase();
  const { data: existingConversation, error: conversationLookupError } =
    await supabase
      .from("inbox_conversaciones")
      .select("id")
      .eq("empresa_id", payload.empresaId)
      .eq("canal_id", payload.canalId)
      .eq("contacto_identificador", contactIdentifier)
      .in("estado", ["abierta", "pendiente"])
      .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<EmailConversationRow>();

  if (conversationLookupError) {
    return jsonResponse({ error: conversationLookupError.message }, 500);
  }

  let conversationId = existingConversation?.id;
  const receivedAt = payload.receivedAt ?? new Date().toISOString();
  const content = buildEmailContent(payload);

  if (!conversationId) {
    const { data: insertedConversation, error: insertConversationError } =
      await supabase
        .from("inbox_conversaciones")
        .insert({
          canal: "email",
          canal_id: payload.canalId,
          contacto_identificador: contactIdentifier,
          contacto_nombre: payload.fromName ?? payload.fromEmail,
          contacto_usuario: payload.fromEmail.toLowerCase(),
          empresa_id: payload.empresaId,
          estado: "abierta",
          prioridad: "normal",
          ultimo_mensaje: payload.subject ?? payload.text ?? "Correo entrante",
          ultimo_mensaje_at: receivedAt,
        })
        .select("id")
        .single<EmailConversationRow>();

    if (insertConversationError) {
      return jsonResponse({ error: insertConversationError.message }, 500);
    }

    conversationId = insertedConversation.id;
  }

  const { data: insertedMessage, error: insertMessageError } = await supabase
    .from("inbox_mensajes")
    .insert({
      canal_message_id: payload.externalMessageId,
      contenido: content,
      conversacion_id: conversationId,
      direccion: "entrante",
      empresa_id: payload.empresaId,
      estado: "registrado",
      received_at: receivedAt,
      tipo: "texto",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertMessageError) {
    return jsonResponse({ error: insertMessageError.message }, 500);
  }

  await supabase
    .from("inbox_conversaciones")
    .update({
      estado: "abierta",
      ultimo_mensaje: payload.subject ?? payload.text ?? "Correo entrante",
      ultimo_mensaje_at: receivedAt,
    })
    .eq("empresa_id", payload.empresaId)
    .eq("id", conversationId);

  return jsonResponse(
    {
      conversationId,
      deduplicated: false,
      messageId: insertedMessage.id,
    },
    201,
  );
}
