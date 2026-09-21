import assert from "node:assert/strict";
import test from "node:test";

import forge from "node-forge";

import { signXmlWithPkcs12 } from "../src/modules/billing/signing/pkcs12.ts";
import { validateFiscalXmlAgainstOfficialXsd } from "../src/modules/billing/xml/validation.ts";

function certificateFixture() {
  const keyPair = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keyPair.publicKey;
  certificate.serialNumber = "02abcdef";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attributes = [{ name: "commonName", value: "Biz.OS XSD Runtime Test" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keyPair.privateKey, forge.md.sha256.create());
  const password = "test-pin-456";
  const p12 = forge.pkcs12.toPkcs12Asn1(keyPair.privateKey, [certificate], password, {
    algorithm: "3des",
  });
  return {
    base64: forge.util.encode64(forge.asn1.toDer(p12).getBytes()),
    password,
  };
}

const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?><FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Clave>50601012600310112345600100010100000000011999999999</Clave><ProveedorSistemas>3101123456</ProveedorSistemas><CodigoActividadEmisor>620100</CodigoActividadEmisor><NumeroConsecutivo>00100001010000000001</NumeroConsecutivo><FechaEmision>2026-09-14T10:00:00-06:00</FechaEmision><Emisor><Nombre>Biz OS Pruebas Sociedad Anonima</Nombre><Identificacion><Tipo>02</Tipo><Numero>3101123456</Numero></Identificacion><Ubicacion><Provincia>1</Provincia><Canton>01</Canton><Distrito>01</Distrito><OtrasSenas>Cien metros norte del parque central</OtrasSenas></Ubicacion><CorreoElectronico>facturacion@example.com</CorreoElectronico></Emisor><Receptor><Nombre>Cliente de Prueba</Nombre><Identificacion><Tipo>01</Tipo><Numero>109990999</Numero></Identificacion><CorreoElectronico>cliente@example.com</CorreoElectronico></Receptor><CondicionVenta>01</CondicionVenta><DetalleServicio><LineaDetalle><NumeroLinea>1</NumeroLinea><CodigoCABYS>8311100000000</CodigoCABYS><Cantidad>1.000</Cantidad><UnidadMedida>Unid</UnidadMedida><Detalle>Servicio de prueba</Detalle><PrecioUnitario>1000.00000</PrecioUnitario><MontoTotal>1000.00000</MontoTotal><SubTotal>1000.00000</SubTotal><BaseImponible>1000.00000</BaseImponible><Impuesto><Codigo>01</Codigo><CodigoTarifaIVA>08</CodigoTarifaIVA><Tarifa>13.00</Tarifa><Monto>130.00000</Monto></Impuesto><ImpuestoAsumidoEmisorFabrica>0.00000</ImpuestoAsumidoEmisorFabrica><ImpuestoNeto>130.00000</ImpuestoNeto><MontoTotalLinea>1130.00000</MontoTotalLinea></LineaDetalle></DetalleServicio><ResumenFactura><CodigoTipoMoneda><CodigoMoneda>CRC</CodigoMoneda><TipoCambio>1.00000</TipoCambio></CodigoTipoMoneda><TotalVenta>1000.00000</TotalVenta><TotalVentaNeta>1000.00000</TotalVentaNeta><TotalDesgloseImpuesto><Codigo>01</Codigo><CodigoTarifaIVA>08</CodigoTarifaIVA><TotalMontoImpuesto>130.00000</TotalMontoImpuesto></TotalDesgloseImpuesto><TotalImpuesto>130.00000</TotalImpuesto><MedioPago><TipoMedioPago>01</TipoMedioPago><TotalMedioPago>1130.00000</TotalMedioPago></MedioPago><TotalComprobante>1130.00000</TotalComprobante></ResumenFactura></FacturaElectronica>`;

test("a signed Hacienda invoice passes the bundled official XML 4.4 schema", async () => {
  const fixture = certificateFixture();
  const signed = await signXmlWithPkcs12({
    certificateBase64: fixture.base64,
    pin: fixture.password,
    unsignedXml: invoiceXml,
  });
  const validation = await validateFiscalXmlAgainstOfficialXsd(signed.signedXml);
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(validation.pendingXsdValidation, false);
  assert.equal(validation.validator, "libxml2/xmllint-wasm");
});

test("the official validator rejects unsigned or structurally incomplete XML", async () => {
  const validation = await validateFiscalXmlAgainstOfficialXsd(
    '<?xml version="1.0"?><FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica"><Clave>123</Clave></FacturaElectronica>',
  );
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.length > 0);
});
