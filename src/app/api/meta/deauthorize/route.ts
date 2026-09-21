import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyMetaSignedRequest } from "@/services/meta/signed-request";

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) return NextResponse.json({ error: "Meta app secret no configurado." }, { status: 503 });

  const formData = await request.formData();
  const signedRequest = formData.get("signed_request");
  const payload = typeof signedRequest === "string"
    ? verifyMetaSignedRequest(signedRequest, appSecret)
    : null;
  if (!payload?.user_id) return NextResponse.json({ error: "Solicitud Meta invalida." }, { status: 400 });

  const confirmationCode = `deauth-${randomBytes(16).toString("hex")}`;
  const subjectHash = createHash("sha256").update(`${payload.user_id}:${appSecret}`).digest("hex");
  const admin = createServiceRoleClient();
  const { error } = await admin.rpc("procesar_meta_data_deletion_server", {
    p_confirmation_code: confirmationCode,
    p_meta_user_id: payload.user_id,
    p_subject_hash: subjectHash,
  });
  if (error) {
    console.error("Meta deauthorization failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No se pudo revocar la autorizacion." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
