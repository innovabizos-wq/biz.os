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
  const documentLayout = source("src/modules/quotes/components/quote-document-layout.tsx");
  const quoteBuilder = source("src/modules/quotes/components/floating-quote-button.tsx");
  const printPage = source("src/app/(app)/cotizaciones/[cotizacionId]/imprimir/page.tsx");
  const settingsPage = source("src/app/(app)/cotizaciones/ajustes/page.tsx");

  assert.match(printDocument, /QuoteDocumentLayout/);
  assert.match(documentLayout, /settings\.templateCode/);
  assert.match(documentLayout, /settings\.logoDataUrl/);
  assert.match(documentLayout, /settings\.documentLabel/);
  assert.match(documentLayout, /function Executive/);
  assert.match(documentLayout, /function Bold/);
  assert.match(documentLayout, /function Minimal/);
  assert.match(documentLayout, /function Editorial/);
  assert.match(documentLayout, /function Classic/);
  assert.match(quoteBuilder, /QuoteDocumentLayout/);
  assert.match(quoteBuilder, /documentSettings/);
  assert.match(source("src\/modules\/quotes\/components\/quote-document-style-form.tsx"), /encType="multipart\/form-data"/);
  assert.match(source("src\/modules\/quotes\/components\/quote-document-style-form.tsx"), /<button[^>]+type="submit"/);
  assert.match(source("src\/modules\/quotes\/components\/quote-document-style-form.tsx"), /saveQuoteDocumentSettingsAction\(formData\)/);
  assert.match(printPage, /getQuoteDocumentSettings/);
  assert.match(settingsPage, /admin\.settings\.manage/);
});
