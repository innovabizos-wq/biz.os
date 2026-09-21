import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { META_GRAPH_API_VERSION } from "@/services/meta/constants";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import {
  encryptPendingMetaConnection,
  META_OAUTH_PENDING_COOKIE,
} from "@/modules/inbox/meta-oauth-pending";

type MetaPage = { access_token?: string; id?: string; instagram_business_account?: { id?: string; username?: string }; name?: string };
type MetaUser = { id?: string };
type MetaTokenData = { access_token?: string; expires_in?: number; token_type?: string };
type MetaDebugData = {
  data?: {
    data_access_expires_at?: number;
    expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
  };
};

const REQUIRED_SCOPES = {
  facebook: ["pages_manage_metadata", "pages_messaging", "pages_read_engagement", "pages_show_list"],
  instagram: ["instagram_basic", "instagram_manage_messages", "pages_read_engagement", "pages_show_list"],
} as const;

function tokenExpiration(data: MetaDebugData["data"]) {
  const candidates = [data?.expires_at, data?.data_access_expires_at]
    .filter((value): value is number => typeof value === "number" && value > 0)
    .map((value) => value * 1000)
    .filter((value) => value > Date.now());
  return candidates.length > 0 ? new Date(Math.min(...candidates)).toISOString() : null;
}

async function debugMetaToken(token: string, appId: string, appSecret: string) {
  const url = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/debug_token`);
  url.searchParams.set("input_token", token);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json() as MetaDebugData;
  if (!response.ok || !payload.data?.is_valid) return null;
  return payload.data;
}

function redirect(request: Request, message: string) {
  return NextResponse.redirect(new URL(`/inbox/conexiones?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateSecret = process.env.META_OAUTH_STATE_SECRET?.trim();
  const [provider, issuedAt, nonce, signature] = (state ?? "").split(".");
  const payload = [provider, issuedAt, nonce].join(".");
  const expected = stateSecret ? createHmac("sha256", stateSecret).update(payload).digest("base64url") : "";
  const validSignature = signature && expected && signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  const validAge = Number.isFinite(Number(issuedAt)) && Date.now() - Number(issuedAt) < 10 * 60 * 1000;
  if (!code || !validSignature || !validAge || (provider !== "facebook" && provider !== "instagram")) return redirect(request, "No se pudo validar la conexion con Meta.");

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!appId || !appSecret || !appUrl) return redirect(request, "Faltan credenciales de Meta en produccion.");

  const access = await requireAdminAccess();
  const tokenUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId); tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", `${appUrl}/api/meta/connect/callback`); tokenUrl.searchParams.set("code", code);
  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
  const tokenData = await tokenResponse.json() as MetaTokenData;
  if (!tokenResponse.ok || !tokenData.access_token) return redirect(request, "Meta no autorizo la conexion.");
  const longLivedUrl = new URL(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token`);
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", tokenData.access_token);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  const longLivedResponse = await fetch(longLivedUrl, { cache: "no-store" });
  const longLivedData = await longLivedResponse.json() as MetaTokenData;
  if (!longLivedResponse.ok || !longLivedData.access_token) {
    return redirect(request, "No se pudo convertir la autorizacion Meta en un token de larga duracion.");
  }
  const userToken = longLivedData.access_token;
  const userTokenDebug = await debugMetaToken(userToken, appId, appSecret);
  if (!userTokenDebug) return redirect(request, "Meta devolvio un token invalido.");
  const grantedScopes = userTokenDebug.scopes ?? [];
  const missingScopes = REQUIRED_SCOPES[provider].filter((scope) => !grantedScopes.includes(scope));
  if (missingScopes.length > 0) {
    return redirect(request, `Faltan permisos Meta requeridos: ${missingScopes.join(", ")}.`);
  }
  const [userResponse, pagesResponse] = await Promise.all([
    fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me?fields=id&access_token=${encodeURIComponent(userToken)}`, { cache: "no-store" }),
    fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`, { cache: "no-store" }),
  ]);
  const userData = await userResponse.json() as MetaUser;
  const pagesData = await pagesResponse.json() as { data?: MetaPage[] };
  if (!userResponse.ok || !userData.id || !pagesResponse.ok) {
    return redirect(request, "Meta no devolvio la identidad y las paginas autorizadas.");
  }
  const pages = (await Promise.all((pagesData.data ?? []).map(async (page) => {
    const accountId = provider === "instagram" ? page.instagram_business_account?.id : page.id;
    if (!accountId || !page.id || !page.access_token) return null;
    const pageTokenDebug = await debugMetaToken(page.access_token, appId, appSecret);
    if (!pageTokenDebug) return null;
    return {
      accessToken: page.access_token,
      grantedScopes,
      id: page.id,
      instagramBusinessAccount: page.instagram_business_account?.id
        ? {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username,
          }
        : undefined,
      name: page.name ?? "Pagina de Facebook",
      tokenExpiresAt: tokenExpiration(pageTokenDebug),
    };
  }))).filter((page) => page !== null);
  if (!pages.length) return redirect(request, provider === "instagram" ? "No encontramos una cuenta profesional de Instagram vinculada." : "No encontramos una Pagina de Facebook elegible.");

  const response = NextResponse.redirect(new URL("/inbox/conexiones/seleccionar-meta", request.url));
  response.cookies.set(META_OAUTH_PENDING_COOKIE, encryptPendingMetaConnection({
    empresaId: access.tenant.empresaId,
    issuedAt: Date.now(),
    metaUserId: userData.id,
    pages,
    profileId: access.tenant.profileId,
    provider,
  }), { httpOnly: true, maxAge: 10 * 60, sameSite: "lax", secure: true, path: "/" });
  return response;
}
