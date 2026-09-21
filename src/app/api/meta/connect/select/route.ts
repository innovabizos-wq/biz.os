import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { META_GRAPH_API_VERSION } from "@/services/meta/constants";
import {
  decryptPendingMetaConnection,
  META_OAUTH_PENDING_COOKIE,
} from "@/modules/inbox/meta-oauth-pending";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

function redirect(request: Request, query: string) {
  return NextResponse.redirect(new URL(`/inbox/conexiones?${query}`, request.url));
}

const FACEBOOK_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
  "message_echoes",
].join(",");

const INSTAGRAM_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_reactions",
  "messaging_seen",
].join(",");

async function subscribeMetaAccountToMessages(
  accountId: string,
  accessToken: string,
  subscribedFields: string,
) {
  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${accountId}/subscribed_apps`,
    {
      body: new URLSearchParams({
        access_token: accessToken,
        subscribed_fields: subscribedFields,
      }),
      cache: "no-store",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    },
  );

  if (!response.ok) {
    console.error("Meta OAuth: no se pudo suscribir la pagina al webhook", {
      accountId,
      status: response.status,
    });
    return false;
  }

  return true;
}

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  const pending = decryptPendingMetaConnection(
    request.headers.get("cookie")
      ?.split("; ")
      .find((cookie) => cookie.startsWith(`${META_OAUTH_PENDING_COOKIE}=`))
      ?.slice(META_OAUTH_PENDING_COOKIE.length + 1),
  );
  if (
    !pending ||
    pending.empresaId !== access.tenant.empresaId ||
    pending.profileId !== access.tenant.profileId ||
    Date.now() - pending.issuedAt > 10 * 60 * 1000
  ) return redirect(request, "error=La%20seleccion%20de%20Meta%20expir%C3%B3.%20Vuelve%20a%20conectar.");

  const formData = await request.formData();
  const selectedIds = new Set(
    formData.getAll("pageId").filter((value): value is string => typeof value === "string"),
  );
  const selectedPages = pending.pages.filter((page) => selectedIds.has(page.id));
  if (!selectedPages.length) return redirect(request, "error=Selecciona%20al%20menos%20una%20Pagina.");

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return redirect(request, "error=Faltan%20credenciales%20de%20Meta%20en%20produccion.");

  const supabase = await createClient();
  const admin = createServiceRoleClient();
  for (const page of selectedPages) {
    const accountId = pending.provider === "instagram"
      ? page.instagramBusinessAccount?.id
      : page.id;
    if (!accountId) continue;

    const subscribed = await subscribeMetaAccountToMessages(
      accountId,
      page.accessToken,
      pending.provider === "instagram"
        ? INSTAGRAM_SUBSCRIBED_FIELDS
        : FACEBOOK_SUBSCRIBED_FIELDS,
    );
    if (!subscribed) {
      return redirect(
        request,
        `error=${encodeURIComponent(`No se pudo activar ${pending.provider === "instagram" ? "Instagram" : "Messenger"}. Intenta conectar la cuenta de nuevo.`)}`,
      );
    }

    const existing = await supabase.from("inbox_canales")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("proveedor", "meta")
      .eq("canal", pending.provider)
      .eq("identificador_externo", accountId)
      .maybeSingle<{ id: string }>();
    if (existing.error) {
      console.error("Meta OAuth: no se pudo consultar el canal existente", existing.error);
      return redirect(request, "error=No%20se%20pudo%20preparar%20un%20canal%20Meta.");
    }

    let channelId = existing.data?.id;
    if (!channelId) {
      const created = await supabase.rpc("crear_inbox_canal_meta", {
        p_app_id: appId,
        p_business_id: null,
        p_canal: pending.provider,
        p_identificador_externo: accountId,
        p_instagram_business_account_id: pending.provider === "instagram" ? accountId : null,
        p_nombre: pending.provider === "instagram"
          ? `Instagram ${page.instagramBusinessAccount?.username ?? page.name}`
          : page.name,
        p_page_id: page.id,
        p_phone_number_id: null,
        p_waba_id: null,
      });
      if (created.error) {
        console.error("Meta OAuth: no se pudo crear el canal", created.error);
        return redirect(request, "error=No%20se%20pudo%20crear%20un%20canal%20Meta.");
      }
      channelId = (created.data as Array<{ id: string }> | null)?.[0]?.id;
    }
    if (!channelId) return redirect(request, "error=No%20se%20pudo%20guardar%20un%20canal%20Meta.");

    const secrets = await admin.rpc("guardar_inbox_canal_meta_secretos_server", {
      p_access_token: page.accessToken,
      p_actor_id: access.tenant.profileId,
      p_app_secret: appSecret,
      p_canal_id: channelId,
      p_empresa_id: access.tenant.empresaId,
      p_token_expires_at: page.tokenExpiresAt,
      p_verify_token: randomUUID(),
    });
    if (secrets.error) {
      console.error("Meta OAuth: no se pudieron guardar los secretos", secrets.error);
      return redirect(request, "error=No%20se%20pudieron%20guardar%20las%20credenciales%20de%20Meta.");
    }

    const activated = await supabase.rpc("cambiar_estado_inbox_canal", {
      p_canal_id: channelId,
      p_estado: "activo",
    });
    if (activated.error) {
      console.error("Meta OAuth: no se pudo activar el canal", activated.error);
      return redirect(request, "error=Las%20credenciales%20se%20guardaron%2C%20pero%20no%20se%20pudo%20activar%20el%20canal.");
    }

    const { error: ownerError } = await admin
      .from("inbox_meta_oauth_propietarios")
      .upsert({
        canal_id: channelId,
        empresa_id: access.tenant.empresaId,
        granted_by: access.tenant.profileId,
        granted_scopes: page.grantedScopes,
        last_validated_at: new Date().toISOString(),
        meta_user_id: pending.metaUserId,
        proveedor: pending.provider,
        token_expires_at: page.tokenExpiresAt,
      }, { onConflict: "empresa_id,canal_id,meta_user_id" });
    if (ownerError) {
      console.error("Meta OAuth: no se pudo registrar el propietario OAuth", ownerError);
      return redirect(request, "error=El%20canal%20se%20conecto%2C%20pero%20no%20se%20pudo%20registrar%20la%20autorizacion.");
    }
  }

  const response = redirect(
    request,
    `success=${encodeURIComponent(
      `${selectedPages.length} canal(es) conectado(s) y listo(s) para recibir mensajes.`,
    )}`,
  );
  response.cookies.delete(META_OAUTH_PENDING_COOKIE);
  return response;
}
