import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  INBOX_SLA_FIRST_RESPONSE_MINUTES,
  INBOX_SLA_WARNING_MINUTES,
} from "@/modules/inbox/constants";
import type {
  InboxAssignableUser,
  InboxAutomationRule,
  InboxCampaign,
  InboxCampaignRecipient,
  InboxChannelConfig,
  InboxConversation,
  InboxConversationMetaSendStatus,
  InboxCustomer,
  InboxEvent,
  InboxMetaChannelDiagnostic,
  InboxMetaChannelStatus,
  InboxMetaTemplate,
  InboxMessage,
  InboxSlaStatus,
  InboxSummary,
  InboxWebhookEvent,
} from "@/modules/inbox/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type ChannelRow = {
  canal: InboxChannelConfig["canal"];
  conexion_estado: InboxChannelConfig["conexionEstado"];
  configuracion_publica: JsonRecord;
  created_at: string;
  created_by: string | null;
  estado: InboxChannelConfig["estado"];
  id: string;
  identificador_externo: string | null;
  nombre: string;
  proveedor: InboxChannelConfig["proveedor"];
  proveedor_estado: string | null;
  ultima_verificacion_at: string | null;
  updated_at: string;
  updated_by: string | null;
  webhook_url: string | null;
};

type MetaStatusRow = {
  access_token_suffix?: string | null;
  access_token_updated_at?: string | null;
  canal: InboxMetaChannelStatus["canal"];
  canal_id: string;
  conexion_estado: InboxMetaChannelStatus["conexionEstado"];
  proveedor: InboxMetaChannelStatus["proveedor"];
  tiene_access_token: boolean;
  tiene_app_secret: boolean;
  tiene_verify_token: boolean;
  token_expires_at: string | null;
  webhook_url: string | null;
};

type ConversationRow = {
  asignado: NameRelation | NameRelation[] | null;
  asignado_a: string | null;
  canal: InboxConversation["canal"];
  canal_id: string | null;
  canal_rel: NameRelation | NameRelation[] | null;
  cerrada_at: string | null;
  cliente_id: string | null;
  contacto_identificador: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_usuario: string | null;
  created_at: string;
  crm_clientes: NameRelation | NameRelation[] | null;
  estado: InboxConversation["estado"];
  id: string;
  prioridad: InboxConversation["prioridad"];
  ultimo_mensaje: string | null;
  ultimo_mensaje_at: string | null;
  updated_at: string;
};

type MessageRow = {
  canal_message_id: string | null;
  contenido: string | null;
  conversacion_id: string;
  created_at: string;
  direccion: InboxMessage["direccion"];
  enviado_por: string | null;
  es_nota_interna: boolean;
  estado: InboxMessage["estado"];
  id: string;
  profiles: NameRelation | NameRelation[] | null;
  received_at: string | null;
  sent_at: string | null;
  tipo: InboxMessage["tipo"];
};

type UnreadMessageRow = {
  conversacion_id: string;
  created_at: string;
};

type ConversationReadRow = {
  conversacion_id: string;
  read_at: string;
};

type ConversationSignal = {
  lastIncomingAt: string | null;
  unreadCount: number;
};

type EventRow = {
  created_at: string;
  created_by: string | null;
  descripcion: string | null;
  id: string;
  metadata: JsonRecord;
  profiles: NameRelation | NameRelation[] | null;
  tipo: string;
};

type WebhookEventRow = {
  canal: string | null;
  canal_id: string | null;
  error: string | null;
  event_type: string | null;
  external_message_id: string | null;
  external_recipient_id: string | null;
  external_sender_id: string | null;
  id: string;
  object_type: string | null;
  procesado: boolean;
  received_at: string;
};

type MetaTemplateRow = {
  canal_id: string | null;
  canal_rel: NameRelation | NameRelation[] | null;
  categoria: InboxMetaTemplate["categoria"];
  cuerpo: string;
  estado: InboxMetaTemplate["estado"];
  id: string;
  idioma: string;
  meta_template_id: string | null;
  nombre: string;
  rechazo_motivo: string | null;
  updated_at: string;
  variables: unknown;
};

type CampaignTemplateRelation = {
  categoria: InboxCampaign["plantillaCategoria"];
  estado: InboxCampaign["plantillaEstado"];
  idioma: string | null;
  nombre: string | null;
};

type CampaignRow = {
  audiencia: unknown;
  canal_id: string;
  canal_rel: NameRelation | NameRelation[] | null;
  created_at: string;
  delivered_count: number;
  estado: InboxCampaign["estado"];
  failed_count: number;
  id: string;
  nombre: string;
  objetivo: string | null;
  plantilla_id: string;
  plantilla_rel: CampaignTemplateRelation | CampaignTemplateRelation[] | null;
  read_count: number;
  recipient_count: number;
  replied_count: number;
  scheduled_at: string | null;
  sent_count: number;
  updated_at: string;
};

type CampaignRecipientRow = {
  attempt_count: number;
  campana_id: string;
  canal_message_id: string | null;
  cliente_id: string | null;
  conversacion_id: string | null;
  created_at: string;
  delivered_at: string | null;
  estado: InboxCampaignRecipient["estado"];
  external_recipient_id: string | null;
  id: string;
  last_attempt_at: string | null;
  last_error: string | null;
  nombre: string | null;
  opt_in: boolean;
  opt_in_at: string | null;
  opt_in_source: string | null;
  read_at: string | null;
  replied_at: string | null;
  sent_at: string | null;
  telefono: string;
  updated_at: string;
  variables: unknown;
};

type AutomationRow = {
  accion_config: unknown;
  accion_tipo: InboxAutomationRule["accionTipo"];
  canal_id: string | null;
  canal_rel: NameRelation | NameRelation[] | null;
  condiciones: unknown;
  created_at: string;
  descripcion: string | null;
  estado: InboxAutomationRule["estado"];
  id: string;
  modo: InboxAutomationRule["modo"];
  nombre: string;
  prioridad: number;
  trigger_tipo: InboxAutomationRule["triggerTipo"];
  ultima_ejecucion_at: string | null;
  updated_at: string;
};

type AutomationExecutionRow = {
  automatizacion_id: string;
  estado: "ejecutada" | "fallida" | "omitida" | "sugerida";
};

type UserRow = {
  id: string;
  nombre: string;
};

type CustomerRow = {
  id: string;
  nombre: string;
  telefono: string | null;
  whatsapp: string | null;
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function getTenant(): Promise<CoreResult<TenantContext>> {
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok) return tenant;
  if (!tenant.data) {
    return fail("INVALID_TENANT_CONTEXT", "No hay empresa activa.");
  }

  return ok(tenant.data);
}

function canViewChannels(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);
}

function canViewConversations(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.conversations.assign",
  ]);
}

export function canAccessInboxNav(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.channels.view",
  ]);
}

function mapChannel(row: ChannelRow): InboxChannelConfig {
  return {
    canal: row.canal,
    conexionEstado: row.conexion_estado,
    configuracionPublica: row.configuracion_publica,
    createdAt: row.created_at,
    createdBy: row.created_by,
    estado: row.estado,
    id: row.id,
    identificadorExterno: row.identificador_externo,
    nombre: row.nombre,
    proveedor: row.proveedor,
    proveedorEstado: row.proveedor_estado,
    ultimaVerificacionAt: row.ultima_verificacion_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    webhookUrl: row.webhook_url,
  };
}

function mapMetaStatus(row: MetaStatusRow): InboxMetaChannelStatus {
  return {
    accessTokenSuffix: row.access_token_suffix ?? null,
    accessTokenUpdatedAt: row.access_token_updated_at ?? null,
    canal: row.canal,
    canalId: row.canal_id,
    conexionEstado: row.conexion_estado,
    proveedor: row.proveedor,
    tieneAccessToken: row.tiene_access_token,
    tieneAppSecret: row.tiene_app_secret,
    tieneVerifyToken: row.tiene_verify_token,
    tokenExpiresAt: row.token_expires_at,
    webhookUrl: row.webhook_url,
  };
}

function mapWebhookEvent(row: WebhookEventRow): InboxWebhookEvent {
  return {
    canal: row.canal,
    canalId: row.canal_id,
    error: row.error,
    eventType: row.event_type,
    externalMessageId: row.external_message_id,
    externalRecipientId: row.external_recipient_id,
    externalSenderId: row.external_sender_id,
    id: row.id,
    objectType: row.object_type,
    procesado: row.procesado,
    receivedAt: row.received_at,
  };
}

function mapConversation(
  row: ConversationRow,
  signalsByConversation = new Map<string, ConversationSignal>(),
): InboxConversation {
  const signals = signalsByConversation.get(row.id) ?? {
    lastIncomingAt: null,
    unreadCount: 0,
  };
  const sla = calculateSla(row.estado, signals);

  return {
    asignadoA: row.asignado_a,
    asignadoNombre: firstRelation(row.asignado)?.nombre ?? null,
    canal: row.canal,
    canalId: row.canal_id,
    canalNombre: firstRelation(row.canal_rel)?.nombre ?? null,
    cerradaAt: row.cerrada_at,
    clienteId: row.cliente_id,
    clienteNombre: firstRelation(row.crm_clientes)?.nombre ?? null,
    contactoIdentificador: row.contacto_identificador,
    contactoNombre: row.contacto_nombre,
    contactoTelefono: row.contacto_telefono,
    contactoUsuario: row.contacto_usuario,
    createdAt: row.created_at,
    estado: row.estado,
    id: row.id,
    lastIncomingAt: signals.lastIncomingAt,
    prioridad: row.prioridad,
    slaDueAt: sla.dueAt,
    slaStatus: sla.status,
    ultimoMensaje: row.ultimo_mensaje,
    ultimoMensajeAt: row.ultimo_mensaje_at,
    unreadCount: signals.unreadCount,
    updatedAt: row.updated_at,
  };
}

function addMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function calculateSla(
  status: InboxConversation["estado"],
  signals: ConversationSignal,
): { dueAt: string | null; status: InboxSlaStatus } {
  if (status === "cerrada" || status === "spam") {
    return { dueAt: null, status: "pausado" };
  }

  if (!signals.lastIncomingAt || signals.unreadCount === 0) {
    return { dueAt: null, status: "ok" };
  }

  const dueAt = addMinutes(signals.lastIncomingAt, INBOX_SLA_FIRST_RESPONSE_MINUTES);
  const now = Date.now();
  const dueTime = new Date(dueAt).getTime();

  if (now > dueTime) {
    return { dueAt, status: "vencido" };
  }

  if (dueTime - now <= INBOX_SLA_WARNING_MINUTES * 60 * 1000) {
    return { dueAt, status: "riesgo" };
  }

  return { dueAt, status: "ok" };
}

async function getConversationSignalsForCurrentProfile(
  tenant: TenantContext,
  conversationIds: string[],
) {
  if (conversationIds.length === 0) return new Map<string, ConversationSignal>();

  const supabase = await createClient();
  const [reads, incomingMessages] = await Promise.all([
    supabase
      .from("inbox_conversacion_lecturas")
      .select("conversacion_id, read_at")
      .eq("empresa_id", tenant.empresaId)
      .eq("profile_id", tenant.profileId)
      .in("conversacion_id", conversationIds),
    supabase
      .from("inbox_mensajes")
      .select("conversacion_id, created_at")
      .eq("empresa_id", tenant.empresaId)
      .eq("direccion", "entrante")
      .eq("es_nota_interna", false)
      .in("conversacion_id", conversationIds),
  ]);

  if (incomingMessages.error) return new Map<string, ConversationSignal>();

  const readAtByConversation = new Map<string, string>();
  for (const row of ((reads.data ?? []) as ConversationReadRow[])) {
    readAtByConversation.set(row.conversacion_id, row.read_at);
  }

  const signals = new Map<string, ConversationSignal>();
  for (const row of ((incomingMessages.data ?? []) as UnreadMessageRow[])) {
    const readAt = readAtByConversation.get(row.conversacion_id);
    const current = signals.get(row.conversacion_id) ?? {
      lastIncomingAt: null,
      unreadCount: 0,
    };

    if (!current.lastIncomingAt || row.created_at > current.lastIncomingAt) {
      current.lastIncomingAt = row.created_at;
    }

    if (!readAt || row.created_at > readAt) {
      current.unreadCount += 1;
    }

    signals.set(row.conversacion_id, current);
  }

  return signals;
}

function mapMessage(row: MessageRow): InboxMessage {
  return {
    canalMessageId: row.canal_message_id,
    contenido: row.contenido,
    conversacionId: row.conversacion_id,
    createdAt: row.created_at,
    direccion: row.direccion,
    enviadoPor: row.enviado_por,
    enviadoPorNombre: firstRelation(row.profiles)?.nombre ?? null,
    esNotaInterna: row.es_nota_interna,
    estado: row.estado,
    id: row.id,
    receivedAt: row.received_at,
    sentAt: row.sent_at,
    tipo: row.tipo,
  };
}

function mapEvent(row: EventRow): InboxEvent {
  return {
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByNombre: firstRelation(row.profiles)?.nombre ?? null,
    descripcion: row.descripcion,
    id: row.id,
    metadata: row.metadata,
    tipo: row.tipo,
  };
}

function mapTemplate(row: MetaTemplateRow): InboxMetaTemplate {
  const variables = Array.isArray(row.variables)
    ? row.variables.filter((value): value is string => typeof value === "string")
    : [];

  return {
    canalId: row.canal_id,
    canalNombre: firstRelation(row.canal_rel)?.nombre ?? null,
    categoria: row.categoria,
    cuerpo: row.cuerpo,
    estado: row.estado,
    id: row.id,
    idioma: row.idioma,
    metaTemplateId: row.meta_template_id,
    nombre: row.nombre,
    rechazoMotivo: row.rechazo_motivo,
    updatedAt: row.updated_at,
    variables,
  };
}

function mapCampaign(row: CampaignRow): InboxCampaign {
  const template = firstRelation(row.plantilla_rel);
  const audiencia =
    row.audiencia && typeof row.audiencia === "object" && !Array.isArray(row.audiencia)
      ? (row.audiencia as JsonRecord)
      : {};

  return {
    audiencia,
    canalId: row.canal_id,
    canalNombre: firstRelation(row.canal_rel)?.nombre ?? null,
    createdAt: row.created_at,
    deliveredCount: row.delivered_count,
    estado: row.estado,
    failedCount: row.failed_count,
    id: row.id,
    nombre: row.nombre,
    objetivo: row.objetivo,
    plantillaCategoria: template?.categoria ?? null,
    plantillaEstado: template?.estado ?? null,
    plantillaId: row.plantilla_id,
    plantillaIdioma: template?.idioma ?? null,
    plantillaNombre: template?.nombre ?? null,
    readCount: row.read_count,
    recipientCount: row.recipient_count,
    repliedCount: row.replied_count,
    scheduledAt: row.scheduled_at,
    sentCount: row.sent_count,
    updatedAt: row.updated_at,
  };
}

function mapCampaignRecipient(row: CampaignRecipientRow): InboxCampaignRecipient {
  return {
    attemptCount: row.attempt_count,
    campaignId: row.campana_id,
    canalMessageId: row.canal_message_id,
    clienteId: row.cliente_id,
    conversacionId: row.conversacion_id,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    estado: row.estado,
    externalRecipientId: row.external_recipient_id,
    id: row.id,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
    nombre: row.nombre,
    optIn: row.opt_in,
    optInAt: row.opt_in_at,
    optInSource: row.opt_in_source,
    readAt: row.read_at,
    repliedAt: row.replied_at,
    sentAt: row.sent_at,
    telefono: row.telefono,
    updatedAt: row.updated_at,
    variables: mapJsonRecord(row.variables),
  };
}

function mapJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function mapAutomation(
  row: AutomationRow,
  executionStats = new Map<
    string,
    { executed: number; failed: number; total: number }
  >(),
): InboxAutomationRule {
  const stats = executionStats.get(row.id) ?? {
    executed: 0,
    failed: 0,
    total: 0,
  };

  return {
    accionConfig: mapJsonRecord(row.accion_config),
    accionTipo: row.accion_tipo,
    canalId: row.canal_id,
    canalNombre: firstRelation(row.canal_rel)?.nombre ?? null,
    condiciones: mapJsonRecord(row.condiciones),
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    executionCount: stats.total,
    failedExecutionCount: stats.failed,
    id: row.id,
    modo: row.modo,
    nombre: row.nombre,
    prioridad: row.prioridad,
    successfulExecutionCount: stats.executed,
    triggerTipo: row.trigger_tipo,
    ultimaEjecucionAt: row.ultima_ejecucion_at,
    updatedAt: row.updated_at,
  };
}

export async function getInboxSummary(): Promise<CoreResult<InboxSummary>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  const supabase = await createClient();
  const [open, pending, closed, channels] = await Promise.all([
    supabase
      .from("inbox_conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.data.empresaId)
      .eq("estado", "abierta"),
    supabase
      .from("inbox_conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.data.empresaId)
      .eq("estado", "pendiente"),
    supabase
      .from("inbox_conversaciones")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.data.empresaId)
      .eq("estado", "cerrada"),
    supabase
      .from("inbox_canales")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", tenant.data.empresaId)
      .eq("estado", "activo"),
  ]);

  return ok({
    activeChannels: channels.count ?? 0,
    openConversations: open.count ?? 0,
    pendingConversations: pending.count ?? 0,
    recentlyClosedConversations: closed.count ?? 0,
  });
}

export async function getInboxChannels(): Promise<CoreResult<InboxChannelConfig[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_canales")
    .select(
      "id, canal, proveedor, nombre, identificador_externo, estado, conexion_estado, proveedor_estado, ultima_verificacion_at, webhook_url, configuracion_publica, created_by, updated_by, created_at, updated_at",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("created_at", { ascending: false });

  if (error) return fail("PERMISSION_DENIED", "No se pudieron consultar canales.", error);

  return ok(((data ?? []) as ChannelRow[]).map(mapChannel));
}

export async function getInboxChannelDetail(
  canalId: string,
): Promise<CoreResult<InboxChannelConfig | null>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_canales")
    .select(
      "id, canal, proveedor, nombre, identificador_externo, estado, conexion_estado, proveedor_estado, ultima_verificacion_at, webhook_url, configuracion_publica, created_by, updated_by, created_at, updated_at",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("id", canalId)
    .maybeSingle<ChannelRow>();

  if (error) return fail("PERMISSION_DENIED", "No se pudo consultar el canal.", error);

  return ok(data ? mapChannel(data) : null);
}

export async function getInboxChannelMetaStatus(
  canalId: string,
): Promise<CoreResult<InboxMetaChannelStatus | null>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_inbox_canal_meta_estado", {
    p_canal_id: canalId,
  });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar estado Meta.", error);
  }

  const row = (data as MetaStatusRow[] | null)?.[0];

  return ok(row ? mapMetaStatus(row) : null);
}

export async function getInboxWebhookEventsForChannel(
  canalId: string,
): Promise<CoreResult<InboxWebhookEvent[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_webhook_eventos")
    .select(
      "id, canal_id, canal, object_type, event_type, external_message_id, external_sender_id, external_recipient_id, procesado, error, received_at",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("canal_id", canalId)
    .order("received_at", { ascending: false })
    .limit(10);

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar eventos webhook.",
      error,
    );
  }

  return ok(((data ?? []) as WebhookEventRow[]).map(mapWebhookEvent));
}

export async function getInboxUnassociatedWebhookEventsForChannel(
  canalId: string,
): Promise<CoreResult<InboxWebhookEvent[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "obtener_inbox_webhook_eventos_no_asociados",
    {
      p_canal_id: canalId,
      p_limit: 10,
    },
  );

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as WebhookEventRow[]).map(mapWebhookEvent));
}

export async function getInboxMetaChannelDiagnostic(
  canalId: string,
): Promise<CoreResult<InboxMetaChannelDiagnostic>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewChannels(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver canales.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_canales")
    .select("id, estado, configuracion_publica")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("proveedor", "meta")
    .eq("canal", "whatsapp")
    .neq("estado", "inactivo");

  if (error) {
    return ok({
      activeMetaWhatsappChannels: 0,
      duplicatePhoneNumberIds: [],
      warnings: [],
    });
  }

  const rows = (data ?? []) as Array<{
    configuracion_publica: JsonRecord;
    estado: string;
    id: string;
  }>;
  const phoneCounts = new Map<string, number>();

  for (const row of rows) {
    const phoneNumberId = String(row.configuracion_publica.phone_number_id ?? "");

    if (phoneNumberId) {
      phoneCounts.set(phoneNumberId, (phoneCounts.get(phoneNumberId) ?? 0) + 1);
    }
  }

  const duplicatePhoneNumberIds = Array.from(phoneCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([phoneNumberId]) => phoneNumberId);
  const warnings: string[] = [];

  if (rows.length > 1) {
    warnings.push(
      "Hay varios canales WhatsApp Meta activos. Verifica que el phone_number_id correcto este en este canal.",
    );
  }

  if (duplicatePhoneNumberIds.length > 0) {
    warnings.push(
      `Hay phone_number_id duplicados: ${duplicatePhoneNumberIds.join(", ")}.`,
    );
  }

  if (!rows.some((row) => row.id === canalId)) {
    warnings.push("Este canal no esta activo como WhatsApp Meta.");
  }

  return ok({
    activeMetaWhatsappChannels: rows.length,
    duplicatePhoneNumberIds,
    warnings,
  });
}

export async function getInboxMetaTemplates(): Promise<
  CoreResult<InboxMetaTemplate[]>
> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.channels.view",
      "inbox.channels.manage",
      "inbox.conversations.reply",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver plantillas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_meta_plantillas")
    .select(
      "id, canal_id, nombre, idioma, categoria, estado, cuerpo, variables, meta_template_id, rechazo_motivo, updated_at, canal_rel:inbox_canales!inbox_meta_plantillas_canal_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("updated_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar plantillas.", error);
  }

  return ok(((data ?? []) as MetaTemplateRow[]).map(mapTemplate));
}

export async function getApprovedInboxMetaTemplatesForConversation(
  conversation: InboxConversation,
): Promise<CoreResult<InboxMetaTemplate[]>> {
  if (conversation.canal !== "whatsapp" || !conversation.canalId) {
    return ok([]);
  }

  const templates = await getInboxMetaTemplates();
  if (!templates.ok) return templates;

  return ok(
    templates.data.filter(
      (template) =>
        template.estado === "aprobada" &&
        (!template.canalId || template.canalId === conversation.canalId),
    ),
  );
}

export async function getInboxCampaigns(): Promise<CoreResult<InboxCampaign[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.channels.view",
      "inbox.channels.manage",
      "inbox.conversations.reply",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver campanas.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_campanas")
    .select(
      "id, canal_id, plantilla_id, nombre, objetivo, estado, audiencia, scheduled_at, recipient_count, sent_count, delivered_count, read_count, replied_count, failed_count, created_at, updated_at, canal_rel:inbox_canales!inbox_campanas_canal_empresa_fkey(nombre), plantilla_rel:inbox_meta_plantillas!inbox_campanas_plantilla_empresa_fkey(nombre, idioma, categoria, estado)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar campanas.", error);
  }

  return ok(((data ?? []) as CampaignRow[]).map(mapCampaign));
}

export async function getInboxCampaignRecipients(): Promise<
  CoreResult<InboxCampaignRecipient[]>
> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.channels.view",
      "inbox.channels.manage",
      "inbox.conversations.reply",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver audiencia.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_campana_destinatarios")
    .select(
      "id, campana_id, cliente_id, conversacion_id, nombre, telefono, external_recipient_id, opt_in, opt_in_source, opt_in_at, estado, variables, canal_message_id, attempt_count, last_attempt_at, last_error, sent_at, delivered_at, read_at, replied_at, created_at, updated_at",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar audiencia.", error);
  }

  return ok(((data ?? []) as CampaignRecipientRow[]).map(mapCampaignRecipient));
}

export async function getInboxAutomationRules(): Promise<
  CoreResult<InboxAutomationRule[]>
> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.channels.view",
      "inbox.channels.manage",
      "inbox.conversations.reply",
    ])
  ) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver automatizaciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_automatizaciones")
    .select(
      "id, canal_id, nombre, descripcion, trigger_tipo, accion_tipo, modo, estado, condiciones, accion_config, prioridad, ultima_ejecucion_at, created_at, updated_at, canal_rel:inbox_canales!inbox_automatizaciones_canal_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("prioridad", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron consultar automatizaciones.",
      error,
    );
  }

  const rows = (data ?? []) as AutomationRow[];
  const ids = rows.map((row) => row.id);
  const executionStats = new Map<
    string,
    { executed: number; failed: number; total: number }
  >();

  if (ids.length > 0) {
    const executions = await supabase
      .from("inbox_automatizacion_ejecuciones")
      .select("automatizacion_id, estado")
      .eq("empresa_id", tenant.data.empresaId)
      .in("automatizacion_id", ids);

    if (!executions.error) {
      for (const execution of ((executions.data ?? []) as AutomationExecutionRow[])) {
        const current = executionStats.get(execution.automatizacion_id) ?? {
          executed: 0,
          failed: 0,
          total: 0,
        };

        current.total += 1;
        if (execution.estado === "ejecutada") current.executed += 1;
        if (execution.estado === "fallida") current.failed += 1;

        executionStats.set(execution.automatizacion_id, current);
      }
    }
  }

  return ok(rows.map((row) => mapAutomation(row, executionStats)));
}

export async function getInboxConversations(): Promise<
  CoreResult<InboxConversation[]>
> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewConversations(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver conversaciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_conversaciones")
    .select(
      "id, canal_id, cliente_id, asignado_a, canal, contacto_nombre, contacto_identificador, contacto_telefono, contacto_usuario, estado, prioridad, ultimo_mensaje, ultimo_mensaje_at, cerrada_at, created_at, updated_at, canal_rel:inbox_canales!inbox_conversaciones_canal_empresa_fkey(nombre), crm_clientes!inbox_conversaciones_cliente_empresa_fkey(nombre), asignado:profiles!inbox_conversaciones_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar conversaciones.", error);
  }

  const rows = (data ?? []) as ConversationRow[];
  const signals = await getConversationSignalsForCurrentProfile(
    tenant.data,
    rows.map((row) => row.id),
  );

  return ok(rows.map((row) => mapConversation(row, signals)));
}

export async function getInboxConversationDetail(
  conversacionId: string,
): Promise<CoreResult<InboxConversation | null>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewConversations(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver conversaciones.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_conversaciones")
    .select(
      "id, canal_id, cliente_id, asignado_a, canal, contacto_nombre, contacto_identificador, contacto_telefono, contacto_usuario, estado, prioridad, ultimo_mensaje, ultimo_mensaje_at, cerrada_at, created_at, updated_at, canal_rel:inbox_canales!inbox_conversaciones_canal_empresa_fkey(nombre), crm_clientes!inbox_conversaciones_cliente_empresa_fkey(nombre), asignado:profiles!inbox_conversaciones_asignado_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("id", conversacionId)
    .maybeSingle<ConversationRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la conversacion.", error);
  }

  if (!data) return ok(null);

  const signals = await getConversationSignalsForCurrentProfile(tenant.data, [
    data.id,
  ]);

  return ok(mapConversation(data, signals));
}

export async function getInboxConversationMetaSendStatus(
  conversation: InboxConversation,
): Promise<CoreResult<InboxConversationMetaSendStatus>> {
  if (conversation.canal !== "whatsapp" || !conversation.canalId) {
    return ok({
      isReady: false,
      reason: "Esta conversacion no pertenece a un canal WhatsApp Meta.",
    });
  }

  const [channel, metaStatus] = await Promise.all([
    getInboxChannelDetail(conversation.canalId),
    getInboxChannelMetaStatus(conversation.canalId),
  ]);

  if (!channel.ok || !channel.data || channel.data.proveedor !== "meta") {
    return ok({
      isReady: false,
      reason: "El canal no es proveedor Meta.",
    });
  }

  if (
    channel.data.estado !== "activo" ||
    channel.data.conexionEstado !== "configurado"
  ) {
    return ok({
      isReady: false,
      reason: "El canal WhatsApp Meta no esta activo/configurado.",
    });
  }

  const phoneNumberId = channel.data.configuracionPublica.phone_number_id;

  if (typeof phoneNumberId !== "string" || !phoneNumberId.trim()) {
    return ok({
      isReady: false,
      reason: "Falta phone_number_id en la configuracion del canal.",
    });
  }

  if (!metaStatus.ok || !metaStatus.data?.tieneAccessToken) {
    return ok({
      isReady: false,
      reason: "Falta access_token configurado.",
    });
  }

  return ok({ isReady: true, reason: null });
}

export async function getInboxMessages(
  conversacionId: string,
): Promise<CoreResult<InboxMessage[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!canViewConversations(tenant.data)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver mensajes.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_mensajes")
    .select(
      "id, conversacion_id, direccion, tipo, contenido, estado, canal_message_id, es_nota_interna, enviado_por, received_at, sent_at, created_at, profiles!inbox_mensajes_enviado_por_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: true });

  if (error) return fail("PERMISSION_DENIED", "No se pudieron consultar mensajes.", error);

  return ok(((data ?? []) as MessageRow[]).map(mapMessage));
}

export async function getInboxEvents(
  conversacionId: string,
): Promise<CoreResult<InboxEvent[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!hasPermission(tenant.data.permissions, "inbox.conversations.view")) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_eventos")
    .select(
      "id, tipo, descripcion, metadata, created_by, created_at, profiles!inbox_eventos_created_by_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.data.empresaId)
    .eq("conversacion_id", conversacionId)
    .order("created_at", { ascending: false });

  if (error) return ok([]);

  return ok(((data ?? []) as EventRow[]).map(mapEvent));
}

export async function getAssignableUsersForInbox(): Promise<
  CoreResult<InboxAssignableUser[]>
> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (!hasPermission(tenant.data.permissions, "inbox.conversations.assign")) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre")
    .eq("empresa_id", tenant.data.empresaId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) return ok([]);

  return ok(((data ?? []) as UserRow[]).map((row) => ({ ...row })));
}

export async function getCustomersForInbox(): Promise<CoreResult<InboxCustomer[]>> {
  const tenant = await getTenant();
  if (!tenant.ok) return tenant;

  if (
    !hasAnyPermission(tenant.data.permissions, [
      "inbox.conversations.assign",
      "inbox.conversations.create",
      "crm.customers.view",
    ])
  ) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_clientes")
    .select("id, nombre, telefono, whatsapp")
    .eq("empresa_id", tenant.data.empresaId)
    .order("nombre", { ascending: true });

  if (error) return ok([]);

  return ok(((data ?? []) as CustomerRow[]).map((row) => ({ ...row })));
}
