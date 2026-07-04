import type {
  INBOX_AUTOMATION_ACTIONS,
  INBOX_AUTOMATION_MODES,
  INBOX_AUTOMATION_STATUSES,
  INBOX_AUTOMATION_TRIGGERS,
  INBOX_CAMPAIGN_RECIPIENT_STATUSES,
  INBOX_CHANNEL_PROVIDERS,
  INBOX_CHANNEL_STATUSES,
  INBOX_CHANNELS,
  INBOX_CAMPAIGN_STATUSES,
  INBOX_CONNECTION_STATUSES,
  INBOX_CONVERSATION_STATUSES,
  INBOX_MESSAGE_DIRECTIONS,
  INBOX_MESSAGE_STATUSES,
  INBOX_MESSAGE_TYPES,
  INBOX_META_TEMPLATE_CATEGORIES,
  INBOX_META_TEMPLATE_STATUSES,
  INBOX_META_CHANNELS,
  INBOX_PRIORITIES,
  INBOX_SLA_STATUSES,
} from "@/modules/inbox/constants";
import type { JsonRecord } from "@/types/core";

export type InboxChannel = (typeof INBOX_CHANNELS)[number];
export type InboxMetaChannel = (typeof INBOX_META_CHANNELS)[number];
export type InboxChannelProvider = (typeof INBOX_CHANNEL_PROVIDERS)[number];
export type InboxChannelStatus = (typeof INBOX_CHANNEL_STATUSES)[number];
export type InboxConnectionStatus = (typeof INBOX_CONNECTION_STATUSES)[number];
export type InboxConversationStatus =
  (typeof INBOX_CONVERSATION_STATUSES)[number];
export type InboxPriority = (typeof INBOX_PRIORITIES)[number];
export type InboxMessageDirection = (typeof INBOX_MESSAGE_DIRECTIONS)[number];
export type InboxMessageType = (typeof INBOX_MESSAGE_TYPES)[number];
export type InboxMessageStatus = (typeof INBOX_MESSAGE_STATUSES)[number];
export type InboxSlaStatus = (typeof INBOX_SLA_STATUSES)[number];
export type InboxMetaTemplateCategory =
  (typeof INBOX_META_TEMPLATE_CATEGORIES)[number];
export type InboxMetaTemplateStatus =
  (typeof INBOX_META_TEMPLATE_STATUSES)[number];
export type InboxCampaignStatus = (typeof INBOX_CAMPAIGN_STATUSES)[number];
export type InboxCampaignRecipientStatus =
  (typeof INBOX_CAMPAIGN_RECIPIENT_STATUSES)[number];
export type InboxAutomationTrigger =
  (typeof INBOX_AUTOMATION_TRIGGERS)[number];
export type InboxAutomationAction = (typeof INBOX_AUTOMATION_ACTIONS)[number];
export type InboxAutomationMode = (typeof INBOX_AUTOMATION_MODES)[number];
export type InboxAutomationStatus =
  (typeof INBOX_AUTOMATION_STATUSES)[number];

export type InboxChannelConfig = {
  canal: InboxChannel;
  conexionEstado: InboxConnectionStatus;
  configuracionPublica: JsonRecord;
  createdAt: string;
  createdBy: string | null;
  estado: InboxChannelStatus;
  id: string;
  identificadorExterno: string | null;
  nombre: string;
  proveedor: InboxChannelProvider;
  proveedorEstado: string | null;
  ultimaVerificacionAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  webhookUrl: string | null;
};

export type InboxMetaChannelStatus = {
  accessTokenSuffix?: string | null;
  accessTokenUpdatedAt?: string | null;
  canal: InboxChannel;
  canalId: string;
  conexionEstado: InboxConnectionStatus;
  proveedor: InboxChannelProvider;
  tieneAccessToken: boolean;
  tieneAppSecret: boolean;
  tieneVerifyToken: boolean;
  tokenExpiresAt: string | null;
  webhookUrl: string | null;
};

export type InboxMetaSecretSaveResult = {
  canalId: string;
  tieneAccessToken: boolean;
  tieneAppSecret: boolean;
  tieneVerifyToken: boolean;
  tokenExpiresAt: string | null;
};

export type InboxVerifyTokenResult = InboxMetaSecretSaveResult & {
  verifyToken: string;
};

export type InboxConversation = {
  asignadoA: string | null;
  asignadoNombre: string | null;
  canal: InboxChannel;
  canalId: string | null;
  canalNombre: string | null;
  cerradaAt: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  contactoIdentificador: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoUsuario: string | null;
  createdAt: string;
  estado: InboxConversationStatus;
  id: string;
  lastIncomingAt: string | null;
  prioridad: InboxPriority;
  slaDueAt: string | null;
  slaStatus: InboxSlaStatus;
  ultimoMensaje: string | null;
  ultimoMensajeAt: string | null;
  unreadCount: number;
  updatedAt: string;
};

export type InboxConversationDetail = InboxConversation;

export type InboxMessage = {
  canalMessageId: string | null;
  contenido: string | null;
  conversacionId: string;
  createdAt: string;
  direccion: InboxMessageDirection;
  enviadoPor: string | null;
  enviadoPorNombre: string | null;
  esNotaInterna: boolean;
  estado: InboxMessageStatus;
  id: string;
  receivedAt: string | null;
  sentAt: string | null;
  tipo: InboxMessageType;
};

export type InboxEvent = {
  createdAt: string;
  createdBy: string | null;
  createdByNombre: string | null;
  descripcion: string | null;
  id: string;
  metadata: JsonRecord;
  tipo: string;
};

export type InboxWebhookEvent = {
  canal: string | null;
  canalId: string | null;
  error: string | null;
  eventType: string | null;
  externalMessageId: string | null;
  externalRecipientId: string | null;
  externalSenderId: string | null;
  id: string;
  objectType: string | null;
  procesado: boolean;
  receivedAt: string;
};

export type InboxMetaChannelDiagnostic = {
  activeMetaWhatsappChannels: number;
  duplicatePhoneNumberIds: string[];
  warnings: string[];
};

export type InboxConversationMetaSendStatus = {
  isReady: boolean;
  reason: string | null;
};

export type InboxMetaTemplate = {
  canalId: string | null;
  canalNombre: string | null;
  categoria: InboxMetaTemplateCategory;
  cuerpo: string;
  estado: InboxMetaTemplateStatus;
  id: string;
  idioma: string;
  metaTemplateId: string | null;
  nombre: string;
  rechazoMotivo: string | null;
  updatedAt: string;
  variables: string[];
};

export type InboxCampaign = {
  audiencia: JsonRecord;
  canalId: string;
  canalNombre: string | null;
  createdAt: string;
  deliveredCount: number;
  estado: InboxCampaignStatus;
  failedCount: number;
  id: string;
  nombre: string;
  objetivo: string | null;
  plantillaCategoria: InboxMetaTemplateCategory | null;
  plantillaEstado: InboxMetaTemplateStatus | null;
  plantillaId: string;
  plantillaIdioma: string | null;
  plantillaNombre: string | null;
  readCount: number;
  recipientCount: number;
  repliedCount: number;
  scheduledAt: string | null;
  sentCount: number;
  updatedAt: string;
};

export type InboxCampaignRecipient = {
  attemptCount: number;
  campaignId: string;
  canalMessageId: string | null;
  clienteId: string | null;
  conversacionId: string | null;
  createdAt: string;
  deliveredAt: string | null;
  estado: InboxCampaignRecipientStatus;
  externalRecipientId: string | null;
  id: string;
  lastAttemptAt: string | null;
  lastError: string | null;
  nombre: string | null;
  optIn: boolean;
  optInAt: string | null;
  optInSource: string | null;
  readAt: string | null;
  repliedAt: string | null;
  sentAt: string | null;
  telefono: string;
  updatedAt: string;
  variables: JsonRecord;
};

export type InboxAutomationRule = {
  accionConfig: JsonRecord;
  accionTipo: InboxAutomationAction;
  canalId: string | null;
  canalNombre: string | null;
  condiciones: JsonRecord;
  createdAt: string;
  descripcion: string | null;
  estado: InboxAutomationStatus;
  executionCount: number;
  failedExecutionCount: number;
  id: string;
  modo: InboxAutomationMode;
  nombre: string;
  prioridad: number;
  successfulExecutionCount: number;
  triggerTipo: InboxAutomationTrigger;
  ultimaEjecucionAt: string | null;
  updatedAt: string;
};

export type InboxAssignableUser = {
  id: string;
  nombre: string;
};

export type InboxCustomer = {
  id: string;
  nombre: string;
  telefono: string | null;
  whatsapp: string | null;
};

export type InboxSummary = {
  activeChannels: number;
  openConversations: number;
  pendingConversations: number;
  recentlyClosedConversations: number;
};
