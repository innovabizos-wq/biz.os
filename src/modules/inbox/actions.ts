"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  buildWhatsAppMessagesEndpoint,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
} from "@/services/meta/client";
import { META_GRAPH_API_VERSION } from "@/services/meta/constants";
import { dispatchInboxCampaignBatch } from "@/modules/whapp/server/campaign-dispatcher";
import {
  addInboxCampaignRecipientSchema,
  addInboxMessageSchema,
  assignInboxConversationSchema,
  changeInboxChannelStatusSchema,
  changeInboxConversationStatusSchema,
  createMetaChannelSchema,
  createInboxChannelSchema,
  createInboxConversationSchema,
  dispatchInboxCampaignBatchSchema,
  linkInboxConversationCustomerSchema,
  markInboxConversationReadSchema,
  prepareInboxCampaignQueueSchema,
  recordInboxAutomationExecutionSchema,
  regenerateVerifyTokenSchema,
  saveMetaChannelSecretsSchema,
  sendWhatsAppTemplateSchema,
  updateInboxCampaignRecipientStatusSchema,
  updateInboxCampaignStatusSchema,
  updateMetaChannelConfigSchema,
  upsertInboxAutomationRuleSchema,
  upsertInboxCampaignSchema,
  upsertMetaTemplateSchema,
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

type MetaTemplateActionRow = {
  canal_id: string | null;
  categoria: string;
  cuerpo: string;
  estado: string;
  id: string;
  idioma: string;
  nombre: string;
  variables: unknown;
};

type CampaignChannelActionRow = {
  canal: string;
  conexion_estado: string;
  estado: string;
  id: string;
  proveedor: string;
};

type CampaignTemplateActionRow = {
  canal_id: string | null;
  estado: string;
  id: string;
  nombre: string;
};

type CampaignRecipientCampaignRow = {
  estado: string;
  id: string;
};

type CampaignRecipientStatusRow = {
  campana_id: string;
  estado: string;
  id: string;
};

type AutomationChannelActionRow = {
  id: string;
};

type AutomationExecutionValidationRow = {
  canal_id: string | null;
  estado: string;
  id: string;
};

type AutomationExecutionConversationRow = {
  canal_id: string | null;
  id: string;
};

type InboxServerClient = Awaited<ReturnType<typeof createClient>>;

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

function parseTemplateVariables(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildTemplateBodyComponents(values: string[]) {
  if (values.length === 0) return undefined;

  return [
    {
      parameters: values.map((text) => ({ text, type: "text" as const })),
      type: "body" as const,
    },
  ];
}

function buildTemplatePreview(templateName: string, values: string[]) {
  return values.length > 0
    ? `Plantilla Meta: ${templateName}\nVariables:\n${values.join("\n")}`
    : `Plantilla Meta: ${templateName}`;
}

function parseOptionalSchedule(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

function parseAutomationJson(value?: string | null) {
  if (!value) return {};

  const trimmed = value.trim();
  if (!trimmed) return {};

  if (!trimmed.startsWith("{")) {
    return { notas: trimmed };
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
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
  revalidatePath("/whapp/plantillas");
  revalidatePath("/whapp/campanas");
  revalidatePath("/whapp/automatizaciones");

  if (conversacionId) {
    revalidatePath(`/inbox/conversaciones/${conversacionId}`);
    revalidatePath(`/whapp/conversaciones/${conversacionId}`);
  }

  if (canalId) {
    revalidatePath(`/inbox/canales/${canalId}`);
    revalidatePath(`/whapp/canales/${canalId}`);
  }
}

async function countCampaignRecipients(
  supabase: InboxServerClient,
  empresaId: string,
  campaignId: string,
  statuses?: string[],
) {
  let query = supabase
    .from("inbox_campana_destinatarios")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("campana_id", campaignId);

  if (statuses && statuses.length > 0) {
    query = query.in("estado", statuses);
  } else {
    query = query.neq("estado", "excluido");
  }

  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

async function refreshCampaignRecipientMetrics(
  supabase: InboxServerClient,
  empresaId: string,
  profileId: string,
  campaignId: string,
) {
  const [
    recipientCount,
    sentCount,
    deliveredCount,
    readCount,
    repliedCount,
    failedCount,
  ] = await Promise.all([
    countCampaignRecipients(supabase, empresaId, campaignId),
    countCampaignRecipients(supabase, empresaId, campaignId, [
      "enviado",
      "entregado",
      "leido",
      "respondido",
    ]),
    countCampaignRecipients(supabase, empresaId, campaignId, [
      "entregado",
      "leido",
      "respondido",
    ]),
    countCampaignRecipients(supabase, empresaId, campaignId, [
      "leido",
      "respondido",
    ]),
    countCampaignRecipients(supabase, empresaId, campaignId, ["respondido"]),
    countCampaignRecipients(supabase, empresaId, campaignId, ["fallido"]),
  ]);

  if (
    recipientCount === null ||
    sentCount === null ||
    deliveredCount === null ||
    readCount === null ||
    repliedCount === null ||
    failedCount === null
  ) {
    return;
  }

  await supabase
    .from("inbox_campanas")
    .update({
      delivered_count: deliveredCount,
      failed_count: failedCount,
      read_count: readCount,
      recipient_count: recipientCount,
      replied_count: repliedCount,
      sent_count: sentCount,
      updated_by: profileId,
    })
    .eq("empresa_id", empresaId)
    .eq("id", campaignId);
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

  await supabase.rpc("recalcular_salud_modulos_empresa_actual");
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

  await supabase.rpc("recalcular_salud_modulos_empresa_actual");
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

  const access = await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const serviceSupabase = createServiceRoleClient();
  const accessToken = parsed.data.accessToken?.trim() || null;
  const appSecret = parsed.data.appSecret?.trim() || null;
  const verifyToken = parsed.data.verifyToken?.trim() || null;
  const tokenExpiresAt = parsed.data.tokenExpiresAt?.trim() || null;

  const { error } = await serviceSupabase.rpc("guardar_inbox_canal_meta_secretos_server", {
    p_access_token: accessToken,
    p_actor_id: access.tenant.profileId,
    p_app_secret: appSecret,
    p_canal_id: parsed.data.canalId,
    p_empresa_id: access.tenant.empresaId,
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

  await supabase.rpc("recalcular_salud_modulos_empresa_actual");
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

  const access = await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const serviceSupabase = createServiceRoleClient();
  const { data, error } = await serviceSupabase.rpc(
    "regenerar_inbox_canal_verify_token_server",
    {
      p_actor_id: access.tenant.profileId,
      p_canal_id: parsed.data.canalId,
      p_empresa_id: access.tenant.empresaId,
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

export async function upsertMetaTemplateAction(formData: FormData) {
  const parsed = upsertMetaTemplateSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/plantillas", "Datos de plantilla invalidos.");
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/plantillas",
  );
  const supabase = await createClient();
  const variables = parseTemplateVariables(parsed.data.variables);
  const payload = {
    canal_id: parsed.data.canalId ?? null,
    categoria: parsed.data.categoria,
    cuerpo: parsed.data.cuerpo,
    empresa_id: access.tenant.empresaId,
    estado: parsed.data.estado,
    idioma: parsed.data.idioma,
    nombre: parsed.data.nombre,
    rechazo_motivo: parsed.data.rechazoMotivo ?? null,
    updated_by: access.tenant.profileId,
    variables,
  };

  const result = parsed.data.templateId
    ? await supabase
        .from("inbox_meta_plantillas")
        .update(payload)
        .eq("id", parsed.data.templateId)
        .eq("empresa_id", access.tenant.empresaId)
    : await supabase.from("inbox_meta_plantillas").insert({
        ...payload,
        created_by: access.tenant.profileId,
      });

  if (result.error) {
    logInboxActionError("upsertMetaTemplateAction", result.error, {
      templateName: parsed.data.nombre,
    });
    redirectWithError(
      "/whapp/plantillas",
      `No se pudo guardar la plantilla: ${safeErrorMessage(result.error)}`,
    );
  }

  revalidateInboxPaths();
  redirect("/whapp/plantillas?success=Plantilla%20guardada.");
}

export async function upsertInboxCampaignAction(formData: FormData) {
  const parsed = upsertInboxCampaignSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Datos de campana invalidos.");
  }

  const scheduledAt = parseOptionalSchedule(parsed.data.scheduledAt);
  if (scheduledAt === undefined) {
    redirectWithError("/whapp/campanas", "Fecha programada invalida.");
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();

  const [{ data: channel, error: channelError }, { data: template, error: templateError }] =
    await Promise.all([
      supabase
        .from("inbox_canales")
        .select("id, canal, proveedor, estado, conexion_estado")
        .eq("empresa_id", access.tenant.empresaId)
        .eq("id", parsed.data.canalId)
        .maybeSingle<CampaignChannelActionRow>(),
      supabase
        .from("inbox_meta_plantillas")
        .select("id, canal_id, nombre, estado")
        .eq("empresa_id", access.tenant.empresaId)
        .eq("id", parsed.data.templateId)
        .maybeSingle<CampaignTemplateActionRow>(),
    ]);

  if (channelError) {
    logInboxActionError("upsertInboxCampaignAction.getChannel", channelError, {
      canalId: parsed.data.canalId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar el canal.");
  }

  if (!channel || channel.canal !== "whatsapp" || channel.proveedor !== "meta") {
    redirectWithError(
      "/whapp/campanas",
      "Las campanas solo pueden usar canales WhatsApp Meta.",
    );
  }

  if (channel.estado !== "activo" || channel.conexion_estado !== "configurado") {
    redirectWithError(
      "/whapp/campanas",
      "El canal WhatsApp Meta debe estar activo y configurado.",
    );
  }

  if (templateError) {
    logInboxActionError("upsertInboxCampaignAction.getTemplate", templateError, {
      templateId: parsed.data.templateId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar la plantilla.");
  }

  if (!template || template.estado !== "aprobada") {
    redirectWithError(
      "/whapp/campanas",
      "La campana requiere una plantilla aprobada.",
    );
  }

  if (template.canal_id && template.canal_id !== parsed.data.canalId) {
    redirectWithError(
      "/whapp/campanas",
      "La plantilla no pertenece al canal seleccionado.",
    );
  }

  const payload = {
    audiencia: parsed.data.audiencia ? { notas: parsed.data.audiencia } : {},
    canal_id: parsed.data.canalId,
    empresa_id: access.tenant.empresaId,
    estado: parsed.data.estado,
    nombre: parsed.data.nombre,
    objetivo: parsed.data.objetivo ?? null,
    plantilla_id: parsed.data.templateId,
    scheduled_at: scheduledAt,
    updated_by: access.tenant.profileId,
  };

  const result = parsed.data.campaignId
    ? await supabase
        .from("inbox_campanas")
        .update(payload)
        .eq("id", parsed.data.campaignId)
        .eq("empresa_id", access.tenant.empresaId)
    : await supabase.from("inbox_campanas").insert({
        ...payload,
        created_by: access.tenant.profileId,
      });

  if (result.error) {
    logInboxActionError("upsertInboxCampaignAction", result.error, {
      campaignName: parsed.data.nombre,
    });
    redirectWithError(
      "/whapp/campanas",
      `No se pudo guardar la campana: ${safeErrorMessage(result.error)}`,
    );
  }

  revalidateInboxPaths();
  redirect("/whapp/campanas?success=Campana%20guardada.");
}

export async function addInboxCampaignRecipientAction(formData: FormData) {
  const parsed = addInboxCampaignRecipientSchema.safeParse({
    ...getFormData(formData),
    optIn: formData.get("optIn") === "on" || formData.get("optIn") === "true",
  });

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Datos de destinatario invalidos.");
  }

  const variables = parseAutomationJson(parsed.data.variables);
  if (!variables) {
    redirectWithError(
      "/whapp/campanas",
      "Variables debe ser texto simple o JSON valido.",
    );
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("inbox_campanas")
    .select("id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle<CampaignRecipientCampaignRow>();

  if (campaignError) {
    logInboxActionError("addInboxCampaignRecipientAction.getCampaign", campaignError, {
      campaignId: parsed.data.campaignId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar la campana.");
  }

  if (!campaign) {
    redirectWithError("/whapp/campanas", "La campana no existe.");
  }

  if (!["borrador", "programada", "pausada"].includes(campaign.estado)) {
    redirectWithError(
      "/whapp/campanas",
      "Solo puedes cargar audiencia en campanas en borrador, programadas o pausadas.",
    );
  }

  const normalizedPhone = parsed.data.telefono.replace(/[^\d+]/g, "");
  if (normalizedPhone.length < 8) {
    redirectWithError("/whapp/campanas", "Telefono de destinatario invalido.");
  }

  const { error } = await supabase.from("inbox_campana_destinatarios").insert({
    campana_id: parsed.data.campaignId,
    cliente_id: parsed.data.clienteId ?? null,
    conversacion_id: parsed.data.conversacionId ?? null,
    created_by: access.tenant.profileId,
    empresa_id: access.tenant.empresaId,
    estado: "listo",
    external_recipient_id: parsed.data.externalRecipientId ?? null,
    nombre: parsed.data.nombre ?? null,
    opt_in: true,
    opt_in_at: new Date().toISOString(),
    opt_in_source: parsed.data.optInSource,
    telefono: normalizedPhone,
    updated_by: access.tenant.profileId,
    variables,
  });

  if (error) {
    logInboxActionError("addInboxCampaignRecipientAction", error, {
      campaignId: parsed.data.campaignId,
      telefono: normalizedPhone,
    });
    redirectWithError(
      "/whapp/campanas",
      `No se pudo agregar destinatario: ${safeErrorMessage(error)}`,
    );
  }

  await refreshCampaignRecipientMetrics(
    supabase,
    access.tenant.empresaId,
    access.tenant.profileId,
    parsed.data.campaignId,
  );

  revalidateInboxPaths();
  redirect("/whapp/campanas?success=Destinatario%20agregado.");
}

export async function prepareInboxCampaignQueueAction(formData: FormData) {
  const parsed = prepareInboxCampaignQueueSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Campana invalida.");
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("inbox_campanas")
    .select("id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle<CampaignRecipientCampaignRow>();

  if (campaignError) {
    logInboxActionError("prepareInboxCampaignQueueAction.getCampaign", campaignError, {
      campaignId: parsed.data.campaignId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar la campana.");
  }

  if (!campaign) {
    redirectWithError("/whapp/campanas", "La campana no existe.");
  }

  if (!["borrador", "programada", "pausada"].includes(campaign.estado)) {
    redirectWithError(
      "/whapp/campanas",
      "Solo puedes preparar campanas en borrador, programadas o pausadas.",
    );
  }

  const readyCount = await countCampaignRecipients(
    supabase,
    access.tenant.empresaId,
    parsed.data.campaignId,
    ["listo"],
  );

  if (!readyCount) {
    redirectWithError(
      "/whapp/campanas",
      "La campana no tiene destinatarios listos con opt-in.",
    );
  }

  const { error: queueError } = await supabase
    .from("inbox_campana_destinatarios")
    .update({
      estado: "en_cola",
      last_error: null,
      updated_by: access.tenant.profileId,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("campana_id", parsed.data.campaignId)
    .eq("estado", "listo")
    .eq("opt_in", true);

  if (queueError) {
    logInboxActionError("prepareInboxCampaignQueueAction.queue", queueError, {
      campaignId: parsed.data.campaignId,
    });
    redirectWithError("/whapp/campanas", "No se pudo preparar la cola.");
  }

  const { error: campaignUpdateError } = await supabase
    .from("inbox_campanas")
    .update({
      estado: "enviando",
      updated_by: access.tenant.profileId,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId);

  if (campaignUpdateError) {
    logInboxActionError(
      "prepareInboxCampaignQueueAction.updateCampaign",
      campaignUpdateError,
      { campaignId: parsed.data.campaignId },
    );
    redirectWithError("/whapp/campanas", "No se pudo activar la campana.");
  }

  await refreshCampaignRecipientMetrics(
    supabase,
    access.tenant.empresaId,
    access.tenant.profileId,
    parsed.data.campaignId,
  );

  revalidateInboxPaths();
  redirect("/whapp/campanas?success=Cola%20preparada.");
}

export async function dispatchInboxCampaignBatchAction(formData: FormData) {
  const parsed = dispatchInboxCampaignBatchSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Campana invalida para despacho.");
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("inbox_campanas")
    .select("id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle<CampaignRecipientCampaignRow>();

  if (campaignError) {
    logInboxActionError("dispatchInboxCampaignBatchAction.getCampaign", campaignError, {
      campaignId: parsed.data.campaignId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar la campana.");
  }

  if (!campaign) {
    redirectWithError("/whapp/campanas", "La campana no existe.");
  }

  if (campaign.estado !== "enviando") {
    redirectWithError(
      "/whapp/campanas",
      "Solo puedes despachar campanas en estado enviando.",
    );
  }

  const result = await dispatchInboxCampaignBatch({
    campaignId: parsed.data.campaignId,
    empresaId: access.tenant.empresaId,
    limit: 3,
  });

  if ("error" in result && result.error) {
    redirectWithError(
      "/whapp/campanas",
      `No se pudo despachar la campana: ${result.error}`,
    );
  }

  const sent = result.results.filter((item) => item.status === "sent").length;
  const failed = result.results.filter((item) => item.status === "failed").length;
  const retrying = result.results.filter((item) => item.status === "retrying").length;

  revalidateInboxPaths();

  if (result.processed === 0) {
    redirectWithError("/whapp/campanas", "No hay destinatarios en cola.");
  }

  redirect(
    `/whapp/campanas?success=Lote%20despachado:%20${sent}%20enviados,%20${failed}%20fallidos,%20${retrying}%20en%20reintento.`,
  );
}

export async function updateInboxCampaignStatusAction(formData: FormData) {
  const parsed = updateInboxCampaignStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Estado de campana invalido.");
  }

  if (!["borrador", "programada", "pausada", "cancelada"].includes(parsed.data.estado)) {
    redirectWithError(
      "/whapp/campanas",
      "Este estado no se puede aplicar manualmente desde campanas.",
    );
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("inbox_campanas")
    .select("id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId)
    .maybeSingle<CampaignRecipientCampaignRow>();

  if (campaignError) {
    logInboxActionError("updateInboxCampaignStatusAction.getCampaign", campaignError, {
      campaignId: parsed.data.campaignId,
    });
    redirectWithError("/whapp/campanas", "No se pudo validar la campana.");
  }

  if (!campaign) {
    redirectWithError("/whapp/campanas", "La campana no existe.");
  }

  if (campaign.estado === "enviada") {
    redirectWithError("/whapp/campanas", "Una campana enviada no puede reabrirse.");
  }

  const { error } = await supabase
    .from("inbox_campanas")
    .update({
      estado: parsed.data.estado,
      updated_by: access.tenant.profileId,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.campaignId);

  if (error) {
    logInboxActionError("updateInboxCampaignStatusAction", error, {
      campaignId: parsed.data.campaignId,
      status: parsed.data.estado,
    });
    redirectWithError("/whapp/campanas", "No se pudo cambiar el estado.");
  }

  revalidateInboxPaths();
  redirect("/whapp/campanas?success=Estado%20actualizado.");
}

export async function updateInboxCampaignRecipientStatusAction(formData: FormData) {
  const parsed = updateInboxCampaignRecipientStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/whapp/campanas", "Estado de destinatario invalido.");
  }

  const allowedStatuses = ["listo", "fallido", "excluido"] as const;
  if (!allowedStatuses.includes(parsed.data.estado as (typeof allowedStatuses)[number])) {
    redirectWithError(
      "/whapp/campanas",
      "Este estado de destinatario no se puede aplicar manualmente.",
    );
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/campanas",
  );
  const supabase = await createClient();
  const { data: recipient, error: recipientError } = await supabase
    .from("inbox_campana_destinatarios")
    .select("id, campana_id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.recipientId)
    .maybeSingle<CampaignRecipientStatusRow>();

  if (recipientError) {
    logInboxActionError(
      "updateInboxCampaignRecipientStatusAction.getRecipient",
      recipientError,
      { recipientId: parsed.data.recipientId },
    );
    redirectWithError("/whapp/campanas", "No se pudo validar el destinatario.");
  }

  if (!recipient) {
    redirectWithError("/whapp/campanas", "El destinatario no existe.");
  }

  if (["enviado", "entregado", "leido", "respondido"].includes(recipient.estado)) {
    redirectWithError(
      "/whapp/campanas",
      "No se puede cambiar manualmente un destinatario con tracking de envio.",
    );
  }

  const { error } = await supabase
    .from("inbox_campana_destinatarios")
    .update({
      estado: parsed.data.estado,
      last_error: parsed.data.estado === "fallido" ? parsed.data.lastError : null,
      updated_by: access.tenant.profileId,
    })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.recipientId);

  if (error) {
    logInboxActionError("updateInboxCampaignRecipientStatusAction", error, {
      recipientId: parsed.data.recipientId,
      status: parsed.data.estado,
    });
    redirectWithError("/whapp/campanas", "No se pudo actualizar el destinatario.");
  }

  await refreshCampaignRecipientMetrics(
    supabase,
    access.tenant.empresaId,
    access.tenant.profileId,
    recipient.campana_id,
  );

  revalidateInboxPaths();
  redirect("/whapp/campanas?success=Destinatario%20actualizado.");
}

export async function upsertInboxAutomationRuleAction(formData: FormData) {
  const parsed = upsertInboxAutomationRuleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(
      "/whapp/automatizaciones",
      "Datos de automatizacion invalidos.",
    );
  }

  const condiciones = parseAutomationJson(parsed.data.condiciones);
  const accionConfig = parseAutomationJson(parsed.data.accionConfig);

  if (!condiciones || !accionConfig) {
    redirectWithError(
      "/whapp/automatizaciones",
      "Condiciones y configuracion deben ser texto simple o JSON valido.",
    );
  }

  const access = await assertInboxPermission(
    "inbox.channels.manage",
    "/whapp/automatizaciones",
  );
  const supabase = await createClient();

  if (parsed.data.canalId) {
    const { data: channel, error } = await supabase
      .from("inbox_canales")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", parsed.data.canalId)
      .maybeSingle<AutomationChannelActionRow>();

    if (error) {
      logInboxActionError("upsertInboxAutomationRuleAction.getChannel", error, {
        canalId: parsed.data.canalId,
      });
      redirectWithError(
        "/whapp/automatizaciones",
        "No se pudo validar el canal.",
      );
    }

    if (!channel) {
      redirectWithError(
        "/whapp/automatizaciones",
        "El canal seleccionado no pertenece a la empresa.",
      );
    }
  }

  const payload = {
    accion_config: accionConfig,
    accion_tipo: parsed.data.accionTipo,
    canal_id: parsed.data.canalId ?? null,
    condiciones,
    descripcion: parsed.data.descripcion ?? null,
    empresa_id: access.tenant.empresaId,
    estado: parsed.data.estado,
    modo: parsed.data.modo,
    nombre: parsed.data.nombre,
    prioridad: parsed.data.prioridad,
    trigger_tipo: parsed.data.triggerTipo,
    updated_by: access.tenant.profileId,
  };

  const result = parsed.data.automationId
    ? await supabase
        .from("inbox_automatizaciones")
        .update(payload)
        .eq("id", parsed.data.automationId)
        .eq("empresa_id", access.tenant.empresaId)
    : await supabase.from("inbox_automatizaciones").insert({
        ...payload,
        created_by: access.tenant.profileId,
      });

  if (result.error) {
    logInboxActionError("upsertInboxAutomationRuleAction", result.error, {
      automationName: parsed.data.nombre,
    });
    redirectWithError(
      "/whapp/automatizaciones",
      `No se pudo guardar la automatizacion: ${safeErrorMessage(result.error)}`,
    );
  }

  revalidateInboxPaths();
  redirect("/whapp/automatizaciones?success=Automatizacion%20guardada.");
}

export async function recordInboxAutomationExecutionAction(formData: FormData) {
  const parsed = recordInboxAutomationExecutionSchema.safeParse({
    ...getFormData(formData),
    estado: formData.get("estado") ?? "sugerida",
  });
  const redirectTo = getSafeRedirectPath(
    formData.get("redirectTo"),
    "/whapp/conversaciones",
  );

  if (!parsed.success) {
    redirectWithError(redirectTo, "Datos de autopilot invalidos.");
  }

  const access = await assertInboxPermission(
    "inbox.conversations.reply",
    redirectTo,
  );
  const supabase = await createClient();

  const [{ data: automation, error: automationError }, { data: conversation, error: conversationError }] =
    await Promise.all([
      supabase
        .from("inbox_automatizaciones")
        .select("id, canal_id, estado")
        .eq("empresa_id", access.tenant.empresaId)
        .eq("id", parsed.data.automationId)
        .maybeSingle<AutomationExecutionValidationRow>(),
      supabase
        .from("inbox_conversaciones")
        .select("id, canal_id")
        .eq("empresa_id", access.tenant.empresaId)
        .eq("id", parsed.data.conversacionId)
        .maybeSingle<AutomationExecutionConversationRow>(),
    ]);

  if (automationError) {
    logInboxActionError(
      "recordInboxAutomationExecutionAction.getAutomation",
      automationError,
      { automationId: parsed.data.automationId },
    );
    redirectWithError(redirectTo, "No se pudo validar la automatizacion.");
  }

  if (conversationError) {
    logInboxActionError(
      "recordInboxAutomationExecutionAction.getConversation",
      conversationError,
      { conversacionId: parsed.data.conversacionId },
    );
    redirectWithError(redirectTo, "No se pudo validar la conversacion.");
  }

  if (!automation || automation.estado !== "activa") {
    redirectWithError(redirectTo, "La automatizacion no esta activa.");
  }

  if (!conversation) {
    redirectWithError(redirectTo, "La conversacion no existe.");
  }

  if (automation.canal_id && automation.canal_id !== conversation.canal_id) {
    redirectWithError(
      redirectTo,
      "La automatizacion no aplica al canal de esta conversacion.",
    );
  }

  const resultText = parsed.data.resultado ?? "Decision registrada desde Whapp.";
  const { error } = await supabase.from("inbox_automatizacion_ejecuciones").insert({
    automatizacion_id: parsed.data.automationId,
    conversacion_id: parsed.data.conversacionId,
    created_by: access.tenant.profileId,
    empresa_id: access.tenant.empresaId,
    estado: parsed.data.estado,
    resultado: { nota: resultText },
  });

  if (error) {
    logInboxActionError("recordInboxAutomationExecutionAction", error, {
      automationId: parsed.data.automationId,
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectTo,
      `No se pudo auditar autopilot: ${safeErrorMessage(error)}`,
    );
  }

  await supabase
    .from("inbox_automatizaciones")
    .update({ ultima_ejecucion_at: new Date().toISOString() })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.automationId);

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(`${redirectTo}?success=Autopilot%20auditado.`);
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

  const access = await assertInboxPermission("inbox.conversations.reply", redirectPath);

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

  const serviceSupabase = createServiceRoleClient();
  const { data, error } = await serviceSupabase.rpc(
    "obtener_inbox_whatsapp_send_config_server",
    {
      p_actor_id: access.tenant.profileId,
      p_conversacion_id: parsed.data.conversacionId,
      p_empresa_id: access.tenant.empresaId,
    },
  );

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

export async function sendWhatsAppTemplateAction(formData: FormData) {
  const parsed = sendWhatsAppTemplateSchema.safeParse({
    conversacionId: formData.get("conversacionId"),
    templateId: formData.get("templateId"),
    variables: formData.get("variables"),
  });
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/whapp/conversaciones/${formData.get("conversacionId")}`
      : "/whapp/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Datos de plantilla invalidos.");
  }

  const access = await assertInboxPermission("inbox.conversations.reply", redirectPath);
  const supabase = await createClient();
  const [{ data: conversation, error: conversationError }, { data: template, error: templateError }] =
    await Promise.all([
      supabase
        .from("inbox_conversaciones")
        .select(
          "id, canal_id, canal, canal_rel:inbox_canales!inbox_conversaciones_canal_empresa_fkey(id, nombre, canal, proveedor, estado, conexion_estado, configuracion_publica)",
        )
        .eq("id", parsed.data.conversacionId)
        .maybeSingle<WhatsAppSendConversationRow>(),
      supabase
        .from("inbox_meta_plantillas")
        .select("id, canal_id, nombre, idioma, categoria, estado, cuerpo, variables")
        .eq("id", parsed.data.templateId)
        .eq("empresa_id", access.tenant.empresaId)
        .maybeSingle<MetaTemplateActionRow>(),
    ]);

  if (conversationError) {
    logInboxActionError(
      "sendWhatsAppTemplateAction.getConversation",
      conversationError,
      { conversacionId: parsed.data.conversacionId },
    );
    redirectWithError(
      redirectPath,
      `No se pudo validar el canal asociado: ${safeErrorMessage(conversationError)}`,
    );
  }

  if (templateError) {
    logInboxActionError("sendWhatsAppTemplateAction.getTemplate", templateError, {
      templateId: parsed.data.templateId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo validar la plantilla: ${safeErrorMessage(templateError)}`,
    );
  }

  if (!conversation) {
    redirectWithError(redirectPath, "Conversacion no encontrada.");
  }

  if (!template) {
    redirectWithError(redirectPath, "Plantilla no encontrada.");
  }

  if (template.estado !== "aprobada") {
    redirectWithError(redirectPath, "Solo se pueden enviar plantillas aprobadas.");
  }

  if (template.canal_id && template.canal_id !== conversation.canal_id) {
    redirectWithError(
      redirectPath,
      "La plantilla pertenece a otro canal WhatsApp.",
    );
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

  if (channel.estado !== "activo" || channel.conexion_estado !== "configurado") {
    redirectWithError(
      redirectPath,
      `El canal asociado no esta activo/configurado. Estado: ${channel.estado}. Conexion: ${channel.conexion_estado}.`,
    );
  }

  if (!channelPhoneNumberId) {
    redirectWithError(
      redirectPath,
      `El canal ${channelName} no tiene phone_number_id configurado.`,
    );
  }

  const serviceSupabase = createServiceRoleClient();
  const { data, error } = await serviceSupabase.rpc(
    "obtener_inbox_whatsapp_send_config_server",
    {
      p_actor_id: access.tenant.profileId,
      p_conversacion_id: parsed.data.conversacionId,
      p_empresa_id: access.tenant.empresaId,
    },
  );

  if (error) {
    logInboxActionError("sendWhatsAppTemplateAction.getConfig", error, {
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

  const variableValues = parseTemplateVariables(parsed.data.variables);
  const endpoint = buildWhatsAppMessagesEndpoint(channelPhoneNumberId);

  console.info("[sendWhatsAppTemplateAction] WhatsApp template send", {
    canalId: channel.id,
    channelName,
    conversationId: parsed.data.conversacionId,
    endpoint,
    graphVersion: META_GRAPH_API_VERSION,
    phoneNumberId: channelPhoneNumberId,
    templateName: template.nombre,
    to: config.to_phone,
    variableCount: variableValues.length,
  });

  const result = await sendWhatsAppTemplateMessage({
    accessToken: config.access_token,
    components: buildTemplateBodyComponents(variableValues),
    languageCode: template.idioma,
    name: template.nombre,
    phoneNumberId: channelPhoneNumberId,
    to: config.to_phone,
  });
  const preview = buildTemplatePreview(template.nombre, variableValues);

  const { error: registerError } = await supabase.rpc(
    "registrar_inbox_mensaje_saliente_meta",
    {
      p_canal_message_id: result.ok ? result.messageId : null,
      p_contenido: preview,
      p_conversacion_id: parsed.data.conversacionId,
      p_error: result.ok
        ? null
        : `Canal: ${channelName}. Phone Number ID usado: ${channelPhoneNumberId}. Meta: ${result.error}`,
      p_estado: result.ok ? "enviado" : "fallido",
    },
  );

  if (registerError) {
    logInboxActionError("sendWhatsAppTemplateAction.register", registerError, {
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
      `No se pudo enviar la plantilla por WhatsApp. Canal: ${channelName}. Phone Number ID usado: ${channelPhoneNumberId}. Meta: ${result.error}`,
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

export async function markInboxConversationReadAction(formData: FormData) {
  const parsed = markInboxConversationReadSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/whapp/conversaciones/${formData.get("conversacionId")}`
      : "/whapp/conversaciones";
  const redirectPath = getSafeRedirectPath(formData.get("redirectTo"), fallbackPath);

  if (!parsed.success) {
    redirectWithError(redirectPath, "Conversacion invalida.");
  }

  const access = await requireAdminAccess();

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "inbox.conversations.view",
      "inbox.conversations.reply",
      "inbox.conversations.assign",
    ])
  ) {
    redirectWithError(redirectPath, "No tienes permiso para marcar lectura.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_inbox_conversacion_leida", {
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("markInboxConversationReadAction", error, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo marcar como leida: ${safeErrorMessage(error)}`,
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
