import { KpiThemeSelector } from "@/components/kpi/kpi-theme-selector";
import { SidebarLogoSelector } from "@/components/navigation/sidebar-logo-selector";
import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import {
  getNotificationSettings,
  saveNotificationSettingsAction,
} from "@/modules/notifications/settings";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AppearancePageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function AppearancePage({ searchParams }: AppearancePageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canViewAppearance = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);
  const canManageAppearance = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.manage",
  ]);

  if (!canViewAppearance) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Configuracion"
          title="Apariencia"
        />
        <EmptyState
          description="Solicita acceso de configuracion al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Ajusta el logo del menu y la escala de color visual para los KPI premium. Estas preferencias se guardan en este navegador."
        eyebrow="Configuracion"
        title="Apariencia"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      <SidebarLogoSelector />
      <KpiThemeSelector />
      <NotificationSettingsPanel canManage={canManageAppearance} tenant={access.tenant} />
    </section>
  );
}

async function NotificationSettingsPanel({
  canManage,
  tenant,
}: {
  canManage: boolean;
  tenant: Awaited<ReturnType<typeof requireAdminAccess>>["tenant"];
}) {
  const settings = await getNotificationSettings(tenant);
  const leadMinutes = settings.ok ? settings.data.followupReminderLeadMinutes : 30;

  return (
    <form
      action={saveNotificationSettingsAction}
      className="rounded-xl border bg-white p-5 shadow-sm"
    >
      <fieldset className="space-y-4" disabled={!canManage}>
        <div>
          <p className="text-base font-black text-slate-950">Notificaciones</p>
          <p className="mt-1 text-sm text-slate-500">
            Configura cuando biz.os debe avisar seguimientos pendientes mientras la
            sesion esta abierta.
          </p>
        </div>

        <label className="block max-w-sm space-y-1 text-sm font-semibold">
          <span>Recordar seguimientos antes de la hora</span>
          <input
            className="h-10 w-full rounded-md border px-3 text-sm"
            defaultValue={leadMinutes}
            max={1440}
            min={1}
            name="followupReminderLeadMinutes"
            type="number"
          />
          <span className="block text-xs font-normal text-slate-500">
            Default recomendado: 30 minutos. Tambien se avisara a la hora exacta si
            el seguimiento sigue pendiente.
          </span>
        </label>

        <Button type="submit">Guardar notificaciones</Button>
      </fieldset>

      {!canManage ? (
        <p className="mt-3 text-xs text-slate-500">
          Necesitas permiso para gestionar configuracion.
        </p>
      ) : null}
    </form>
  );
}
