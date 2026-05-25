import { InfoCard } from "@/components/shared/info-card";
import { SectionHeader } from "@/components/shared/section-header";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminUsuarioPage() {
  const access = await requireAdminAccess();
  const profile = access.profile;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Perfil operativo vinculado al usuario autenticado."
        eyebrow="Administración"
        title="Usuario"
      />
      <InfoCard
        items={[
          { label: "Nombre", value: profile.nombre },
          { label: "Correo", value: profile.correo },
          { label: "Telefono", value: profile.telefono },
          { label: "Estado", value: profile.estado },
          {
            label: "Ultimo acceso",
            value: profile.ultimoAcceso
              ? new Date(profile.ultimoAcceso).toLocaleString("es")
              : "No registrado",
          },
          { label: "Profile ID", mono: true, value: profile.id },
          { label: "Empresa ID", mono: true, value: profile.empresaId },
        ]}
        title="Datos del profile"
      />
    </section>
  );
}
