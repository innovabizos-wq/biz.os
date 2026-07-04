import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import {
  getInboxAutomationRules,
  getInboxChannels,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappAutomationForm } from "@/modules/whapp/components/whapp-automation-form";
import { WhappAutomationsTable } from "@/modules/whapp/components/whapp-automations-table";

type WhappAutomationsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function WhappAutomationsPage({
  searchParams,
}: WhappAutomationsPageProps) {
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
          description="No tienes permiso para ver automatizaciones Whapp."
          eyebrow="Whapp"
          title="Automatizaciones"
        />
        <EmptyState
          description="Solicita permisos de canales o conversaciones al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [channels, automations] = await Promise.all([
    getInboxChannels(),
    getInboxAutomationRules(),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Configura reglas de autopilot para sugerir, asistir o automatizar acciones sobre conversaciones Whapp."
          eyebrow="Whapp"
          title="Automatizaciones"
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

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Las reglas automaticas quedan configuradas y auditables. El motor de
        ejecucion por eventos debe activarse en una fase controlada con limites,
        pruebas y revision de acciones sensibles.
      </div>

      <WhappAutomationForm
        canManage={canManage}
        channels={channels.ok ? channels.data : []}
      />

      {automations.ok && automations.data.length > 0 ? (
        <WhappAutomationsTable automations={automations.data} />
      ) : (
        <EmptyState
          description={
            automations.ok
              ? "No hay automatizaciones configuradas."
              : automations.error.message
          }
          title="Sin automatizaciones"
        />
      )}
    </section>
  );
}
