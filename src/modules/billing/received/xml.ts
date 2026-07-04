export type ReceivedFiscalXmlParseResult = {
  clave: string | null;
  consecutivo: string | null;
  currencyCode: string | null;
  haciendaStatus: string | null;
  issuerIdentification: string | null;
  issuerName: string | null;
  issueDatetime: string | null;
  parsedData: Record<string, unknown>;
  totalAmount: number | null;
  validationErrors: { code: string; group: string; message: string }[];
};

function tagValue(xml: string, tagName: string) {
  const pattern = new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`, "i");
  const match = xml.match(pattern);
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() || null;
}

function nestedTagValue(xml: string, parentTagName: string, tagName: string) {
  const pattern = new RegExp(
    `<(?:\\w+:)?${parentTagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${parentTagName}>`,
    "i",
  );
  const parent = xml.match(pattern)?.[1];
  return parent ? tagValue(parent, tagName) : null;
}

function numberValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIssueDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseReceivedFiscalXml(xml: string): ReceivedFiscalXmlParseResult {
  const trimmedXml = xml.trim();
  const validationErrors: ReceivedFiscalXmlParseResult["validationErrors"] = [];

  if (!trimmedXml.startsWith("<") || !trimmedXml.includes(">")) {
    validationErrors.push({
      code: "invalid_xml_shape",
      group: "XML",
      message: "El contenido no parece ser XML.",
    });
  }

  const clave = tagValue(trimmedXml, "Clave");
  const consecutivo = tagValue(trimmedXml, "NumeroConsecutivo");
  const issuerName = nestedTagValue(trimmedXml, "Emisor", "Nombre");
  const issuerIdentification = nestedTagValue(trimmedXml, "Identificacion", "Numero");
  const issueDatetime = normalizeIssueDate(tagValue(trimmedXml, "FechaEmision"));
  const currencyCode = tagValue(trimmedXml, "CodigoMoneda") ?? tagValue(trimmedXml, "CodigoTipoMoneda");
  const totalAmount = numberValue(tagValue(trimmedXml, "TotalComprobante"));

  if (!clave || !/^\d{50}$/.test(clave)) {
    validationErrors.push({
      code: "missing_or_invalid_clave",
      group: "XML",
      message: "Falta clave numerica valida de 50 digitos.",
    });
  }

  if (!consecutivo || !/^\d{20}$/.test(consecutivo)) {
    validationErrors.push({
      code: "missing_or_invalid_consecutivo",
      group: "XML",
      message: "Falta numero consecutivo valido de 20 digitos.",
    });
  }

  if (!issuerName) {
    validationErrors.push({
      code: "missing_issuer_name",
      group: "Emisor",
      message: "Falta nombre del emisor.",
    });
  }

  if (!issuerIdentification) {
    validationErrors.push({
      code: "missing_issuer_identification",
      group: "Emisor",
      message: "Falta identificacion del emisor.",
    });
  }

  return {
    clave,
    consecutivo,
    currencyCode,
    haciendaStatus: null,
    issuerIdentification,
    issuerName,
    issueDatetime,
    parsedData: {
      currencyCode,
      parser: "parseReceivedFiscalXml",
      pendingXsdValidation: true,
    },
    totalAmount,
    validationErrors,
  };
}
