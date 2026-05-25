import type { NormalizedMetaWebhookMessage } from "@/services/meta/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stripKnownSecrets(value: JsonRecord): JsonRecord {
  const safe = { ...value };

  delete safe.access_token;
  delete safe.app_secret;
  delete safe.verify_token;

  return safe;
}

function unixSecondsToIso(value: string | null) {
  if (!value) return null;

  const numeric = Number(value);

  return Number.isFinite(numeric) ? new Date(numeric * 1000).toISOString() : null;
}

function unixMsToIso(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numeric) ? new Date(numeric).toISOString() : null;
}

export function normalizeWhatsAppWebhook(
  payload: unknown,
): NormalizedMetaWebhookMessage[] {
  const root = asRecord(payload);
  const messages: NormalizedMetaWebhookMessage[] = [];

  for (const entry of asArray(root.entry)) {
    const entryRecord = asRecord(entry);

    for (const change of asArray(entryRecord.changes)) {
      const changeRecord = asRecord(change);
      const value = asRecord(changeRecord.value);
      const metadata = asRecord(value.metadata);
      const accountExternalId = asString(metadata.phone_number_id) ?? asString(entryRecord.id);
      const contact = asRecord(asArray(value.contacts)[0]);
      const profile = asRecord(contact.profile);

      for (const item of asArray(value.messages)) {
        const message = asRecord(item);
        const type = asString(message.type) ?? "texto";
        const text = asString(asRecord(message.text).body);

        messages.push({
          accountExternalId,
          channel: "whatsapp",
          messageExternalId: asString(message.id),
          messageType: type,
          provider: "meta",
          rawSafe: stripKnownSecrets({
            contactName: profile.name,
            message,
            metadata,
          }),
          recipientExternalId: accountExternalId,
          senderExternalId: asString(message.from),
          text,
          timestamp: unixSecondsToIso(asString(message.timestamp)),
        });
      }
    }
  }

  return messages;
}

function normalizeMessagingWebhook(
  payload: unknown,
  channel: "facebook" | "instagram",
): NormalizedMetaWebhookMessage[] {
  const root = asRecord(payload);
  const messages: NormalizedMetaWebhookMessage[] = [];

  for (const entry of asArray(root.entry)) {
    const entryRecord = asRecord(entry);

    for (const item of asArray(entryRecord.messaging)) {
      const event = asRecord(item);
      const message = asRecord(event.message);
      const recipient = asRecord(event.recipient);
      const sender = asRecord(event.sender);
      const text = asString(message.text);

      messages.push({
        accountExternalId: asString(recipient.id) ?? asString(entryRecord.id),
        channel,
        messageExternalId: asString(message.mid),
        messageType: text ? "texto" : "sistema",
        provider: "meta",
        rawSafe: stripKnownSecrets({ event }),
        recipientExternalId: asString(recipient.id),
        senderExternalId: asString(sender.id),
        text,
        timestamp: unixMsToIso(event.timestamp),
      });
    }
  }

  return messages;
}

export function normalizeMessengerWebhook(
  payload: unknown,
): NormalizedMetaWebhookMessage[] {
  return normalizeMessagingWebhook(payload, "facebook");
}

export function normalizeInstagramWebhook(
  payload: unknown,
): NormalizedMetaWebhookMessage[] {
  return normalizeMessagingWebhook(payload, "instagram");
}

export function normalizeMetaWebhook(payload: unknown) {
  const objectType = asString(asRecord(payload).object);

  if (objectType === "whatsapp_business_account") {
    return normalizeWhatsAppWebhook(payload);
  }

  if (objectType === "instagram") {
    return normalizeInstagramWebhook(payload);
  }

  if (objectType === "page") {
    return normalizeMessengerWebhook(payload);
  }

  return [];
}
