import { createServiceRoleClient } from "@/lib/supabase/admin";
import { META_WEBHOOK_MAX_BODY_BYTES } from "@/services/meta/constants";
import { normalizeMetaWebhook } from "@/services/meta/normalizers";
import {
  canSkipMetaSignature,
  getMetaSignature,
  isMetaSignatureFormat,
} from "@/services/meta/signature";
import {
  getMetaObjectType,
  isMetaSubscribeVerification,
  readMetaVerifyParams,
} from "@/services/meta/webhook";
import type { MetaWebhookProcessSummary } from "@/services/meta/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyTokenRpcRow = {
  canal_id?: string;
  canal?: string;
  empresa_id?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function textResponse(body: string, status = 200) {
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
    status,
  });
}

function buildSafeHeaders(headers: Headers) {
  return {
    "content-type": headers.get("content-type"),
    "x-forwarded-for-present": Boolean(headers.get("x-forwarded-for")),
    "user-agent": headers.get("user-agent"),
    "x-hub-signature-256-present": Boolean(headers.get("x-hub-signature-256")),
  };
}

function summarizeRpcData(data: unknown): MetaWebhookProcessSummary {
  return ((data as MetaWebhookProcessSummary[] | null)?.[0] ??
    {}) as MetaWebhookProcessSummary;
}

function shouldLogMetaWebhookDiagnostics() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.META_WEBHOOK_DEBUG_LOGS === "true"
  );
}

function getEntryCount(payload: unknown) {
  if (!payload || typeof payload !== "object") return 0;

  const entries = (payload as { entry?: unknown }).entry;

  return Array.isArray(entries) ? entries.length : 0;
}

function logMetaWebhookInfo(
  message: string,
  metadata: Record<string, unknown> = {},
) {
  if (shouldLogMetaWebhookDiagnostics()) {
    console.info(`[meta-webhook] ${message}`, metadata);
  }
}

function logMetaWebhookError(
  message: string,
  metadata: Record<string, unknown> = {},
) {
  if (shouldLogMetaWebhookDiagnostics()) {
    console.error(`[meta-webhook] ${message}`, metadata);
  }
}

export async function GET(request: Request) {
  const params = readMetaVerifyParams(new URL(request.url));

  if (!isMetaSubscribeVerification(params)) {
    return textResponse("Bad request", 400);
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("buscar_canal_por_verify_token", {
    p_verify_token: params.verifyToken,
  });

  if (error) {
    return textResponse("Forbidden", 403);
  }

  const match = (data as VerifyTokenRpcRow[] | null)?.[0];

  if (!match?.canal_id || !params.challenge) {
    return textResponse("Forbidden", 403);
  }

  return textResponse(params.challenge);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = getMetaSignature(request.headers);
  const bodySize = Buffer.byteLength(rawBody, "utf8");

  logMetaWebhookInfo("Meta webhook POST received", {
    bodySize,
    contentType: request.headers.get("content-type"),
    headers: buildSafeHeaders(request.headers),
    signaturePresent: Boolean(signature),
  });

  if (!rawBody.trim()) {
    logMetaWebhookInfo("Payload vacio");
    return jsonResponse({ ok: true, reason: "empty_payload" });
  }

  if (bodySize > META_WEBHOOK_MAX_BODY_BYTES) {
    logMetaWebhookError("Payload excede limite", { bodySize });
    return jsonResponse({ ok: false, error: "payload_too_large" }, 413);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    logMetaWebhookInfo("Content-Type no soportado", { contentType });
    return jsonResponse({ ok: true, reason: "unsupported_content_type" });
  }

  if (!canSkipMetaSignature()) {
    if (!isMetaSignatureFormat(signature)) {
      logMetaWebhookError("Firma ausente o formato invalido");
      return jsonResponse({ ok: false, error: "missing_signature" }, 401);
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("verificar_meta_webhook_signature", {
      p_payload: rawBody,
      p_signature: signature,
    });

    if (error || data !== true) {
      logMetaWebhookError("Firma invalida", {
        code: error?.code,
        message: error?.message,
      });
      return jsonResponse({ ok: false, error: "invalid_signature" }, 401);
    }
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    logMetaWebhookInfo("JSON invalido");
    return jsonResponse({ ok: true, reason: "invalid_json" });
  }

  const normalized = normalizeMetaWebhook(payload);
  const objectType = getMetaObjectType(payload);

  logMetaWebhookInfo("Meta webhook payload parsed", {
    entries: getEntryCount(payload),
    normalizedMessages: normalized.length,
    objectType,
  });

  if (!payload || typeof payload !== "object") {
    return jsonResponse({ ok: true, reason: "unsupported_payload" });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("procesar_inbox_webhook_meta", {
    p_headers: buildSafeHeaders(request.headers),
    p_payload: payload,
  });

  if (error) {
    logMetaWebhookError("RPC procesar_inbox_webhook_meta fallo", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
      objectType,
    });
    return jsonResponse({ ok: false, error: "processing_failed" }, 500);
  }

  const summary = summarizeRpcData(data);

  logMetaWebhookInfo("RPC procesar_inbox_webhook_meta completado", {
    objectType,
    summary,
  });

  return jsonResponse({
    ok: true,
    reason: normalized.length === 0 ? "no_supported_messages_but_registered" : undefined,
    summary,
  });
}
