"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reverifyFiscalConnectionAction, saveAndVerifyFiscalConnectionAction } from "@/modules/billing/connectors/actions";
import type { FiscalConnection, FiscalProviderCode } from "@/modules/billing/connectors/types";

const PROVIDERS: Array<{ code: FiscalProviderCode; description: string; name: string; status: string }> = [
  { code: "gti", description: "Prioridad actual: cuenta, payload 4.4, envío protegido y conciliación sin duplicados.", name: "GTI", status: "Integración prioritaria" },
  { code: "factura_profesional", description: "Se retomará como conector separado después de GTI.", name: "FacturaProfesional", status: "Pausado" },
  { code: "alegra", description: "Se retomará como conector separado después de GTI.", name: "Alegra", status: "Pausado" },
  { code: "hacienda", description: "Autenticación directa, firma y documentos XML 4.4.", name: "Hacienda directo", status: "Operativo" },
  { code: "rest", description: "Contrato estándar con emisión idempotente y consulta recuperable, sin ejecutar código del cliente.", name: "REST configurable", status: "Contrato estándar" },
  { code: "tico_factura_import", description: "Importación y deduplicación por clave; no emite por API.", name: "Tico Factura", status: "Importación" },
];

function statusLabel(status: FiscalConnection["status"]) {
  return ({ active: "Activa", disabled: "Desactivada", draft: "Pendiente", error: "Con error", verified: "Verificada" })[status];
}

async function certificateToBase64(file: File) {
  if (file.size > 500_000) throw new Error("La llave .p12 supera el límite de 500 KB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

export function ConnectionsManager({ canManage, initialConnections }: { canManage: boolean; initialConnections: FiscalConnection[] }) {
  const [provider, setProvider] = useState<FiscalProviderCode | null>(null);
  const [connections, setConnections] = useState(initialConnections);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshConnection(id: string) {
    startTransition(async () => {
      setMessage("Verificando conexión…");
      const result = await reverifyFiscalConnectionAction(id);
      setMessage(result.ok ? result.data.detail : result.error);
      if (result.ok) setConnections((rows) => rows.map((row) => row.id === id
        ? { ...row, lastError: null, lastVerifiedAt: new Date().toISOString(), status: result.data.status }
        : result.data.status === "active" && row.status === "active"
          ? { ...row, status: "verified" }
          : row));
    });
  }

  return (
    <div className="grid gap-6">
      {message ? <p className="rounded-xl border bg-muted/50 p-3 text-sm" aria-live="polite">{message}</p> : null}
      {connections.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {connections.map((connection) => (
            <article className="rounded-2xl border bg-card p-4" key={connection.id}>
              <div className="flex items-start justify-between gap-3">
                <div><h2 className="font-semibold">{connection.name}</h2><p className="text-xs text-muted-foreground">{connection.environment === "production" ? "Producción" : "Pruebas"}</p></div>
                <span className={`rounded-full px-2 py-1 text-xs ${connection.status === "active" ? "bg-emerald-100 text-emerald-800" : connection.status === "error" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{statusLabel(connection.status)}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{connection.capabilities.length ? connection.capabilities.join(" · ") : "Sin capacidades verificadas"}</p>
              {connection.lastError ? <p className="mt-3 text-sm text-destructive">{connection.lastError}</p> : null}
              {canManage ? <Button className="mt-4" disabled={pending} onClick={() => refreshConnection(connection.id)} size="sm" variant="outline"><RefreshCw /> Verificar de nuevo</Button> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Agregar conexión</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((item) => (
            <button className={`rounded-2xl border bg-card p-5 text-left transition hover:border-primary ${provider === item.code ? "border-primary ring-2 ring-primary/20" : ""}`} disabled={!canManage} key={item.code} onClick={() => setProvider(item.code)} type="button">
              <div className="flex items-center gap-2"><PlugZap size={18} /><span className="font-semibold">{item.name}</span></div>
              <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium">{item.status}</span>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      {provider === "tico_factura_import" ? (
        <div className="rounded-2xl border bg-card p-5"><h3 className="font-semibold">Tico Factura por intercambio</h3><p className="mt-2 text-sm text-muted-foreground">Carga el XML recibido en Facturación. Biz.OS usa la clave fiscal para evitar duplicados y vincular el documento con la venta.</p></div>
      ) : provider ? (
        <form className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              setMessage("Guardando y haciendo una prueba de lectura…");
              const certificateFile = form.get("certificateFile");
              const certificateBase64 = certificateFile instanceof File && certificateFile.size
                ? await certificateToBase64(certificateFile)
                : "";
              const result = await saveAndVerifyFiscalConnectionAction({
                credentials: {
                  apiKey: String(form.get("apiKey") ?? ""),
                  certificateBase64,
                  certificatePin: String(form.get("certificatePin") ?? ""),
                  email: String(form.get("email") ?? ""),
                  password: String(form.get("password") ?? ""),
                  token: String(form.get("token") ?? ""),
                  username: String(form.get("username") ?? ""),
                },
                environment: form.get("environment"),
                name: form.get("name"),
                providerCode: provider,
                publicConfig: {
                  accountNumber: String(form.get("accountNumber") ?? ""),
                  acceptedValues: String(form.get("acceptedValues") ?? "accepted,aceptado"),
                  apiKeyHeader: String(form.get("apiKeyHeader") ?? "X-API-Key"),
                  baseUrl: String(form.get("baseUrl") ?? ""),
                  contractVersion: "bizos-fiscal-v1",
                  documentIdField: String(form.get("documentIdField") ?? "documentId"),
                  issuePath: String(form.get("issuePath") ?? "/fiscal-documents"),
                  processingValues: String(form.get("processingValues") ?? "received,processing,recibido,procesando"),
                  referenceField: String(form.get("referenceField") ?? "reference"),
                  rejectedValues: String(form.get("rejectedValues") ?? "rejected,rechazado"),
                  statusField: String(form.get("statusField") ?? "status"),
                  statusPathTemplate: String(form.get("statusPathTemplate") ?? "/fiscal-documents/{reference}"),
                  verificationPath: String(form.get("verificationPath") ?? "/fiscal-contract"),
                },
              });
              setMessage(result.ok ? result.data.detail : result.error);
              if (result.ok) window.location.reload();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "No se pudo leer el certificado.");
            }
          });
        }}>
          <div className="md:col-span-2"><h3 className="font-semibold">Conectar {PROVIDERS.find((item) => item.code === provider)?.name}</h3><p className="text-sm text-muted-foreground">Las credenciales se cifran y la primera prueba solo consulta información.</p></div>
          <label className="grid gap-1 text-sm">Nombre de la conexión<Input defaultValue={PROVIDERS.find((item) => item.code === provider)?.name} name="name" required /></label>
          <label className="grid gap-1 text-sm">Ambiente<select className="h-8 rounded-lg border bg-background px-2" defaultValue="testing" name="environment"><option value="testing">Pruebas</option><option value="production">Producción</option></select></label>
          {provider === "alegra" ? <><label className="grid gap-1 text-sm">Correo de Alegra<Input name="email" required type="email" /></label><label className="grid gap-1 text-sm">Token API<Input name="token" required type="password" /></label></> : null}
          {provider === "hacienda" ? <>
            <label className="grid gap-1 text-sm">Usuario de Hacienda<Input autoComplete="off" name="username" required /></label>
            <label className="grid gap-1 text-sm">Contraseña<Input autoComplete="new-password" name="password" required type="password" /></label>
            <label className="grid gap-1 text-sm">Llave criptográfica .p12<Input accept=".p12,.pfx,application/x-pkcs12" name="certificateFile" required type="file" /></label>
            <label className="grid gap-1 text-sm">PIN de la llave<Input autoComplete="new-password" name="certificatePin" required type="password" /></label>
          </> : null}
          {provider === "gti" ? <>
            <label className="grid gap-1 text-sm">Número de cuenta GTI<Input autoComplete="off" inputMode="numeric" name="accountNumber" required /></label>
            <label className="grid gap-1 text-sm">Usuario GTI<Input autoComplete="off" name="username" required /></label>
            <label className="grid gap-1 text-sm">Contraseña GTI<Input autoComplete="new-password" name="password" required type="password" /></label>
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground md:col-span-2">La comprobación inicial confirma la configuración y disponibilidad del servicio. La emisión se activará después de una prueba aceptada y una consulta recuperable en la cuenta sandbox de GTI.</p>
          </> : null}
          {provider === "rest" ? <>
            <label className="grid gap-1 text-sm md:col-span-2">URL base HTTPS<Input name="baseUrl" placeholder="https://api.proveedor.example" required type="url" /></label>
            <label className="grid gap-1 text-sm">Ruta de verificación<Input defaultValue="/fiscal-contract" name="verificationPath" required /></label>
            <label className="grid gap-1 text-sm">Ruta de emisión<Input defaultValue="/fiscal-documents" name="issuePath" required /></label>
            <label className="grid gap-1 text-sm md:col-span-2">Ruta de consulta<Input defaultValue="/fiscal-documents/{reference}" name="statusPathTemplate" required /><span className="text-xs text-muted-foreground">Debe incluir {"{reference}"} una vez.</span></label>
            <label className="grid gap-1 text-sm">Campo de estado<Input defaultValue="status" name="statusField" required /></label>
            <label className="grid gap-1 text-sm">Campo de ID externo<Input defaultValue="documentId" name="documentIdField" required /></label>
            <label className="grid gap-1 text-sm">Campo de referencia<Input defaultValue="reference" name="referenceField" required /></label>
            <label className="grid gap-1 text-sm">Estados aceptados<Input defaultValue="accepted,aceptado" name="acceptedValues" required /></label>
            <label className="grid gap-1 text-sm">Estados en proceso<Input defaultValue="received,processing,recibido,procesando" name="processingValues" required /></label>
            <label className="grid gap-1 text-sm">Estados rechazados<Input defaultValue="rejected,rechazado" name="rejectedValues" required /></label>
          </> : null}
          {provider === "factura_profesional" || provider === "rest" ? <>
            <label className="grid gap-1 text-sm">Token Bearer<Input name="token" type="password" /></label>
            <label className="grid gap-1 text-sm">Usuario<Input name="username" /></label><label className="grid gap-1 text-sm">Contraseña<Input name="password" type="password" /></label>
            <label className="grid gap-1 text-sm">API key<Input name="apiKey" type="password" /></label><label className="grid gap-1 text-sm">Header de API key<Input defaultValue="X-API-Key" name="apiKeyHeader" /></label>
          </> : null}
          <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm md:col-span-2"><ShieldCheck size={18} /><span>Biz.OS solo activa automáticamente un conector cuyo contrato de emisión esté implementado. Los demás quedan verificados sin reemplazar la conexión activa.</span></div>
          <Button className="md:col-span-2" disabled={pending} type="submit">{pending ? "Verificando…" : <><CheckCircle2 /> Conectar, verificar y activar</>}</Button>
        </form>
      ) : null}
    </div>
  );
}
