"use client";

import { useActionState, useState } from "react";

import {
  createPublicApiKeyAction,
  revokePublicApiKeyAction,
  type PublicApiKeyActionState,
} from "@/modules/public-api/actions";
import {
  PUBLIC_API_SCOPES,
  type PublicApiKeySummary,
} from "@/modules/public-api/contract";

const initialState: PublicApiKeyActionState = { error: null, rawKey: null, success: null };

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function PublicApiKeysManager({
  canManage,
  keys,
}: {
  canManage: boolean;
  keys: PublicApiKeySummary[];
}) {
  const [state, formAction, pending] = useActionState(createPublicApiKeyAction, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h2 className="text-lg font-black">API publica v1</h2>
        <p className="text-sm text-muted-foreground">
          Crea claves por empresa para consultar clientes, catalogo, ventas, saldos y documentos fiscales. Cada clave tiene permisos y limite propios.
        </p>
        <a className="mt-2 inline-block text-sm font-bold underline" href="/api/v1/openapi.json" target="_blank">
          Abrir contrato OpenAPI
        </a>
      </div>

      {canManage ? (
        <form action={formAction} className="space-y-3 rounded-lg border bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm font-semibold">
              <span>Nombre</span>
              <input className="w-full rounded-md border bg-white px-3 py-2" name="name" placeholder="Integracion tienda" required />
            </label>
            <label className="space-y-1 text-sm font-semibold">
              <span>Ambiente</span>
              <select className="w-full rounded-md border bg-white px-3 py-2" defaultValue="live" name="environment">
                <option value="live">Produccion</option>
                <option value="test">Pruebas</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold">
              <span>Vencimiento</span>
              <select className="w-full rounded-md border bg-white px-3 py-2" defaultValue="365" name="expiresInDays">
                <option value="30">30 dias</option>
                <option value="90">90 dias</option>
                <option value="365">1 ano</option>
                <option value="never">Sin vencimiento</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-semibold">
              <span>Solicitudes por minuto</span>
              <input className="w-full rounded-md border bg-white px-3 py-2" defaultValue={120} max={600} min={1} name="rateLimitPerMinute" type="number" />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-bold">Permisos de lectura</legend>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {PUBLIC_API_SCOPES.map((scope) => (
                <label className="flex items-center gap-2 text-sm" key={scope.value}>
                  <input defaultChecked name="scopes" type="checkbox" value={scope.value} />
                  <span>{scope.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:bg-slate-400" disabled={pending} type="submit">
            {pending ? "Creando..." : "Crear clave"}
          </button>
          {state.error ? <p className="text-sm font-semibold text-red-800">{state.error}</p> : null}
          {state.rawKey ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-950">{state.success}</p>
              <code className="block break-all rounded bg-white p-2 text-xs">{state.rawKey}</code>
              <button
                className="rounded-md border bg-white px-3 py-2 text-xs font-black"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.rawKey ?? "");
                  setCopied(true);
                }}
                type="button"
              >
                {copied ? "Copiada" : "Copiar clave"}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Clave</th>
              <th className="px-3 py-2">Permisos</th>
              <th className="px-3 py-2">Uso</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Accion</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr className="border-t" key={key.id}>
                <td className="px-3 py-3">
                  <div className="font-bold">{key.name}</div>
                  <code className="text-xs text-muted-foreground">...{key.keyPrefix}</code>
                  <div className="text-xs text-muted-foreground">Vence: {formatDate(key.expiresAt)}</div>
                </td>
                <td className="max-w-80 px-3 py-3 text-xs">{key.scopes.join(", ")}</td>
                <td className="px-3 py-3 text-xs">
                  <div>{key.rateLimitPerMinute}/min</div>
                  <div className="text-muted-foreground">Ultimo: {formatDate(key.lastUsedAt)}</div>
                </td>
                <td className="px-3 py-3 font-semibold">{key.status === "active" ? "Activa" : "Revocada"}</td>
                <td className="px-3 py-3">
                  {canManage && key.status === "active" ? (
                    <form action={revokePublicApiKeyAction}>
                      <input name="keyId" type="hidden" value={key.id} />
                      <button className="rounded-md border border-red-200 px-3 py-2 text-xs font-black text-red-800" type="submit">
                        Revocar
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin acciones</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!keys.length ? <p className="p-4 text-sm text-muted-foreground">No hay claves API creadas.</p> : null}
      </div>
    </div>
  );
}
