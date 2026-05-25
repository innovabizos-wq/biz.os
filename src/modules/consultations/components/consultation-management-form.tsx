import { FileText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveConsultationAction } from "@/modules/consultations/actions";
import { ConsultationClientForm } from "@/modules/consultations/components/consultation-client-form";
import type { ConsultationSearchResult } from "@/modules/consultations/types";

type ConsultationManagementFormProps = {
  canCreateCustomer: boolean;
  canSaveInteraction: boolean;
  result: ConsultationSearchResult | null;
  returnTo?: "/consultas/nueva" | "/dashboard";
};

export function ConsultationManagementForm({
  canCreateCustomer,
  canSaveInteraction,
  result,
  returnTo = "/consultas/nueva",
}: ConsultationManagementFormProps) {
  if (!result) return null;

  const needsCustomerCreate = result.source !== "internal";
  const canSubmit = canSaveInteraction && (!needsCustomerCreate || canCreateCustomer);

  return (
    <form action={saveConsultationAction} className="space-y-5">
      <input name="returnTo" type="hidden" value={returnTo} />
      <ConsultationClientForm result={result} />

      {!canSaveInteraction ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No tienes permiso para registrar gestiones. Solicita acceso al administrador.
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
            disabled={!canSubmit}
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
            disabled={!canSubmit}
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
  );
}
