import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const databaseMigration = source("database/migrations/0070_whapp_meta_compliance_and_classification.sql");
const supabaseMigration = source("supabase/migrations/20260814090000_whapp_meta_compliance_and_classification.sql");
const tierDatabaseMigration = source("database/migrations/0071_meta_volume_tier_pricing.sql");
const tierSupabaseMigration = source("supabase/migrations/20260814220000_meta_volume_tier_pricing.sql");
const rateDatabaseMigration = source("database/migrations/0072_seed_meta_rates_2026_08_14.sql");
const rateSupabaseMigration = source("supabase/migrations/20260814221000_seed_meta_rates_2026_08_14.sql");
const dispatcher = source("src/modules/whapp/server/campaign-dispatcher.ts");
const contactPolicy = source("src/modules/whapp/server/messaging-policy.ts");
const inboxActions = source("src/modules/inbox/actions.ts");
const oauthCallback = source("src/app/api/meta/connect/callback/route.ts");
const oauthSelect = source("src/app/api/meta/connect/select/route.ts");
const deletionRoute = source("src/app/api/meta/data-deletion/route.ts");
const signedRequest = source("src/services/meta/signed-request.ts");
const webhookRoute = source("src/app/api/webhooks/meta/route.ts");
const webhookSignals = source("src/services/meta/webhook-signals.ts");
const widget = source("src/modules/inbox-widget/components/floating-inbox-widget.tsx");

test("compliance migration copies are identical and tenant isolated", () => {
  assert.equal(databaseMigration.trim(), supabaseMigration.trim());
  assert.match(databaseMigration, /inbox_contacto_preferencias/);
  assert.match(databaseMigration, /inbox_consentimiento_eventos/);
  assert.match(databaseMigration, /detectar_inbox_baja_desde_mensaje/);
  assert.match(databaseMigration, /registrar_inbox_consentimiento_servicio_inbound/);
  assert.match(databaseMigration, /empresa_id = public\.current_empresa_id\(\)/);
  assert.match(databaseMigration, /enable row level security/);
});

test("campaign dispatch fails closed on consent, template, quality and pricing", () => {
  assert.match(dispatcher, /recipient\.consentimiento_id/);
  assert.match(dispatcher, /meta_status !== "APPROVED"/);
  assert.match(dispatcher, /quality_status === "RED"/);
  assert.match(dispatcher, /inbox_meta_tarifas/);
  assert.match(dispatcher, /No existe tarifa Meta vigente/);
  assert.match(dispatcher, /volumePosition/);
  assert.match(contactPolicy, /estado === "baja"/);
  assert.match(contactPolicy, /paused_at/);
  assert.match(contactPolicy, /mensajeria_comercial/);
});

test("Meta pricing supports delivered-message volume tiers and free entry points", () => {
  assert.equal(tierDatabaseMigration.trim(), tierSupabaseMigration.trim());
  assert.match(tierDatabaseMigration, /volume_from/);
  assert.match(tierDatabaseMigration, /volume_position/);
  assert.match(tierDatabaseMigration, /free_entry_point/);
  assert.match(tierDatabaseMigration, /date_trunc\('month'/);
});

test("current official rates are reproducible for operational markets", () => {
  assert.equal(rateDatabaseMigration.trim(), rateSupabaseMigration.trim());
  assert.match(rateDatabaseMigration, /REST_OF_LATIN_AMERICA/);
  assert.match(rateDatabaseMigration, /MEXICO/);
  assert.match(rateDatabaseMigration, /whatsappbusiness\.com\/products\/platform-pricing/);
  assert.match(rateDatabaseMigration, /40000001, null/);
});

test("official template sync is the only route to approved sends", () => {
  assert.match(inboxActions, /fetchWhatsAppTemplates/);
  assert.match(inboxActions, /syncWhatsAppTemplatesAction/);
  assert.match(inboxActions, /meta_status: template\.status/);
  assert.match(inboxActions, /last_synced_at: syncedAt/);
  assert.match(inboxActions, /La plantilla debe estar aprobada y sincronizada con Meta/);
});

test("OAuth records the Meta owner and subscribes full messaging signals", () => {
  assert.match(oauthCallback, /metaUserId: userData\.id/);
  assert.match(oauthCallback, /fb_exchange_token/);
  assert.match(oauthCallback, /debug_token/);
  assert.match(oauthCallback, /REQUIRED_SCOPES/);
  assert.match(oauthCallback, /tokenExpiresAt/);
  assert.match(oauthSelect, /inbox_meta_oauth_propietarios/);
  assert.match(oauthSelect, /granted_scopes: page\.grantedScopes/);
  assert.match(oauthSelect, /token_expires_at: page\.tokenExpiresAt/);
  for (const field of [
    "messages",
    "messaging_postbacks",
    "message_deliveries",
    "message_reads",
    "message_echoes",
    "message_reactions",
    "messaging_seen",
  ]) assert.match(oauthSelect, new RegExp(field));
});

test("Meta privacy callbacks verify signatures and remove server secrets", () => {
  assert.match(signedRequest, /createHmac\("sha256", appSecret\)/);
  assert.match(signedRequest, /timingSafeEqual/);
  assert.match(deletionRoute, /procesar_meta_data_deletion_server/);
  assert.match(databaseMigration, /delete from public\.inbox_canal_secretos/);
  assert.match(databaseMigration, /delete from vault\.secrets/);
  assert.match(databaseMigration, /proveedor_estado = 'data_deleted'/);
});

test("supplemental webhook processing covers cross-channel delivery signals", () => {
  assert.match(webhookRoute, /processMetaWebhookSignals/);
  assert.match(webhookSignals, /delivery\?\.mids/);
  assert.match(webhookSignals, /read\?\.watermark/);
  assert.match(webhookSignals, /message\?\.is_echo/);
  assert.match(webhookSignals, /reaccion_meta/);
});

test("popup consumes first-class labels and funnel stages without layout replacement", () => {
  assert.match(databaseMigration, /inbox_conversacion_etiquetas/);
  assert.match(databaseMigration, /inbox_conversacion_funnel/);
  assert.match(databaseMigration, /upsert_inbox_funnel_etapa/);
  assert.match(widget, /operations\.availableTags/);
  assert.match(widget, /operations\.funnelStages/);
  assert.match(widget, /whapp-tools/);
});
