import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { searchConsultationSubjectAction } from "@/modules/consultations/actions";

type ConsultationSearchFormProps = {
  defaultDocumento?: string;
  returnTo?: "/consultas/nueva" | "/dashboard";
};

export function ConsultationSearchForm({
  defaultDocumento = "",
  returnTo = "/consultas/nueva",
}: ConsultationSearchFormProps) {
  return (
    <form action={searchConsultationSubjectAction} className="rounded-lg border bg-background p-5">
      <input name="returnTo" type="hidden" value={returnTo} />
      <label className="space-y-2 text-sm">
        <span className="font-medium">Cedula / Documento</span>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            className="h-12 flex-1 rounded-md border bg-background px-4 text-base"
            defaultValue={defaultDocumento}
            name="documento"
            placeholder="Digite cedula fisica, juridica o DIMEX"
            required
          />
          <Button className="h-12 px-5" type="submit">
            <Search aria-hidden="true" />
            Buscar
          </Button>
        </div>
      </label>
    </form>
  );
}
