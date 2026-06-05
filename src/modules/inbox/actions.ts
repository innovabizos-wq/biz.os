"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  buildWhatsAppMessagesEndpoint,
  sendWhatsAppTextMessage,
} from "@/services/meta/client";
import { META_GRAPH_API_VERSION } from "@/services/meta/constants";
import {
  addInboxMessageSchema,
  assignInboxConversationSchema,
  changeInboxChannelStatusSchema,
  changeInboxConversationStatusSchema,
  createMetaChannelSchema,
  createInboxChannelSchema,
  createInboxConversationSchema,
  linkInboxConversationCustomerSchema,
  regenerateVerifyTokenSchema,
  saveMetaChannelSecretsSchema,
  updateMetaChannelConfigSchema,
} from "@/modules/inbox/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type RpcIdRow = {
  id?: string;
};

type VerifyTokenRow = {
  verify_token?: string;
};

type WhatsAppSendConfigRow = {
  access_token?: string;
  access_token_suffix?: string | null;
  access_token_updated_at?: string | null;
  canal_id?: string;
  channel_name?: string;
  conversacion_id?: string;
  empresa_id?: string;
  phone_number_id?: string;
  to_phone?: string;
};

type WhatsAppSendConversationRow = {
  canal: string;
  canal_id: string | null;
  canal_rel:
    | {
        canal: string;
        configuracion_publica: Record<string, unknown>;
        conexion_estado: string;
        estado: string;
        id: string;
        nombre: string;
        proveedor: string;
      }
    | Array<{
        canal: string;
        configuracion_publica: Record<string, unknown>;
        conexion_estado: string;
        estado: string;
        id: string;
        nombre: string;
        proveedor: string;
      }>
    | null;
  id: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function getSafeRedirectPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") return fallback;

  const path = value.trim();

  if (!path.startsWith("/inbox") && !path.startsWith("/whapp")) {
    return fallback;
  }

  if (path.includes("://") || path.startsWith("//")) {
    return fallback;
  }

  return path;
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (message?.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }

  return "No se pudo actualizar el Inbox. Intenta de nuevo o solicita ayuda al administrador.";
}

function logInboxActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string>,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function revalidateInboxPaths(conversacionId?: string, canalId?: string) {
  revalidatePath("/inbox");
  revalidatePath("/inbox/conversaciones");
  revalidatePath("/inbox/canales");
  revalidatePath("/inbox/canales/nuevo");
  revalidatePath("/whapp");
  revalidatePath("/whapp/conversaciones");
  revalidatePath("/whapp/canales");
  revalidatePath("/whapp/salud");

  if (conversacionId) {
    revalidatePath(`/inbox/conversaciones/${conversacionId}`);
    revalidatePath(`/whapp/conversaciones/${conversacionId}`);
  }

  if (canalId) {
    revalidatePath(`/inbox/canales/${canalId}`);
    revalidatePath(`/whapp/canales/${canalId}`);
  }
}

async function assertInboxPermission(
  permission:
    | "inbox.channels.manage"
    | "inbox.conversations.assign"
    | "inbox.conversations.create"
    | "inbox.conversations.reply"
    | "inbox.conversations.status.change",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta accion.");
  }

  return access;
}

export async function createInboxChannelAction(formData: FormData) {
  const parsed = createInboxChannelSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales", "Datos de canal invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales");

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_inbox_canal_manual", {
    p_canal: parsed.data.canal,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_nombre: parsed.data.nombre,
  });

  if (error) {
    logInboxActionError("createInboxChannelAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/canales",
      `No se pudo crear el canal: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths();
  redirect("/inbox/canales");
}

export async function changeInboxChannelStatusAction(formData: FormData) {
  const parsed = changeInboxChannelStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales", "Estado de canal invalido.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inbox_canal", {
    p_canal_id: parsed.data.canalId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInboxActionError("changeInboxChannelStatusAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      "/inbox/canales",
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(`/inbox/canales/${parsed.data.canalId}`);
}

export async function createMetaChannelAction(formData: FormData) {
  const parsed = createMetaChannelSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales/nuevo", "Datos de canal Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales/nuevo");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_inbox_canal_meta", {
    p_app_id: parsed.data.appId ?? null,
    p_business_id: parsed.data.businessId ?? null,
    p_canal: parsed.data.canal,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_instagram_business_account_id:
      parsed.data.instagramBusinessAccountId ?? null,
    p_nombre: parsed.data.nombre,
    p_page_id: parsed.data.pageId ?? null,
    p_phone_number_id: parsed.data.phoneNumberId ?? null,
    p_waba_id: parsed.data.wabaId ?? null,
  });

  if (error) {
    logInboxActionError("createMetaChannelAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/canales/nuevo",
      `No se pudo crear el canal Meta: ${safeErrorMessage(error)}`,
    );
  }

  const canalId = (data as RpcIdRow[] | null)?.[0]?.id;

  revalidateInboxPaths(undefined, canalId);
  redirect(canalId ? `/inbox/canales/${canalId}` : "/inbox/canales");
}

export async function updateMetaChannelConfigAction(formData: FormData) {
  const parsed = updateMetaChannelConfigSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de configuracion Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_inbox_canal_meta_config", {
    p_app_id: parsed.data.appId ?? null,
    p_business_id: parsed.data.businessId ?? null,
    p_canal_id: parsed.data.canalId,
    p_conexion_estado: parsed.data.conexionEstado,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_instagram_business_account_id:
      parsed.data.instagramBusinessAccountId ?? null,
    p_nombre: parsed.data.nombre,
    p_page_id: parsed.data.pageId ?? null,
    p_phone_number_id: parsed.data.phoneNumberId ?? null,
    p_waba_id: parsed.data.wabaId ?? null,
  });

  if (error) {
    logInboxActionError("updateMetaChannelConfigAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo actualizar el canal Meta: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(fallbackPath);
}

export async function saveMetaChannelSecretsAction(formData: FormData) {
  const parsed = saveMetaChannelSecretsSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de secretos Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const accessToken = parsed.data.accessToken?.trim() || null;
  const appSecret = parsed.data.appSecret?.trim() || null;
  const verifyToken = parsed.data.verifyToken?.trim() || null;
  const tokenExpiresAt = parsed.data.tokenExpiresAt?.trim() || null;

  const { error } = await supabase.rpc("guardar_inbox_canal_meta_secretos", {
    p_access_token: accessToken,
    p_app_secret: appSecret,
    p_canal_id: parsed.data.canalId,
    p_token_expires_at: tokenExpiresAt,
    p_verify_token: verifyToken,
  });

  if (error) {
    logInboxActionError("saveMetaChannelSecretsAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudieron guardar los secretos: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(
    `${fallbackPath}?success=${encodeURIComponent(
      "Secretos Meta actualizados correctamente.",
    )}`,
  );
}

export async function regenerateMetaVerifyTokenAction(formData: FormData) {
  const parsed = regenerateVerifyTokenSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Canal invalido.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "regenerar_inbox_canal_verify_token",
    {
      p_canal_id: parsed.data.canalId,
    },
  );

  if (error) {
    logInboxActionError("regenerateMetaVerifyTokenAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo regenerar el verify token: ${safeErrorMessage(error)}`,
    );
  }

  const verifyToken = (data as VerifyTokenRow[] | null)?.[0]?.verify_token;

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(
    verifyToken
      ? `${fallbackPath}?verifyToken=${encodeURIComponent(verifyToken)}`
      : fallbackPath,
  );
}

export async function createInboxConversationAction(formData: FormData) {
  const parsed = createInboxConversationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/conversaciones", "Datos de conversacion invalidos.");
  }

  await assertInboxPermission(
    "inbox.conversations.create",
    "/inbox/conversaciones",
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_inbox_conversacion_manual", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_canal: parsed.data.canal,
    p_canal_id: parsed.data.canalId ?? null,
    p_cliente_id: parsed.data.clienteId ?? null,
    p_contacto_identificador: parsed.data.contactoIdentificador ?? null,
    p_contacto_nombre: parsed.data.contactoNombre ?? null,
    p_contacto_telefono: parsed.data.contactoTelefono ?? null,
    p_contacto_usuario: parsed.data.contactoUsuario ?? null,
    p_mensaje_inicial: parsed.data.mensajeInicial ?? null,
  });

  if (error) {
    logInboxActionError("createInboxConversationAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/conversaciones",
      `No se pudo crear la conversacion: ${safeErrorMessage(error)}`,
    );
  }

  const conversacionId = (data as RpcIdRow[] | null)?.[0]?.id;

  revalidateInboxPaths(conversacionId);
  redirect(
    conversacionId
      ? `/inbox/conversaciones/${conversacionId}`
      : "/inbox/conversaciones",
  );
}

export async function addInboxMessageAction(formData: FormData) {
  const parsed = addInboxMessageSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Datos de mensaje invalidos.");
  }

  if (parsed.data.direccion === "entrante") {
    const access = await requireAdminAccess();

    if (
      !hasAnyPermission(access.tenant.permissions, [
        "inbox.conversations.create",
        "inbox.conversations.reply",
      ])
    ) {
      redirectWithError(redirectPath, "No tienes permiso para realizar esta accion.");
    }
  } else {
    await assertInboxPermission("inbox.conversations.reply", redirectPath);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_mensaje_inbox", {
    p_contenido: parsed.data.contenido,
    p_conversacion_id: parsed.data.conversacionId,
    p_direccion: parsed.data.direccion,
    p_es_nota_interna: parsed.data.esNotaInterna,
  });

  if (error) {
    logInboxActionError("addInboxMessageAction", error, {
      conversacionId: parsed.data.conversacionId,
      direccion: parsed.data.direccion,
    });
    redirectWithError(
      redirectPath,
      `No se pudo registrar el mensaje: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(redirectPath);
}

export async function sendWhatsAppMessageAction(formData: FormData) {
  const parsed = addInboxMessageSchema.safeParse({
    contenido: formData.get("contenido"),
    conversacionId: formData.get("conversacionId"),
    direccion: "saliente",
    esNotaInterna: false,
  });
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Datos de mensaje invalidos.");
  }

  await assertInboxPermission("inbox.conversations.reply", redirectPath);

  const supabase = await createClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("inbox_conversaciones")
    .select(
      "id, canal_id, canal, canal_rel:inbox_canales!inbox_conversaciones_canal_empresa_fkey(id, nombre, canal, proveedor, estado, conexion_estado, configuracion_publica)",
    )
    .eq("id", parsed.data.conversacionId)
    .maybeSingle<WhatsAppSendConversationRow>();

  if (conversationError) {
    logInboxActionError("sendWhatsAppMessageAction.getConversation", conversationError, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo validar el canal asociado: ${safeErrorMessage(conversationError)}`,
    );
  }

  if (!conversation) {
    redirectWithError(redirectPath, "Conversacion no encontrada.");
  }

  if (!conversation.canal_id) {
    redirectWithError(
      redirectPath,
      "La conversacion no tiene canal WhatsApp asociado.",
    );
  }

  const channel = firstRelation(conversation.canal_rel);

  if (!channel || channel.id !== conversation.canal_id) {
    redirectWithError(
      redirectPath,
      "No se pudo validar el canal asociado a la conversacion.",
    );
  }

  const channelName = channel.nombre;
  const channelPhoneNumberId = safeString(
    channel.configuracion_publica.phone_number_id,
  );

  if (channel.canal !== "whatsapp" || channel.proveedor !== "meta") {
    redirectWithError(
      redirectPath,
      `El canal asociado no es WhatsApp Meta. Canal: ${channelName}.`,
    );
  }

  if (channel.estado === "inactivo") {
    redirectWithError(redirectPath, "El canal asociado esta inactivo.");
  }

  if (channel.estado !== "activo") {
    redirectWithError(
      redirectPath,
      `El canal asociado no esta activo. Estado: ${channel.estado}.`,
    );
  }

  if (channel.conexion_estado !== "configurado") {
    redirectWithError(
      redirectPath,
      `El canal asociado no esta configurado. Conexion: ${channel.conexion_estado}.`,
    );
  }

  if (!channelPhoneNumberId) {
    redirectWithError(
      redirectPath,
      `El canal ${channelName} no tiene phone_number_id configurado.`,
    );
  }

  const { data, error } = await supabase.rpc("obtener_inbox_whatsapp_send_config", {
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("sendWhatsAppMessageAction.getConfig", error, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo preparar el envio por WhatsApp: ${safeErrorMessage(error)}`,
    );
  }

  const config = (data as WhatsAppSendConfigRow[] | null)?.[0];
  const configCanalId = safeString(config?.canal_id);

  if (!config?.access_token || !config.to_phone) {
    redirectWithError(
      redirectPath,
      `Este canal no esta listo para envio real por WhatsApp. Canal: ${channelName}. Phone Number ID usado: ${channelPhoneNumberId}.`,
    );
  }

  if (configCanalId !== channel.id) {
    redirectWithError(
      redirectPath,
      `La configuracion de envio no coincide con el canal asociado. Canal asociado: ${channel.id}. Canal configuracion: ${configCanalId || "sin canal"}.`,
    );
  }

  const endpoint = buildWhatsAppMessagesEndpoint(channelPhoneNumberId);

  console.info("[sendWhatsAppMessageAction] WhatsApp manual send", {
    accessTokenConfigured: Boolean(config.access_token),
    accessTokenUpdatedAt: config.access_token_updated_at ?? null,
    canalId: channel.id,
    channelName,
    conversationId: parsed.data.conversacionId,
    endpoint,
    graphVersion: META_GRAPH_API_VERSION,
    phoneNumberId: channelPhoneNumberId,
    phoneNumberIdLength: channelPhoneNumberId.length,
    tokenFingerprint: config.access_token_suffix
      ? `...${config.access_token_suffix}`
      : null,
    to: config.to_phone,
  });

  const result = await sendWhatsAppTextMessage({
    accessToken: config.access_token,
    body: parsed.data.contenido,
    phoneNumberId: channelPhoneNumberId,
    to: config.to_phone,
  });

  const { error: registerError } = await supabase.rpc(
    "registrar_inbox_mensaje_saliente_meta",
    {
      p_canal_message_id: result.ok ? result.messageId : null,
      p_contenido: parsed.data.contenido,
      p_conversacion_id: parsed.data.conversacionId,
      p_error: result.ok
        ? null
        : `Canal: ${channelName}. Phone Number ID usado: ${channelPhoneNumberId}. Meta: ${result.error}`,
      p_estado: result.ok ? "enviado" : "fallido",
    },
  );

  if (registerError) {
    logInboxActionError("sendWhatsAppMessageAction.register", registerError, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `Meta respondio, pero no se pudo registrar el mensaje: ${safeErrorMessage(
        registerError,
      )}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);

  if (!result.ok) {
    redirectWithError(
      redirectPath,
      `No se pudo enviar por WhatsApp. Canal: ${channelName}. Phone Number ID usado: ${channelPhoneNumberId}. Meta: ${result.error}`,
    );
  }

  redirect(redirectPath);
}

export async function assignInboxConversationAction(formData: FormData) {
  const parsed = assignInboxConversationSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Datos de asignacion invalidos.");
  }

  await assertInboxPermission("inbox.conversations.assign", redirectPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_inbox_conversacion", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("assignInboxConversationAction", error, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo asignar la conversacion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(redirectPath);
}

export async function linkInboxConversationCustomerAction(formData: FormData) {
  const parsed = linkInboxConversationCustomerSchema.safeParse(
    getFormData(formData),
  );
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Datos de cliente invalidos.");
  }

  await assertInboxPermission("inbox.conversations.assign", redirectPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("vincular_inbox_conversacion_cliente", {
    p_cliente_id: parsed.data.clienteId,
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("linkInboxConversationCustomerAction", error, {
      clienteId: parsed.data.clienteId,
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo vincular el cliente: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(redirectPath);
}

export async function changeInboxConversationStatusAction(formData: FormData) {
  const parsed = changeInboxConversationStatusSchema.safeParse(
    getFormData(formData),
  );
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Estado de conversacion invalido.");
  }

  await assertInboxPermission(
    "inbox.conversations.status.change",
    redirectPath,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inbox_conversacion", {
    p_conversacion_id: parsed.data.conversacionId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInboxActionError("changeInboxConversationStatusAction", error, {
      conversacionId: parsed.data.conversacionId,
      estado: parsed.data.estado,
    });
    redirectWithError(
      redirectPath,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(redirectPath);
}
