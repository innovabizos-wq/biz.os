import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import {
  getInboxChannels,
  getInboxMetaTemplates,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappTemplateForm } from "@/modules/whapp/components/whapp-template-form";
import { WhappTemplatesTable } from "@/modules/whapp/components/whapp-templates-table";

type WhappTemplatesPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function WhappTemplatesPage({
  searchParams,
}: WhappTemplatesPageProps) {
  const [query, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
    "inbox.conversations.reply",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver plantillas Meta."
          eyebrow="Whapp"
          title="Plantillas Meta"
        />
        <EmptyState
          description="Solicita permisos de canales o conversaciones al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [channels, templates] = await Promise.all([
    getInboxChannels(),
    getInboxMetaTemplates(),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Catalogo local de plantillas WhatsApp Meta para conversaciones fuera de ventana y campanas futuras."
          eyebrow="Whapp"
          title="Plantillas Meta"
        />
        <Link className={buttonVariants({ variant: "outline" })} href="/whapp">
          Volver a Whapp
        </Link>
      </div>

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}
      {query?.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {query.success}
        </p>
      ) : null}

      <WhappTemplateForm
        canManage={canManage}
        channels={channels.ok ? channels.data : []}
      />

      {templates.ok && templates.data.length > 0 ? (
        <WhappTemplatesTable templates={templates.data} />
      ) : (
        <EmptyState
          description={
            templates.ok
              ? "No hay plantillas Meta registradas."
              : templates.error.message
          }
          title="Sin plantillas"
        />
      )}
    </section>
  );
}
