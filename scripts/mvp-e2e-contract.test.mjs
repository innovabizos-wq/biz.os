import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function exists(path) {
  assert.ok(existsSync(new URL(path, root)), `Missing required MVP route or contract: ${path}`);
}

function srcFiles(dir = "src") {
  const dirUrl = new URL(`${dir}/`, root);
  const entries = readdirSync(dirUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const childPath = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...srcFiles(childPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(childPath);
    }
  }

  return files;
}

const protectedModuleLayouts = [
  ["src/app/(app)/autoblog/layout.tsx", "autoblog"],
  ["src/app/(app)/despacho/layout.tsx", "dispatch"],
  ["src/app/(app)/inbox/layout.tsx", "whapp"],
  ["src/app/(app)/inventario/layout.tsx", "inventory"],
  ["src/app/(app)/compras/layout.tsx", "purchases"],
  ["src/app/(app)/pagos/layout.tsx", "payments"],
  ["src/app/(app)/rrhh/layout.tsx", "hr"],
  ["src/app/(app)/ventas/layout.tsx", "sales"],
  ["src/app/(app)/whapp/layout.tsx", "whapp"],
  ["src/app/(app)/admin/ia/layout.tsx", "ai"],
];

const criticalRoutes = [
  "src/app/(auth)/onboarding/page.tsx",
  "src/app/(auth)/invitation/page.tsx",
  "src/app/(app)/crm/clientes/page.tsx",
  "src/app/(app)/crm/clientes/nuevo/page.tsx",
  "src/app/(app)/cotizaciones/page.tsx",
  "src/app/(app)/cotizaciones/nueva/page.tsx",
  "src/app/(app)/cotizaciones/[cotizacionId]/imprimir/page.tsx",
  "src/app/(app)/ventas/page.tsx",
  "src/app/(app)/pagos/page.tsx",
  "src/app/(app)/compras/page.tsx",
  "src/app/(app)/compras/error.tsx",
  "src/app/(app)/compras/ordenes/[ordenId]/page.tsx",
  "src/app/(app)/inventario/page.tsx",
  "src/app/(app)/despacho/page.tsx",
  "src/app/(app)/pagos/error.tsx",
  "src/app/(app)/rrhh/personal/page.tsx",
  "src/app/(app)/inbox/conversaciones/page.tsx",
  "src/app/(app)/admin/modulos/page.tsx",
  "src/app/(app)/admin/fiscal/page.tsx",
  "src/app/(app)/admin/ia/page.tsx",
  "src/app/api/webhooks/meta/route.ts",
  "src/app/api/mobile/bootstrap/route.ts",
  "src/app/api/mobile/dispatch/route.ts",
];

test("MVP critical routes exist and remain routable", () => {
  for (const route of criticalRoutes) {
    exists(route);
  }
});

test("optional and operational module route groups are protected by the module contract", () => {
  for (const [layoutPath, moduleCode] of protectedModuleLayouts) {
    const layout = source(layoutPath);
    assert.match(layout, /requireActiveModule/);
    assert.match(layout, new RegExp(`requireActiveModule\\("${moduleCode}"\\)`));
  }
});

test("module toggle, fiscal and Meta configuration changes recalculate module health", () => {
  assert.match(
    source("src/modules/platform-modules/actions.ts"),
    /recalcular_salud_modulos_empresa_actual/,
  );
  assert.match(
    source("src/modules/billing/actions.ts"),
    /recalcular_salud_modulos_empresa_actual/,
  );
  assert.match(
    source("src/modules/inbox/actions.ts"),
    /recalcular_salud_modulos_empresa_actual/,
  );
});

test("WhatsApp real send obtains access tokens only through the service-role RPC", () => {
  const inboxActions = source("src/modules/inbox/actions.ts");

  assert.match(inboxActions, /createServiceRoleClient/);
  assert.match(inboxActions, /obtener_inbox_whatsapp_send_config_server/);
  assert.doesNotMatch(
    inboxActions,
    /\.rpc\("obtener_inbox_whatsapp_send_config",/,
  );
});

test("Meta webhook route stays server-only and avoids anon RPC access", () => {
  const webhookRoute = source("src/app/api/webhooks/meta/route.ts");

  assert.match(webhookRoute, /createServiceRoleClient/);
  assert.match(webhookRoute, /buscar_canal_por_verify_token/);
  assert.match(webhookRoute, /verificar_meta_webhook_signature/);
  assert.match(webhookRoute, /procesar_inbox_webhook_meta/);
});

test("Meta secret writes use service-role server RPCs", () => {
  const inboxActions = source("src/modules/inbox/actions.ts");

  assert.match(inboxActions, /createServiceRoleClient/);
  assert.match(inboxActions, /guardar_inbox_canal_meta_secretos_server/);
  assert.match(inboxActions, /regenerar_inbox_canal_verify_token_server/);
  assert.doesNotMatch(
    inboxActions,
    /\.rpc\("guardar_inbox_canal_meta_secretos",/,
  );
  assert.doesNotMatch(
    inboxActions,
    /\.rpc\(\s*"regenerar_inbox_canal_verify_token",/,
  );
});

test("service-role client stays server-only and allowlisted", () => {
  const adminHelper = source("src/lib/supabase/admin.ts");
  const allSourceFiles = srcFiles();
  const adminImporters = allSourceFiles
    .filter((file) => source(file).includes("@/lib/supabase/admin"))
    .sort();

  assert.match(adminHelper, /import "server-only";/);
  assert.deepEqual(adminImporters, [
    "src/app/api/webhooks/meta/route.ts",
    "src/app/api/whapp/email/inbound/route.ts",
    "src/modules/inbox/actions.ts",
    "src/modules/whapp/server/campaign-dispatcher.ts",
  ]);

  for (const file of allSourceFiles) {
    const content = source(file);

    if (file !== "src/lib/supabase/admin.ts") {
      assert.doesNotMatch(
        content,
        /SUPABASE_SERVICE_ROLE_KEY/,
        `${file} must not read SUPABASE_SERVICE_ROLE_KEY directly`,
      );
    }

    if (content.includes("@/lib/supabase/admin")) {
      assert.doesNotMatch(
        content,
        /^["']use client["'];?/m,
        `${file} must not import service-role admin client from a Client Component`,
      );
    }
  }
});

test("authenticated SaaS shell and commercial flow are wired for sellable demo", () => {
  const authActions = source("src/modules/auth/actions.ts");
  const authSession = source("src/lib/auth/session.ts");
  const appLayout = source("src/app/(app)/layout.tsx");
  const quoteDetailPage = source("src/app/(app)/cotizaciones/[cotizacionId]/page.tsx");
  const quotePrintPage = source("src/app/(app)/cotizaciones/[cotizacionId]/imprimir/page.tsx");
  const quotePrintButton = source("src/modules/quotes/components/quote-print-button.tsx");
  const quotesActions = source("src/modules/quotes/actions.ts");
  const saleDetailPage = source("src/app/(app)/ventas/[ventaId]/page.tsx");
  const saleInventoryActions = source("src/modules/sales-inventory/actions.ts");
  const dispatchActions = source("src/modules/dispatch/actions.ts");
  const paymentsActions = source("src/modules/payments/actions.ts");
  const paymentsPage = source("src/app/(app)/pagos/page.tsx");
  const paymentsError = source("src/app/(app)/pagos/error.tsx");
  const purchasesPage = source("src/app/(app)/compras/page.tsx");
  const purchasesError = source("src/app/(app)/compras/error.tsx");
  const purchaseDetailPage = source("src/app/(app)/compras/ordenes/[ordenId]/page.tsx");
  const purchasesQueries = source("src/modules/purchases/queries.ts");
  const paymentsQueries = source("src/modules/payments/queries.ts");

  assert.match(authActions, /supabase\.auth\.signInWithPassword/);
  assert.match(authActions, /supabase\.auth\.signUp/);
  assert.match(authActions, /bootstrap_empresa_inicial/);
  assert.match(authSession, /supabase\.auth\.getUser/);
  assert.match(authSession, /createTenantContext/);
  assert.match(appLayout, /redirect\("\/login"\)/);
  assert.match(appLayout, /redirect\("\/onboarding"\)/);

  assert.match(quoteDetailPage, /\/imprimir/);
  assert.match(quoteDetailPage, /Imprimir \/ guardar PDF/);
  assert.doesNotMatch(quoteDetailPage, /PDF y envio se implementaran/);
  assert.match(quotePrintPage, /QuotePrintDocument/);
  assert.match(quotePrintPage, /quotes\.view/);
  assert.match(quotePrintButton, /window\.print\(\)/);

  assert.match(quotesActions, /generar_venta_desde_cotizacion/);
  assert.match(quotesActions, /cambiar_estado_venta/);
  assert.match(quotesActions, /revalidatePath\("\/ventas"\)/);
  assert.match(saleDetailPage, /SaleInventoryPanel/);
  assert.match(saleDetailPage, /SaleDispatchPanel/);
  assert.match(saleDetailPage, /Pagos esta disponible desde/);
  assert.match(saleInventoryActions, /aplicar_salida_inventario_venta/);
  assert.match(saleInventoryActions, /inventory\.stock\.adjust/);
  assert.match(dispatchActions, /crear_despacho_desde_venta/);
  assert.match(dispatchActions, /dispatch\.orders\.create/);
  assert.match(paymentsActions, /sincronizar_cuentas_cobrar_ventas_actual/);
  assert.match(paymentsActions, /sincronizar_cuentas_pagar_compras_actual/);
  assert.match(paymentsActions, /registrar_movimiento_cuenta/);
  assert.match(paymentsActions, /anular_cuenta_pago/);
  assert.match(paymentsActions, /payments\.accounts\.manage/);
  assert.match(paymentsPage, /syncReceivablesAction/);
  assert.match(paymentsPage, /recordPaymentAction/);
  assert.match(paymentsPage, /Por cobrar/);
  assert.match(paymentsPage, /Por pagar/);
  assert.match(paymentsPage, /sync-payables/);
  assert.match(paymentsError, /unstable_retry/);
  assert.match(purchasesPage, /createSupplierAction/);
  assert.match(purchasesPage, /Crear orden multi-item/);
  assert.match(purchaseDetailPage, /receivePurchaseOrderAction/);
  assert.match(purchaseDetailPage, /Registrar recepcion/);
  assert.match(purchaseDetailPage, /emitPurchaseOrderAction/);
  assert.match(purchaseDetailPage, /cancelPurchaseOrderAction/);
  assert.match(purchasesError, /unstable_retry/);
  assert.doesNotMatch(purchasesQueries, /![a-z_]+_empresa_fkey/);
  assert.doesNotMatch(paymentsQueries, /![a-z_]+_empresa_fkey/);
});

test("Inbox surfaces Meta as real guarded operation instead of simulated-only copy", () => {
  const inboxPage = source("src/app/(app)/inbox/page.tsx");
  const conversationsPage = source("src/app/(app)/inbox/conversaciones/page.tsx");
  const newChannelPage = source("src/app/(app)/inbox/canales/nuevo/page.tsx");
  const messageThread = source("src/modules/inbox/components/inbox-message-thread.tsx");
  const replyForm = source("src/modules/inbox/components/inbox-reply-form.tsx");
  const whappPage = source("src/app/(app)/whapp/page.tsx");

  assert.match(inboxPage, /webhook oficial/);
  assert.match(inboxPage, /secretos protegidos/);
  assert.match(inboxPage, /envio real/);
  assert.doesNotMatch(inboxPage, /sin webhooks, tokens ni\s+envios reales/);
  assert.match(conversationsPage, /conversaciones manuales o Meta/);
  assert.match(newChannelPage, /envio real queda disponible/);
  assert.match(messageThread, /Enviado por WhatsApp/);
  assert.match(messageThread, /Entrante Meta/);
  assert.match(replyForm, /Cumplimiento Meta/);
  assert.match(whappPage, /Cumplimiento Meta/);
  assert.doesNotMatch(whappPage, /Regla 24h pendiente/);
});

test("CRM customer search and consultation deduping stay document-aware", () => {
  const customersDatabase = source("src/modules/crm/components/customers-database.tsx");
  const customersTable = source("src/modules/crm/components/customers-table.tsx");
  const crmQueries = source("src/modules/crm/queries.ts");
  const customerDetailPage = source("src/app/(app)/crm/clientes/[clienteId]/page.tsx");
  const customerTimeline = source("src/modules/crm/components/customer-timeline.tsx");
  const consultationResultCard = source("src/modules/consultations/components/consultation-result-card.tsx");
  const consultationQueries = source("src/modules/consultations/queries.ts");

  assert.match(customersDatabase, /customer\.identificacion/);
  assert.match(customersDatabase, /Con documento/);
  assert.match(customersDatabase, /Seguimiento pendiente/);
  assert.match(customersDatabase, /sin-actividad/);
  assert.match(customersTable, /Identificacion/);
  assert.match(customersTable, /Ultimo movimiento/);
  assert.match(crmQueries, /from\("crm_interacciones"\)/);
  assert.match(crmQueries, /from\("crm_seguimientos"\)/);
  assert.match(crmQueries, /from\("cotizaciones"\)/);
  assert.match(crmQueries, /from\("ventas"\)/);
  assert.match(customerDetailPage, /Historial del cliente/);
  assert.match(customerTimeline, /Cotizacion/);
  assert.match(customerTimeline, /Venta/);
  assert.match(consultationResultCard, /Cliente existente en CRM/);
  assert.match(consultationQueries, /identificacion_normalizada/);
});

test("payments, purchases, AI and mobile contracts are wired through server guarded modules", () => {
  assert.match(source("src/modules/payments/actions.ts"), /sincronizar_cuentas_cobrar_ventas_actual/);
  assert.match(source("src/modules/payments/actions.ts"), /sincronizar_cuentas_pagar_compras_actual/);
  assert.match(source("src/modules/payments/actions.ts"), /registrar_movimiento_cuenta/);
  assert.match(source("src/modules/purchases/actions.ts"), /crear_orden_compra_completa/);
  assert.match(source("src/modules/purchases/actions.ts"), /recibir_orden_compra_parcial/);
  assert.match(source("src/modules/billing/actions.ts"), /isModuleActive\(access\.tenant\.activeModules, "billing"\)/);
  assert.match(source("src/modules/ai/actions.ts"), /guardar_configuracion_empresa/);
  assert.match(source("src/modules/ai/actions.ts"), /registrar_ai_usage_event/);
  assert.match(source("src/app/api/mobile/bootstrap/route.ts"), /mobile\.access/);
  assert.match(source("src/app/api/mobile/dispatch/route.ts"), /dispatch\.orders\.view/);
});

test("reports module has an explicit sidebar access path", () => {
  const appLayout = source("src/app/(app)/layout.tsx");
  const sidebarNav = source("src/components/navigation/app-sidebar-nav.tsx");

  assert.match(appLayout, /isModuleActive\(tenant\.activeModules, "reports"\)/);
  assert.match(appLayout, /hasPermission\(tenant\.permissions, "reports\.dashboard\.view"\)/);
  assert.match(appLayout, /showReports=\{Boolean\(showReports\)\}/);
  assert.match(sidebarNav, /showReports \? "Reportes" : "Inicio"/);
  assert.match(sidebarNav, /showHrDashboard[\s\S]*label: "Planillas"/);
});
