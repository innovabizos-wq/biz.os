import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseReceivedFiscalXml } from "../src/modules/billing/received/xml.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/20260914142000_fiscal_xml_imports.sql", import.meta.url),
  "utf8",
);
const actionSource = readFileSync(
  new URL("../src/modules/billing/actions.ts", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/app/(app)/facturacion/recepcion/page.tsx", import.meta.url),
  "utf8",
);

const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">
  <Clave>50601012600310112345600100010100000000011999999999</Clave>
  <NumeroConsecutivo>00100001010000000001</NumeroConsecutivo>
  <FechaEmision>2026-09-14T10:00:00-06:00</FechaEmision>
  <Emisor><Nombre>Empresa Emisora</Nombre><Identificacion><Tipo>02</Tipo><Numero>3101123456</Numero></Identificacion></Emisor>
  <Receptor><Nombre>Empresa Receptora</Nombre><Identificacion><Tipo>02</Tipo><Numero>3101999999</Numero></Identificacion></Receptor>
  <ResumenFactura><CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1</TipoCambio></CodigoTipoMoneda><TotalComprobante>1130.00</TotalComprobante></ResumenFactura>
</FacturaElectronica>`;

test("the external XML parser anchors issuer and receiver fields in a secure DOM", () => {
  const parsed = parseReceivedFiscalXml(invoiceXml);
  assert.equal(parsed.documentRoot, "FacturaElectronica");
  assert.equal(parsed.documentTypeCode, "01");
  assert.equal(parsed.issuerIdentification, "3101123456");
  assert.equal(parsed.receiverIdentification, "3101999999");
  assert.equal(parsed.currencyCode, "CRC");
  assert.equal(parsed.totalAmount, 1130);
  assert.deepEqual(parsed.validationErrors, []);
});

test("the external XML parser rejects entities and non-official namespaces", () => {
  const unsafe = parseReceivedFiscalXml(
    invoiceXml
      .replace("<?xml version=\"1.0\" encoding=\"UTF-8\"?>", '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///etc/passwd">]>')
      .replace("https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica", "https://invalid.example/factura"),
  );
  const codes = unsafe.validationErrors.map((entry) => entry.code);
  assert.ok(codes.includes("unsafe_xml_declaration"));
  assert.ok(codes.includes("invalid_fiscal_namespace"));
});

test("the import migration enforces tenant isolation, hashes, deduplication and atomic archiving", () => {
  assert.match(migration, /create table if not exists public\.fiscal_xml_import_batches/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /empresa_id = \(select public\.current_empresa_id\(\)\)/);
  assert.match(migration, /fiscal_received_documents_empresa_xml_sha256_unique/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /extensions\.digest/);
  assert.match(migration, /create or replace function public\.import_fiscal_external_xml/);
  assert.match(migration, /insert into public\.fiscal_received_documents/);
  assert.match(migration, /insert into public\.fiscal_received_document_artifacts/);
  assert.match(migration, /'haciendaStatusVerified', false/);
  assert.doesNotMatch(migration, /grant execute[^;]+to anon/is);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/is);
  assert.match(migration, /to service_role/);
  assert.match(migration, /permission\.codigo in \('billing\.issue', 'billing\.invoices\.create', 'billing\.receive'\)/);
});

test("the reception action previews before import and validates identity plus official XSD", () => {
  assert.match(actionSource, /validateFiscalXmlAgainstOfficialXsd\(xmlText\)/);
  assert.match(actionSource, /receiver_company_mismatch/);
  assert.match(actionSource, /issuer_company_mismatch/);
  assert.match(actionSource, /import_fiscal_external_xml/);
  assert.match(actionSource, /p_actor_id: access\.tenant\.profileId/);
  assert.match(actionSource, /status: "duplicate"/);
  assert.match(pageSource, /Tico Factura/);
  assert.match(pageSource, /Validar vista previa/);
  assert.match(pageSource, /Estado Hacienda no verificado/);
});
