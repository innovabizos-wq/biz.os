import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { BusinessContextForm } from "@/modules/business-context/components/business-context-form";
import { BusinessContextSummary } from "@/modules/business-context/components/business-context-summary";
import {
  canManageBusinessContext,
  canViewBusinessContext,
  getBusinessContext,
} from "@/modules/business-context/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type BusinessContextPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function BusinessContextPage({
  searchParams,
}: BusinessContextPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = canViewBusinessContext(access.tenant);
  const canManage = canManageBusinessContext(access.tenant);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita permisos administrativos para revisar esta seccion."
          eyebrow="Administracion"
          title="Contexto del negocio"
        />
        <EmptyState
          description="No tienes permiso para ver el contexto del negocio."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const context = await getBusinessContext(access.tenant);
  const businessContext = context.ok ? context.data : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Define la identidad, reglas y conocimiento base que biz.os usara para asistir a tu empresa."
        eyebrow="Administracion"
        title="Contexto del negocio"
      />

      <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
        El contexto del negocio alimentara modulos como Autoblog, IA, WhatsApp,
        cotizaciones, reportes y automatizaciones futuras.
      </p>

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      {!businessContext ? (
        <EmptyState
          description="Completar esta informacion ayudara a que biz.os genere contenido, sugerencias y automatizaciones mas precisas."
          title="Todavia no has definido el contexto del negocio"
        />
      ) : null}

      <BusinessContextSummary context={businessContext} />
      <BusinessContextForm canManage={canManage} context={businessContext} />
    </section>
  );
}
