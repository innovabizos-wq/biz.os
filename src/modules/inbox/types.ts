import type {
  INBOX_CHANNEL_PROVIDERS,
  INBOX_CHANNEL_STATUSES,
  INBOX_CHANNELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_CONVERSATION_STATUSES,
  INBOX_MESSAGE_DIRECTIONS,
  INBOX_MESSAGE_STATUSES,
  INBOX_MESSAGE_TYPES,
  INBOX_META_CHANNELS,
  INBOX_PRIORITIES,
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
  prioridad: InboxPriority;
  ultimoMensaje: string | null;
  ultimoMensajeAt: string | null;
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
