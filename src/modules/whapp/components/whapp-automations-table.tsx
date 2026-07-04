import {
  INBOX_AUTOMATION_ACTION_LABELS,
  INBOX_AUTOMATION_MODE_LABELS,
  INBOX_AUTOMATION_STATUS_LABELS,
  INBOX_AUTOMATION_TRIGGER_LABELS,
} from "@/modules/inbox/constants";
import type { InboxAutomationRule } from "@/modules/inbox/types";

type WhappAutomationsTableProps = {
  automations: InboxAutomationRule[];
};

function statusClassName(status: InboxAutomationRule["estado"]) {
  if (status === "activa") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "pausada") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function modeClassName(mode: InboxAutomationRule["modo"]) {
  if (mode === "automatica") return "border-blue-200 bg-blue-50 text-blue-800";
  if (mode === "asistida") return "border-violet-200 bg-violet-50 text-violet-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDate(value: string | null) {
  if (!value) return "Sin ejecuciones";
  return new Date(value).toLocaleString("es-CR");
}

export function WhappAutomationsTable({
  automations,
}: WhappAutomationsTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Regla</th>
            <th className="px-4 py-3">Disparador</th>
            <th className="px-4 py-3">Accion</th>
            <th className="px-4 py-3">Modo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Ejecuciones</th>
          </tr>
        </thead>
        <tbody>
          {automations.map((automation) => (
            <tr className="border-t align-top" key={automation.id}>
              <td className="max-w-md px-4 py-3">
                <p className="font-medium">{automation.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {automation.descripcion ?? "Sin descripcion"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Canal: {automation.canalNombre ?? "Todos"}
                </p>
              </td>
              <td className="px-4 py-3">
                {INBOX_AUTOMATION_TRIGGER_LABELS[automation.triggerTipo]}
              </td>
              <td className="px-4 py-3">
                {INBOX_AUTOMATION_ACTION_LABELS[automation.accionTipo]}
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-bold",
                    modeClassName(automation.modo),
                  ].join(" ")}
                >
                  {INBOX_AUTOMATION_MODE_LABELS[automation.modo]}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-bold",
                    statusClassName(automation.estado),
                  ].join(" ")}
                >
                  {INBOX_AUTOMATION_STATUS_LABELS[automation.estado]}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <p>total: {automation.executionCount}</p>
                <p>ok: {automation.successfulExecutionCount}</p>
                <p>fallo: {automation.failedExecutionCount}</p>
                <p>{formatDate(automation.ultimaEjecucionAt)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
