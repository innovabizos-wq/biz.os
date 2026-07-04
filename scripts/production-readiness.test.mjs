import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function sourceFiles(dir) {
  const entries = readdirSync(new URL(`${dir}/`, root), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childPath = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...sourceFiles(childPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(childPath);
    }
  }

  return files;
}

function envValue(envText, key) {
  const match = envText.match(new RegExp(`^${key}=(.*)$`, "m"));
  assert.ok(match, `.env.example must include ${key}`);
  return match[1].trim();
}

test("production env example exposes only required configuration placeholders", () => {
  const envExample = source(".env.example");
  const readme = source("README.md");
  const requiredKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "PUBLIC_SIGNUP_ENABLED",
    "FISCAL_CONFIG_ENCRYPTION_KEY",
    "HACIENDA_ENVIRONMENT",
    "BILLING_HACIENDA_SEND_ENABLED",
    "BILLING_HACIENDA_STATUS_ENABLED",
    "META_WEBHOOK_SKIP_SIGNATURE",
    "META_WEBHOOK_DEBUG_LOGS",
    "META_GRAPH_API_VERSION",
    "WHAPP_CAMPAIGN_WORKER_SECRET",
    "CRON_SECRET",
    "WHAPP_EMAIL_INBOUND_SECRET",
  ];

  for (const key of requiredKeys) {
    envValue(envExample, key);
  }

  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "FISCAL_CONFIG_ENCRYPTION_KEY",
    "WHAPP_CAMPAIGN_WORKER_SECRET",
    "CRON_SECRET",
    "WHAPP_EMAIL_INBOUND_SECRET",
  ]) {
    assert.equal(envValue(envExample, key), "", `${key} must not contain a sample secret`);
  }

  assert.equal(envValue(envExample, "PUBLIC_SIGNUP_ENABLED"), "true");
  assert.equal(envValue(envExample, "HACIENDA_ENVIRONMENT"), "pruebas");
  assert.equal(envValue(envExample, "BILLING_HACIENDA_SEND_ENABLED"), "false");
  assert.equal(envValue(envExample, "BILLING_HACIENDA_STATUS_ENABLED"), "false");
  assert.equal(envValue(envExample, "META_WEBHOOK_SKIP_SIGNATURE"), "false");
  assert.equal(envValue(envExample, "META_WEBHOOK_DEBUG_LOGS"), "false");
  assert.equal(envValue(envExample, "META_GRAPH_API_VERSION"), "v25.0");
  assert.doesNotMatch(envExample, /PAYMENTS_ENABLED|PURCHASES_ENABLED|MOBILE_API_ENABLED|AI_API_KEY|AI_PROVIDER/);
  assert.doesNotMatch(readme, /PAYMENTS_ENABLED|PURCHASES_ENABLED|MOBILE_API_ENABLED|AI_API_KEY|AI_PROVIDER/);
  assert.match(readme, /src\/lib\/supabase\/admin\.ts/);
  assert.match(readme, /server-only/);
});

test("Whapp campaign dispatcher is scheduled and protected for production", () => {
  const vercelConfig = JSON.parse(source("vercel.json"));
  const dispatcherRoute = source("src/app/api/whapp/campanas/despachar/route.ts");
  const whappDocs = source("docs/modules/whapp-core.md");

  assert.deepEqual(vercelConfig.crons, [
    {
      path: "/api/whapp/campanas/despachar",
      schedule: "0 6 * * *",
    },
  ]);
  assert.match(dispatcherRoute, /export async function GET/);
  assert.match(dispatcherRoute, /process\.env\.CRON_SECRET/);
  assert.match(dispatcherRoute, /process\.env\.WHAPP_CAMPAIGN_WORKER_SECRET/);
  assert.match(dispatcherRoute, /const limit = getLimit\(url\)/);
  assert.match(dispatcherRoute, /\[whapp-campaign-dispatcher\]/);
  assert.match(dispatcherRoute, /updated: results\.filter/);
  assert.match(whappDocs, /Vercel Cron/);
  assert.match(whappDocs, /CRON_SECRET/);
});

test("Whapp campaign dispatcher has bounded retries and backoff", () => {
  const dispatcher = source("src/modules/whapp/server/campaign-dispatcher.ts");
  const inboxActions = source("src/modules/inbox/actions.ts");
  const whappDocs = source("docs/modules/whapp-core.md");

  assert.match(dispatcher, /MAX_CAMPAIGN_RECIPIENT_ATTEMPTS = 3/);
  assert.match(dispatcher, /RETRY_BACKOFF_MINUTES = \[0, 5, 30\]/);
  assert.match(dispatcher, /status: exhausted \? "failed" : "retrying"/);
  assert.match(dispatcher, /estado: result\.ok \? "enviado" : exhausted \? "fallido" : "en_cola"/);
  assert.match(inboxActions, /status === "retrying"/);
  assert.match(whappDocs, /Reintentos controlados/);
  assert.match(whappDocs, /Al tercer intento fallido pasa a/);
});

test("Whapp email inbound endpoint is protected and stores omnichannel email", () => {
  const route = source("src/app/api/whapp/email/inbound/route.ts");
  const inboxDocs = source("docs/modules/inbox-core.md");
  const whappDocs = source("docs/modules/whapp-core.md");

  assert.match(route, /process\.env\.WHAPP_EMAIL_INBOUND_SECRET/);
  assert.match(route, /createServiceRoleClient/);
  assert.match(route, /channel\.canal !== "email"/);
  assert.match(route, /channel\.proveedor !== "email"/);
  assert.match(route, /\.eq\("canal_message_id", payload\.externalMessageId\)/);
  assert.match(route, /from\("inbox_conversaciones"\)/);
  assert.match(route, /from\("inbox_mensajes"\)/);
  assert.match(inboxDocs, /webhook seguro de correo entrante/i);
  assert.match(whappDocs, /correo por webhook seguro/i);
});

test("local TypeScript build artifacts stay out of version control", () => {
  const gitignore = source(".gitignore");

  assert.match(gitignore, /\*\.tsbuildinfo/);
  assert.doesNotMatch(source("README.md"), /tsconfig\.tsbuildinfo` como artefacto requerido/);
});

test("Meta webhook signature bypass is impossible in production", () => {
  const signatureSource = source("src/services/meta/signature.ts");

  assert.match(signatureSource, /process\.env\.NODE_ENV !== "production"/);
  assert.match(signatureSource, /process\.env\.META_WEBHOOK_SKIP_SIGNATURE === "true"/);
});

test("Inbox production copy does not claim Meta messaging is unavailable", () => {
  const publicDocs = [
    "README.md",
    "docs/modules/inbox-core.md",
    "docs/modules/inbox-widget.md",
  ];
  const inboxFiles = [
    ...publicDocs,
    ...sourceFiles("src/app/(app)/inbox"),
    ...sourceFiles("src/modules/inbox"),
    ...sourceFiles("src/modules/inbox-widget"),
  ];

  for (const file of inboxFiles) {
    const content = source(file);

    assert.doesNotMatch(
      content,
      /sin recibir ni enviar mensajes reales|sin integrar APIs reales de Meta|No crea webhooks|No recibe webhooks|No se envian mensajes reales en esta fase|no envia mensajes reales|El envio de mensajes se implementara en la siguiente fase|El textarea de respuesta es visual en esta fase/,
      `${file} contains stale non-sellable Inbox copy`,
    );
  }
});

test("Supabase advisor warnings have a production closeout policy", () => {
  const rpcAudit = source("docs/supabase-rpc-security-audit.md");
  const releaseChecklist = source("docs/release-checklist.md");

  assert.match(rpcAudit, /SECURITY DEFINER` ejecutables por `authenticated`: `103`/);
  assert.match(rpcAudit, /Todas validan `auth\.uid\(\)`: `103`/);
  assert.match(rpcAudit, /Sin validacion explicita de permiso \| 9/);
  assert.match(rpcAudit, /Sin validacion explicita de empresa \| 4/);
  assert.match(rpcAudit, /Con terminos de secretos aun expuestos a `authenticated` \| 2/);
  assert.match(rpcAudit, /obtener_inbox_canal_meta_estado/);
  assert.match(rpcAudit, /guardar_configuracion_fiscal/);
  assert.doesNotMatch(
    rpcAudit,
    /guardar_inbox_canal_meta_secretos\(\.\.\.\)\n- `obtener_inbox_whatsapp_send_config/,
  );
  assert.match(rpcAudit, /leaked password protection/);
  assert.match(releaseChecklist, /leaked password protection activado/);
  assert.match(releaseChecklist, /docs\/supabase-rpc-security-audit\.md/);
});
