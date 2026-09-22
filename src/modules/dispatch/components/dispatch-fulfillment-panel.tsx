import { randomUUID } from "node:crypto";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { recordDispatchFulfillmentAction } from "@/modules/dispatch/actions";
import type {
  DispatchFulfillmentEvent,
  DispatchItemProgress,
  DispatchOrder,
  DispatchWarehouse,
} from "@/modules/dispatch/types";

type DispatchFulfillmentPanelProps = {
  canDeliver: boolean;
  canReturn: boolean;
  dispatch: DispatchOrder;
  events: DispatchFulfillmentEvent[];
  items: DispatchItemProgress[];
  warehouses: DispatchWarehouse[];
};

function QuantityLines({
  items,
  mode,
}: {
  items: DispatchItemProgress[];
  mode: "delivery" | "return";
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const available = mode === "delivery"
          ? item.orderedQuantity - item.netDeliveredQuantity
          : item.netDeliveredQuantity;
        if (available <= 0) return null;
        return (
          <div
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_9rem] sm:items-end"
            key={item.id}
          >
            <div>
              <p className="text-sm font-medium">{item.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pedido {item.orderedQuantity} · entregado neto {item.netDeliveredQuantity}
                {item.returnedQuantity > 0 ? ` · devuelto ${item.returnedQuantity}` : ""}
              </p>
            </div>
            <label className="grid gap-1 text-xs">
              <span>{mode === "delivery" ? "Entregar ahora" : "Recibir ahora"}</span>
              <Input
                max={available}
                min="0"
                name={`quantity:${item.id}`}
                placeholder="0"
                step="0.01"
                type="number"
              />
            </label>
          </div>
        );
      })}
    </div>
  );
}

function WarehouseSelect({
  id,
  required,
  warehouses,
}: {
  id: string;
  required: boolean;
  warehouses: DispatchWarehouse[];
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">Bodega</span>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        id={id}
        name="warehouseId"
        required={required}
      >
        <option value="">{required ? "Selecciona una bodega" : "Usar la bodega reservada"}</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>{warehouse.nombre}</option>
        ))}
      </select>
    </label>
  );
}

export function DispatchFulfillmentPanel({
  canDeliver,
  canReturn,
  dispatch,
  events,
  items,
  warehouses,
}: DispatchFulfillmentPanelProps) {
  const remaining = items.some(
    (item) => item.netDeliveredQuantity < item.orderedQuantity,
  );
  const returnable = items.some((item) => item.netDeliveredQuantity > 0);
  const deliveryOpen = ["listo", "en_ruta", "parcial"].includes(dispatch.estado);
  const returnOpen = ["parcial", "entregado"].includes(dispatch.estado);

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Entregas por línea</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada confirmación mueve únicamente la cantidad indicada. Una devolución física crea
          el registro comercial relacionado, pero deja el reembolso y la nota fiscal pendientes.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto]" key={item.id}>
            <div>
              <p className="text-sm font-medium">{item.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.netDeliveredQuantity} de {item.orderedQuantity} entregados
                {item.returnedQuantity > 0 ? ` · ${item.returnedQuantity} devueltos` : ""}
              </p>
            </div>
            <Badge variant={item.netDeliveredQuantity >= item.orderedQuantity ? "default" : "secondary"}>
              {item.netDeliveredQuantity >= item.orderedQuantity ? "Completa" : "Pendiente"}
            </Badge>
          </div>
        ))}
      </div>

      {canDeliver && deliveryOpen && remaining ? (
        <form action={recordDispatchFulfillmentAction} className="space-y-4 rounded-xl border bg-background p-4">
          <input name="despachoId" type="hidden" value={dispatch.id} />
          <input name="eventType" type="hidden" value="delivery" />
          <input name="operationId" type="hidden" value={randomUUID()} />
          <input name="ventaId" type="hidden" value={dispatch.ventaId} />
          <div>
            <p className="font-medium">Confirmar entrega parcial o final</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Si la venta tiene reservas, puedes dejar la bodega vacía para usar la reservada.
            </p>
          </div>
          <QuantityLines items={items} mode="delivery" />
          <div className="grid gap-3 md:grid-cols-2">
            <WarehouseSelect id={`delivery-warehouse-${dispatch.id}`} required={false} warehouses={warehouses} />
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Persona que recibe</span>
              <Input maxLength={160} name="receiverName" />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Resultado</span>
            <Textarea maxLength={1000} name="result" placeholder="Entrega parcial, observaciones o faltantes." />
          </label>
          <Button type="submit">Registrar cantidades entregadas</Button>
        </form>
      ) : null}

      {canReturn && returnOpen && returnable ? (
        <form action={recordDispatchFulfillmentAction} className="space-y-4 rounded-xl border bg-background p-4">
          <input name="despachoId" type="hidden" value={dispatch.id} />
          <input name="eventType" type="hidden" value="return" />
          <input name="operationId" type="hidden" value={randomUUID()} />
          <input name="ventaId" type="hidden" value={dispatch.ventaId} />
          <div>
            <p className="font-medium">Registrar devolución física</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reintegra la mercancía y crea la devolución comercial para procesar después sus efectos financiero y fiscal.
            </p>
          </div>
          <QuantityLines items={items} mode="return" />
          <WarehouseSelect id={`return-warehouse-${dispatch.id}`} required warehouses={warehouses} />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Motivo</span>
            <Textarea maxLength={500} minLength={3} name="result" required />
          </label>
          <Button disabled={warehouses.length === 0} type="submit" variant="destructive">
            Registrar devolución operativa
          </Button>
        </form>
      ) : null}

      {events.length > 0 ? (
        <div className="space-y-3">
          <p className="font-medium">Historial operativo</p>
          {events.map((event) => (
            <article className="rounded-lg border bg-background p-3 text-sm" key={event.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={event.eventType === "delivery" ? "default" : "destructive"}>
                  {event.eventType === "delivery" ? "Entrega" : "Devolución"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString("es-CR")}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {event.items.map((item) => `${item.quantity} × ${item.description}`).join(" · ")}
              </p>
              {event.warehouseName ? <p className="mt-1 text-xs">Bodega: {event.warehouseName}</p> : null}
              {event.receiverName ? <p className="mt-1 text-xs">Recibe: {event.receiverName}</p> : null}
              {event.result ? <p className="mt-1 text-xs">{event.result}</p> : null}
              {event.salesReturnId ? (
                <Link className="mt-2 inline-block text-xs font-medium underline" href={`/ventas/${dispatch.ventaId}`}>
                  Ver efectos pendientes de la devolución
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
