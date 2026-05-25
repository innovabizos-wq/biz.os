import type { InventoryMovement } from "@/modules/inventory/types";

type InventoryMovementsTableProps = {
  movements: InventoryMovement[];
};

export function InventoryMovementsTable({
  movements,
}: InventoryMovementsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3">Bodega</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Cantidad</th>
            <th className="px-4 py-3">Anterior</th>
            <th className="px-4 py-3">Nueva</th>
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Referencia</th>
            <th className="px-4 py-3">Creado por</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr className="border-t" key={movement.id}>
              <td className="px-4 py-3">
                {new Date(movement.createdAt).toLocaleString("es-CR")}
              </td>
              <td className="px-4 py-3 font-medium">
                {movement.productoCodigo ? `${movement.productoCodigo} - ` : ""}
                {movement.productoNombre ?? "Producto"}
              </td>
              <td className="px-4 py-3">{movement.bodegaNombre ?? "Bodega"}</td>
              <td className="px-4 py-3">{movement.tipo}</td>
              <td className="px-4 py-3">{movement.cantidad}</td>
              <td className="px-4 py-3">{movement.cantidadAnterior}</td>
              <td className="px-4 py-3">{movement.cantidadNueva}</td>
              <td className="px-4 py-3">{movement.motivo ?? "-"}</td>
              <td className="px-4 py-3">
                {movement.referenciaTipo
                  ? `${movement.referenciaTipo} ${movement.referenciaId ?? ""}`
                  : "-"}
              </td>
              <td className="px-4 py-3">
                {movement.creadoPorNombre ?? "No disponible"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
