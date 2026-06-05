export const META_PROVIDER = "meta" as const;

export const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";

export const META_WEBHOOK_PATH = "/api/webhooks/meta";

export const META_WEBHOOK_MAX_BODY_BYTES = 2 * 1024 * 1024;

export const META_SUPPORTED_CHANNELS = [
  "whatsapp",
  "facebook",
  "instagram",
] as const;

export const META_WEBHOOK_EVENT_NAMES = [
  "messages",
] as const;

export const META_REQUIRED_PUBLIC_CONFIG_FIELDS = {
  facebook: ["page_id", "app_id"] as const,
  instagram: ["instagram_business_account_id", "page_id", "app_id"] as const,
  whatsapp: ["phone_number_id", "waba_id", "app_id"] as const,
};

export const META_REQUIRED_SECRET_FIELDS = [
  "access_token",
  "app_secret",
  "verify_token",
] as const;
