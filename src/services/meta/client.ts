import { META_GRAPH_API_VERSION } from "@/services/meta/constants";

type SendWhatsAppTextMessageInput = {
  accessToken: string;
  body: string;
  phoneNumberId: string;
  to: string;
};

export type SendWhatsAppTextMessageResult =
  | {
      messageId: string | null;
      ok: true;
    }
  | {
      error: string;
      ok: false;
      status: number;
    };

type WhatsAppSendResponse = {
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
  messages?: Array<{
    id?: string;
  }>;
};

function sanitizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

export function buildWhatsAppMessagesEndpoint(phoneNumberId: string) {
  const cleanPhoneNumberId = String(phoneNumberId).trim();

  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(
    cleanPhoneNumberId,
  )}/messages`;
}

export async function sendWhatsAppTextMessage({
  accessToken,
  body,
  phoneNumberId,
  to,
}: SendWhatsAppTextMessageInput): Promise<SendWhatsAppTextMessageResult> {
  const cleanTo = sanitizePhone(to);
  const cleanPhoneNumberId = String(phoneNumberId).trim();

  if (!cleanTo || !body.trim() || !cleanPhoneNumberId || !accessToken.trim()) {
    return {
      error: "Configuracion o destinatario incompleto.",
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
  const payload = (await response.json().catch(() => ({}))) as WhatsAppSendResponse;

  if (!response.ok) {
    return {
      error: payload.error?.message ?? "Meta rechazo el envio del mensaje.",
      ok: false,
      status: response.status,
    };
  }

  return {
    messageId: payload.messages?.[0]?.id ?? null,
    ok: true,
  };
}
