import { EmptyState } from "@/components/shared/empty-state";
import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentSucursal } from "@/modules/branches/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminSucursalPage() {
  const access = await requireAdminAccess();
  const sucursal = await getCurrentSucursal(access.tenant);

  if (!sucursal.ok || !sucursal.data) {
    return (
      <EmptyState
        description="El usuario actual no tiene sucursal asignada."
        title="Sucursal"
      />
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Sucursal operativa asociada al usuario actual."
        eyebrow="Administración"
        title="Sucursal"
      />
      <InfoCard
        items={[
          { label: "Nombre", value: sucursal.data.nombre },
          { label: "Codigo", value: sucursal.data.codigo },
          { label: "Direccion", value: sucursal.data.direccion },
          { label: "Telefono", value: sucursal.data.telefono },
          { label: "Estado", value: sucursal.data.estado },
        ]}
        title="Datos de sucursal"
      />
    </section>
  );
}
