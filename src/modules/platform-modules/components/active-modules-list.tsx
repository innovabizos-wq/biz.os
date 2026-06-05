import { toggleCompanyModuleAction } from "@/modules/platform-modules/actions";
import type { CompanyModuleStatus } from "@/modules/platform-modules/queries";
import { Button } from "@/components/ui/button";

type ActiveModulesListProps = {
  modules: CompanyModuleStatus[];
};

function healthLabel(status: CompanyModuleStatus["healthStatus"]) {
  switch (status) {
    case "healthy":
      return "Salud ok";
    case "misconfigured":
      return "Mal configurado";
    case "unhealthy":
      return "Con fallos";
    case "inactive":
      return "Inactivo";
    default:
      return "Sin diagnostico";
  }
}

function healthClassName(status: CompanyModuleStatus["healthStatus"]) {
  switch (status) {
    case "healthy":
      return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800";
    case "misconfigured":
      return "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800";
    case "unhealthy":
      return "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800";
    default:
      return "inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700";
  }
}

export function ActiveModulesList({ modules }: ActiveModulesListProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Modulo</th>
            <th className="px-4 py-3">Descripcion</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Accion</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr className="border-t" key={module.codigo}>
              <td className="px-4 py-3">
                <p className="font-semibold">{module.nombre}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {module.codigo}
                </p>
              </td>
              <td className="max-w-xl px-4 py-3 text-muted-foreground">
                {module.descripcion ?? "Sin descripcion."}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    module.isCore
                      ? "inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800"
                      : "inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800"
                  }
                >
                  {module.isCore ? "Madre" : "Opcional"}
                </span>
                {module.isCore ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bloqueado por arquitectura
                  </p>
                ) : null}
                {module.requiredConfigKeys.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Config: {module.requiredConfigKeys.join(", ")}
                  </p>
                ) : null}
                {module.healthKeys.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Salud: {module.healthKeys.join(", ")}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <span
                  className={
                    module.isActive
                      ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
                      : "inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  }
                >
                  {module.isActive ? "Activo" : "Inactivo"}
                </span>
                {module.fechaActivacion && module.isActive ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Activado:{" "}
                    {new Date(module.fechaActivacion).toLocaleString("es")}
                  </p>
                ) : null}
                {module.healthKeys.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    <span className={healthClassName(module.healthStatus)}>
                      {healthLabel(module.healthStatus)}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Config: {module.healthConfigurationComplete ? "ok" : "pendiente"} -
                      Credenciales: {module.healthCredentialsPresent ? "ok" : "pendiente"}
                    </p>
                    {module.healthLastError ? (
                      <p className="max-w-64 text-xs text-rose-700">
                        {module.healthLastError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right">
                {!module.canToggle ? (
                  <div className="ml-auto max-w-64 text-right">
                    <p className="text-sm font-medium text-muted-foreground">
                      Siempre activo
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {module.lockedMessage}
                    </p>
                  </div>
                ) : (
                  <form action={toggleCompanyModuleAction}>
                    <input name="moduloId" type="hidden" value={module.moduloId} />
                    <input
                      name="nextState"
                      type="hidden"
                      value={module.isActive ? "inactivo" : "activo"}
                    />
                    <Button
                      type="submit"
                      variant={module.isActive ? "outline" : "default"}
                    >
                      {module.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
