"use client";

import { useState } from "react";

import { addQuoteItemAction } from "@/modules/quotes/actions";
import type { QuoteCatalogProduct } from "@/modules/quotes/types";
import { Button } from "@/components/ui/button";

type QuoteItemFormProps = {
  activeProducts: QuoteCatalogProduct[];
  cotizacionId: string;
};

function numberToInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function QuoteItemForm({
  activeProducts,
  cotizacionId,
}: QuoteItemFormProps) {
  const [descripcion, setDescripcion] = useState("");
  const [precioUnitario, setPrecioUnitario] = useState("0");
  const [impuestoPorcentaje, setImpuestoPorcentaje] = useState("0");

  function handleProductChange(productId: string) {
    const product = activeProducts.find((item) => item.id === productId);

    if (!product) {
      return;
    }

    setDescripcion(product.descripcion ?? product.nombre);
    setPrecioUnitario(numberToInput(product.precioBase));
    setImpuestoPorcentaje(numberToInput(product.impuestoPorcentaje));
  }

  return (
    <form
      action={addQuoteItemAction}
      className="space-y-4 rounded-lg border bg-background p-5"
    >
      <input name="cotizacionId" type="hidden" value={cotizacionId} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Producto/servicio del catalogo</span>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          name="productoId"
          onChange={(event) => handleProductChange(event.target.value)}
        >
          <option value="">Item manual</option>
          {activeProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.codigo ? `${product.codigo} - ` : ""}
              {product.nombre} ({product.tipo})
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Descripcion</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="descripcion"
            onChange={(event) => setDescripcion(event.target.value)}
            required
            value={descripcion}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Cantidad</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue="1"
            min="0.01"
            name="cantidad"
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Precio</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            min="0"
            name="precioUnitario"
            onChange={(event) => setPrecioUnitario(event.target.value)}
            step="0.01"
            type="number"
            value={precioUnitario}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Descuento</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue="0"
            min="0"
            name="descuento"
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Impuesto %</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            min="0"
            name="impuestoPorcentaje"
            onChange={(event) => setImpuestoPorcentaje(event.target.value)}
            step="0.01"
            type="number"
            value={impuestoPorcentaje}
          />
        </label>
      </div>
      <Button type="submit">Agregar item</Button>
    </form>
  );
}
