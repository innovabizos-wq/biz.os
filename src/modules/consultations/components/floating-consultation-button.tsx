"use client";

import { ArrowRight, Check, FileText, Plus, Save, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CRM_INTERACCION_TIPOS } from "@/modules/crm/constants";
import type { CrmInteraccionTipo } from "@/modules/crm/types";
import {
  createConsultationCustomerModalAction,
  saveConsultationModalAction,
  searchConsultationSubjectModalAction,
  type ConsultationCustomerStepState,
  type ConsultationModalSaveState,
  type ConsultationModalSearchState,
} from "@/modules/consultations/actions";
import { ConsultationResultCard } from "@/modules/consultations/components/consultation-result-card";
import type { ConsultationSearchResult } from "@/modules/consultations/types";

type FloatingConsultationButtonProps = {
  canCreateCustomer: boolean;
  canCreateQuote: boolean;
  canSaveInteraction: boolean;
};

const originOptions = [
  "Cliente fisico",
  "Referido",
  "Whatsapp",
  "Facebook",
  "Instagram",
  "Llamada in",
  "Lead",
  "Otros",
];

const quickResults = [
  "Solicita informacion",
  "Pendiente cotizacion",
  "Cliente contactado",
  "No contesta",
  "Requiere seguimiento",
];

function getInitialResult(): ConsultationSearchResult {
  return {
    documento: "",
    message: "Completa la informacion para iniciar una gestion.",
    source: "manual",
  };
}

const initialSearchState: ConsultationModalSearchState = {
  documento: "",
  message: null,
  result: getInitialResult(),
  status: "idle",
};

const initialCustomerState: ConsultationCustomerStepState = {
  cliente: null,
  message: null,
  status: "idle",
};

const initialSaveState: ConsultationModalSaveState = {
  clienteId: null,
  intent: null,
  message: null,
  status: "idle",
};

export function FloatingConsultationButton({
  canCreateCustomer,
  canCreateQuote,
  canSaveInteraction,
}: FloatingConsultationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);

  function openModal() {
    setModalKey((current) => current + 1);
    setIsOpen(true);
  }

  return (
    <>
      <button
        aria-label="Nueva consulta"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-black text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/25"
        onClick={openModal}
        title="Nueva consulta"
        type="button"
      >
        <Plus aria-hidden="true" size={30} strokeWidth={2.6} />
      </button>

      {isOpen ? (
        <ConsultationModal
          canCreateCustomer={canCreateCustomer}
          canCreateQuote={canCreateQuote}
          canSaveInteraction={canSaveInteraction}
          key={modalKey}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

function ConsultationModal({
  canCreateCustomer,
  canCreateQuote,
  canSaveInteraction,
  onClose,
}: FloatingConsultationButtonProps & {
  onClose: () => void;
}) {
  const router = useRouter();
  const [searchState, searchAction, isSearching] = useActionState(
    searchConsultationSubjectModalAction,
    initialSearchState,
  );
  const [customerState, customerAction, isCreatingCustomer] = useActionState(
    createConsultationCustomerModalAction,
    initialCustomerState,
  );
  const [saveState, saveAction, isSaving] = useActionState(
    saveConsultationModalAction,
    initialSaveState,
  );
  const customer = customerState.cliente;
  const result = searchState.result ?? getInitialResult();
  const isStepTwo = customerState.status === "success" && customer;

  useEffect(() => {
    if (saveState.status !== "success") return;

    const timeoutId = window.setTimeout(() => {
      if (saveState.intent === "quote" && saveState.clienteId) {
        onClose();
        router.push(`/cotizaciones/nueva?clienteId=${saveState.clienteId}`);
        return;
      }

      onClose();
      router.refresh();
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [onClose, router, saveState.clienteId, saveState.intent, saveState.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      aria-labelledby="new-consultation-title"
      aria-modal="true"
      className="fixed inset-0 z-[9998] bg-black/55"
      role="dialog"
    >
      <div className="absolute inset-0 flex items-center justify-center p-4 lg:left-[196px]">
        <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-br from-white to-sky-50 px-6 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
                Registro rapido
              </p>
              <h2
                className="mt-1 text-2xl font-black tracking-normal text-slate-950"
                id="new-consultation-title"
              >
                Nueva consulta
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {isStepTwo ? "Paso 2: gestion" : "Paso 1: cliente"}
              </p>
            </div>
            <button
              aria-label="Cerrar registro rapido"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={21} strokeWidth={2.4} />
            </button>
          </div>

          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-bold">
              <span
                className={`rounded-lg px-3 py-2 text-center ${
                  !isStepTwo ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                }`}
              >
                1. Cliente
              </span>
              <span
                className={`rounded-lg px-3 py-2 text-center ${
                  isStepTwo ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                }`}
              >
                2. Interaccion
              </span>
            </div>

            {searchState.message || customerState.message || saveState.message ? (
              <p
                className={`mt-3 rounded-xl border px-4 py-2 text-sm ${
                  customerState.status === "success" || saveState.status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {saveState.message ?? customerState.message ?? searchState.message}
              </p>
            ) : null}
          </div>

          <div className="max-h-[calc(86vh-150px)] overflow-y-auto px-6 py-4">
            {isStepTwo ? (
              <InteractionStep
                canSaveInteraction={canSaveInteraction}
                canCreateQuote={canCreateQuote}
                customer={customer}
                isSaving={isSaving}
                onCancel={onClose}
                saveAction={saveAction}
              />
            ) : (
              <CustomerStep
                canCreateCustomer={canCreateCustomer}
                customerAction={customerAction}
                isCreatingCustomer={isCreatingCustomer}
                isSearching={isSearching}
                onCancel={onClose}
                result={result}
                searchAction={searchAction}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomerStep({
  canCreateCustomer,
  customerAction,
  isCreatingCustomer,
  isSearching,
  onCancel,
  result,
  searchAction,
}: {
  canCreateCustomer: boolean;
  customerAction: (formData: FormData) => void;
  isCreatingCustomer: boolean;
  isSearching: boolean;
  onCancel: () => void;
  result: ConsultationSearchResult;
  searchAction: (formData: FormData) => void;
}) {
  const isInternal = result.source === "internal";
  const cliente = isInternal ? result.cliente : null;
  const hacienda = result.source === "hacienda" ? result.hacienda : null;
  const documento =
    cliente?.identificacion ??
    hacienda?.documento ??
    (result.source === "manual" ? result.documento : "");
  const nombre = cliente?.nombre ?? hacienda?.nombre ?? "";
  const tipo = isInternal ? result.tipoAutomatico : "prospecto";
  const needsCreate = !isInternal;
  const formKey = `${result.source}-${documento}`;

  return (
    <div className="space-y-4">
      <form
        action={searchAction}
        className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3"
      >
        <label className="space-y-1.5 text-sm font-semibold text-slate-800">
          <span>Cedula / Documento</span>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              autoFocus
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              defaultValue={documento}
              inputMode="numeric"
              name="documento"
              placeholder="Cedula fisica, juridica o DIMEX"
              required
            />
            <Button className="h-11 px-4" disabled={isSearching} type="submit">
              <Search aria-hidden="true" />
              {isSearching ? "Buscando" : "Buscar"}
            </Button>
          </div>
        </label>
      </form>

      <ConsultationResultCard result={result} />

      <form action={customerAction} className="space-y-4" key={formKey}>
        <input name="clienteId" type="hidden" value={cliente?.id ?? ""} />
        <input name="source" type="hidden" value={result.source} />
        <input name="tipo" type="hidden" value={tipo} />
        <input
          name="tipoIdentificacion"
          type="hidden"
          value={hacienda?.tipoIdentificacion ?? ""}
        />
        <input name="regimen" type="hidden" value={hacienda?.regimen ?? ""} />
        <input name="situacion" type="hidden" value={hacienda?.situacion ?? ""} />

        {needsCreate && !canCreateCustomer ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            No tienes permiso para crear clientes.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <FieldInput
            defaultValue={nombre}
            label="Nombre / razon social"
            name="nombre"
            readOnly={isInternal}
            required
          />
          <FieldInput
            defaultValue={documento}
            label="Documento"
            name="documento"
            readOnly={isInternal}
            required
          />
          <FieldInput
            defaultValue={cliente?.telefono ?? ""}
            label="Telefono"
            name="telefono"
            readOnly={isInternal}
          />
          <FieldInput
            defaultValue={cliente?.whatsapp ?? ""}
            label="WhatsApp"
            name="whatsapp"
            readOnly={isInternal}
          />
          <FieldInput
            defaultValue={cliente?.correo ?? ""}
            label="Correo"
            name="correo"
            readOnly={isInternal}
            type="email"
          />
          <label className="space-y-1.5 text-sm font-semibold text-slate-800">
            <span>Origen</span>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
              defaultValue={cliente?.origen ?? "Cliente fisico"}
              name="origen"
              required
            >
              {originOptions.map((origin) => (
                <option key={origin} value={origin}>
                  {origin}
                </option>
              ))}
            </select>
          </label>
        </div>

        <FieldInput label="Direccion" name="direccion" />

        <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 pt-4">
          <Button
            className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            disabled={(needsCreate && !canCreateCustomer) || isCreatingCustomer}
            type="submit"
          >
            <ArrowRight aria-hidden="true" />
            {isCreatingCustomer ? "Guardando" : "Continuar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({
  defaultValue = "",
  label,
  name,
  readOnly = false,
  required = false,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  readOnly?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-800">
      <span>{label}</span>
      <input
        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 read-only:text-slate-500"
        defaultValue={defaultValue}
        name={name}
        readOnly={readOnly}
        required={required}
        type={type}
      />
    </label>
  );
}

function InteractionStep({
  canCreateQuote,
  canSaveInteraction,
  customer,
  isSaving,
  onCancel,
  saveAction,
}: {
  canSaveInteraction: boolean;
  canCreateQuote: boolean;
  customer: NonNullable<ConsultationCustomerStepState["cliente"]>;
  isSaving: boolean;
  onCancel: () => void;
  saveAction: (formData: FormData) => void;
}) {
  const [interactionType, setInteractionType] =
    useState<CrmInteraccionTipo>("nota");
  const [intent, setIntent] = useState<"quote" | "save">("save");
  const [result, setResult] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const intentInputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const resultSuggestions = useMemo(() => quickResults, []);

  useEffect(() => {
    summaryRef.current?.focus();
  }, []);

  function submitWithIntent(nextIntent: "quote" | "save") {
    setIntent(nextIntent);

    if (intentInputRef.current) {
      intentInputRef.current.value = nextIntent;
    }

    formRef.current?.requestSubmit();
  }

  return (
    <form action={saveAction} className="space-y-4" ref={formRef}>
      <input name="clienteId" type="hidden" value={customer.clienteId} />
      <input name="correo" type="hidden" value={customer.correo ?? ""} />
      <input name="direccion" type="hidden" value={customer.direccion ?? ""} />
      <input name="documento" type="hidden" value={customer.documento} />
      <input name="nombre" type="hidden" value={customer.nombre} />
      <input name="origen" type="hidden" value={customer.origen} />
      <input name="source" type="hidden" value={customer.source} />
      <input name="telefono" type="hidden" value={customer.telefono ?? ""} />
      <input name="tipo" type="hidden" value={customer.tipo} />
      <input name="whatsapp" type="hidden" value={customer.whatsapp ?? ""} />
      <input
        defaultValue={intent}
        name="intent"
        ref={intentInputRef}
        type="hidden"
      />

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <div className="flex items-center gap-2 font-bold">
          <Check aria-hidden="true" size={17} />
          Cliente listo
        </div>
        <p className="mt-1 text-emerald-900">
          {customer.nombre} - {customer.origen}
        </p>
      </div>

      {!canSaveInteraction ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No tienes permiso para registrar gestiones. Solicita acceso al administrador.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="space-y-1.5 text-sm font-semibold text-slate-800">
          <span>Tipo</span>
          <select
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            name="interaccionTipo"
            onChange={(event) =>
              setInteractionType(event.target.value as CrmInteraccionTipo)
            }
            value={interactionType}
          >
            {CRM_INTERACCION_TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-semibold text-slate-800">
          <span>Resultado</span>
          <input
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            name="interaccionResultado"
            onChange={(event) => setResult(event.target.value)}
            placeholder="Ejemplo: Pendiente cotizacion"
            value={result}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {resultSuggestions.map((suggestion) => (
          <button
            className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
            key={suggestion}
            onClick={() => setResult(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label className="block space-y-2 text-sm font-semibold text-slate-800">
        <span>Descripcion de gestion</span>
        <textarea
          className="min-h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          name="descripcionGestion"
          placeholder="Escribe la gestion realizada. Ejemplo: Cliente llama y solicita informacion; queda pendiente enviar cotizacion."
          ref={summaryRef}
          required
        />
      </label>

      <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 pt-4">
        <Button
          className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </Button>
        <Button
          className="bg-black text-white hover:bg-black/90"
          disabled={!canSaveInteraction || isSaving}
          onClick={() => submitWithIntent("save")}
          type="button"
        >
          <Save aria-hidden="true" />
          {isSaving && intent === "save" ? "Guardando" : "Guardar"}
        </Button>
        <Button
          className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
          disabled={!canSaveInteraction || !canCreateQuote || isSaving}
          onClick={() => submitWithIntent("quote")}
          title={
            canCreateQuote
              ? "Guardar gestion y crear una cotizacion"
              : "Necesitas permiso para crear cotizaciones"
          }
          type="button"
          variant="outline"
        >
          <FileText aria-hidden="true" />
          {isSaving && intent === "quote" ? "Preparando cotizacion" : "Cotizar"}
        </Button>
      </div>
    </form>
  );
}
