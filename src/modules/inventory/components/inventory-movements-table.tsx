import type { InventoryMovement } from "@/modules/inventory/types";

type InventoryMovementsTableProps = {
  movements: InventoryMovement[];
};

const TYPE_STYLES = {
  ajuste: "border-amber-200 bg-amber-50 text-amber-800",
  entrada: "border-emerald-200 bg-emerald-50 text-emerald-800",
  salida: "border-rose-200 bg-rose-50 text-rose-800",
} satisfies Record<InventoryMovement["tipo"], string>;

function getMovementLabel(type: InventoryMovement["tipo"]) {
  if (type === "entrada") return "Entrada";
  if (type === "salida") return "Salida";

  return "Ajuste";
}

function getReferenceLabel(movement: InventoryMovement) {
  if (movement.referenciaTipo === "traslado_bodega") {
    return `Traslado ${movement.referenciaId?.slice(0, 8) ?? ""}`;
  }

  if (movement.referenciaTipo === "traslado_bodega_reversion") {
    return `Reversion traslado ${movement.referenciaId?.slice(0, 8) ?? ""}`;
  }

  return movement.referenciaTipo
    ? `${movement.referenciaTipo} ${movement.referenciaId ?? ""}`
    : "-";
}

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
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${TYPE_STYLES[movement.tipo]}`}
                >
                  {getMovementLabel(movement.tipo)}
                </span>
              </td>
              <td className="px-4 py-3">{movement.cantidad}</td>
              <td className="px-4 py-3">{movement.cantidadAnterior}</td>
              <td className="px-4 py-3">{movement.cantidadNueva}</td>
              <td className="px-4 py-3">{movement.motivo ?? "-"}</td>
              <td className="px-4 py-3">
                {getReferenceLabel(movement)}
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
