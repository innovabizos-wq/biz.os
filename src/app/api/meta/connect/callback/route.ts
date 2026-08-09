import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { META_GRAPH_API_VERSION } from "@/services/meta/constants";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import {
  encryptPendingMetaConnection,
  META_OAUTH_PENDING_COOKIE,
} from "@/modules/inbox/meta-oauth-pending";

type MetaPage = { access_token?: string; id?: string; instagram_business_account?: { id?: string; username?: string }; name?: string };

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
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokenData.access_token) return redirect(request, "Meta no autorizo la conexion.");
  const pagesResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(tokenData.access_token)}`, { cache: "no-store" });
  const pagesData = await pagesResponse.json() as { data?: MetaPage[] };
  const pages = (pagesData.data ?? []).flatMap((page) => {
    const accountId = provider === "instagram" ? page.instagram_business_account?.id : page.id;
    if (!accountId || !page.id || !page.access_token) return [];
    return [{
      accessToken: page.access_token,
      id: page.id,
      instagramBusinessAccount: page.instagram_business_account?.id
        ? {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username,
          }
        : undefined,
      name: page.name ?? "Pagina de Facebook",
    }];
  });
  if (!pages.length) return redirect(request, provider === "instagram" ? "No encontramos una cuenta profesional de Instagram vinculada." : "No encontramos una Pagina de Facebook elegible.");

  const response = NextResponse.redirect(new URL("/inbox/conexiones/seleccionar-meta", request.url));
  response.cookies.set(META_OAUTH_PENDING_COOKIE, encryptPendingMetaConnection({
    empresaId: access.tenant.empresaId,
    issuedAt: Date.now(),
    pages,
    profileId: access.tenant.profileId,
    provider,
  }), { httpOnly: true, maxAge: 10 * 60, sameSite: "lax", secure: true, path: "/" });
  return response;
}
