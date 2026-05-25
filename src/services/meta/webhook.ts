import { META_WEBHOOK_EVENT_NAMES, META_WEBHOOK_PATH } from "@/services/meta/constants";
import type { MetaWebhookVerifyParams } from "@/services/meta/types";

export function getMetaWebhookPath() {
  return META_WEBHOOK_PATH;
}

export function getFutureMetaWebhookEvents() {
  return META_WEBHOOK_EVENT_NAMES;
}

export function readMetaVerifyParams(url: URL): MetaWebhookVerifyParams {
  return {
    challenge: url.searchParams.get("hub.challenge"),
    mode: url.searchParams.get("hub.mode"),
    verifyToken: url.searchParams.get("hub.verify_token"),
  };
}

export function isMetaSubscribeVerification(params: MetaWebhookVerifyParams) {
  return (
    params.mode === "subscribe" &&
    Boolean(params.verifyToken) &&
    Boolean(params.challenge)
  );
}

export function getMetaObjectType(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const value = (payload as { object?: unknown }).object;

  return typeof value === "string" ? value : null;
}

export function getMetaWebhookCallbackUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  return appUrl ? `${appUrl}${META_WEBHOOK_PATH}` : META_WEBHOOK_PATH;
}
