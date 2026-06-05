import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { AutoblogArticleList } from "@/modules/autoblog/components/autoblog-article-list";
import { AUTOBLOG_STATUS_LABELS } from "@/modules/autoblog/constants";
import {
  canCreateAutoblog,
  canViewAutoblog,
  getAutoblogArticles,
  isAutoblogEnabled,
} from "@/modules/autoblog/queries";
import type { AutoblogStatus } from "@/modules/autoblog/types";
import { getBusinessContext } from "@/modules/business-context/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AutoblogPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

const summaryStatuses: AutoblogStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "ready_to_publish",
];

export default async function AutoblogPage({ searchParams }: AutoblogPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);

  if (!isAutoblogEnabled(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Crea articulos y contenido para redes usando el contexto de tu negocio."
          eyebrow="Autoblog"
          title="Autoblog"
        />
        <EmptyState
          description="Activa Autoblog desde Administracion / Modulos o desde el plan de la empresa."
          title="Autoblog no esta activo"
        />
      </section>
    );
  }

  if (!canViewAutoblog(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita permisos de Autoblog al administrador de tu empresa."
          eyebrow="Autoblog"
          title="Autoblog"
        />
        <EmptyState
          description="No tienes permiso para ver Autoblog."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [articlesResult, contextResult] = await Promise.all([
    getAutoblogArticles(access.tenant),
    getBusinessContext(access.tenant),
  ]);
  const articles = articlesResult.ok ? articlesResult.data : [];
  const businessContext = contextResult.ok ? contextResult.data : null;
  const canCreate = canCreateAutoblog(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        actions={
          canCreate ? (
            <Link
              className="app-theme-button inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-white"
              href="/autoblog/nuevo"
            >
              Crear articulo
            </Link>
          ) : null
        }
        description="Crea articulos y contenido para redes usando el contexto de tu negocio."
        eyebrow="Autoblog"
        title="Autoblog"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      {!businessContext ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            Antes de generar articulos, configura el contexto del negocio.
          </p>
          <Link
            className="mt-2 inline-flex font-semibold text-amber-950 underline"
            href="/admin/contexto"
          >
            Configurar contexto
          </Link>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <article className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="mt-2 text-2xl font-semibold">{articles.length}</p>
        </article>
        {summaryStatuses.map((status) => (
          <article className="rounded-lg border bg-background p-4" key={status}>
            <p className="text-sm text-muted-foreground">
              {AUTOBLOG_STATUS_LABELS[status]}
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {articles.filter((article) => article.status === status).length}
            </p>
          </article>
        ))}
      </div>

      <AutoblogArticleList articles={articles} />
    </section>
  );
}
