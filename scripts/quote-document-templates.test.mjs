import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("quote document templates are tenant-scoped and writable only by company administrators", () => {
  const migration = source("supabase/migrations/20260926230000_quote_document_templates.sql");
  assert.match(migration, /create table if not exists public\.company_quote_document_settings/);
  assert.match(migration, /'executive', 'bold', 'minimal', 'editorial', 'classic'/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /current_empresa_id\(\)/);
  assert.match(migration, /current_user_has_permission\('admin\.settings\.manage'\)/);
});

test("quote document settings apply a company template and commercial identity at print time", () => {
  const printDocument = source("src/modules/quotes/components/quote-print-document.tsx");
  const printPage = source("src/app/(app)/cotizaciones/[cotizacionId]/imprimir/page.tsx");
  const settingsPage = source("src/app/(app)/cotizaciones/ajustes/page.tsx");

  assert.match(printDocument, /settings\.templateCode/);
  assert.match(printDocument, /settings\.logoDataUrl/);
  assert.match(printDocument, /settings\.documentLabel/);
  assert.match(printPage, /getQuoteDocumentSettings/);
  assert.match(settingsPage, /admin\.settings\.manage/);
});
