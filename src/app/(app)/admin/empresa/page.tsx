import { EmptyState } from "@/components/shared/empty-state";
import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentEmpresa } from "@/modules/companies/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminEmpresaPage() {
  const access = await requireAdminAccess();
  const empresa = await getCurrentEmpresa(access.tenant);

  if (!empresa.ok || !empresa.data) {
    return <EmptyState description="No hay empresa visible." title="Empresa" />;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Datos principales de la empresa actual. Vista de solo lectura."
        eyebrow="Administración"
        title="Empresa"
      />
      <InfoCard
        items={[
          { label: "Nombre", value: empresa.data.nombre },
          { label: "Nombre comercial", value: empresa.data.nombreComercial },
          {
            label: "Identificacion fiscal",
            value: empresa.data.identificacionFiscal,
          },
          { label: "Correo", value: empresa.data.correo },
          { label: "Telefono", value: empresa.data.telefono },
          { label: "Estado", value: empresa.data.estado },
          {
            label: "Fecha de creacion",
            value: new Date(empresa.data.createdAt).toLocaleString("es"),
          },
        ]}
        title="Datos de empresa"
      />
    </section>
  );
}
