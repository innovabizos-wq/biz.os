import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { getAdminCoreSnapshot } from "@/modules/tenant/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminPage() {
  const access = await requireAdminAccess();
  const snapshot = await getAdminCoreSnapshot(access.tenant, access.profile);

  if (!snapshot.ok) {
    return (
      <EmptyState
        description={snapshot.error.message}
        title="No se pudo cargar la administración"
      />
    );
  }

  const data = snapshot.data;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Configuración de empresa y acceso administrativo."
        eyebrow="Administración"
        title="Administración"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard
          items={[
            { label: "Empresa", value: data.empresa?.nombre },
            { label: "Usuario", value: data.profile.nombre },
            { label: "Sucursal", value: data.sucursal?.nombre },
            { label: "Rol", value: data.rol?.nombre },
            { label: "Plan", value: data.plan?.codigo },
            { label: "Permisos", value: data.permissions.length },
          ]}
          title="Resumen operativo"
        />
        <InfoCard
          description="Estos identificadores no se reciben desde el frontend."
          items={[
            { label: "Profile ID", mono: true, value: data.profile.id },
            { label: "Modulos activos", value: data.modules.length },
            {
              label: "Codigos",
              value: data.modules.map((module) => module.codigo).join(", "),
            },
          ]}
          title="Datos de configuración"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link className={buttonVariants({ variant: "outline" })} href="/admin/empresa">
          Empresa
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/admin/usuario">
          Usuario
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/admin/rol">
          Rol y permisos
        </Link>
      </div>
    </section>
  );
}
