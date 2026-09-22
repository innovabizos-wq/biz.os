"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Minus, Plus, Printer, RefreshCw, ShoppingCart, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  closePosSessionAction,
  loadPosCatalogPageAction,
  submitPosSaleAction,
} from "@/modules/pos/actions";
import {
  completeQueuedPosOperation,
  getQueuedPosOperations,
  queuePosOperation,
  savePosCatalog,
  savePosSession,
} from "@/modules/pos/offline-store";
import type { PosCatalogItem, PosPaymentInput, PosSaleInput, PosSaleResult, PosSession, PosTerminal } from "@/modules/pos/types";

type CartLine = PosCatalogItem & { quantity: number };

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function currency(value: number) {
  return new Intl.NumberFormat("es-CR", { currency: "CRC", style: "currency" }).format(value);
}

export function PosTerminalScreen({
  initialCatalog,
  session,
  terminal,
}: {
  initialCatalog: PosCatalogItem[];
  session: PosSession;
  terminal: PosTerminal;
}) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<PosPaymentInput[]>([{ amount: 0, method: "cash", verified: true }]);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingQuantities, setPendingQuantities] = useState<Map<string, number>>(new Map());
  const [preparedOffline, setPreparedOffline] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<PosSaleResult | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [nextSequence, setNextSequence] = useState(session.lastSequence + 1);
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => cart.reduce((sum, line) => {
    const subtotal = line.unitPrice * line.quantity;
    return {
      subtotal: sum.subtotal + subtotal,
      tax: sum.tax + subtotal * line.taxRate / 100,
    };
  }, { subtotal: 0, tax: 0 }), [cart]);
  const total = Math.round((totals.subtotal + totals.tax) * 100) / 100;
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return catalog.slice(0, 80);
    return catalog.filter((item) =>
      item.name.toLocaleLowerCase("es").includes(needle)
      || item.code?.toLocaleLowerCase("es").includes(needle)
    ).slice(0, 80);
  }, [catalog, search]);

  async function refreshQueue() {
    const rows = await getQueuedPosOperations(session.id);
    const quantities = new Map<string, number>();
    for (const row of rows) {
      for (const item of row.items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }
    }
    setPendingCount(rows.length);
    setPendingQuantities(quantities);
    setNextSequence(Math.max(session.lastSequence + 1, ...rows.map((row) => row.sequence + 1)));
  }

  function applyCatalogAllocations(
    allocations: Array<{ offlineAvailable: number; productId: string }>,
  ) {
    if (allocations.length === 0) return;
    const byProduct = new Map(
      allocations.map((allocation) => [allocation.productId, allocation.offlineAvailable]),
    );
    setCatalog((current) => current.map((item) => byProduct.has(item.productId)
      ? { ...item, offlineAvailable: byProduct.get(item.productId) ?? item.offlineAvailable }
      : item));
  }

  function consumeConnectedCatalog(items: PosSaleInput["items"]) {
    const consumed = new Map<string, number>();
    for (const item of items) {
      consumed.set(item.productId, (consumed.get(item.productId) ?? 0) + item.quantity);
    }
    setCatalog((current) => {
      const next = current.map((item) => item.productType === "producto" && consumed.has(item.productId)
        ? {
            ...item,
            offlineAvailable: Math.max(
              0,
              item.offlineAvailable - (consumed.get(item.productId) ?? 0),
            ),
          }
        : item);
      void savePosCatalog(session.id, next);
      return next;
    });
  }

  async function syncQueue() {
    if (!navigator.onLine) return;
    const rows = await getQueuedPosOperations(session.id);
    for (const operation of rows) {
      try {
        const result = await submitPosSaleAction(operation);
        if (!result.ok) {
          setMessage(`Pendiente ${operation.sequence}: ${result.error}`);
          break;
        }
        const allocations = await completeQueuedPosOperation(operation);
        applyCatalogAllocations(allocations);
        setLastReceipt(result.data);
      } catch {
        setMessage(`Pendiente ${operation.sequence}: la sincronización se interrumpió.`);
        break;
      }
    }
    await refreshQueue();
  }

  useEffect(() => {
    void navigator.serviceWorker?.register("/sw.js");
    let cancelled = false;
    void (async () => {
      try {
        await savePosSession(session, terminal);
        await savePosCatalog(session.id, initialCatalog);
        await refreshQueue();
      } catch {
        if (!cancelled) setMessage("No se pudo preparar el almacenamiento local de la caja.");
      } finally {
        if (!cancelled) setLocalReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  // The session identity controls the local cache lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, terminal.id]);

  useEffect(() => {
    if (!online || !localReady) return;
    const syncTimer = window.setTimeout(() => void syncQueue(), 0);
    return () => window.clearTimeout(syncTimer);
  // syncQueue is intentionally run only when connectivity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReady, online]);

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current
      .map((line) => line.productId === productId ? { ...line, quantity: line.quantity + delta } : line)
      .filter((line) => line.quantity > 0));
  }

  function addProduct(product: PosCatalogItem) {
    setCart((current) => {
      const existing = current.find((line) => line.productId === product.productId);
      if (existing) return current.map((line) => line.productId === product.productId ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { ...product, quantity: 1 }];
    });
    setSearch("");
  }

  async function prepareOffline() {
    setMessage("Descargando catálogo protegido…");
    const all = new Map(catalog.map((item) => [item.productId, item]));
    let offset = 0;
    while (offset >= 0) {
      const result = await loadPosCatalogPageAction({ limit: 500, offset, sessionId: session.id });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      for (const item of result.data.items) all.set(item.productId, item);
      await savePosCatalog(session.id, result.data.items);
      offset = result.data.nextOffset ?? -1;
    }
    setCatalog([...all.values()]);
    setPreparedOffline(true);
    setMessage(`${all.size} productos listos para trabajar sin conexión.`);
  }

  function completeSale() {
    if (cart.length === 0) return setMessage("Agrega al menos un producto.");
    const effectivePayments = payments.map((payment, index) => ({
      ...payment,
      amount: payments.length === 1 && index === 0 ? total : Number(payment.amount || 0),
    }));
    const paid = Math.round(effectivePayments.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
    if (paid !== total) return setMessage("Los pagos deben coincidir con el total.");
    if (!online) {
      const unavailable = cart.find((line) => line.productType === "producto"
        && line.quantity > line.offlineAvailable - (pendingQuantities.get(line.productId) ?? 0));
      if (unavailable) return setMessage(`Cupo sin conexión insuficiente para ${unavailable.name}.`);
    }
    const operation: PosSaleInput = {
      capturedAt: new Date().toISOString(),
      clientOperationId: crypto.randomUUID(),
      items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      offline: !online,
      payments: effectivePayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        verified: payment.method === "sinpe" ? Boolean(payment.verified) : true,
      })),
      sequence: nextSequence,
      sessionId: session.id,
    };
    startTransition(async () => {
      setMessage(null);
      if (!navigator.onLine) {
        try {
          const stored = await queuePosOperation(operation);
          setNextSequence(stored.sequence + 1);
          setCart([]);
          setMessage(`Venta ${stored.sequence} guardada. Se emitirá al recuperar conexión.`);
          await refreshQueue();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "No se pudo proteger la venta local.");
        }
        return;
      }
      try {
        const result = await submitPosSaleAction(operation);
        if (!result.ok) return setMessage(result.error);
        setLastReceipt(result.data);
        setNextSequence((value) => value + 1);
        consumeConnectedCatalog(operation.items);
        setCart([]);
        setMessage(`Venta ${result.data.saleNumber} registrada correctamente.`);
      } catch {
        try {
          const stored = await queuePosOperation({ ...operation, offline: true });
          setNextSequence(stored.sequence + 1);
          setCart([]);
          setMessage("La conexión se interrumpió. La venta quedó guardada para reintento.");
          await refreshQueue();
        } catch (queueError) {
          setMessage(queueError instanceof Error
            ? queueError.message
            : "La conexión se interrumpió y no se pudo guardar la venta local.");
        }
      }
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.7fr)]">
      <section className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">{terminal.name} · {terminal.warehouseName}</p>
            <p className="text-xs text-muted-foreground">Autorizada hasta {new Date(session.authorizedUntil).toLocaleString("es-CR")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${online ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? "En línea" : "Sin conexión"}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">{pendingCount} por sincronizar</span>
            <Button disabled={!online || pending} onClick={() => startTransition(syncQueue)} size="sm" variant="outline"><RefreshCw /> Sincronizar</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            className="min-w-64 flex-1"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filtered.length === 1) {
                event.preventDefault();
                addProduct(filtered[0]);
              }
            }}
            placeholder="Buscar o escanear código de barras"
            value={search}
          />
          <Button disabled={!online || pending || preparedOffline} onClick={() => startTransition(prepareOffline)} variant="outline">
            {preparedOffline ? "Modo sin conexión listo" : "Preparar sin conexión"}
          </Button>
        </div>

        {message ? <p aria-live="polite" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">{message}</p> : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <button className="rounded-xl border bg-card p-4 text-left transition hover:border-primary" key={product.productId} onClick={() => addProduct(product)} type="button">
              <span className="block truncate font-medium">{product.name}</span>
              <span className="text-xs text-muted-foreground">{product.code || product.productType}</span>
              <span className="mt-3 block font-semibold">{currency(product.unitPrice * (1 + product.taxRate / 100))}</span>
              {terminal.offlineEnabled && product.productType === "producto" ? (
                <span className="text-xs text-muted-foreground">
                  Cupo offline: {Math.max(0, product.offlineAvailable - (pendingQuantities.get(product.productId) ?? 0))}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <aside className="grid content-start gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2"><ShoppingCart /><h2 className="text-lg font-semibold">Venta actual</h2></div>
        <div className="grid max-h-80 gap-2 overflow-auto">
          {cart.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Escanea o selecciona productos.</p> : cart.map((line) => (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-muted/60 p-3" key={line.productId}>
              <div><p className="text-sm font-medium">{line.name}</p><p className="text-xs text-muted-foreground">{currency(line.unitPrice)} + {line.taxRate}%</p></div>
              <div className="flex items-center gap-1">
                <Button aria-label="Restar" onClick={() => changeQuantity(line.productId, -1)} size="icon-xs" variant="outline"><Minus /></Button>
                <span className="min-w-8 text-center text-sm">{line.quantity}</span>
                <Button aria-label="Sumar" onClick={() => changeQuantity(line.productId, 1)} size="icon-xs" variant="outline"><Plus /></Button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-1 border-y py-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{currency(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span>Impuestos</span><span>{currency(totals.tax)}</span></div>
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{currency(total)}</span></div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Pagos divididos</h3><Button onClick={() => setPayments((rows) => [...rows, { amount: 0, method: "card", verified: true }])} size="sm" variant="outline">Agregar</Button></div>
          {payments.map((payment, index) => (
            <div className="grid grid-cols-[110px_1fr_auto] gap-2" key={index}>
              <select className="rounded-lg border bg-background px-2 text-sm" onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, method: event.target.value as PosPaymentInput["method"], verified: event.target.value !== "sinpe" } : row))} value={payment.method}>
                <option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="sinpe">SINPE</option><option value="other">Otro</option>
              </select>
              <Input min="0.01" onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Number(event.target.value) } : row))} step="0.01" type="number" value={payments.length === 1 && index === 0 ? total : payment.amount || ""} />
              <Button aria-label="Quitar pago" disabled={payments.length === 1} onClick={() => setPayments((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} size="icon" variant="ghost"><Minus /></Button>
              {payment.method === "sinpe" ? <label className="col-span-3 flex items-center gap-2 text-xs"><input checked={Boolean(payment.verified)} onChange={(event) => setPayments((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, verified: event.target.checked } : row))} type="checkbox" />Comprobante verificado</label> : null}
            </div>
          ))}
        </div>
        <Button disabled={pending || cart.length === 0} onClick={completeSale} size="lg">{pending ? "Procesando…" : online ? "Cobrar y completar" : "Guardar venta provisional"}</Button>

        {lastReceipt ? <div className="pos-ticket rounded-xl border p-4 text-center text-sm"><p className="font-semibold">{lastReceipt.saleNumber}</p><p>{currency(lastReceipt.total)}</p><p>Cobro: {lastReceipt.paymentStatus}</p><p>Fiscal: {lastReceipt.fiscalStatus}</p><Button className="mt-3 print:hidden" onClick={() => window.print()} size="sm" variant="outline"><Printer /> Imprimir 80 mm</Button></div> : null}

        <details className="border-t pt-3">
          <summary className="cursor-pointer text-sm font-medium">Cierre de caja</summary>
          <form className="mt-3 grid gap-2" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              await syncQueue();
              const result = await closePosSessionAction({ countedCash: form.get("countedCash"), lastSequence: nextSequence - 1, sessionId: session.id });
              setMessage(result.ok ? `Caja cerrada. Diferencia: ${currency(result.data.difference)}` : result.error);
              if (result.ok) window.location.reload();
            });
          }}><Input min="0" name="countedCash" placeholder="Efectivo contado" required step="0.01" type="number" /><Button disabled={pending || pendingCount > 0} type="submit" variant="outline">Cerrar y arquear</Button></form>
        </details>
      </aside>
    </div>
  );
}
