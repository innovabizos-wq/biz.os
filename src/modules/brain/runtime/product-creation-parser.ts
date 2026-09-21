export type ProductCreationEntities = {
  bodegaNombre?: string;
  cantidadInicial?: number;
  nombre?: string;
  precioBase: number;
};

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim();
}

function parseBusinessNumber(value: string | undefined) {
  if (!value) return undefined;

  const compact = value.replace(/\s/g, "");
  const commas = compact.match(/,/g)?.length ?? 0;
  const dots = compact.match(/\./g)?.length ?? 0;

  if (commas > 0 && dots > 0) {
    const decimalSeparator = compact.lastIndexOf(",") > compact.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    return Number(compact.replace(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  const separator = commas > 0 ? "," : dots > 0 ? "." : null;
  if (!separator) return Number(compact);

  const [whole, decimal = ""] = compact.split(separator);
  if (decimal.length === 3) return Number(`${whole}${decimal}`);

  return Number(`${whole}.${decimal}`);
}

export function parseProductCreationEntities(message: string): ProductCreationEntities {
  const price = parseBusinessNumber(
    firstMatch(
      message,
      /\bprecio(?:\s+(?:de|es))?\s*[:#-]?\s*(?:\$|CRC|crc)?\s*([0-9][0-9.,]*)\b/i,
    ),
  );
  const cantidadInicial = parseBusinessNumber(
    firstMatch(
      message,
      /\b(?:cantidad|stock)(?:\s+inicial)?\s*(?:de|es)?\s*[:#-]?\s*([0-9][0-9.,]*)\b/i,
    ) ?? firstMatch(message, /\bcon\s+([0-9][0-9.,]*)\s+(?:unidades?|uds?|piezas?)\b/i),
  );
  const bodegaNombre = firstMatch(
    message,
    /\b(?:en\s+(?:la\s+)?)?bodega\s+(.+?)(?=\s*(?:,|\.|;|(?:con\s+)?(?:cantidad|stock)(?:\s+inicial)?\b|$))/i,
  );
  const nombre = message
    .replace(/^.*?\b(?:producto|servicio)\b/i, "")
    .split(/\b(?:precio|bodega|cantidad|stock)\b/i)[0]
    ?.trim()
    .replace(/[,;]+$/g, "")
    .trim();

  return {
    bodegaNombre: bodegaNombre || undefined,
    cantidadInicial: Number.isFinite(cantidadInicial) ? cantidadInicial : undefined,
    nombre: nombre || undefined,
    precioBase: typeof price === "number" && Number.isFinite(price) ? price : 0,
  };
}
