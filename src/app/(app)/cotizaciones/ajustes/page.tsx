import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuoteDocumentStyleForm } from "@/modules/quotes/components/quote-document-style-form";
import { getQuoteDocumentSettings } from "@/modules/quotes/document-settings";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type QuoteDocumentSettingsPageProps = { searchParams?: Promise<{ error?: string; success?: string }> };

export default async function QuoteDocumentSettingsPage({ searchParams }: QuoteDocumentSettingsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canManage = hasPermission(access.tenant.permissions, "admin.settings.manage");
  if (!canManage) {
    return <section className="space-y-6"><SectionHeader description="Solo la administración de la empresa puede definir la presentación comercial." eyebrow="Cotizaciones" title="Diseño de proformas" /><EmptyState description="Solicita a un administrador que ajuste la plantilla de cotizaciones." title="Acceso restringido" /></section>;
  }
  const settings = await getQuoteDocumentSettings(access.tenant);
  return (
    <section className="space-y-6">
      <SectionHeader actions={<Link className={buttonVariants({ variant: "outline" })} href="/cotizaciones">Volver a cotizaciones</Link>} description="Elige cómo se presentan tus proformas. El diseño se aplica a las cotizaciones actuales y futuras sin alterar su contenido." eyebrow="Cotizaciones" title="Diseño de proformas" />
      <EphemeralPageAlert error={params?.error} success={params?.success} />
      <QuoteDocumentStyleForm settings={settings} />
    </section>
  );
}
