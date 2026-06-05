import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { Button } from "@/components/ui/button";
import { changeAutoblogArticleStatusAction } from "@/modules/autoblog/actions";
import { AutoblogArticleForm } from "@/modules/autoblog/components/autoblog-article-form";
import { AutoblogPublishingTools } from "@/modules/autoblog/components/autoblog-publishing-tools";
import { AutoblogStatusBadge } from "@/modules/autoblog/components/autoblog-status-badge";
import { SocialCopyPreview } from "@/modules/autoblog/components/social-copy-preview";
import {
  canEditAutoblog,
  canManageAutoblog,
  canPublishAutoblog,
  getAutoblogArticle,
  isAutoblogEnabled,
} from "@/modules/autoblog/queries";
import type {
  AutoblogArticle,
  AutoblogStatus,
} from "@/modules/autoblog/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AutoblogArticlePageProps = {
  params: Promise<{ articleId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function StatusButton({
  article,
  label,
  status,
  variant = "outline",
}: {
  article: AutoblogArticle;
  label: string;
  status: AutoblogStatus;
  variant?: "default" | "outline" | "destructive";
}) {
  return (
    <form action={changeAutoblogArticleStatusAction}>
      <input name="articleId" type="hidden" value={article.id} />
      <input name="status" type="hidden" value={status} />
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

export default async function AutoblogArticlePage({
  params,
  searchParams,
}: AutoblogArticlePageProps) {
  const [{ articleId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);

  if (!isAutoblogEnabled(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Crea articulos y contenido para redes usando el contexto de tu negocio."
          eyebrow="Autoblog"
          title="Articulo"
        />
        <EmptyState
          description="Activa Autoblog desde Administracion / Modulos o desde el plan de la empresa."
          title="Autoblog no esta activo"
        />
      </section>
    );
  }

  const article = await getAutoblogArticle(access.tenant, articleId);

  if (!article.ok || !article.data) {
    notFound();
  }

  const canEdit = canEditAutoblog(access.tenant);
  const canPublish = canPublishAutoblog(access.tenant);
  const canManage = canManageAutoblog(access.tenant);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Edita el articulo, SEO y copys para redes."
          eyebrow="Autoblog"
          title={article.data.title}
        />
        <AutoblogStatusBadge status={article.data.status} />
      </div>

      <EphemeralPageAlert error={query?.error} success={query?.success} />

      <p className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Este articulo queda listo dentro de biz.os. La publicacion en web o redes
        se conectara en una fase posterior.
      </p>

      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <StatusButton
            article={article.data}
            label="Enviar a revision"
            status="pending_review"
          />
        ) : null}
        {canPublish ? (
          <StatusButton
            article={article.data}
            label="Aprobar"
            status="approved"
          />
        ) : null}
        {canPublish ? (
          <StatusButton
            article={article.data}
            label="Marcar listo para publicar"
            status="ready_to_publish"
          />
        ) : null}
        {canManage ? (
          <StatusButton
            article={article.data}
            label="Archivar"
            status="archived"
            variant="destructive"
          />
        ) : null}
      </div>

      <AutoblogPublishingTools
        articleContent={article.data.content}
        articleTitle={article.data.title}
      />

      <div>
        <h2 className="text-base font-semibold">Editar contenido</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Guarda cambios, prepara copys y marca el articulo listo cuando termine la
          revision.
        </p>
      </div>

      <AutoblogArticleForm
        article={article.data}
        canEdit={canEdit}
        mode="update"
      />

      <SocialCopyPreview article={article.data} />
    </section>
  );
}
