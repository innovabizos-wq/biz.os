import { createClient } from "@/lib/supabase/server";
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
    "user-agent": headers.get("user-agent"),
    "x-hub-signature-256-present": Boolean(headers.get("x-hub-signature-256")),
  };
}

function summarizeRpcData(data: unknown): MetaWebhookProcessSummary {
  return ((data as MetaWebhookProcessSummary[] | null)?.[0] ??
    {}) as MetaWebhookProcessSummary;
}

export async function GET(request: Request) {
  const params = readMetaVerifyParams(new URL(request.url));

  if (!isMetaSubscribeVerification(params)) {
    return textResponse("Bad request", 400);
  }

  const supabase = await createClient();
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

  if (!rawBody.trim()) {
    return jsonResponse({ ok: true, reason: "empty_payload" });
  }

  if (!canSkipMetaSignature()) {
    if (!isMetaSignatureFormat(signature)) {
      return jsonResponse({ ok: false, error: "missing_signature" }, 401);
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verificar_meta_webhook_signature", {
      p_payload: rawBody,
      p_signature: signature,
    });

    if (error || data !== true) {
      return jsonResponse({ ok: false, error: "invalid_signature" }, 401);
    }
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ ok: true, reason: "invalid_json" });
  }

  const normalized = normalizeMetaWebhook(payload);
  const objectType = getMetaObjectType(payload);

  if (!objectType || normalized.length === 0) {
    return jsonResponse({ ok: true, reason: "no_supported_events" });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("procesar_inbox_webhook_meta", {
    p_headers: buildSafeHeaders(request.headers),
    p_payload: payload,
  });

  if (error) {
    return jsonResponse({ ok: false, error: "processing_failed" }, 500);
  }

  return jsonResponse({
    ok: true,
    summary: summarizeRpcData(data),
  });
}
