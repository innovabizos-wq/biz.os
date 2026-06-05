"use server";

import { inflateRawSync } from "node:zlib";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATALOG_MONEDA } from "@/modules/catalog/constants";
import {
  changeWarehouseStatusSchema,
  createInventoryMovementSchema,
  createInventoryTransferSchema,
  createMaterialEntrySchema,
  createWarehouseSchema,
  importMaterialRowsSchema,
  updateStockLimitsSchema,
  updateWarehouseSchema,
} from "@/modules/inventory/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedProductRow = {
  producto_id?: string;
};

type MaterialImportRow = {
  cantidad?: number | string | null;
  codigo?: string | null;
  descripcion?: string | null;
  nombre?: string | null;
  precioBase?: number | string | null;
  unidadMedida?: string | null;
};

type CleanMaterialImportRow = {
  cantidad: number;
  codigo?: string;
  descripcion?: string;
  nombre: string;
  precioBase: number;
  unidadMedida: string;
};

type UploadedInventoryFile = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name?: string;
  size?: number;
  type?: string;
};

type ZipEntry = {
  data: Buffer;
  name: string;
};

const MAX_IMPORT_ROWS = 1000;

const INVENTORY_HEADER_ALIASES = {
  cantidad: [
    "cantidad",
    "cant",
    "qty",
    "quantity",
    "stock",
    "existencia",
    "existencias",
    "inventario",
    "onhand",
    "onhandqty",
    "disponible",
    "saldo",
  ],
  codigo: [
    "codigo",
    "codigo sku",
    "cod",
    "sku",
    "item",
    "itemcode",
    "item code",
    "productcode",
    "product code",
    "referencia",
    "ref",
    "barcode",
    "barras",
    "codigo barras",
    "upc",
    "ean",
    "clave",
    "idproducto",
  ],
  descripcion: [
    "descripcion",
    "description",
    "detalle",
    "observaciones",
    "notas",
    "concepto",
    "longdescription",
    "long description",
  ],
  nombre: [
    "nombre",
    "producto",
    "product",
    "productname",
    "product name",
    "articulo",
    "material",
    "descripcion producto",
    "nombre producto",
    "item name",
    "description",
  ],
  precioBase: [
    "preciobase",
    "precio base",
    "precio",
    "costo",
    "cost",
    "coste",
    "unit cost",
    "unit price",
    "precio unitario",
    "costo unitario",
    "valor",
  ],
  unidadMedida: [
    "unidadmedida",
    "unidad medida",
    "unidad",
    "um",
    "uom",
    "medida",
    "unit",
  ],
} satisfies Record<keyof Omit<CleanMaterialImportRow, "cantidad" | "precioBase"> | "cantidad" | "precioBase", string[]>;

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function normalizeImportText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-./()[\]#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLooseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value ?? "")
    .replace(/[^\d,.\-]/g, "")
    .replace(/(?!^)-/g, "")
    .trim();

  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = cleaned
      .replaceAll(thousandSeparator, "")
      .replace(decimalSeparator, ".");

    return Number(normalized);
  }

  if (lastComma > -1) {
    const decimals = cleaned.length - lastComma - 1;
    const normalized =
      decimals > 0 && decimals <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replaceAll(",", "");

    return Number(normalized);
  }

  if (lastDot > -1) {
    const decimals = cleaned.length - lastDot - 1;
    const normalized =
      decimals > 0 && decimals <= 2
        ? cleaned
        : cleaned.replaceAll(".", "");

    return Number(normalized);
  }

  return Number(cleaned);
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
}

function detectDelimiter(lines: string[]) {
  const sample = lines.slice(0, 8).join("\n");
  const candidates = [",", ";", "\t", "|"];

  return candidates
    .map((delimiter) => ({
      delimiter,
      score: sample
        .split(/\r?\n/)
        .reduce((sum, line) => sum + splitDelimitedLine(line, delimiter).length, 0),
    }))
    .sort((left, right) => right.score - left.score)[0]?.delimiter ?? ",";
}

function headerScore(headers: string[]) {
  return Object.values(INVENTORY_HEADER_ALIASES).reduce(
    (sum, aliases) =>
      sum +
      (headers.some((header) =>
        aliases.map(normalizeImportText).includes(header),
      )
        ? 1
        : 0),
    0,
  );
}

function rowsTableToImportRows(table: string[][]) {
  let headerIndex = 0;
  let bestScore = -1;

  table.slice(0, 12).forEach((row, index) => {
    const score = headerScore(row.map(normalizeImportText));

    if (score > bestScore) {
      bestScore = score;
      headerIndex = index;
    }
  });

  if (bestScore < 2) return [];

  const headers = table[headerIndex].map(normalizeImportText);
  const headerIndexByName = new Map(headers.map((header, index) => [header, index]));

  function cell(cells: string[], field: keyof typeof INVENTORY_HEADER_ALIASES) {
    for (const name of INVENTORY_HEADER_ALIASES[field]) {
      const index = headerIndexByName.get(normalizeImportText(name));

      if (index !== undefined) return cells[index]?.trim() ?? "";
    }

    return "";
  }

  return table
    .slice(headerIndex + 1)
    .map((cells) => {
      const descripcion = cell(cells, "descripcion");
      const nombre = cell(cells, "nombre") || descripcion;

      return {
        cantidad: parseLooseNumber(cell(cells, "cantidad")),
        codigo: cell(cells, "codigo"),
        descripcion,
        nombre,
        precioBase: parseLooseNumber(cell(cells, "precioBase")),
        unidadMedida: cell(cells, "unidadMedida"),
      };
    })
    .filter((row) => row.nombre);
}

function parseDelimitedInventoryText(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines);
  const table = lines.map((line) => splitDelimitedLine(line, delimiter));

  return rowsTableToImportRows(table);
}

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function columnIndexFromCellRef(cellRef: string) {
  const letters = cellRef.replace(/\d+/g, "").toUpperCase();

  return letters.split("").reduce((sum, letter) => {
    return sum * 26 + letter.charCodeAt(0) - 64;
  }, 0) - 1;
}

function parseZipEntries(buffer: Buffer) {
  const entries = new Map<string, ZipEntry>();
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;

  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) return entries;

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localOffset = buffer.readUInt32LE(centralOffset + 42);
    const name = buffer
      .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 8
        ? inflateRawSync(compressedData)
        : method === 0
          ? compressedData
          : Buffer.alloc(0);

    if (data.length > 0) entries.set(name, { data, name });

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string) {
  const sharedStrings: string[] = [];
  const matches = xml.matchAll(/<si[\s\S]*?<\/si>/g);

  for (const match of matches) {
    const text = [...match[0].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => decodeXmlText(textMatch[1] ?? ""))
      .join("");

    sharedStrings.push(text);
  }

  return sharedStrings;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowMatches = xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g);

    for (const cellMatch of cellMatches) {
      const attributes = cellMatch[1] ?? "";
      const body = cellMatch[2] ?? "";
      const ref = attributes.match(/\sr="([^"]+)"/)?.[1] ?? "";
      const type = attributes.match(/\st="([^"]+)"/)?.[1] ?? "";
      const columnIndex = ref ? columnIndexFromCellRef(ref) : cells.length;
      const rawValue =
        body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ??
        body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ??
        "";
      const value =
        type === "s"
          ? sharedStrings[Number(rawValue)] ?? ""
          : decodeXmlText(rawValue);

      cells[columnIndex] = value;
    }

    if (cells.some(Boolean)) rows.push(cells);
  }

  return rows;
}

async function parseUploadedInventoryFile(file: UploadedInventoryFile) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name?.toLowerCase() ?? "";

  if (name.endsWith(".xlsx")) {
    const entries = parseZipEntries(buffer);
    const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.data.toString("utf8");
    const sheetEntry =
      entries.get("xl/worksheets/sheet1.xml") ??
      [...entries.values()].find((entry) =>
        entry.name.startsWith("xl/worksheets/sheet"),
      );

    if (!sheetEntry) return [];

    const sharedStrings = sharedStringsXml
      ? parseSharedStrings(sharedStringsXml)
      : [];

    return rowsTableToImportRows(
      parseWorksheetRows(sheetEntry.data.toString("utf8"), sharedStrings),
    );
  }

  return parseDelimitedInventoryText(buffer.toString("utf8"));
}

function isUploadedInventoryFile(value: FormDataEntryValue | null): value is File {
  if (!value || typeof value !== "object") return false;

  const maybeFile = value as Partial<UploadedInventoryFile>;

  return (
    typeof maybeFile.arrayBuffer === "function" &&
    typeof maybeFile.size === "number" &&
    maybeFile.size > 0
  );
}

function cleanImportRows(rows: MaterialImportRow[]) {
  const deduped = new Map<string, CleanMaterialImportRow>();

  for (const row of rows) {
    const nombre = row.nombre?.trim() ?? "";
    const codigo = row.codigo?.trim() || undefined;

    if (!nombre) continue;

    const cleanRow: CleanMaterialImportRow = {
      cantidad: Math.max(parseLooseNumber(row.cantidad), 0),
      codigo,
      descripcion: row.descripcion?.trim() || undefined,
      nombre,
      precioBase: Math.max(parseLooseNumber(row.precioBase), 0),
      unidadMedida: row.unidadMedida?.trim() || "unidad",
    };
    const key = codigo
      ? `codigo:${normalizeImportText(codigo)}`
      : `nombre:${normalizeImportText(nombre)}:${normalizeImportText(cleanRow.unidadMedida)}`;
    const existing = deduped.get(key);

    if (existing) {
      existing.cantidad += cleanRow.cantidad;
      existing.descripcion ||= cleanRow.descripcion;
      existing.precioBase ||= cleanRow.precioBase;
      continue;
    }

    deduped.set(key, cleanRow);
  }

  return [...deduped.values()];
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo completar la operacion.";
  if (message.includes("Permiso") || message.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }
  if (message.includes("duplicate key") || message.includes("Ya existe")) {
    return "Ya existe un registro con esos datos.";
  }

  return message;
}

function logInventoryActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string>,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function revalidateInventoryPaths(productoId?: string) {
  revalidatePath("/inventario");
  revalidatePath("/inventario/productos");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/inventario/bodegas");

  if (productoId) {
    revalidatePath(`/catalogo/productos/${productoId}`);
  }
}

async function assertInventoryPermission(
  permission: "inventory.stock.adjust" | "inventory.warehouses.manage",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta acción.");
  }

  return access;
}

async function assertCatalogProductCreatePermission(redirectPath: string) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "catalog.products.create")) {
    redirectWithError(
      redirectPath,
      "Necesitas permiso para crear materiales desde catalogo.",
    );
  }

  return access;
}

async function createPhysicalProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    categoriaId?: string;
    codigo?: string;
    descripcion?: string;
    nombre: string;
    precioBase?: number;
    unidadMedida: string;
  },
) {
  const { data, error } = await supabase.rpc("crear_catalogo_producto", {
    p_categoria_id: input.categoriaId ?? null,
    p_codigo: input.codigo ?? null,
    p_descripcion: input.descripcion ?? null,
    p_impuesto_porcentaje: 0,
    p_moneda: DEFAULT_CATALOG_MONEDA,
    p_nombre: input.nombre,
    p_precio_base: input.precioBase ?? 0,
    p_tipo: "producto",
    p_unidad_medida: input.unidadMedida,
  });

  if (error) {
    return { error, productoId: null };
  }

  const productoId = (data as CreatedProductRow[] | null)?.[0]?.producto_id ?? null;

  if (!productoId) {
    return {
      error: { message: "No se recibio confirmacion del material creado." },
      productoId: null,
    };
  }

  return { error: null, productoId };
}

async function findExistingPhysicalProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    codigo?: string;
    empresaId: string;
    nombre: string;
  },
) {
  if (input.codigo) {
    const { data } = await supabase
      .from("catalogo_productos")
      .select("id")
      .eq("empresa_id", input.empresaId)
      .eq("tipo", "producto")
      .ilike("codigo", input.codigo)
      .maybeSingle();

    if (data?.id) return data.id as string;
  }

  const { data } = await supabase
    .from("catalogo_productos")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .eq("tipo", "producto")
    .ilike("nombre", input.nombre)
    .maybeSingle();

  return data?.id ? (data.id as string) : null;
}

async function registerInitialStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    bodegaId: string;
    cantidad: number;
    motivo: string;
    productoId: string;
  },
) {
  return supabase.rpc("registrar_movimiento_inventario", {
    p_bodega_id: input.bodegaId,
    p_cantidad: input.cantidad,
    p_motivo: input.motivo,
    p_producto_id: input.productoId,
    p_referencia_id: null,
    p_referencia_tipo: null,
    p_tipo: "entrada",
  });
}

async function assertTransferEntities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    bodegaDestinoId: string;
    bodegaOrigenId: string;
    empresaId: string;
    productoId: string;
  },
) {
  const [product, origin, destination] = await Promise.all([
    supabase
      .from("catalogo_productos")
      .select("id")
      .eq("empresa_id", input.empresaId)
      .eq("id", input.productoId)
      .eq("tipo", "producto")
      .eq("estado", "activo")
      .maybeSingle(),
    supabase
      .from("inventario_bodegas")
      .select("id, nombre")
      .eq("empresa_id", input.empresaId)
      .eq("id", input.bodegaOrigenId)
      .eq("estado", "activa")
      .maybeSingle(),
    supabase
      .from("inventario_bodegas")
      .select("id, nombre")
      .eq("empresa_id", input.empresaId)
      .eq("id", input.bodegaDestinoId)
      .eq("estado", "activa")
      .maybeSingle(),
  ]);

  if (product.error || !product.data) {
    redirectWithError(
      "/inventario/productos",
      "Selecciona un producto activo para trasladar.",
    );
  }

  if (origin.error || !origin.data) {
    redirectWithError(
      "/inventario/productos",
      "La bodega origen no esta disponible.",
    );
  }

  if (destination.error || !destination.data) {
    redirectWithError(
      "/inventario/productos",
      "La bodega destino no esta disponible.",
    );
  }
}

export async function createWarehouseAction(formData: FormData) {
  const parsed = createWarehouseSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Datos de bodega invalidos.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_inventario_bodega", {
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
    p_ubicacion: parsed.data.ubicacion ?? null,
  });

  if (error) {
    logInventoryActionError("createWarehouseAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo crear la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function createMaterialEntryAction(formData: FormData) {
  const parsed = createMaterialEntrySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Datos de material invalidos.");
  }

  await assertCatalogProductCreatePermission("/inventario/productos");

  if (parsed.data.cantidadInicial && parsed.data.cantidadInicial > 0) {
    await assertInventoryPermission(
      "inventory.stock.adjust",
      "/inventario/productos",
    );
  }

  const supabase = await createClient();
  const product = await createPhysicalProduct(supabase, {
    categoriaId: parsed.data.categoriaId,
    codigo: parsed.data.codigo,
    descripcion: parsed.data.descripcion,
    nombre: parsed.data.nombre,
    precioBase: parsed.data.precioBase,
    unidadMedida: parsed.data.unidadMedida,
  });

  if (product.error || !product.productoId) {
    logInventoryActionError("createMaterialEntryAction", product.error ?? {}, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudo crear el material: ${safeErrorMessage(product.error ?? {})}`,
    );
  }

  if (parsed.data.cantidadInicial && parsed.data.cantidadInicial > 0) {
    const { error } = await registerInitialStock(supabase, {
      bodegaId: parsed.data.bodegaId!,
      cantidad: parsed.data.cantidadInicial,
      motivo: parsed.data.motivo ?? "Ingreso inicial de material",
      productoId: product.productoId,
    });

    if (error) {
      logInventoryActionError("createMaterialEntryAction.stock", error, {
        productoId: product.productoId,
      });
      redirectWithError(
        "/inventario/productos",
        `Material creado, pero no se pudo registrar stock inicial: ${safeErrorMessage(error)}`,
      );
    }
  }

  revalidateInventoryPaths(product.productoId);
  redirect("/inventario/productos");
}

export async function importMaterialRowsAction(formData: FormData) {
  const parsed = importMaterialRowsSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Archivo de materiales invalido.");
  }

  const access = await assertCatalogProductCreatePermission("/inventario/productos");
  let rows: MaterialImportRow[] = [];

  if (parsed.data.rowsJson) {
    try {
      const value = JSON.parse(parsed.data.rowsJson);
      rows = Array.isArray(value) ? value : [];
    } catch {
      redirectWithError("/inventario/productos", "No se pudo leer la tabla pegada.");
    }
  }

  if (rows.length === 0) {
    const file = formData.get("inventoryFile");

    if (isUploadedInventoryFile(file)) {
      try {
        rows = await parseUploadedInventoryFile(file);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[importMaterialRowsAction.file] parse error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }

        redirectWithError(
          "/inventario/productos",
          "No se pudo interpretar el archivo. Prueba exportarlo como XLSX, CSV o TSV.",
        );
      }
    }
  }

  const cleanRows = cleanImportRows(rows);

  if (cleanRows.length === 0) {
    redirectWithError(
      "/inventario/productos",
      "No encontre materiales validos. Revisa que exista una columna de Producto o Descripcion.",
    );
  }

  if (cleanRows.length > MAX_IMPORT_ROWS) {
    redirectWithError(
      "/inventario/productos",
      `Carga hasta ${MAX_IMPORT_ROWS} materiales por archivo para mantener el proceso controlado.`,
    );
  }

  const hasInitialStock = cleanRows.some((row) => row.cantidad > 0);

  if (hasInitialStock) {
    if (!parsed.data.bodegaId) {
      redirectWithError(
        "/inventario/productos",
        "Selecciona una bodega para cargar cantidades iniciales.",
      );
    }
    await assertInventoryPermission(
      "inventory.stock.adjust",
      "/inventario/productos",
    );
  }

  const supabase = await createClient();

  for (const [index, row] of cleanRows.entries()) {
    const existingProductoId = await findExistingPhysicalProduct(supabase, {
      codigo: row.codigo,
      empresaId: access.tenant.empresaId,
      nombre: row.nombre,
    });
    const product = existingProductoId
      ? { error: null, productoId: existingProductoId }
      : await createPhysicalProduct(supabase, {
          categoriaId: parsed.data.categoriaId,
          codigo: row.codigo,
          descripcion: row.descripcion,
          nombre: row.nombre,
          precioBase: Number.isFinite(row.precioBase) ? row.precioBase : 0,
          unidadMedida: row.unidadMedida,
        });

    if (product.error || !product.productoId) {
      logInventoryActionError("importMaterialRowsAction.product", product.error ?? {}, {
        row: String(index + 1),
      });
      redirectWithError(
        "/inventario/productos",
        `No se pudo importar la fila ${index + 1}: ${safeErrorMessage(product.error ?? {})}`,
      );
    }

    if (row.cantidad > 0) {
      const { error } = await registerInitialStock(supabase, {
        bodegaId: parsed.data.bodegaId!,
        cantidad: row.cantidad,
        motivo: parsed.data.motivo ?? "Importacion de materiales",
        productoId: product.productoId,
      });

      if (error) {
        logInventoryActionError("importMaterialRowsAction.stock", error, {
          row: String(index + 1),
        });
        redirectWithError(
          "/inventario/productos",
          `Fila ${index + 1}: material creado, pero fallo el stock inicial: ${safeErrorMessage(error)}`,
        );
      }
    }
  }

  revalidateInventoryPaths();
  redirect("/inventario/productos");
}

export async function updateWarehouseAction(formData: FormData) {
  const parsed = updateWarehouseSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Datos de bodega invalidos.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_inventario_bodega", {
    p_bodega_id: parsed.data.bodegaId,
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
    p_ubicacion: parsed.data.ubicacion ?? null,
  });

  if (error) {
    logInventoryActionError("updateWarehouseAction", error, {
      bodegaId: parsed.data.bodegaId,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo actualizar la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function changeWarehouseStatusAction(formData: FormData) {
  const parsed = changeWarehouseStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Estado de bodega invalido.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inventario_bodega", {
    p_bodega_id: parsed.data.bodegaId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInventoryActionError("changeWarehouseStatusAction", error, {
      bodegaId: parsed.data.bodegaId,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo cambiar la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function createInventoryMovementAction(formData: FormData) {
  const parsed = createInventoryMovementSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Movimiento de inventario invalido.");
  }

  await assertInventoryPermission(
    "inventory.stock.adjust",
    "/inventario/productos",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    p_bodega_id: parsed.data.bodegaId,
    p_cantidad: parsed.data.cantidad,
    p_motivo: parsed.data.motivo ?? null,
    p_producto_id: parsed.data.productoId,
    p_referencia_id: null,
    p_referencia_tipo: null,
    p_tipo: parsed.data.tipo,
  });

  if (error) {
    logInventoryActionError("createInventoryMovementAction", error, {
      productoId: parsed.data.productoId,
      tipo: parsed.data.tipo,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudo registrar el movimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths(parsed.data.productoId);
  redirect("/inventario/productos");
}

export async function createInventoryTransferAction(formData: FormData) {
  const parsed = createInventoryTransferSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(
      "/inventario/productos",
      "Datos de traslado invalidos. Revisa producto, bodegas y cantidad.",
    );
  }

  const access = await assertInventoryPermission(
    "inventory.stock.adjust",
    "/inventario/productos",
  );
  const supabase = await createClient();

  await assertTransferEntities(supabase, {
    bodegaDestinoId: parsed.data.bodegaDestinoId,
    bodegaOrigenId: parsed.data.bodegaOrigenId,
    empresaId: access.tenant.empresaId,
    productoId: parsed.data.productoId,
  });

  const transferId = crypto.randomUUID();
  const motivo = parsed.data.motivo ?? "Traslado entre bodegas";
  const { error: salidaError } = await supabase.rpc(
    "registrar_movimiento_inventario",
    {
      p_bodega_id: parsed.data.bodegaOrigenId,
      p_cantidad: parsed.data.cantidad,
      p_motivo: motivo,
      p_producto_id: parsed.data.productoId,
      p_referencia_id: transferId,
      p_referencia_tipo: "traslado_bodega",
      p_tipo: "salida",
    },
  );

  if (salidaError) {
    logInventoryActionError("createInventoryTransferAction.salida", salidaError, {
      productoId: parsed.data.productoId,
      transferId,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudo retirar stock de la bodega origen: ${safeErrorMessage(salidaError)}`,
    );
  }

  const { error: entradaError } = await supabase.rpc(
    "registrar_movimiento_inventario",
    {
      p_bodega_id: parsed.data.bodegaDestinoId,
      p_cantidad: parsed.data.cantidad,
      p_motivo: motivo,
      p_producto_id: parsed.data.productoId,
      p_referencia_id: transferId,
      p_referencia_tipo: "traslado_bodega",
      p_tipo: "entrada",
    },
  );

  if (entradaError) {
    logInventoryActionError("createInventoryTransferAction.entrada", entradaError, {
      productoId: parsed.data.productoId,
      transferId,
    });

    const { error: rollbackError } = await supabase.rpc(
      "registrar_movimiento_inventario",
      {
        p_bodega_id: parsed.data.bodegaOrigenId,
        p_cantidad: parsed.data.cantidad,
        p_motivo: `Reversion automatica de traslado fallido ${transferId}`,
        p_producto_id: parsed.data.productoId,
        p_referencia_id: transferId,
        p_referencia_tipo: "traslado_bodega_reversion",
        p_tipo: "entrada",
      },
    );

    if (rollbackError) {
      logInventoryActionError(
        "createInventoryTransferAction.rollback",
        rollbackError,
        {
          productoId: parsed.data.productoId,
          transferId,
        },
      );
    }

    redirectWithError(
      "/inventario/productos",
      rollbackError
        ? `El traslado quedo incompleto y requiere revision manual: ${safeErrorMessage(entradaError)}`
        : `No se pudo ingresar stock en destino. La salida fue revertida: ${safeErrorMessage(entradaError)}`,
    );
  }

  revalidateInventoryPaths(parsed.data.productoId);
  redirect("/inventario/productos");
}

export async function updateStockLimitsAction(formData: FormData) {
  const parsed = updateStockLimitsSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Limites de stock invalidos.");
  }

  await assertInventoryPermission(
    "inventory.stock.adjust",
    "/inventario/productos",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_stock_minimos", {
    p_bodega_id: parsed.data.bodegaId,
    p_producto_id: parsed.data.productoId,
    p_stock_maximo: parsed.data.stockMaximo ?? null,
    p_stock_minimo: parsed.data.stockMinimo,
  });

  if (error) {
    logInventoryActionError("updateStockLimitsAction", error, {
      productoId: parsed.data.productoId,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudieron actualizar limites: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths(parsed.data.productoId);
  redirect("/inventario/productos");
}
