import type { ConsultationSearchResult } from "@/modules/consultations/types";

type ConsultationResultCardProps = {
  result: ConsultationSearchResult | null;
};

export function ConsultationResultCard({ result }: ConsultationResultCardProps) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        Digita una identificacion para iniciar la consulta.
      </div>
    );
  }

  if (result.source === "internal") {
    return null;
  }

  if (result.source === "hacienda") {
    const activity = result.hacienda.actividades[0];

    return (
      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Datos encontrados en Hacienda</p>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Nombre / razon social</dt>
            <dd>{result.hacienda.nombre}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documento</dt>
            <dd>{result.hacienda.documento}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tipo identificacion</dt>
            <dd>{result.hacienda.tipoIdentificacion ?? "No disponible"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Regimen</dt>
            <dd>{result.hacienda.regimen ?? "No disponible"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Situacion tributaria</dt>
            <dd>{result.hacienda.situacion ?? "No disponible"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Actividad principal</dt>
            <dd>{activity?.descripcion ?? "No disponible"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    null
  );
}
