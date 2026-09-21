import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import forge from "node-forge";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const basePath = path.join(projectRoot, "src", specifier.slice(2));
    const resolvedPath = existsSync(basePath) ? basePath : `${basePath}.ts`;
    return { shortCircuit: true, url: pathToFileURL(resolvedPath).href };
  },
});

const { buildBasicFiscalXml } = await import("../src/modules/billing/xml/builders.ts");
const { signXmlWithPkcs12 } = await import("../src/modules/billing/signing/pkcs12.ts");
const { validateFiscalXmlAgainstOfficialXsd } = await import(
  "../src/modules/billing/xml/validation.ts"
);

function certificateFixture() {
  const keyPair = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keyPair.publicKey;
  certificate.serialNumber = "03abcdef";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attributes = [{ name: "commonName", value: "Biz.OS Builder Runtime Test" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keyPair.privateKey, forge.md.sha256.create());
  const password = "test-pin-789";
  const p12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [certificate], password, {
    algorithm: "3des",
  });
  return {
    base64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()),
    password,
  };
}

test("Biz.OS builds, signs and validates its own XML 4.4 invoice", async () => {
  const built = buildBasicFiscalXml({
    activityCode: "620100",
    clave: "50601012600310112345600100010100000000011999999999",
    consecutivo: "00100001010000000001",
    creditTermDays: null,
    currencyCode: "CRC",
    documentTypeCode: "01",
    exchangeRate: 1,
    issuer: {
      address: {
        addressLine: "Cien metros norte del parque central",
        cantonCode: "01",
        districtCode: "01",
        neighborhood: null,
        provinceCode: "1",
      },
      email: "facturacion@example.com",
      identificationNumber: "3101123456",
      identificationType: "02",
      legalName: "Biz OS Pruebas Sociedad Anonima",
      softwareProviderIdentification: "3101123456",
    },
    issueDate: "2026-09-14T16:00:00.000Z",
    lines: [
      {
        cabysCode: "8311100000000",
        commercialCode: "SERV-001",
        detail: "Servicio de prueba",
        discountAmount: 0,
        grossAmount: 1000,
        lineNumber: 1,
        quantity: 1,
        subtotal: 1000,
        taxableBase: 1000,
        taxAmount: 130,
        taxes: [
          {
            amount: 130,
            rate: 13,
            taxCode: "01",
            taxRateCode: "08",
            taxableBase: 1000,
          },
        ],
        totalLineAmount: 1130,
        unitCode: "Unid",
        unitPrice: 1000,
      },
    ],
    paymentMethods: [{ amount: 1130, code: "01" }],
    receiver: {
      email: "cliente@example.com",
      identificationNumber: "109990999",
      identificationType: "01",
      name: "Cliente de Prueba",
    },
    references: [],
    saleConditionCode: "01",
    totals: {
      totalComprobante: 1130,
      totalDescuentos: 0,
      totalImpuestos: 130,
      totalVenta: 1000,
      totalVentaNeta: 1000,
    },
  });
  assert.match(built.xml, /<ProveedorSistemas>3101123456<\/ProveedorSistemas>/);
  assert.match(built.xml, /<FechaEmision>2026-09-14T10:00:00-06:00<\/FechaEmision>/);

  const fixture = certificateFixture();
  const signed = await signXmlWithPkcs12({
    certificateBase64: fixture.base64,
    pin: fixture.password,
    unsignedXml: built.xml,
  });
  const validation = await validateFiscalXmlAgainstOfficialXsd(signed.signedXml);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
});
