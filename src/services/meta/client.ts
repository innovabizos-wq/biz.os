import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

type SendWhatsAppTextMessageInput = {
  accessToken: string;
  body: string;
  phoneNumberId: string;
  to: string;
};

type SendWhatsAppTemplateMessageInput = {
  accessToken: string;
  components?: WhatsAppTemplateComponent[];
  languageCode: string;
  name: string;
  phoneNumberId: string;
  to: string;
};

type SendFacebookTextMessageInput = {
  accessToken: string;
  body: string;
  pageId: string;
  recipientId: string;
};

type SendInstagramTextMessageInput = {
  accessToken: string;
  apiHost?: string | null;
  body: string;
  instagramBusinessAccountId: string;
  recipientId: string;
};

type WhatsAppTemplateComponent = {
  parameters: Array<{
    text: string;
    type: "text";
  }>;
  type: "body";
};

export type MetaSendErrorDetails = {
  code: number | null;
  details: string | null;
  fbtraceId: string | null;
  subcode: number | null;
  type: string | null;
};

export type SendMetaMessageResult =
  | {
      messageId: string | null;
      ok: true;
      recipientId: string | null;
    }
  | {
      error: string;
      errorDetails: MetaSendErrorDetails;
      ok: false;
      status: number;
    };

export type SendWhatsAppMessageResult = SendMetaMessageResult;
export type SendWhatsAppTextMessageResult = SendMetaMessageResult;
export type SendWhatsAppTemplateMessageResult = SendMetaMessageResult;
export type SendFacebookTextMessageResult = SendMetaMessageResult;
export type SendInstagramTextMessageResult = SendMetaMessageResult;

type MetaSendResponse = {
  error?: {
    code?: number;
    error_data?: {
      details?: string;
    };
    error_subcode?: number;
    fbtrace_id?: string;
    message?: string;
    type?: string;
  };
  message_id?: string;
  messages?: Array<{
    id?: string;
  }>;
  recipient_id?: string;
};

function sanitizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function cleanIdentifier(value: string) {
  return String(value).trim();
}

function normalizeInstagramApiHost(value?: string | null) {
  return value?.trim().toLowerCase() === "graph.instagram.com"
    ? "graph.instagram.com"
    : "graph.facebook.com";
}

function buildMessagesEndpoint(host: string, accountId: string) {
  return `https://${host}/${META_GRAPH_API_VERSION}/${encodeURIComponent(
    cleanIdentifier(accountId),
  )}/messages`;
}

function getMetaErrorDetails(payload: MetaSendResponse): MetaSendErrorDetails {
  return {
    code: payload.error?.code ?? null,
    details: payload.error?.error_data?.details ?? null,
    fbtraceId: payload.error?.fbtrace_id ?? null,
    subcode: payload.error?.error_subcode ?? null,
    type: payload.error?.type ?? null,
  };
}

async function parseMetaSendResponse(
  response: Response,
  fallbackError: string,
): Promise<SendMetaMessageResult> {
  const payload = (await response.json().catch(() => ({}))) as MetaSendResponse;

  if (!response.ok) {
    return {
      error: payload.error?.message ?? fallbackError,
      errorDetails: getMetaErrorDetails(payload),
      ok: false,
      status: response.status,
    };
  }

  return {
    messageId: payload.messages?.[0]?.id ?? payload.message_id ?? null,
    ok: true,
    recipientId: payload.recipient_id ?? null,
  };
}

async function sendMessagingTextMessage({
  accessToken,
  accountId,
  body,
  host,
  includeMessagingType,
  recipientId,
}: {
  accessToken: string;
  accountId: string;
  body: string;
  host: string;
  includeMessagingType: boolean;
  recipientId: string;
}): Promise<SendMetaMessageResult> {
  const cleanAccountId = cleanIdentifier(accountId);
  const cleanRecipientId = cleanIdentifier(recipientId);
  const cleanBody = body.trim();

  if (
    !cleanAccountId ||
    !cleanRecipientId ||
    !cleanBody ||
    !accessToken.trim()
  ) {
    return {
      error: "Configuracion o destinatario Meta incompleto.",
      errorDetails: {
        code: null,
        details: null,
        fbtraceId: null,
        subcode: null,
        type: null,
      },
      ok: false,
      status: 400,
    };
  }

  const response = await fetch(buildMessagesEndpoint(host, cleanAccountId), {
    body: JSON.stringify({
      message: { text: cleanBody },
      messaging_type: includeMessagingType ? "RESPONSE" : undefined,
      recipient: { id: cleanRecipientId },
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseMetaSendResponse(response, "Meta rechazo el envio del mensaje.");
}

export function buildWhatsAppMessagesEndpoint(phoneNumberId: string) {
  return buildMessagesEndpoint("graph.facebook.com", phoneNumberId);
}

export function buildFacebookMessagesEndpoint(pageId: string) {
  return buildMessagesEndpoint("graph.facebook.com", pageId);
}

export function buildInstagramMessagesEndpoint(
  instagramBusinessAccountId: string,
  apiHost?: string | null,
) {
  return buildMessagesEndpoint(
    normalizeInstagramApiHost(apiHost),
    instagramBusinessAccountId,
  );
}

export async function sendFacebookTextMessage({
  accessToken,
  body,
  pageId,
  recipientId,
}: SendFacebookTextMessageInput): Promise<SendFacebookTextMessageResult> {
  return sendMessagingTextMessage({
    accessToken,
    accountId: pageId,
    body,
    host: "graph.facebook.com",
    includeMessagingType: true,
    recipientId,
  });
}

export async function sendInstagramTextMessage({
  accessToken,
  apiHost,
  body,
  instagramBusinessAccountId,
  recipientId,
}: SendInstagramTextMessageInput): Promise<SendInstagramTextMessageResult> {
  return sendMessagingTextMessage({
    accessToken,
    accountId: instagramBusinessAccountId,
    body,
    host: normalizeInstagramApiHost(apiHost),
    includeMessagingType: false,
    recipientId,
  });
}

export async function sendWhatsAppTextMessage({
  accessToken,
  body,
  phoneNumberId,
  to,
}: SendWhatsAppTextMessageInput): Promise<SendWhatsAppTextMessageResult> {
  const cleanTo = sanitizePhone(to);
  const cleanPhoneNumberId = cleanIdentifier(phoneNumberId);

  if (!cleanTo || !body.trim() || !cleanPhoneNumberId || !accessToken.trim()) {
    return {
      error: "Configuracion o destinatario incompleto.",
      errorDetails: {
        code: null,
        details: null,
        fbtraceId: null,
        subcode: null,
        type: null,
      },
      ok: false,
      status: 400,
    };
  }

  const response = await fetch(buildWhatsAppMessagesEndpoint(cleanPhoneNumberId), {
    body: JSON.stringify({
      messaging_product: "whatsapp",
      text: { body: body.trim() },
      to: cleanTo,
      type: "text",
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseMetaSendResponse(response, "Meta rechazo el envio del mensaje.");
}

export async function sendWhatsAppTemplateMessage({
  accessToken,
  components,
  languageCode,
  name,
  phoneNumberId,
  to,
}: SendWhatsAppTemplateMessageInput): Promise<SendWhatsAppTemplateMessageResult> {
  const cleanTo = sanitizePhone(to);
  const cleanPhoneNumberId = cleanIdentifier(phoneNumberId);
  const cleanName = name.trim();
  const cleanLanguageCode = languageCode.trim();

  if (
    !cleanTo ||
    !cleanName ||
    !cleanLanguageCode ||
    !cleanPhoneNumberId ||
    !accessToken.trim()
  ) {
    return {
      error: "Configuracion, plantilla o destinatario incompleto.",
      errorDetails: {
        code: null,
        details: null,
        fbtraceId: null,
        subcode: null,
        type: null,
      },
      ok: false,
      status: 400,
    };
  }

  const response = await fetch(buildWhatsAppMessagesEndpoint(cleanPhoneNumberId), {
    body: JSON.stringify({
      messaging_product: "whatsapp",
      template: {
        components: components && components.length > 0 ? components : undefined,
        language: { code: cleanLanguageCode },
        name: cleanName,
      },
      to: cleanTo,
      type: "template",
    }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseMetaSendResponse(response, "Meta rechazo el envio de la plantilla.");
}
