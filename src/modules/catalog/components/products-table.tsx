import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { CatalogProduct } from "@/modules/catalog/types";

type ProductsTableProps = {
  products: CatalogProduct[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function ProductsTable({ products }: ProductsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Codigo</th>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Unidad</th>
            <th className="px-4 py-3">Precio</th>
            <th className="px-4 py-3">Impuesto</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr className="border-t" key={product.id}>
              <td className="px-4 py-3">{product.codigo ?? "Sin codigo"}</td>
              <td className="px-4 py-3 font-medium">{product.nombre}</td>
              <td className="px-4 py-3">{product.tipo}</td>
              <td className="px-4 py-3">
                {product.categoriaNombre ?? "Sin categoria"}
              </td>
              <td className="px-4 py-3">{product.unidadMedida}</td>
              <td className="px-4 py-3">
                {formatMoney(product.precioBase, product.moneda)}
              </td>
              <td className="px-4 py-3">{product.impuestoPorcentaje}%</td>
              <td className="px-4 py-3">{product.estado}</td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/catalogo/productos/${product.id}`}
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
