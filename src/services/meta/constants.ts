export const META_PROVIDER = "meta" as const;

export const META_WEBHOOK_PATH = "/api/webhooks/meta";

export const META_SUPPORTED_CHANNELS = [
  "whatsapp",
  "facebook",
  "instagram",
] as const;

export const META_WEBHOOK_EVENT_NAMES = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
] as const;
