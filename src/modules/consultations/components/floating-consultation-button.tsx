"use client";

import { FileText, Plus, Save, Search, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  saveConsultationModalAction,
  searchConsultationSubjectModalAction,
  type ConsultationModalSaveState,
  type ConsultationModalSearchState,
} from "@/modules/consultations/actions";
import { ConsultationClientForm } from "@/modules/consultations/components/consultation-client-form";
import { ConsultationResultCard } from "@/modules/consultations/components/consultation-result-card";
import type { ConsultationSearchResult } from "@/modules/consultations/types";

type FloatingConsultationButtonProps = {
  canCreateCustomer: boolean;
  canSaveInteraction: boolean;
};

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

const initialSaveState: ConsultationModalSaveState = {
  clienteId: null,
  intent: null,
  message: null,
  status: "idle",
};

export function FloatingConsultationButton({
  canCreateCustomer,
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
  canSaveInteraction,
  onClose,
}: FloatingConsultationButtonProps & {
  onClose: () => void;
}) {
  const [searchState, searchAction, isSearching] = useActionState(
    searchConsultationSubjectModalAction,
    initialSearchState,
  );
  const [saveState, saveAction, isSaving] = useActionState(
    saveConsultationModalAction,
    initialSaveState,
  );
  const result = searchState.result ?? getInitialResult();
  const needsCustomerCreate = result.source !== "internal";
  const canSubmit = canSaveInteraction && (!needsCustomerCreate || canCreateCustomer);

  useEffect(() => {
    if (saveState.status !== "success") return;

    const timeoutId = window.setTimeout(onClose, 750);

    return () => window.clearTimeout(timeoutId);
  }, [onClose, saveState.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-consultation-title"
    >
      <div className="absolute inset-y-0 left-0 right-0 flex items-start justify-center overflow-auto p-4 lg:left-[280px] lg:p-8">
      <div className="w-full max-w-5xl rounded-xl border bg-background p-5 shadow-xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className="text-2xl font-semibold normal-case tracking-normal"
              id="new-consultation-title"
            >
              Nueva consulta
            </h2>
          </div>
          <button
            aria-label="Cerrar nueva consulta"
            className="inline-flex size-10 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={22} strokeWidth={2.6} />
          </button>
        </div>

        {searchState.message || saveState.message ? (
          <p
            className={`mb-4 rounded-md border p-3 text-sm ${
              saveState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {saveState.message ?? searchState.message}
          </p>
        ) : null}

        <div className="space-y-5">
          <form
            action={searchAction}
            className="rounded-lg border bg-background p-5"
          >
            <label className="space-y-2 text-sm">
              <span className="font-medium">Cedula / Documento</span>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  className="h-12 flex-1 rounded-md border bg-background px-4 text-base"
                  defaultValue={searchState.documento}
                  name="documento"
                  placeholder="Digite cedula fisica, juridica o DIMEX"
                  required
                />
                <Button className="h-12 px-5" disabled={isSearching} type="submit">
                  <Search aria-hidden="true" />
                  {isSearching ? "Buscando" : "Buscar"}
                </Button>
              </div>
            </label>
          </form>

          <ConsultationResultCard result={result} />

          <form action={saveAction} className="space-y-5">
            <ConsultationClientForm result={result} />

            {!canSaveInteraction ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                No tienes permiso para registrar gestiones. Solicita acceso al
                administrador.
              </p>
            ) : null}

            {needsCustomerCreate && !canCreateCustomer ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                No tienes permiso para crear clientes.
              </p>
            ) : null}

            <label className="block space-y-2 rounded-lg border bg-background p-5 text-sm">
              <span className="font-semibold">Descripcion de gestion</span>
              <textarea
                className="min-h-40 w-full rounded-md border bg-background px-3 py-2 text-base"
                name="descripcionGestion"
                placeholder="Ejemplo: Cliente llama y solicita informacion. Se brindan detalles y queda pendiente cotizacion."
                required
              />
            </label>

            <div className="flex flex-col gap-3 rounded-lg border bg-background p-5 md:flex-row md:items-center md:justify-end">
              <div className="flex flex-col gap-3 md:flex-row">
                <Button
                  className="bg-black text-white hover:bg-black/90"
                  disabled={!canSubmit || isSaving}
                  name="intent"
                  size="lg"
                  type="submit"
                  value="save"
                >
                  <Save aria-hidden="true" />
                  Guardar
                </Button>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={!canSubmit || isSaving}
                  name="intent"
                  size="lg"
                  type="submit"
                  value="quote"
                >
                  <FileText aria-hidden="true" />
                  Cotizar
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
