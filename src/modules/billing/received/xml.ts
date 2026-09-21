import { DOMParser, type Element as XmlElement } from "@xmldom/xmldom";

export type ReceivedFiscalXmlValidationError = {
  code: string;
  group: string;
  message: string;
};

export type ReceivedFiscalXmlParseResult = {
  clave: string | null;
  consecutivo: string | null;
  currencyCode: string | null;
  documentRoot: string | null;
  documentTypeCode: string | null;
  haciendaStatus: string | null;
  issuerIdentification: string | null;
  issuerName: string | null;
  issueDatetime: string | null;
  parsedData: Record<string, unknown>;
  receiverIdentification: string | null;
  receiverName: string | null;
  totalAmount: number | null;
  validationErrors: ReceivedFiscalXmlValidationError[];
};

const MAX_XML_BYTES = 2_000_000;

const SUPPORTED_ROOTS = {
  FacturaElectronica: {
    documentTypeCode: "01",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica",
  },
  NotaDebitoElectronica: {
    documentTypeCode: "02",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
  },
  NotaCreditoElectronica: {
    documentTypeCode: "03",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
  },
  TiqueteElectronico: {
    documentTypeCode: "04",
    namespace: "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico",
  },
} as const;

type SupportedRoot = keyof typeof SUPPORTED_ROOTS;

function elementName(element: XmlElement) {
  return element.localName || element.nodeName.replace(/^.*:/, "");
}

function directChild(element: XmlElement | null, name: string) {
  if (!element) return null;
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child?.nodeType === 1 && elementName(child as XmlElement) === name) {
      return child as XmlElement;
    }
  }
  return null;
}

function childText(element: XmlElement | null, name: string) {
  return directChild(element, name)?.textContent?.trim() || null;
}

function nestedChildText(element: XmlElement | null, parentName: string, name: string) {
  return childText(directChild(element, parentName), name);
}

function numberValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIssueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function error(code: string, group: string, message: string): ReceivedFiscalXmlValidationError {
  return { code, group, message };
}

export function parseReceivedFiscalXml(xml: string): ReceivedFiscalXmlParseResult {
  const trimmedXml = xml.trim();
  const validationErrors: ReceivedFiscalXmlValidationError[] = [];
  const byteLength = Buffer.byteLength(trimmedXml, "utf8");

  if (!trimmedXml || byteLength > MAX_XML_BYTES) {
    validationErrors.push(
      error("invalid_xml_size", "XML", "El XML esta vacio o supera el limite de 2 MB."),
    );
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(trimmedXml)) {
    validationErrors.push(
      error("unsafe_xml_declaration", "XML", "El XML contiene declaraciones DTD o ENTITY no permitidas."),
    );
  }

  const parserErrors: string[] = [];
  let document: ReturnType<DOMParser["parseFromString"]> | null = null;
  try {
    document = new DOMParser({
      onError: (level, message) => {
        if (level !== "warning") parserErrors.push(String(message));
      },
    }).parseFromString(trimmedXml, "application/xml");
  } catch (parseError) {
    parserErrors.push(parseError instanceof Error ? parseError.message : "XML mal formado");
  }
  const root = document?.documentElement ?? null;

  if (!root || parserErrors.length > 0) {
    validationErrors.push(
      error("malformed_xml", "XML", "El contenido no es un documento XML bien formado."),
    );
  }

  const documentRoot = root ? elementName(root) : null;
  const supported = documentRoot
    ? SUPPORTED_ROOTS[documentRoot as SupportedRoot]
    : undefined;

  if (!supported) {
    validationErrors.push(
      error(
        "unsupported_document_type",
        "XML",
        "El tipo de comprobante no esta admitido para importacion fiscal 4.4.",
      ),
    );
  } else if (root?.namespaceURI !== supported.namespace) {
    validationErrors.push(
      error(
        "invalid_fiscal_namespace",
        "XML",
        `El namespace de ${documentRoot} no corresponde al esquema oficial 4.4.`,
      ),
    );
  }

  const emisor = directChild(root, "Emisor");
  const receptor = directChild(root, "Receptor");
  const resumen = directChild(root, "ResumenFactura");
  const clave = childText(root, "Clave");
  const consecutivo = childText(root, "NumeroConsecutivo");
  const issuerName = childText(emisor, "Nombre");
  const issuerIdentification = nestedChildText(emisor, "Identificacion", "Numero");
  const receiverName = childText(receptor, "Nombre");
  const receiverIdentification = nestedChildText(receptor, "Identificacion", "Numero");
  const rawIssueDatetime = childText(root, "FechaEmision");
  const issueDatetime = normalizeIssueDate(rawIssueDatetime);
  const currencyContainer = directChild(resumen, "CodigoTipoMoneda");
  const currencyCode =
    childText(currencyContainer, "CodigoMoneda") ?? childText(resumen, "CodigoMoneda");
  const totalAmount = numberValue(childText(resumen, "TotalComprobante"));

  if (!clave || !/^\d{50}$/.test(clave)) {
    validationErrors.push(
      error("missing_or_invalid_clave", "XML", "Falta clave numerica valida de 50 digitos."),
    );
  }
  if (!consecutivo || !/^\d{20}$/.test(consecutivo)) {
    validationErrors.push(
      error(
        "missing_or_invalid_consecutivo",
        "XML",
        "Falta numero consecutivo valido de 20 digitos.",
      ),
    );
  }
  if (!issuerName) {
    validationErrors.push(error("missing_issuer_name", "Emisor", "Falta nombre del emisor."));
  }
  if (!issuerIdentification) {
    validationErrors.push(
      error("missing_issuer_identification", "Emisor", "Falta identificacion del emisor."),
    );
  }
  if (!rawIssueDatetime || !issueDatetime) {
    validationErrors.push(
      error("missing_or_invalid_issue_date", "XML", "Falta una fecha de emision valida."),
    );
  }
  if (!currencyCode) {
    validationErrors.push(error("missing_currency", "Resumen", "Falta la moneda del comprobante."));
  }
  if (totalAmount === null || totalAmount < 0) {
    validationErrors.push(
      error("missing_or_invalid_total", "Resumen", "Falta un total de comprobante valido."),
    );
  }

  return {
    clave,
    consecutivo,
    currencyCode,
    documentRoot,
    documentTypeCode: supported?.documentTypeCode ?? null,
    haciendaStatus: null,
    issuerIdentification,
    issuerName,
    issueDatetime,
    parsedData: {
      currencyCode,
      documentRoot,
      documentTypeCode: supported?.documentTypeCode ?? null,
      parser: "secure-dom-v1",
      receiverIdentification,
      receiverName,
      xsdVersion: "4.4",
    },
    receiverIdentification,
    receiverName,
    totalAmount,
    validationErrors,
  };
}
