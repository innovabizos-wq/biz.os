import { createHmac, randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireAdminAccess } from "@/modules/tenant/admin-access";

const PROVIDERS = ["facebook", "instagram"] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(value: string): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const appId = process.env.META_APP_ID?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const stateSecret = process.env.META_OAUTH_STATE_SECRET?.trim();
  const configurationId = process.env.META_FACEBOOK_LOGIN_CONFIG_ID?.trim();

  if (!isProvider(provider) || !appId || !appUrl || !stateSecret || !configurationId) {
    return NextResponse.redirect(new URL("/inbox/conexiones?error=Meta%20no%20esta%20configurado", _request.url));
  }

  await requireAdminAccess();
  const issuedAt = Date.now().toString();
  const statePayload = `${provider}.${issuedAt}.${randomUUID()}`;
  const state = `${statePayload}.${createHmac("sha256", stateSecret).update(statePayload).digest("base64url")}`;
  const callbackUrl = `${appUrl}/api/meta/connect/callback`;
  const authorizationUrl = new URL(`https://www.facebook.com/${process.env.META_GRAPH_API_VERSION?.trim() || "v25.0"}/dialog/oauth`);
  authorizationUrl.searchParams.set("client_id", appId);
  authorizationUrl.searchParams.set("redirect_uri", callbackUrl);
  // Facebook Login for Business obtains its permissions from this saved Meta
  // configuration. Sending scope here makes Meta reject the request.
  authorizationUrl.searchParams.set("config_id", configurationId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("override_default_response_type", "true");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  return response;
}
