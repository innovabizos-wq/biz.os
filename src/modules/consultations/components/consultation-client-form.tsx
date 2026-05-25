import type { ConsultationSearchResult } from "@/modules/consultations/types";

type ConsultationClientFormProps = {
  result: ConsultationSearchResult | null;
};

export function ConsultationClientForm({ result }: ConsultationClientFormProps) {
  if (!result) return null;

  const isInternal = result.source === "internal";
  const cliente = isInternal ? result.cliente : null;
  const hacienda = result.source === "hacienda" ? result.hacienda : null;
  const documento =
    cliente?.identificacion ??
    hacienda?.documento ??
    (result.source === "manual" ? result.documento : "");
  const nombre = cliente?.nombre ?? hacienda?.nombre ?? "";
  const automaticType = result.source === "internal" ? result.tipoAutomatico : "prospecto";
  const automaticTypeLabel = automaticType === "cliente" ? "Cliente" : "Prospecto";

  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="font-semibold">
        {isInternal ? "Datos del cliente" : "Completa los datos de contacto antes de guardar"}
      </p>
      <input name="source" type="hidden" value={result.source} />
      <input name="clienteId" type="hidden" value={cliente?.id ?? ""} />
      <input name="tipoIdentificacion" type="hidden" value={hacienda?.tipoIdentificacion ?? ""} />
      <input name="regimen" type="hidden" value={hacienda?.regimen ?? ""} />
      <input name="situacion" type="hidden" value={hacienda?.situacion ?? ""} />

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre / razon social</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={nombre}
            name="nombre"
            readOnly={isInternal}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Documento</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={documento}
            name="documento"
            readOnly={isInternal}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Telefono</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={cliente?.telefono ?? ""}
            name="telefono"
            readOnly={isInternal}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">WhatsApp</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={cliente?.whatsapp ?? ""}
            name="whatsapp"
            readOnly={isInternal}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Correo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={cliente?.correo ?? ""}
            name="correo"
            readOnly={isInternal}
            type="email"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo automatico</span>
          <input
            className="h-9 w-full rounded-md border bg-muted px-3 text-muted-foreground"
            readOnly
            value={automaticTypeLabel}
          />
          <input name="tipo" type="hidden" value={automaticType} />
        </label>
      </div>

      {!isInternal ? (
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">Direccion</span>
          <input className="h-9 w-full rounded-md border bg-background px-3" name="direccion" />
        </label>
      ) : null}
    </div>
  );
}
