import { webcrypto } from "node:crypto";

import { DOMImplementation, DOMParser, XMLSerializer } from "@xmldom/xmldom";
import forge from "node-forge";
import * as xadesjs from "xadesjs";
import xpath from "xpath";

const POLICY_URL = "https://atv.hacienda.go.cr/ATV/ComprobanteElectronico/docs/esquemas/2024/v4.4/Resoluci%C3%B3n_General_sobre_disposiciones_t%C3%A9cnicas_comprobantes_electr%C3%B3nicos_para_efectos_tributarios.pdf";
const POLICY_SHA256_BASE64 = "DWxin1xWOeI8OuWQXazh4VjLWAaCLAA954em7DMh0h8=";
const MAX_CERTIFICATE_BYTES = 1_000_000;
const MAX_XML_BYTES = 2_000_000;

xadesjs.setNodeDependencies({ DOMImplementation, DOMParser, XMLSerializer, xpath });
xadesjs.Application.setEngine("NodeJS", webcrypto as unknown as Crypto);

type ParsedCertificate = {
  certificateChain: string[];
  expiresAt: Date;
  privateKey: CryptoKey;
  serialNumber: string;
};

export type Pkcs12CertificateInfo = {
  expiresAt: string;
  serialLast4: string;
};

function normalizedBase64(value: string) {
  return value.replace(/^data:[^,]+,/, "").replace(/\s+/g, "");
}

function matchingCertificate(
  certificates: forge.pki.Certificate[],
  privateKey: forge.pki.rsa.PrivateKey,
) {
  const modulus = privateKey.n.toString(16);
  return certificates.find((certificate) => {
    const publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;
    return publicKey?.n?.toString(16) === modulus;
  });
}

async function parsePkcs12(certificateBase64: string, pin: string): Promise<ParsedCertificate> {
  const normalized = normalizedBase64(certificateBase64);
  let derBytes: string;
  try {
    derBytes = forge.util.decode64(normalized);
  } catch {
    throw new Error("El certificado no contiene Base64 válido.");
  }
  if (!derBytes || derBytes.length > MAX_CERTIFICATE_BYTES) {
    throw new Error("El certificado .p12 está vacío o supera 1 MB.");
  }

  let privateKey: forge.pki.rsa.PrivateKey | null = null;
  let certificates: forge.pki.Certificate[] = [];
  try {
    const asn1 = forge.asn1.fromDer(derBytes, false);
    const pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, pin);
    const shroudedOid = forge.pki.oids.pkcs8ShroudedKeyBag;
    const keyOid = forge.pki.oids.keyBag;
    const certOid = forge.pki.oids.certBag;
    const shroudedBags = pkcs12.getBags({ bagType: shroudedOid })[shroudedOid] ?? [];
    const keyBags = pkcs12.getBags({ bagType: keyOid })[keyOid] ?? [];
    privateKey = (shroudedBags[0]?.key ?? keyBags[0]?.key ?? null) as forge.pki.rsa.PrivateKey | null;
    certificates = (pkcs12.getBags({ bagType: certOid })[certOid] ?? [])
      .map((bag) => bag.cert)
      .filter((certificate): certificate is forge.pki.Certificate => Boolean(certificate));
  } catch {
    throw new Error("No se pudo abrir el certificado .p12. Revisa el archivo y su PIN.");
  }

  if (!privateKey || certificates.length === 0) {
    throw new Error("El certificado .p12 no contiene una llave privada y un certificado utilizables.");
  }
  const leaf = matchingCertificate(certificates, privateKey);
  if (!leaf) throw new Error("La llave privada no corresponde al certificado incluido en el .p12.");

  const keyBits = privateKey.n.bitLength();
  if (keyBits !== 2048 && keyBits !== 4096) {
    throw new Error("Hacienda requiere una llave RSA de 2048 o 4096 bits.");
  }
  const now = new Date();
  if (leaf.validity.notBefore > now) throw new Error("El certificado todavía no es válido.");
  if (leaf.validity.notAfter <= now) throw new Error("El certificado está vencido.");

  const privateKeyInfo = forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privateKey));
  const privateKeyDer = forge.asn1.toDer(privateKeyInfo).getBytes();
  const importedKey = await webcrypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(privateKeyDer, (character) => character.charCodeAt(0)),
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["sign"],
  );
  const ordered = [leaf, ...certificates.filter((certificate) => certificate !== leaf)];
  return {
    certificateChain: ordered.map((certificate) => forge.util.encode64(
      forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes(),
    )),
    expiresAt: leaf.validity.notAfter,
    privateKey: importedKey as CryptoKey,
    serialNumber: leaf.serialNumber,
  };
}

export async function inspectPkcs12Certificate(
  certificateBase64: string,
  pin: string,
): Promise<Pkcs12CertificateInfo> {
  const parsed = await parsePkcs12(certificateBase64, pin);
  return {
    expiresAt: parsed.expiresAt.toISOString(),
    serialLast4: parsed.serialNumber.slice(-4).padStart(4, "0"),
  };
}

export async function signXmlWithPkcs12(input: {
  certificateBase64: string;
  pin: string;
  unsignedXml: string;
}) {
  if (!input.unsignedXml.trim() || Buffer.byteLength(input.unsignedXml, "utf8") > MAX_XML_BYTES) {
    throw new Error("El XML está vacío o supera el límite permitido para firma.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(input.unsignedXml)) {
    throw new Error("El XML contiene declaraciones no permitidas para firma.");
  }

  const parsed = await parsePkcs12(input.certificateBase64, input.pin);
  const document = xadesjs.Parse(input.unsignedXml);
  if (!document.documentElement) throw new Error("El XML no tiene un elemento principal válido.");

  const signer = new xadesjs.SignedXml();
  await signer.Sign(
    { name: "RSASSA-PKCS1-v1_5" },
    parsed.privateKey,
    document,
    {
      policy: {
        digestValue: POLICY_SHA256_BASE64,
        hash: "SHA-256",
        identifier: {
          description: "MH-DGT-RES-0027-2024, comprobantes electrónicos v4.4",
          value: POLICY_URL,
        },
      },
      references: [{ hash: "SHA-256", transforms: ["enveloped", "exc-c14n"], uri: "" }],
      signingCertificate: { certificate: parsed.certificateChain[0], digestAlgorithm: "SHA-256" },
      signingTime: { value: new Date() },
      x509: parsed.certificateChain,
    },
  );

  const signedXml = signer.toString();
  const signedDocument = xadesjs.Parse(signedXml);
  const signatures = signedDocument.getElementsByTagNameNS(
    "http://www.w3.org/2000/09/xmldsig#",
    "Signature",
  );
  if (signatures.length !== 1) throw new Error("La firma no produjo una etiqueta Signature única.");
  const verifier = new xadesjs.SignedXml(signedDocument);
  verifier.LoadXml(signatures.item(0) as Element);
  if (!(await verifier.Verify())) throw new Error("La firma XAdES generada no superó la verificación criptográfica.");

  return {
    algorithm: "XAdES-EPES/RSA-SHA256",
    certificateExpiresAt: parsed.expiresAt.toISOString(),
    certificateSerialLast4: parsed.serialNumber.slice(-4).padStart(4, "0"),
    signedXml,
  };
}
