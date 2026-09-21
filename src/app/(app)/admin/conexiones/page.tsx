import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { ConnectionsManager } from "@/modules/billing/connectors/components/connections-manager";
import { getFiscalConnections } from "@/modules/billing/connectors/queries";
import { IntegrationOutboxPanel } from "@/modules/integrations/outbox/components/integration-outbox-panel";
import { listIntegrationOutboxJobs } from "@/modules/integrations/outbox/repository";
import { PublicApiKeysManager } from "@/modules/public-api/components/public-api-keys-manager";
import { listPublicApiKeys } from "@/modules/public-api/management";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function ConnectionsPage() {
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, ["admin.settings.view", "admin.settings.manage", "billing.config.view", "billing.config.manage", "billing.fiscal.view", "billing.fiscal.manage"]);
  const canManage = hasAnyPermission(access.tenant.permissions, ["admin.settings.manage", "billing.config.manage", "billing.fiscal.manage"]);
  const canManageApi = hasPermission(access.tenant.permissions, "admin.settings.manage");
  if (!canView) return <EmptyState description="Solicita acceso a configuración fiscal." title="Acceso denegado" />;
  const [result, jobs, apiKeys] = await Promise.all([
    getFiscalConnections(access.tenant),
    listIntegrationOutboxJobs("open", 50).catch(() => []),
    listPublicApiKeys(access.tenant.empresaId).catch(() => []),
  ]);
  return (
    <section className="space-y-6">
      <SectionHeader description="Conecta y verifica proveedores fiscales con una prueba de lectura antes de activarlos." eyebrow="Configuración" title="Conexiones" />
      <PublicApiKeysManager canManage={canManageApi} keys={apiKeys} />
      {result.ok ? <ConnectionsManager canManage={canManage} initialConnections={result.data} /> : <EmptyState description={result.error.message} title="No se pudieron cargar las conexiones" />}
      <IntegrationOutboxPanel canManage={canManage} jobs={jobs} />
    </section>
  );
}
