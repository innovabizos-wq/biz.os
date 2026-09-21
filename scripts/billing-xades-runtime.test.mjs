import assert from "node:assert/strict";
import test from "node:test";

import forge from "node-forge";

import { inspectPkcs12Certificate, signXmlWithPkcs12 } from "../src/modules/billing/signing/pkcs12.ts";

function certificateFixture() {
  const keyPair = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keyPair.publicKey;
  certificate.serialNumber = "01abcdef";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attributes = [{ name: "commonName", value: "Biz.OS XAdES Runtime Test" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keyPair.privateKey, forge.md.sha256.create());
  const password = "test-pin-123";
  const p12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [certificate], password, {
    algorithm: "3des",
  });
  return {
    base64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()),
    password,
  };
}

test("the Hacienda signer opens PKCS#12 and creates a verified XAdES-EPES signature", async () => {
  const fixture = certificateFixture();
  const certificate = await inspectPkcs12Certificate(fixture.base64, fixture.password);
  assert.equal(certificate.serialLast4, "cdef");

  const result = await signXmlWithPkcs12({
    certificateBase64: fixture.base64,
    pin: fixture.password,
    unsignedXml: '<?xml version="1.0" encoding="utf-8"?><FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Clave>50601012600310112345600100010100000000011999999999</Clave></FacturaElectronica>',
  });

  assert.equal(result.algorithm, "XAdES-EPES/RSA-SHA256");
  assert.match(result.signedXml, /<ds:Signature\b/);
  assert.match(result.signedXml, /http:\/\/uri\.etsi\.org\/01903\/v1\.3\.2#/);
  assert.match(result.signedXml, /SignaturePolicyIdentifier/);
  assert.match(result.signedXml, /MH-DGT-RES-0027-2024/);
  assert.match(result.signedXml, /rsa-sha256/);
  assert.match(result.signedXml, /xmlenc#sha256/);
});
