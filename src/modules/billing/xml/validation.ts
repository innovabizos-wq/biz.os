import { readFile } from "node:fs/promises";
import path from "node:path";

import { validateXML } from "xmllint-wasm";

export type BillingXmlValidationResult = {
  errors: string[];
  ok: boolean;
  validator: string;
  xsdVersion: "4.4";
};

export interface BillingXmlValidator {
  validate(xml: string): Promise<BillingXmlValidationResult>;
}

const MAX_XML_BYTES = 2_000_000;
const SCHEMA_DIRECTORY = path.join(
  process.cwd(),
  "src",
  "modules",
  "billing",
  "xml",
  "schemas",
  "2024",
  "v4.4",
);
const SIGNATURE_SCHEMA_PATH = path.join(
  process.cwd(),
  "src",
  "modules",
  "billing",
  "xml",
  "schemas",
  "2024",
  "xmldsig-core-schema.xsd",
);

const SCHEMAS = {
  FacturaElectronica: {
    fileName: "FacturaElectronica_V4.4.xsd",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica",
  },
  NotaCreditoElectronica: {
    fileName: "NotaCreditoElectronica_V4.4.xsd",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
  },
  NotaDebitoElectronica: {
    fileName: "NotaDebitoElectronica_V4.4.xsd",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
  },
  TiqueteElectronico: {
    fileName: "TiqueteElectronico_V4.4.xsd",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico",
  },
} as const;

type RootName = keyof typeof SCHEMAS;

let schemaContentsPromise:
  | Promise<{ signature: string; xsdByRoot: Record<RootName, string> }>
  | undefined;

function loadSchemas() {
  schemaContentsPromise ??= Promise.all([
    readFile(SIGNATURE_SCHEMA_PATH, "utf8"),
    ...Object.values(SCHEMAS).map((schema) =>
      readFile(path.join(SCHEMA_DIRECTORY, schema.fileName), "utf8"),
    ),
  ]).then(([signature, ...schemas]) => ({
    signature,
    xsdByRoot: Object.fromEntries(
      (Object.keys(SCHEMAS) as RootName[]).map((root, index) => [root, schemas[index]]),
    ) as Record<RootName, string>,
  }));
  return schemaContentsPromise;
}

function schemaForXml(xml: string) {
  const match = xml.match(
    /<(FacturaElectronica|NotaCreditoElectronica|NotaDebitoElectronica|TiqueteElectronico)\b[^>]*\bxmlns="([^"]+)"/,
  );
  if (!match) throw new Error("El XML no declara una raiz y namespace fiscal 4.4 admitidos.");
  const root = match[1] as RootName;
  const expected = SCHEMAS[root];
  if (match[2] !== expected.namespace) {
    throw new Error(`El namespace de ${root} no corresponde al esquema oficial 4.4.`);
  }
  return { root, ...expected };
}

class OfficialHaciendaXsdValidator implements BillingXmlValidator {
  async validate(xml: string): Promise<BillingXmlValidationResult> {
    if (!xml.trim() || Buffer.byteLength(xml, "utf8") > MAX_XML_BYTES) {
      throw new Error("El XML esta vacio o supera 2 MB.");
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new Error("El XML contiene declaraciones DTD o ENTITY no permitidas.");
    }
    const schema = schemaForXml(xml);
    const contents = await loadSchemas();
    const result = await validateXML({
      initialMemoryPages: 512,
      maxMemoryPages: 1024,
      preload: {
        contents: contents.signature,
        fileName: "schemas/xmldsig-core-schema.xsd",
      },
      schema: {
        contents: contents.xsdByRoot[schema.root],
        fileName: `schemas/2024/v4.4/${schema.fileName}`,
      },
      xml: {
        contents: xml,
        fileName: `${schema.root}.xml`,
      },
    });
    return {
      errors: result.errors.slice(0, 20).map((error) =>
        error.loc
          ? `Linea ${error.loc.lineNumber}: ${error.message}`
          : error.message,
      ),
      ok: result.valid,
      validator: "libxml2/xmllint-wasm",
      xsdVersion: "4.4",
    };
  }
}

export function getBillingXmlValidator(): BillingXmlValidator {
  return new OfficialHaciendaXsdValidator();
}

export async function validateFiscalXmlAgainstOfficialXsd(
  xml: string,
): Promise<BillingXmlValidationResult & { enabled: true; pendingXsdValidation: boolean }> {
  const result = await getBillingXmlValidator().validate(xml);
  return {
    ...result,
    enabled: true,
    pendingXsdValidation: !result.ok,
  };
}
