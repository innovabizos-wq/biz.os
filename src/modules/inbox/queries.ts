import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getCurrentTenantContext } from "@/lib/auth/session";
import type {
  InboxAssignableUser,
  InboxChannelConfig,
  InboxConversation,
  InboxCustomer,
  InboxEvent,
  InboxMetaChannelStatus,
  InboxMessage,
  InboxSummary,
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

type EventRow = {
  created_at: string;
  created_by: string | null;
  descripcion: string | null;
  id: string;
  metadata: JsonRecord;
  profiles: NameRelation | NameRelation[] | null;
  tipo: string;
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

function mapConversation(row: ConversationRow): InboxConversation {
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
    prioridad: row.prioridad,
    ultimoMensaje: row.ultimo_mensaje,
    ultimoMensajeAt: row.ultimo_mensaje_at,
    updatedAt: row.updated_at,
  };
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

  return ok(((data ?? []) as ConversationRow[]).map(mapConversation));
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

  return ok(data ? mapConversation(data) : null);
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
