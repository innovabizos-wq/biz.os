export type ParsedCabysRow = {
  code: string;
  description: string;
  isGood: boolean | null;
  isService: boolean | null;
  metadata: Record<string, unknown>;
  normalizedDescription: string;
  suggestedTaxRate: number | null;
  taxRateCode: string | null;
};

export type CabysImportParseResult = {
  errors: string[];
  rows: ParsedCabysRow[];
  skippedRows: number;
  totalRows: number;
};

const MAX_IMPORT_ROWS = 500;

function splitLine(line: string) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseBoolean(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "si", "true", "bien", "producto"].includes(normalized)) return true;
  if (["0", "no", "false", "servicio"].includes(normalized)) return false;
  return null;
}

function parseTaxRate(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function taxRateCodeForRate(rate: number | null) {
  if (rate === 13) return "08";
  if (rate === 0) return "01";
  return null;
}

function valueFrom(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value?.trim()) return value.trim();
  }

  return "";
}

export function parseCabysImportText(input: string): CabysImportParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      errors: ["El archivo debe incluir encabezado y al menos una fila."],
      rows: [],
      skippedRows: 0,
      totalRows: 0,
    };
  }

  const headers = splitLine(lines[0]).map(normalizeHeader);
  const rows: ParsedCabysRow[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  for (const [index, line] of lines.slice(1, MAX_IMPORT_ROWS + 1).entries()) {
    const values = splitLine(line);
    const record = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""]));
    const code = valueFrom(record, ["codigo", "code", "cabys", "codigo_cabys"]).replace(/\D/g, "");
    const description = valueFrom(record, ["descripcion", "description", "nombre", "detalle"]);
    const taxRate = parseTaxRate(valueFrom(record, ["tarifa", "iva", "impuesto", "tax_rate"]));
    const goodFlag = parseBoolean(valueFrom(record, ["bien", "producto", "is_good"]));
    const serviceFlag = parseBoolean(valueFrom(record, ["servicio", "is_service"]));

    if (!code || !description) {
      skippedRows += 1;
      errors.push(`Fila ${index + 2}: falta codigo o descripcion.`);
      continue;
    }

    if (code.length !== 13) {
      skippedRows += 1;
      errors.push(`Fila ${index + 2}: codigo CABYS debe tener 13 digitos.`);
      continue;
    }

    rows.push({
      code,
      description,
      isGood: goodFlag,
      isService: serviceFlag ?? (goodFlag === null ? null : !goodFlag),
      metadata: {
        importedColumns: record,
      },
      normalizedDescription: normalizeDescription(description),
      suggestedTaxRate: taxRate,
      taxRateCode: taxRateCodeForRate(taxRate),
    });
  }

  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    errors.push(`Importacion limitada a ${MAX_IMPORT_ROWS} filas por lote.`);
  }

  return {
    errors,
    rows,
    skippedRows,
    totalRows: lines.length - 1,
  };
}
