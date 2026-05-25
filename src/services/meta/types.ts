import type { META_SUPPORTED_CHANNELS, META_WEBHOOK_EVENT_NAMES } from "@/services/meta/constants";

export type MetaSupportedChannel = (typeof META_SUPPORTED_CHANNELS)[number];

export type MetaWebhookEventName = (typeof META_WEBHOOK_EVENT_NAMES)[number];

export type MetaPublicChannelConfig = {
  appId?: string;
  businessId?: string;
  instagramBusinessAccountId?: string;
  pageId?: string;
  phoneNumberId?: string;
  wabaId?: string;
};

export type MetaSecretState = {
  tieneAccessToken: boolean;
  tieneAppSecret: boolean;
  tieneVerifyToken: boolean;
  tokenExpiresAt: string | null;
};

export type MetaWebhookVerifyParams = {
  challenge: string | null;
  mode: string | null;
  verifyToken: string | null;
};

export type NormalizedMetaWebhookMessage = {
  accountExternalId: string | null;
  channel: MetaSupportedChannel;
  messageExternalId: string | null;
  messageType: string;
  provider: "meta";
  rawSafe: Record<string, unknown>;
  recipientExternalId: string | null;
  senderExternalId: string | null;
  text: string | null;
  timestamp: string | null;
};

export type MetaWebhookProcessSummary = {
  conversaciones_creadas?: number;
  eventos_recibidos?: number;
  mensajes_creados?: number;
  mensajes_duplicados?: number;
};
