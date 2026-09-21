import { randomUUID } from "node:crypto";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cancelInventoryCountAction,
  closeInventoryCountAction,
  recordInventoryCountItemAction,
  startInventoryCountAction,
} from "@/modules/inventory/actions";
import type {
  InventoryCount,
  InventoryCountItem,
  InventoryWarehouse,
} from "@/modules/inventory/types";

type InventoryCountsPanelProps = {
  canAdjust: boolean;
  counts: InventoryCount[];
  items: InventoryCountItem[];
  selectedCount: InventoryCount | null;
  warehouses: InventoryWarehouse[];
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusLabel(status: InventoryCount["status"]) {
  if (status === "open") return "Abierto";
  if (status === "closed") return "Cerrado";
  return "Cancelado";
}

function varianceClass(variance: number | null) {
  if (variance === null || variance === 0) return "text-slate-600";
  return variance > 0 ? "text-emerald-700" : "text-red-700";
}

export function InventoryCountsPanel({
  canAdjust,
  counts,
  items,
  selectedCount,
  warehouses,
}: InventoryCountsPanelProps) {
  const warehouseWithOpenCount = new Set(
    counts.filter((count) => count.status === "open").map((count) => count.warehouseId),
  );
  const availableWarehouses = warehouses.filter(
    (warehouse) =>
      warehouse.estado === "activa" && !warehouseWithOpenCount.has(warehouse.id),
  );
  const countComplete = Boolean(
    selectedCount && selectedCount.countedItems === selectedCount.totalItems,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <section className="rounded-lg border bg-background p-4">
          <h2 className="font-semibold">Iniciar conteo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La bodega queda protegida contra entradas, salidas y traslados hasta cerrar o cancelar.
          </p>

          {canAdjust && availableWarehouses.length > 0 ? (
            <form action={startInventoryCountAction} className="mt-4 space-y-3">
              <input name="operationId" type="hidden" value={randomUUID()} />
              <label className="grid gap-1 text-sm font-medium">
                Bodega
                <select className="rounded-md border bg-background px-3 py-2" name="warehouseId" required>
                  <option value="">Selecciona una bodega</option>
                  {availableWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Nota opcional
                <input
                  className="rounded-md border bg-background px-3 py-2"
                  maxLength={500}
                  name="notes"
                  placeholder="Motivo o responsable"
                />
              </label>
              <button className={buttonVariants()} type="submit">
                Abrir conteo físico
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {canAdjust
                ? "Todas las bodegas activas ya tienen un conteo abierto."
                : "Necesitas permiso para ajustar inventario."}
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-background p-4">
          <h2 className="font-semibold">Historial reciente</h2>
          <div className="mt-3 space-y-2">
            {counts.length > 0 ? (
              counts.map((count) => (
                <Link
                  className={cn(
                    "block rounded-md border p-3 text-sm transition hover:bg-muted/50",
                    selectedCount?.id === count.id && "border-primary bg-primary/5",
                  )}
                  href={`/inventario/conteos?conteo=${count.id}`}
                  key={count.id}
                >
                  <span className="flex items-center justify-between gap-2">
                    <strong>{count.countNumber}</strong>
                    <span>{statusLabel(count.status)}</span>
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    {count.warehouseName ?? "Bodega"} · {count.countedItems}/{count.totalItems}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no hay conteos.</p>
            )}
          </div>
        </section>
      </aside>

      <section className="min-w-0 rounded-lg border bg-background p-4">
        {!selectedCount ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <h2 className="font-semibold">Selecciona o inicia un conteo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aquí registrarás la cantidad física de cada producto.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {selectedCount.warehouseName ?? "Bodega"}
                </p>
                <h2 className="text-xl font-semibold">{selectedCount.countNumber}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abierto {DATE_FORMATTER.format(new Date(selectedCount.openedAt))} · {statusLabel(selectedCount.status)}
                </p>
              </div>
              <div className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
                {selectedCount.countedItems} de {selectedCount.totalItems} productos
              </div>
            </header>

            {selectedCount.notes ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm">{selectedCount.notes}</p>
            ) : null}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Producto</th>
                    <th className="px-3 py-3">Sistema</th>
                    <th className="px-3 py-3">Conteo físico</th>
                    <th className="px-3 py-3">Diferencia</th>
                    <th className="px-3 py-3">Nota</th>
                    {selectedCount.status === "open" && canAdjust ? (
                      <th className="px-3 py-3">Acción</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr className="border-t align-top" key={item.id}>
                      <td className="px-3 py-3 font-medium">
                        {item.productName ?? "Producto"}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {item.productCode ?? "Sin código"}
                        </span>
                      </td>
                      <td className="px-3 py-3">{item.expectedQuantity}</td>
                      {selectedCount.status === "open" && canAdjust ? (
                        <>
                          <td className="px-3 py-3">
                            <form action={recordInventoryCountItemAction} className="contents" id={`count-item-${item.id}`}>
                              <input name="countId" type="hidden" value={selectedCount.id} />
                              <input name="itemId" type="hidden" value={item.id} />
                              <input
                                aria-label={`Cantidad física de ${item.productName ?? "producto"}`}
                                className="w-28 rounded-md border bg-background px-3 py-2"
                                defaultValue={item.countedQuantity ?? ""}
                                min="0"
                                name="countedQuantity"
                                required
                                step="0.01"
                                type="number"
                              />
                            </form>
                          </td>
                          <td className={cn("px-3 py-3", varianceClass(item.varianceQuantity))}>
                            {item.varianceQuantity ?? "Pendiente"}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              aria-label={`Nota de ${item.productName ?? "producto"}`}
                              className="min-w-44 rounded-md border bg-background px-3 py-2"
                              defaultValue={item.notes ?? ""}
                              form={`count-item-${item.id}`}
                              maxLength={500}
                              name="notes"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <button
                              className={buttonVariants({ size: "sm", variant: "outline" })}
                              form={`count-item-${item.id}`}
                              type="submit"
                            >
                              Guardar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3">{item.countedQuantity ?? "-"}</td>
                          <td className={cn("px-3 py-3", varianceClass(item.varianceQuantity))}>
                            {item.varianceQuantity ?? "-"}
                          </td>
                          <td className="px-3 py-3">{item.notes ?? "-"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                La bodega no tenía filas de stock al abrir el conteo. Puedes cerrarlo sin ajustes.
              </p>
            ) : null}

            {selectedCount.status === "open" && canAdjust ? (
              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <form action={cancelInventoryCountAction}>
                  <input name="countId" type="hidden" value={selectedCount.id} />
                  <input name="operationId" type="hidden" value={randomUUID()} />
                  <button className={buttonVariants({ variant: "outline" })} type="submit">
                    Cancelar conteo
                  </button>
                </form>
                <form action={closeInventoryCountAction}>
                  <input name="countId" type="hidden" value={selectedCount.id} />
                  <input name="operationId" type="hidden" value={randomUUID()} />
                  <button
                    className={buttonVariants()}
                    disabled={!countComplete}
                    title={countComplete ? undefined : "Registra todos los productos antes de cerrar"}
                    type="submit"
                  >
                    Cerrar y aplicar diferencias
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
