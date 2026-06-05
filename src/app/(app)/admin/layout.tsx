import { AdminTabs, type AdminTabItem } from "@/components/admin/admin-tabs";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await requireAdminAccess();
  const showAdminSettings = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);
  const showAdminSettingsManage = hasAnyPermission(access.tenant.permissions, [
    "admin.settings.manage",
  ]);
  const showBillingModule = isModuleActive(access.tenant.activeModules, "billing");
  const showFiscalSettings =
    showBillingModule &&
    hasAnyPermission(access.tenant.permissions, [
      "admin.settings.view",
      "admin.settings.manage",
      "billing.fiscal.view",
      "billing.fiscal.manage",
    ]);
  const showAdminUsers = hasAnyPermission(access.tenant.permissions, [
    "admin.users.view",
    "admin.users.manage",
  ]);
  const showAdminRoles = hasAnyPermission(access.tenant.permissions, [
    "admin.roles.view",
    "admin.roles.manage",
  ]);
  const tabs: AdminTabItem[] = [
    { href: "/admin", label: "Resumen" },
    showAdminSettings ? { href: "/admin/empresa", label: "Empresa" } : null,
    showAdminUsers ? { href: "/admin/usuarios", label: "Usuarios" } : null,
    showAdminUsers ? { href: "/admin/invitaciones", label: "Invitaciones" } : null,
    showAdminRoles ? { href: "/admin/roles", label: "Roles" } : null,
    showAdminRoles ? { href: "/admin/permisos", label: "Permisos" } : null,
    showAdminSettings ? { href: "/admin/plan", label: "Plan" } : null,
    showAdminSettingsManage ? { href: "/admin/modulos", label: "Modulos" } : null,
    showAdminSettings ? { href: "/admin/apariencia", label: "Apariencia" } : null,
    showFiscalSettings ? { href: "/admin/fiscal", label: "Fiscal" } : null,
    showAdminSettings ? { href: "/admin/contexto", label: "Contexto del negocio" } : null,
  ].filter(Boolean) as AdminTabItem[];

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-4 overflow-hidden">
      <AdminTabs tabs={tabs} />
      <div className="min-h-0 flex-1 overflow-auto pr-1">{children}</div>
    </section>
  );
}
