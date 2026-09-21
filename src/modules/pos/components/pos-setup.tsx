"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPosTerminalAction, openPosSessionAction } from "@/modules/pos/actions";
import type { PosTerminal } from "@/modules/pos/types";

type WarehouseOption = { id: string; name: string };

export function PosTerminalSetup({ warehouses }: { warehouses: WarehouseOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          setError(null);
          const result = await createPosTerminalAction({
            code: form.get("code"),
            idempotencyKey: crypto.randomUUID(),
            name: form.get("name"),
            offlineEnabled: form.get("offlineEnabled") === "on",
            warehouseId: form.get("warehouseId"),
          });
          if (!result.ok) return setError(result.error);
          router.push(`/ventas/pos?terminal=${result.data.terminalId}`);
          router.refresh();
        });
      }}
    >
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Crear la primera terminal</h2>
        <p className="text-sm text-muted-foreground">Asocia la caja con la bodega de donde saldrá el inventario.</p>
      </div>
      <label className="grid gap-1 text-sm">
        Código
        <Input name="code" placeholder="CAJA-01" required />
      </label>
      <label className="grid gap-1 text-sm">
        Nombre
        <Input name="name" placeholder="Caja principal" required />
      </label>
      <label className="grid gap-1 text-sm md:col-span-2">
        Bodega
        <select className="h-9 rounded-lg border bg-background px-3" name="warehouseId" required>
          <option value="">Selecciona una bodega</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input defaultChecked name="offlineEnabled" type="checkbox" />
        Preparar cupo protegido para ventas sin conexión
      </label>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <Button className="md:col-span-2" disabled={pending || warehouses.length === 0} type="submit">
        {pending ? "Creando…" : "Crear terminal"}
      </Button>
    </form>
  );
}

export function PosSessionSetup({ terminal }: { terminal: PosTerminal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid max-w-xl gap-4 rounded-2xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          setError(null);
          const result = await openPosSessionAction({
            idempotencyKey: crypto.randomUUID(),
            openingCash: form.get("openingCash"),
            terminalId: terminal.id,
          });
          if (!result.ok) return setError(result.error);
          router.refresh();
        });
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">Abrir {terminal.name}</h2>
        <p className="text-sm text-muted-foreground">La autorización sin conexión durará {terminal.offlineSessionHours} horas.</p>
      </div>
      <label className="grid gap-1 text-sm">
        Fondo inicial en efectivo
        <Input defaultValue="0" min="0" name="openingCash" required step="0.01" type="number" />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={pending} type="submit">{pending ? "Abriendo…" : "Abrir caja"}</Button>
    </form>
  );
}
