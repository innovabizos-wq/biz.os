import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { saveFiscalConfigurationAction } from "@/modules/billing/actions";
import { getFiscalConfiguration } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type FiscalPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm">
      <span>{label}</span>
      <span
        className={
          done
            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700"
            : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800"
        }
      >
        {done ? "Listo" : "Pendiente"}
      </span>
    </li>
  );
}

export default async function FiscalConfigurationPage({
  searchParams,
}: FiscalPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
    "billing.fiscal.view",
    "billing.fiscal.manage",
  ]);
  const canManage = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.manage",
    "billing.fiscal.manage",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita permisos administrativos para revisar esta seccion."
          eyebrow="Admin"
          title="Configuracion fiscal"
        />
        <EmptyState description="No tienes permiso para ver fiscal." title="Acceso denegado" />
      </section>
    );
  }

  if (!isModuleActive(access.tenant.activeModules, "billing")) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Este modulo no esta activo para tu empresa."
          eyebrow="Modulo inactivo"
          title="Configuracion fiscal"
        />
        <EmptyState
          description="Activa Facturacion desde Administracion / Modulos para usar esta seccion."
          title="Este modulo no esta activo para tu empresa."
        />
      </section>
    );
  }

  const fiscal = await getFiscalConfiguration(access.tenant);
  const config = fiscal.ok ? fiscal.data : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Datos fiscales y credenciales requeridas para emitir comprobantes electronicos de Costa Rica."
        eyebrow="Admin"
        title="Configuracion fiscal"
      />

      <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        Biz.OS valida el XML 4.4 ya firmado antes de enviarlo. Completa el domicilio fiscal y la
        identificacion registrada para el proveedor del sistema para habilitar la emision.
      </p>

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <form action={saveFiscalConfigurationAction} className="rounded-xl border bg-white p-5 shadow-sm">
          <fieldset disabled={!canManage} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Ambiente</span>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.ambiente ?? "pruebas"}
                  name="ambiente"
                >
                  <option value="pruebas">Pruebas</option>
                  <option value="produccion">Produccion</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Correo emisor</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.correoEmisor ?? ""}
                  name="correoEmisor"
                  type="email"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_170px]">
              <label className="space-y-1 text-sm font-semibold">
                <span>Razon social</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.razonSocial ?? ""}
                  name="razonSocial"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Tipo ID</span>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.tipoIdentificacion ?? "02"}
                  name="tipoIdentificacion"
                >
                  <option value="01">Fisica</option>
                  <option value="02">Juridica</option>
                  <option value="03">DIMEX</option>
                  <option value="04">NITE</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Identificacion</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.identificacion ?? ""}
                  name="identificacion"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Actividad economica</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.actividadEconomica ?? ""}
                  name="actividadEconomica"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
            </div>

            <label className="space-y-1 text-sm font-semibold">
              <span>Identificacion del proveedor del sistema</span>
              <input
                className="h-10 w-full rounded-md border px-3 text-sm"
                defaultValue={config?.identificacionProveedorSistema ?? ""}
                maxLength={20}
                name="identificacionProveedorSistema"
              />
              <span className="block text-xs font-normal text-muted-foreground">
                Numero registrado ante Hacienda para quien provee el sistema de emision.
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold">
                <span>Provincia</span>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.provincia ?? ""}
                  name="provincia"
                >
                  <option value="">Seleccionar</option>
                  <option value="1">San Jose</option>
                  <option value="2">Alajuela</option>
                  <option value="3">Cartago</option>
                  <option value="4">Heredia</option>
                  <option value="5">Guanacaste</option>
                  <option value="6">Puntarenas</option>
                  <option value="7">Limon</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Canton</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.canton ?? ""}
                  inputMode="numeric"
                  maxLength={2}
                  name="canton"
                  placeholder="01"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Distrito</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.distrito ?? ""}
                  inputMode="numeric"
                  maxLength={2}
                  name="distrito"
                  placeholder="01"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[180px_1fr]">
              <label className="space-y-1 text-sm font-semibold">
                <span>Barrio (opcional)</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.barrio ?? ""}
                  maxLength={50}
                  name="barrio"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Otras senas</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.otrasSenas ?? ""}
                  maxLength={250}
                  name="otrasSenas"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Condicion de venta predeterminada</span>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.condicionVenta ?? "01"}
                  name="condicionVenta"
                >
                  <option value="01">Contado</option>
                  <option value="02">Credito</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Medio de pago predeterminado</span>
                <select
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.medioPago ?? "01"}
                  name="medioPago"
                >
                  <option value="01">Efectivo</option>
                  <option value="02">Tarjeta</option>
                  <option value="03">Cheque</option>
                  <option value="04">Transferencia / SINPE</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Sucursal</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.sucursal ?? "001"}
                  name="sucursal"
                  placeholder="001"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Terminal</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  defaultValue={config?.terminal ?? "00001"}
                  name="terminal"
                  placeholder="00001"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">
                <span>Usuario API Hacienda</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  name="haciendaUsuario"
                  placeholder={config?.hasHaciendaUsuario ? "Guardado" : ""}
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>Contrasena API Hacienda</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  name="haciendaPassword"
                  placeholder={config?.hasHaciendaPassword ? "Guardada" : ""}
                  type="password"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <label className="space-y-1 text-sm font-semibold">
                <span>Llave criptografica .p12 en Base64</span>
                <textarea
                  className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                  name="p12Base64"
                  placeholder={config?.hasP12 ? "Llave guardada" : ""}
                />
              </label>
              <label className="space-y-1 text-sm font-semibold">
                <span>PIN de llave</span>
                <input
                  className="h-10 w-full rounded-md border px-3 text-sm"
                  name="pin"
                  placeholder={config?.hasPin ? "Guardado" : ""}
                  type="password"
                />
              </label>
            </div>

            <div className="flex justify-end border-t pt-4">
              <button
                className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                disabled={!canManage}
                type="submit"
              >
                Guardar configuracion fiscal
              </button>
            </div>
          </fieldset>
        </form>

        <aside className="rounded-xl border bg-slate-50 p-5">
          <h2 className="text-base font-black">Checklist fiscal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La emision se habilita cuando todos los puntos estan completos.
          </p>
          <ul className="mt-4 space-y-2">
            <ChecklistItem
              done={Boolean(config?.razonSocial && config.identificacion)}
              label="Datos de empresa"
            />
            <ChecklistItem done={Boolean(config?.actividadEconomica)} label="Actividad" />
            <ChecklistItem
              done={Boolean(config?.identificacionProveedorSistema)}
              label="Proveedor del sistema"
            />
            <ChecklistItem
              done={Boolean(config?.provincia && config.canton && config.distrito && config.otrasSenas)}
              label="Domicilio fiscal"
            />
            <ChecklistItem
              done={Boolean(config?.hasHaciendaUsuario && config.hasHaciendaPassword)}
              label="Credenciales Hacienda"
            />
            <ChecklistItem
              done={Boolean(config?.hasP12 && config.hasPin)}
              label="Llave criptografica"
            />
            <ChecklistItem
              done={Boolean(config?.sucursal && config.terminal)}
              label="Sucursal y terminal"
            />
          </ul>
          <div className="mt-4 rounded-lg border bg-white p-3 text-sm">
            <p className="font-bold">
              Estado: {config?.listoParaEmitir ? "listo para emitir" : "incompleto"}
            </p>
            <p className="mt-1 text-muted-foreground">
              Los secretos se guardan cifrados y no se muestran de vuelta.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
