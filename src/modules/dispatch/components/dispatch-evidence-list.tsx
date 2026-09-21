import { Camera, MapPin, Signature } from "lucide-react";

import type { DispatchDeliveryEvidence } from "@/modules/dispatch/types";

export function DispatchEvidenceList({ evidence }: { evidence: DispatchDeliveryEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        Aún no hay evidencia de entrega.
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="font-semibold">Evidencia privada</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {evidence.map((item) => (
          <a className="rounded-xl border p-4 transition hover:border-primary" href={`/api/mobile/dispatch/evidence/${item.id}`} key={item.id} target="_blank">
            <div className="flex items-center gap-2 font-medium">
              {item.type === "photo" ? <Camera size={17} /> : <Signature size={17} />}
              {item.type === "photo" ? "Foto" : "Firma"}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(item.capturedAt).toLocaleString("es-CR")}
            </p>
            <p className="mt-1 text-sm">Receptor: {item.receiverName ?? "No indicado"}</p>
            {item.latitude !== null && item.longitude !== null ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={13} /> Ubicación registrada · precisión {Math.round(item.accuracyMeters ?? 0)} m
              </p>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}
