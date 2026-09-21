import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const client = source("src/services/meta/client.ts");
const actions = source("src/modules/inbox/actions.ts");
const queries = source("src/modules/inbox/queries.ts");
const replyForm = source("src/modules/inbox/components/inbox-reply-form.tsx");
const normalizers = source("src/services/meta/normalizers.ts");
const databaseMigration = source(
  "database/migrations/0067_meta_omnichannel_outbound.sql",
);
const supabaseMigration = source(
  "supabase/migrations/20260803055552_meta_omnichannel_outbound.sql",
);

test("Meta client sends real text through WhatsApp, Facebook and Instagram endpoints", () => {
  assert.match(client, /export async function sendWhatsAppTextMessage/);
  assert.match(client, /export async function sendFacebookTextMessage/);
  assert.match(client, /export async function sendInstagramTextMessage/);
  assert.match(client, /graph\.facebook\.com/);
  assert.match(client, /graph\.instagram\.com/);
  assert.match(client, /messaging_type: includeMessagingType \? "RESPONSE"/);
  assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(client, /error_subcode/);
});

test("reply action enforces the customer-care window and never simulates Meta sends", () => {
  assert.match(actions, /export async function sendMetaMessageAction/);
  assert.match(actions, /obtener_inbox_meta_send_config_server/);
  assert.match(actions, /META_REPLY_WINDOW_MS/);
  assert.match(actions, /sendWhatsAppTextMessage/);
  assert.match(actions, /sendFacebookTextMessage/);
  assert.match(actions, /sendInstagramTextMessage/);
  assert.match(actions, /registrar_inbox_mensaje_saliente_meta/);
  assert.match(actions, /no se permite registrar una respuesta simulada/);
  assert.match(replyForm, /isMetaChannel \? sendMetaMessageAction/);
  assert.doesNotMatch(replyForm, /Respuesta saliente simulada/);
  assert.doesNotMatch(replyForm, /Registrar respuesta simulada/);
});

test("send readiness checks each Meta account id, token expiry and the 24-hour window", () => {
  assert.match(queries, /phone_number_id/);
  assert.match(queries, /page_id/);
  assert.match(queries, /instagram_business_account_id/);
  assert.match(queries, /tokenExpiresAt/);
  assert.match(queries, /24 \* 60 \* 60 \* 1000/);
  assert.match(queries, /El cliente debe iniciar la conversacion/);
});

test("database migration keeps secrets server-only and restores minimum worker grants", () => {
  assert.equal(databaseMigration.trim(), supabaseMigration.trim());
  assert.match(databaseMigration, /obtener_inbox_meta_send_config_server/);
  assert.match(
    databaseMigration,
    /from public, anon, authenticated;\s*grant execute[\s\S]*to service_role;/,
  );
  assert.match(
    databaseMigration,
    /grant select, update on table public\.inbox_campana_destinatarios to service_role/,
  );
  assert.match(
    databaseMigration,
    /grant select, update on table public\.inbox_campanas to service_role/,
  );
  assert.match(
    databaseMigration,
    /grant select on table public\.inbox_meta_plantillas to service_role/,
  );
  assert.match(databaseMigration, /'mensaje_saliente_meta'/);
});

test("Facebook and Instagram echo events are ignored by the normalizer", () => {
  assert.match(normalizers, /isTrue\(message\.is_echo\)/);
  assert.match(normalizers, /isTrue\(message\.is_self\)/);
});
