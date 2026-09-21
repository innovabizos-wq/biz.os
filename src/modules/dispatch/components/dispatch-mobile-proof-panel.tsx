"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Camera, MapPin, RefreshCw, Signature, Truck, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getQueuedDispatchOperations,
  queueDispatchOperation,
  removeQueuedDispatchOperation,
  type QueuedDispatchEvidence,
  type QueuedDispatchOperation,
} from "@/modules/dispatch/mobile-offline-store";
import type { DispatchOrder, DispatchMobileTargetStatus } from "@/modules/dispatch/types";

type LocationCapture = {
  accuracyMeters: number;
  latitude: number;
  longitude: number;
};

class DispatchSyncError extends Error {
  retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "DispatchSyncError";
    this.retryable = retryable;
  }
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function filesToEvidence(files: FileList | null, kind: "photo" | "signature") {
  return Array.from(files ?? []).map((file) => ({
    blob: file,
    fileName: file.name,
    kind,
    mimeType: file.type,
  } satisfies QueuedDispatchEvidence));
}

async function sendOperation(operation: QueuedDispatchOperation | Omit<QueuedDispatchOperation, "queuedAt">) {
  const body = new FormData();
  body.set("capturedAt", operation.capturedAt);
  body.set("dispatchId", operation.dispatchId);
  body.set("operationId", operation.operationId);
  body.set("targetStatus", operation.targetStatus);
  if (operation.receiverName) body.set("receiverName", operation.receiverName);
  if (operation.result) body.set("result", operation.result);
  if (operation.latitude !== undefined) body.set("latitude", String(operation.latitude));
  if (operation.longitude !== undefined) body.set("longitude", String(operation.longitude));
  if (operation.accuracyMeters !== undefined) body.set("accuracyMeters", String(operation.accuracyMeters));
  for (const evidence of operation.evidence) {
    body.append(
      evidence.kind,
      new File([evidence.blob], evidence.fileName, { type: evidence.mimeType }),
    );
  }

  const response = await fetch("/api/mobile/dispatch", { body, method: "POST" });
  const payload = await response.json().catch(() => ({})) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new DispatchSyncError(
      payload.message || "No se pudo sincronizar la entrega.",
      response.status >= 500,
    );
  }
  return payload;
}

export function DispatchMobileProofPanel({
  canChangeStatus,
  dispatch,
}: {
  canChangeStatus: boolean;
  dispatch: DispatchOrder;
}) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [pending, startTransition] = useTransition();
  const [pendingCount, setPendingCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [result, setResult] = useState("");
  const [photoEvidence, setPhotoEvidence] = useState<QueuedDispatchEvidence[]>([]);
  const [signatureEvidence, setSignatureEvidence] = useState<QueuedDispatchEvidence[]>([]);
  const [location, setLocation] = useState<LocationCapture | null>(null);

  async function refreshPendingCount() {
    const rows = await getQueuedDispatchOperations();
    setPendingCount(rows.length);
  }

  async function syncQueue() {
    if (!navigator.onLine) return;
    const rows = await getQueuedDispatchOperations();
    for (const operation of rows) {
      try {
        await sendOperation(operation);
        await removeQueuedDispatchOperation(operation.operationId);
      } catch (error) {
        if (error instanceof DispatchSyncError && !error.retryable) {
          await removeQueuedDispatchOperation(operation.operationId);
          setMessage(`La operación ${operation.operationId.slice(0, 8)} requiere revisión: ${error.message}`);
          break;
        }
        setMessage(
          `Pendiente ${operation.operationId.slice(0, 8)}: ${error instanceof Error ? error.message : "error de sincronización"}`,
        );
        break;
      }
    }
    await refreshPendingCount();
  }

  useEffect(() => {
    void navigator.serviceWorker?.register("/sw.js");
    const refreshTimer = window.setTimeout(() => void refreshPendingCount(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, []);

  useEffect(() => {
    if (!online) return;
    const syncTimer = window.setTimeout(() => void syncQueue(), 0);
    return () => window.clearTimeout(syncTimer);
  // The queue must resume whenever connectivity returns.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  function captureLocation() {
    if (!navigator.geolocation) {
      setMessage("Este dispositivo no permite capturar ubicación.");
      return;
    }
    setMessage("Solicitando ubicación…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          accuracyMeters: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setMessage("Ubicación autorizada y guardada para esta evidencia.");
      },
      () => setMessage("No se autorizó la ubicación. Puedes continuar sin ella."),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 },
    );
  }

  function submit(targetStatus: DispatchMobileTargetStatus) {
    const evidence = [...photoEvidence, ...signatureEvidence].slice(0, 4);
    if (targetStatus === "entregado" && !receiverName.trim()) {
      setMessage("Indica quién recibió la entrega.");
      return;
    }
    if (targetStatus === "entregado" && evidence.length === 0) {
      setMessage("Adjunta al menos una foto o firma.");
      return;
    }
    if (targetStatus === "fallido" && !result.trim()) {
      setMessage("Describe por qué no se completó la entrega.");
      return;
    }

    const operation = {
      accuracyMeters: location?.accuracyMeters,
      capturedAt: new Date().toISOString(),
      dispatchId: dispatch.id,
      evidence,
      latitude: location?.latitude,
      longitude: location?.longitude,
      operationId: crypto.randomUUID(),
      receiverName: receiverName.trim() || undefined,
      result: result.trim() || undefined,
      targetStatus,
    } satisfies Omit<QueuedDispatchOperation, "queuedAt">;

    startTransition(async () => {
      setMessage(null);
      if (!navigator.onLine) {
        await queueDispatchOperation(operation);
        await refreshPendingCount();
        setMessage("Operación guardada en este dispositivo. Se enviará al recuperar conexión.");
        return;
      }
      try {
        await sendOperation(operation);
        setMessage("Entrega sincronizada correctamente.");
        window.location.reload();
      } catch (error) {
        if (error instanceof DispatchSyncError && !error.retryable) {
          setMessage(error.message);
          return;
        }
        await queueDispatchOperation(operation);
        await refreshPendingCount();
        setMessage(
          `${error instanceof Error ? error.message : "La conexión se interrumpió."} La operación quedó guardada para reintento.`,
        );
      }
    });
  }

  if (!canChangeStatus || !["listo", "en_ruta"].includes(dispatch.estado)) return null;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Truck size={18} /> Operación móvil</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Guarda la entrega en este dispositivo si se pierde la conexión.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${online ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? "En línea" : "Sin conexión"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">{pendingCount} pendientes</span>
          <Button disabled={!online || pending || pendingCount === 0} onClick={() => startTransition(syncQueue)} size="sm" variant="outline">
            <RefreshCw size={14} /> Sincronizar
          </Button>
        </div>
      </div>

      {message ? <p aria-live="polite" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">{message}</p> : null}

      {dispatch.estado === "listo" ? (
        <Button disabled={pending} onClick={() => submit("en_ruta")}>
          Iniciar ruta
        </Button>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Persona que recibe</span>
              <Input onChange={(event) => setReceiverName(event.target.value)} placeholder="Nombre completo" value={receiverName} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Resultado o incidencia</span>
              <textarea className="min-h-24 rounded-md border bg-background px-3 py-2" onChange={(event) => setResult(event.target.value)} placeholder="Entrega completa, rechazo, dirección cerrada…" value={result} />
            </label>
            <Button onClick={captureLocation} type="button" variant="outline">
              <MapPin size={16} /> {location ? "Ubicación capturada" : "Capturar ubicación"}
            </Button>
          </div>

          <div className="space-y-3">
            <label className="grid cursor-pointer gap-1 rounded-xl border border-dashed p-4 text-sm">
              <span className="flex items-center gap-2 font-medium"><Camera size={17} /> Fotos de entrega</span>
              <span className="text-xs text-muted-foreground">JPG, PNG o WebP; máximo 6 MB por archivo.</span>
              <input accept="image/jpeg,image/png,image/webp" capture="environment" className="text-xs" multiple onChange={(event) => setPhotoEvidence(filesToEvidence(event.target.files, "photo").slice(0, 3))} type="file" />
            </label>
            <label className="grid cursor-pointer gap-1 rounded-xl border border-dashed p-4 text-sm">
              <span className="flex items-center gap-2 font-medium"><Signature size={17} /> Firma</span>
              <span className="text-xs text-muted-foreground">Adjunta una imagen de la firma cuando corresponda.</span>
              <input accept="image/jpeg,image/png,image/webp" className="text-xs" onChange={(event) => setSignatureEvidence(filesToEvidence(event.target.files, "signature").slice(0, 1))} type="file" />
            </label>
            <p className="text-xs text-muted-foreground">
              {photoEvidence.length + signatureEvidence.length} evidencia(s) listas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <Button disabled={pending} onClick={() => submit("entregado")}>Confirmar entrega</Button>
            <Button disabled={pending} onClick={() => submit("fallido")} variant="destructive">Registrar intento fallido</Button>
          </div>
        </div>
      )}
    </section>
  );
}
