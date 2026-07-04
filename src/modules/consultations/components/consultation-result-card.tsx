import type { ConsultationSearchResult } from "@/modules/consultations/types";

import Link from "next/link";

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
    return (
      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Cliente existente en CRM</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se encontro un registro con esta identificacion. La gestion se asociara a
          este cliente para evitar duplicados.
        </p>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Nombre</dt>
            <dd>{result.cliente.nombre}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Documento</dt>
            <dd>{result.documento}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tipo</dt>
            <dd>{result.cliente.tipo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{result.cliente.estado}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Telefono</dt>
            <dd>{result.cliente.telefono ?? "No disponible"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Correo</dt>
            <dd>{result.cliente.correo ?? "No disponible"}</dd>
          </div>
        </dl>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-emerald-700 underline underline-offset-4"
          href={`/crm/clientes/${result.cliente.id}`}
        >
          Abrir ficha del cliente
        </Link>
      </div>
    );
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
