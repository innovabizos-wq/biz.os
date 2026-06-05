"use client";

import { FileUp, PackagePlus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CatalogCategory } from "@/modules/catalog/types";
import {
  createMaterialEntryAction,
  importMaterialRowsAction,
} from "@/modules/inventory/actions";
import type { InventoryWarehouse } from "@/modules/inventory/types";

type MaterialIntakePanelProps = {
  canAdjust: boolean;
  canCreateProducts: boolean;
  categories: CatalogCategory[];
  warehouses: InventoryWarehouse[];
};

type ImportRow = {
  cantidad: string;
  codigo: string;
  descripcion: string;
  nombre: string;
  precioBase: string;
  unidadMedida: string;
};

type ImportPreview = {
  message: string | null;
  rows: ImportRow[];
};

const HEADER_ALIASES = {
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
    "referencia",
    "ref",
    "barcode",
    "barras",
    "codigo barras",
    "upc",
    "ean",
  ],
  descripcion: [
    "descripcion",
    "description",
    "detalle",
    "observaciones",
    "notas",
    "concepto",
  ],
  nombre: [
    "nombre",
    "producto",
    "product",
    "articulo",
    "artículo",
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
} satisfies Record<keyof ImportRow, string[]>;

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\-./()[\]#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNumberText(value: string) {
  const cleaned = value
    .replace(/[^\d,.\-]/g, "")
    .replace(/^-+/, "-")
    .trim();

  if (!cleaned) return "";

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    return cleaned
      .replaceAll(thousandSeparator, "")
      .replace(decimalSeparator, ".");
  }

  if (lastComma > -1) {
    return cleaned.replace(",", ".");
  }

  return cleaned;
}

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t", "|"];

  return candidates
    .map((delimiter) => ({
      delimiter,
      parts: splitDelimitedLine(line, delimiter).length,
    }))
    .sort((left, right) => right.parts - left.parts)[0]?.delimiter ?? ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter === ",") return splitCsvLine(line);

  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
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

function findHeaderIndex(lines: string[], delimiter: string) {
  let best = { index: 0, score: -1 };

  lines.slice(0, 12).forEach((line, index) => {
    const headers = splitDelimitedLine(line, delimiter).map(normalizeHeader);
    const score = Object.values(HEADER_ALIASES).reduce(
      (sum, aliases) =>
        sum +
        (headers.some((header) =>
          aliases.map(normalizeHeader).includes(header),
        )
          ? 1
          : 0),
      0,
    );

    if (score > best.score) best = { index, score };
  });

  return best;
}

function parseMaterialTable(text: string): ImportPreview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { message: "El archivo esta vacio.", rows: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headerMatch = findHeaderIndex(lines, delimiter);

  if (headerMatch.score < 2) {
    return {
      message:
        "No pude reconocer suficientes columnas. Usa encabezados como SKU, Producto, Cantidad, Unidad o Precio.",
      rows: [],
    };
  }

  const headers = splitDelimitedLine(lines[headerMatch.index], delimiter).map(
    normalizeHeader,
  );
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  function cell(cells: string[], field: keyof ImportRow) {
    for (const name of HEADER_ALIASES[field]) {
      const index = headerIndex.get(normalizeHeader(name));

      if (index !== undefined) {
        return cells[index]?.trim() ?? "";
      }
    }

    return "";
  }

  const rows = lines
    .slice(headerMatch.index + 1)
    .map((line) => {
      const cells = splitDelimitedLine(line, delimiter);
      const nombre = cell(cells, "nombre") || cell(cells, "descripcion");

      return {
        cantidad: normalizeNumberText(cell(cells, "cantidad")),
        codigo: cell(cells, "codigo"),
        descripcion: cell(cells, "descripcion"),
        nombre,
        precioBase: normalizeNumberText(cell(cells, "precioBase")),
        unidadMedida: cell(cells, "unidadMedida"),
      };
    })
    .filter((row) => row.nombre);

  return {
    message:
      rows.length > 0
        ? `Detecte ${rows.length} filas con separador ${
            delimiter === "\t" ? "tabulador" : delimiter
          }.`
        : "No encontre filas de productos despues del encabezado.",
    rows,
  };
}

export function MaterialIntakePanel({
  canAdjust,
  canCreateProducts,
  categories,
  warehouses,
}: MaterialIntakePanelProps) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.estado === "activa",
  );
  const rowsJson = useMemo(() => JSON.stringify(rows), [rows]);

  if (!canCreateProducts) {
    return (
      <section className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Ingreso de materiales</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu usuario puede mover stock existente, pero no crear materiales
          nuevos desde inventario. Solicita acceso de catalogo al administrador.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <form
        action={createMaterialEntryAction}
        className="rounded-lg border bg-background p-5"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PackagePlus aria-hidden="true" size={20} />
          </span>
          <div>
            <p className="font-semibold">Ingreso manual rapido</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea el material y registra una entrada inicial si ya tienes
              cantidad fisica.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nombre del material</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="nombre"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Codigo / SKU</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="codigo"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Unidad</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue="unidad"
              name="unidadMedida"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Categoria</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="categoriaId"
            >
              <option value="">Sin categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Cantidad inicial</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              disabled={!canAdjust}
              min="0"
              name="cantidadInicial"
              step="0.01"
              type="number"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Bodega</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              disabled={!canAdjust}
              name="bodegaId"
            >
              <option value="">Sin entrada inicial</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Precio base</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              defaultValue="0"
              min="0"
              name="precioBase"
              step="0.01"
              type="number"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Motivo</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="motivo"
              placeholder="Compra inicial, conteo fisico..."
            />
          </label>
        </div>

        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-medium">Descripcion</span>
          <textarea
            className="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm"
            name="descripcion"
          />
        </label>

        <Button className="mt-4" type="submit">
          Guardar material
        </Button>
      </form>

      <form
        action={importMaterialRowsAction}
        className="rounded-lg border bg-background p-5"
      >
        <input name="rowsJson" type="hidden" value={rowsJson} />
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileUp aria-hidden="true" size={20} />
          </span>
          <div>
            <p className="font-semibold">Ingreso desde archivo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acepta CSV, TSV, TXT o contenido copiado desde Excel/Google
              Sheets. Para XLSX, el sistema lo procesa al importar. Reconoce
              nombres comunes como SKU, Item, Producto, Cantidad, UOM, Costo y
              Precio unitario.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm md:col-span-3">
            <span className="font-medium">Archivo de inventario</span>
            <input
              accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values"
              className="h-9 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              name="inventoryFile"
              onChange={async (event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  setRows([]);
                  setHasUploadedFile(false);
                  setImportMessage(null);
                  return;
                }

                setHasUploadedFile(true);
                const extension = file.name.split(".").pop()?.toLowerCase();

                if (extension === "xlsx" || extension === "xls") {
                  setRows([]);
                  setImportMessage(
                    "Archivo Excel listo para importar. La vista previa local aplica a CSV/TSV o tablas pegadas.",
                  );
                  return;
                }

                const preview = parseMaterialTable(await file.text());
                setRows(preview.rows);
                setImportMessage(preview.message);
              }}
              type="file"
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-3">
            <span className="font-medium">Pegar desde Excel o Google Sheets</span>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(event) => {
                const preview = parseMaterialTable(event.target.value);
                setHasUploadedFile(false);
                setRows(preview.rows);
                setImportMessage(preview.message);
              }}
              placeholder="Pega aqui una tabla con encabezados: SKU, Producto, Cantidad, Unidad, Costo..."
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Categoria</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="categoriaId"
            >
              <option value="">Sin categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Bodega</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              disabled={!canAdjust}
              name="bodegaId"
            >
              <option value="">Solo crear materiales</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Motivo</span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="motivo"
              placeholder="Importacion inicial"
            />
          </label>
        </div>

        <div className="mt-4 max-h-52 overflow-auto rounded-md border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.slice(0, 20).map((row, index) => (
                  <tr className="border-t" key={`${row.nombre}-${index}`}>
                    <td className="px-3 py-2">{row.codigo || "-"}</td>
                    <td className="px-3 py-2 font-medium">{row.nombre}</td>
                    <td className="px-3 py-2">{row.unidadMedida || "unidad"}</td>
                    <td className="px-3 py-2">{row.cantidad || "0"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-muted-foreground"
                    colSpan={4}
                  >
                    Selecciona un archivo o pega una tabla para revisar las filas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {rows.length > 0
              ? `${rows.length} materiales listos para importar.`
              : (importMessage ?? "Maximo recomendado: 1000 filas por archivo.")}
          </p>
          <Button disabled={rows.length === 0 && !hasUploadedFile} type="submit">
            Importar materiales
          </Button>
        </div>
      </form>
    </section>
  );
}
