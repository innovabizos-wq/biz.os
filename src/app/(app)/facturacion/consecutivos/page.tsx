import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { canUseBilling } from "@/modules/billing/guards";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function FiscalSequencesPage() {
  const access = await requireAdminAccess();

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Control fiscal de consecutivos por ambiente, sucursal, terminal y tipo documental."
        eyebrow="Facturacion"
        title="Consecutivos"
      />
      <EmptyState
        description="La base de datos ya reserva consecutivos de forma transaccional. La edicion manual se habilitara solo para billing.config.manage."
        title="Consecutivos preparados"
      />
    </section>
  );
}
