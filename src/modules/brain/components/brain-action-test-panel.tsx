"use client";

import { useEffect, useMemo, useState } from "react";

import type { PublicConversationAction } from "@/lib/ai/action-registry";

type ApiResult = {
  actionId?: string;
  actionName?: string;
  confirmationRequired?: boolean;
  error?: string;
  expiresAt?: string;
  message?: string;
  mode?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  risk?: string;
  token?: string;
};

const DEFAULT_PARAMS = `{
  "query": "cliente",
  "limit": 5
}`;

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const data = await response.json();

  if (!response.ok) {
    return { error: data.error ?? "No se pudo completar la prueba.", ...data };
  }

  return data as ApiResult;
}

export function BrainActionTestPanel() {
  const [actions, setActions] = useState<PublicConversationAction[]>([]);
  const [actionId, setActionId] = useState("");
  const [confirmationToken, setConfirmationToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paramsText, setParamsText] = useState(DEFAULT_PARAMS);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/brain/actions")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const nextActions = Array.isArray(data.actions) ? data.actions : [];
        setActions(nextActions);
        setActionId(nextActions[0]?.id ?? "");
      })
      .catch(() => {
        if (active) setResult({ error: "No se pudieron cargar las acciones." });
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedAction = useMemo(
    () => actions.find((action) => action.id === actionId) ?? null,
    [actionId, actions],
  );

  function parseParams() {
    try {
      return JSON.parse(paramsText) as Record<string, unknown>;
    } catch {
      setResult({ error: "Los parametros no son JSON valido." });
      return null;
    }
  }

  async function run(path: "/api/brain/dry-run" | "/api/brain/execute") {
    const params = parseParams();
    if (!params || !actionId) return;

    setIsLoading(true);
    const response = await postJson(path, { actionId, params });
    setResult(response);
    setConfirmationToken(response.token ?? "");
    setIsLoading(false);
  }

  async function confirm() {
    if (!confirmationToken) {
      setResult({ error: "Primero ejecuta una accion que requiera confirmacion." });
      return;
    }

    setIsLoading(true);
    const response = await postJson("/api/brain/confirm", {
      confirmationToken,
    });
    setResult(response);
    if (!response.error) setConfirmationToken("");
    setIsLoading(false);
  }

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Prueba de acciones del Brain</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Ejecuta dry-run, validacion y confirmacion sobre el puente seguro del Brain.
          </p>
        </div>
        {selectedAction ? (
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
            Riesgo {selectedAction.risk}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Accion</span>
            <select
              className="rounded-md border bg-background px-3 py-2"
              onChange={(event) => setActionId(event.target.value)}
              value={actionId}
            >
              {actions.map((action) => (
                <option key={action.id} value={action.id}>
                  {action.name} ({action.id})
                </option>
              ))}
            </select>
          </label>

          {selectedAction ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              <p>{selectedAction.description}</p>
              <p className="mt-2">
                Confirmacion: {selectedAction.requiresConfirmation ? "requerida" : "no requerida"}
              </p>
            </div>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Parametros JSON</span>
            <textarea
              className="min-h-40 rounded-md border bg-background px-3 py-2 font-mono text-xs"
              onChange={(event) => setParamsText(event.target.value)}
              value={paramsText}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
              disabled={isLoading || !actionId}
              onClick={() => run("/api/brain/dry-run")}
              type="button"
            >
              Dry-run
            </button>
            <button
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={isLoading || !actionId}
              onClick={() => run("/api/brain/execute")}
              type="button"
            >
              Ejecutar
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-60"
              disabled={isLoading || !confirmationToken}
              onClick={confirm}
              type="button"
            >
              Confirmar token
            </button>
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <p className="text-sm font-medium">Resultado</p>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
            {result ? JSON.stringify(result, null, 2) : "Sin prueba ejecutada."}
          </pre>
        </div>
      </div>
    </div>
  );
}
