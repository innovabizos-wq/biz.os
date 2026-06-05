"use client";

import { CheckCircle2, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  createQuoteModalAction,
  type AddQuoteItemModalState,
  type CreateQuoteModalState,
} from "@/modules/quotes/actions";
import { DEFAULT_QUOTE_MONEDA } from "@/modules/quotes/constants";
import {
  searchConsultationSubjectModalAction,
  type ConsultationModalSearchState,
} from "@/modules/consultations/actions";
import type { QuoteCatalogProduct, QuoteCustomer } from "@/modules/quotes/types";

type FloatingQuoteButtonProps = {
  activeProducts: QuoteCatalogProduct[];
  customers: QuoteCustomer[];
  hideTrigger?: boolean;
  initialOpen?: boolean;
  preselectedClienteId?: string;
};

type LocalQuoteItem = NonNullable<AddQuoteItemModalState["item"]> & {
  productoId: string | null;
};

const initialQuoteState: CreateQuoteModalState = {
  cotizacionId: null,
  message: null,
  numero: null,
  status: "idle",
};

const initialSearchState: ConsultationModalSearchState = {
  documento: "",
  message: null,
  result: null,
  status: "idle",
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function numberToInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLocalItem(input: {
  cantidad: number;
  descripcion: string;
  descuento: number;
  impuestoPorcentaje: number;
  precioUnitario: number;
  productoId: string | null;
}): LocalQuoteItem {
  const subtotal = input.cantidad * input.precioUnitario;
  const taxableAmount = Math.max(subtotal - input.descuento, 0);
  const impuestoMonto = taxableAmount * (input.impuestoPorcentaje / 100);
  const total = taxableAmount + impuestoMonto;

  return {
    cantidad: input.cantidad,
    descripcion: input.descripcion,
    descuento: input.descuento,
    impuestoMonto,
    impuestoPorcentaje: input.impuestoPorcentaje,
    precioUnitario: input.precioUnitario,
    productoId: input.productoId,
    subtotal,
    total,
  };
}

export function FloatingQuoteButton({
  activeProducts,
  customers,
  hideTrigger = false,
  initialOpen = false,
  preselectedClienteId,
}: FloatingQuoteButtonProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <>
      {hideTrigger ? null : (
        <Button onClick={() => setIsOpen(true)} type="button">
          <Plus aria-hidden="true" />
          Nueva cotizacion
        </Button>
      )}

      {isOpen ? (
        <QuoteModal
          activeProducts={activeProducts}
          customers={customers}
          preselectedClienteId={preselectedClienteId}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

function QuoteModal({
  activeProducts,
  customers,
  onClose,
  preselectedClienteId,
}: FloatingQuoteButtonProps & {
  onClose: () => void;
}) {
  const preselectedCustomer =
    customers.find((customer) => customer.id === preselectedClienteId) ?? null;
  const [quoteState, setQuoteState] =
    useState<CreateQuoteModalState>(initialQuoteState);
  const [clienteId, setClienteId] = useState(preselectedClienteId ?? "");
  const [customerQuery, setCustomerQuery] = useState(
    preselectedCustomer?.nombre ?? "",
  );
  const [searchState, setSearchState] =
    useState<ConsultationModalSearchState>(initialSearchState);
  const [items, setItems] = useState<LocalQuoteItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [precioUnitario, setPrecioUnitario] = useState("0");
  const [descuento, setDescuento] = useState("0");
  const [impuestoPorcentaje, setImpuestoPorcentaje] = useState("0");
  const [itemMessage, setItemMessage] = useState<string | null>(null);
  const [isSearching, startSearching] = useTransition();
  const [isCreatingQuote, startCreatingQuote] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const moneda = DEFAULT_QUOTE_MONEDA;

  const selectedCustomer =
    customers.find((customer) => customer.id === clienteId) ?? null;
  const localCustomerMatch = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();

    if (!normalizedQuery) return null;

    return (
      customers.find((customer) =>
        [customer.nombre, customer.telefono ?? "", customer.whatsapp ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ) ?? null
    );
  }, [customerQuery, customers]);
  const haciendaName =
    searchState.result?.source === "hacienda"
      ? searchState.result.hacienda.nombre
      : null;
  const effectiveCustomerName =
    selectedCustomer?.nombre ??
    localCustomerMatch?.nombre ??
    haciendaName ??
    "Sin cliente";
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.descuento, 0);
  const taxTotal = items.reduce((sum, item) => sum + item.impuestoMonto, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);

  function applyProduct(productId: string) {
    const product = activeProducts.find((item) => item.id === productId);

    setSelectedProductId(productId);

    if (!product) return;

    setDescripcion(product.descripcion ?? product.nombre);
    setPrecioUnitario(numberToInput(product.precioBase));
    setImpuestoPorcentaje(numberToInput(product.impuestoPorcentaje));
  }

  function runCustomerSearch() {
    const trimmedQuery = customerQuery.trim();

    if (!trimmedQuery) return;

    if (localCustomerMatch) {
      setClienteId(localCustomerMatch.id);
      setSearchState({
        documento: trimmedQuery,
        message: null,
        result: null,
        status: "success",
      });
      return;
    }

    startSearching(async () => {
      const formData = new FormData();
      formData.set("documento", trimmedQuery);
      const result = await searchConsultationSubjectModalAction(
        searchState,
        formData,
      );

      setSearchState(result);

      if (result.result?.source === "internal") {
        setClienteId(result.result.cliente.id);
      }
    });
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDescription = descripcion.trim();
    const nextQuantity = toNumber(cantidad);
    const nextPrice = toNumber(precioUnitario);

    if (!nextDescription) {
      setItemMessage("Agrega una descripcion para el item.");
      return;
    }

    if (nextQuantity <= 0) {
      setItemMessage("La cantidad debe ser mayor a 0.");
      return;
    }

    if (nextPrice <= 0) {
      setItemMessage("El precio debe ser mayor a 0.");
      return;
    }

    const nextItem = buildLocalItem({
      cantidad: nextQuantity,
      descripcion: nextDescription,
      descuento: toNumber(descuento),
      impuestoPorcentaje: toNumber(impuestoPorcentaje),
      precioUnitario: nextPrice,
      productoId: selectedProductId || null,
    });

    setItems((currentItems) => [...currentItems, nextItem]);
    setItemMessage("Item agregado a la proforma.");
    setSelectedProductId("");
    setDescripcion("");
    setCantidad("1");
    setPrecioUnitario("0");
    setDescuento("0");
    setImpuestoPorcentaje("0");
  }

  function createQuote() {
    if (items.length === 0) {
      setQuoteState({
        cotizacionId: null,
        message: "Agrega al menos un item antes de crear la cotizacion.",
        numero: null,
        status: "error",
      });
      return;
    }

    const formData = new FormData();
    formData.set("clienteId", clienteId);
    formData.set("moneda", moneda);
    formData.set("itemsJson", JSON.stringify(items));

    startCreatingQuote(async () => {
      const result = await createQuoteModalAction(quoteState, formData);
      setQuoteState(result);

      if (result.status === "success" && result.cotizacionId) {
        onClose();
        if (pathname === "/cotizaciones") {
          router.refresh();
        } else {
          router.push("/cotizaciones");
        }
      }
    });
  }

  return (
    <div
      aria-labelledby="new-quote-title"
      aria-modal="true"
      className="fixed inset-0 z-[9998] bg-black/65"
      role="dialog"
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4">
        <div className="grid h-[min(710px,calc(100vh-3rem))] w-[min(1200px,calc(100vw-2rem))] grid-cols-[1.08fr_0.92fr] gap-3 rounded-[1.4rem] border border-white/15 bg-[#eef1f4] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
          <section className="min-h-0 overflow-y-auto rounded-2xl bg-background p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
                  Comercial
                </p>
                <h2
                  className="mt-1 text-2xl font-black tracking-tight"
                  id="new-quote-title"
                >
                  Nueva cotizacion
                </h2>
              </div>
              <button
                aria-label="Cerrar nueva cotizacion"
                className="inline-flex size-10 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
                onClick={onClose}
                type="button"
              >
                <X aria-hidden="true" size={22} strokeWidth={2.6} />
              </button>
            </div>

            <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 text-blue-700" size={20} />
                <div>
                  <p className="font-black">Proforma en preparacion</p>
                  <p className="text-xs">
                    No se crea numero ni borrador hasta presionar Crear cotizacion.
                  </p>
                </div>
              </div>
            </div>

            {quoteState.message ? (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {quoteState.message}
              </p>
            ) : null}

            <section className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-black">Cliente</p>
                <Search className="text-blue-700" size={18} />
              </div>
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-lg border bg-white px-3 text-sm"
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    if (!event.target.value.trim()) setClienteId("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      runCustomerSearch();
                    }
                  }}
                  placeholder="Buscar cedula, nombre, telefono o WhatsApp"
                  value={customerQuery}
                />
                <button
                  className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-40"
                  disabled={isSearching || !customerQuery.trim()}
                  onClick={runCustomerSearch}
                  type="button"
                >
                  {isSearching ? "Buscando" : "Buscar"}
                </button>
              </div>
              <p className="mt-2 text-xs text-blue-950">
                {selectedCustomer
                  ? `Cliente CRM: ${selectedCustomer.nombre}`
                  : localCustomerMatch
                    ? `Coincidencia CRM: ${localCustomerMatch.nombre}`
                    : searchState.result?.source === "hacienda"
                      ? `Hacienda: ${searchState.result.hacienda.nombre}`
                      : searchState.message ??
                        "Busca primero en CRM; si es cedula valida, consulta Hacienda."}
              </p>
            </section>

            <section className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-3">
              <p className="mb-2 text-sm font-black">Items / productos / servicios</p>
              <form className="space-y-3" onSubmit={addItem}>
                <label className="space-y-1 text-xs font-semibold">
                  <span>Catalogo</span>
                  <select
                    className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                    name="productoId"
                    onChange={(event) => applyProduct(event.target.value)}
                    value={selectedProductId}
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
                <div className="grid gap-2 md:grid-cols-[1.4fr_0.55fr_0.75fr]">
                  <label className="space-y-1 text-xs font-semibold">
                    <span>Descripcion</span>
                    <input
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                      name="descripcion"
                      onChange={(event) => setDescripcion(event.target.value)}
                      required
                      value={descripcion}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    <span>Cantidad</span>
                    <input
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                      min="0.01"
                      name="cantidad"
                      onChange={(event) => setCantidad(event.target.value)}
                      step="0.01"
                      type="number"
                      value={cantidad}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    <span>Precio</span>
                    <input
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                      min="0.01"
                      name="precioUnitario"
                      onChange={(event) => setPrecioUnitario(event.target.value)}
                      step="0.01"
                      type="number"
                      value={precioUnitario}
                    />
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <label className="space-y-1 text-xs font-semibold">
                    <span>Descuento</span>
                    <input
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                      min="0"
                      name="descuento"
                      onChange={(event) => setDescuento(event.target.value)}
                      step="0.01"
                      type="number"
                      value={descuento}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold">
                    <span>Impuesto %</span>
                    <input
                      className="h-9 w-full rounded-md border bg-white px-3 text-sm"
                      min="0"
                      name="impuestoPorcentaje"
                      onChange={(event) => setImpuestoPorcentaje(event.target.value)}
                      step="0.01"
                      type="number"
                      value={impuestoPorcentaje}
                    />
                  </label>
                  <Button className="self-end" type="submit">
                    <Plus aria-hidden="true" />
                    Agregar
                  </Button>
                </div>
              </form>
              {itemMessage ? (
                <p className="mt-2 text-xs text-emerald-950">{itemMessage}</p>
              ) : null}

              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <div
                      className="grid grid-cols-[1fr_auto] rounded-lg border bg-white px-3 py-2 text-sm"
                      key={`${item.descripcion}-${index}`}
                    >
                      <div>
                        <p className="font-bold">{item.descripcion}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.cantidad} x {formatMoney(item.precioUnitario, moneda)}
                        </p>
                      </div>
                      <p className="font-black">{formatMoney(item.total, moneda)}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed bg-white p-3 text-sm text-muted-foreground">
                    Agrega productos o servicios antes de crear la cotizacion.
                  </p>
                )}
              </div>
            </section>

            <div className="sticky bottom-0 -mx-4 mt-3 flex justify-end gap-2 border-t bg-background px-4 py-3">
              <Button
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={items.length === 0 || isCreatingQuote}
                onClick={createQuote}
                type="button"
                variant="outline"
              >
                {isCreatingQuote ? "Creando" : "Crear cotizacion"}
              </Button>
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="min-h-full rounded-xl border bg-white p-6 shadow-sm">
              <div className="border-b pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                      Proforma
                    </p>
                    <h3 className="mt-2 text-3xl font-black">SIN NUMERO</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      El numero se asigna al crear
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#075e54] px-4 py-3 text-right text-white">
                    <p className="text-xs opacity-80">Total</p>
                    <p className="text-xl font-black">{formatMoney(total, moneda)}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 rounded-lg bg-slate-50 p-4 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-slate-500">Cliente</p>
                    <p className="font-bold">{effectiveCustomerName}</p>
                    <p className="text-xs text-slate-500">
                      {selectedCustomer?.whatsapp ??
                        selectedCustomer?.telefono ??
                        searchState.documento ??
                        "Contacto no definido"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estado</p>
                    <p className="font-bold">Proforma sin guardar</p>
                    <p className="text-xs text-slate-500">Moneda: {moneda}</p>
                  </div>
                </div>
              </div>

              <div className="py-5">
                <div className="grid grid-cols-[1fr_58px_90px] border-b bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-500">
                  <span>Descripcion</span>
                  <span className="text-right">Cant.</span>
                  <span className="text-right">Total</span>
                </div>
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <div
                      className="grid grid-cols-[1fr_58px_90px] border-b px-3 py-3 text-sm"
                      key={`${item.descripcion}-preview-${index}`}
                    >
                      <span>{item.descripcion}</span>
                      <span className="text-right text-slate-500">
                        {item.cantidad}
                      </span>
                      <span className="text-right font-semibold">
                        {formatMoney(item.total, moneda)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-10 text-center text-sm text-slate-500">
                    Sin items agregados.
                  </div>
                )}
              </div>

              <div className="grid gap-2 border-t pt-5 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal, moneda)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Descuento</span>
                  <strong>{formatMoney(discountTotal, moneda)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Impuesto</span>
                  <strong>{formatMoney(taxTotal, moneda)}</strong>
                </div>
                <div className="mt-2 flex justify-between border-t pt-3 text-lg">
                  <span className="font-black">Total</span>
                  <strong>{formatMoney(total, moneda)}</strong>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-dashed p-4 text-xs text-slate-500">
                Vista previa local. Se guarda y recibe numero solo al presionar
                Crear cotizacion.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
