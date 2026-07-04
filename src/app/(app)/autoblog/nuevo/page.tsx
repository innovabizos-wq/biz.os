import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { PendingSubmitButton } from "@/components/shared/pending-submit-button";
import { SectionHeader } from "@/components/shared/section-header";
import { generateAutoblogDraftAction } from "@/modules/autoblog/actions";
import { getAutoblogAiStatus } from "@/modules/autoblog/ai";
import { AutoblogArticleForm } from "@/modules/autoblog/components/autoblog-article-form";
import { AutoblogTopicForm } from "@/modules/autoblog/components/autoblog-topic-form";
import {
  AUTOBLOG_SOURCE_MODE_LABELS,
  AUTOBLOG_SOURCE_MODES,
} from "@/modules/autoblog/constants";
import {
  canCreateAutoblog,
  isAutoblogEnabled,
} from "@/modules/autoblog/queries";
import { getBusinessContext } from "@/modules/business-context/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewAutoblogArticlePageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function NewAutoblogArticlePage({
  searchParams,
}: NewAutoblogArticlePageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);

  if (!isAutoblogEnabled(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Crea articulos y contenido para redes usando el contexto de tu negocio."
          eyebrow="Autoblog"
          title="Crear articulo"
        />
        <EmptyState
          description="Activa Autoblog desde Administracion / Modulos o desde el plan de la empresa."
          title="Autoblog no esta activo"
        />
      </section>
    );
  }

  const canCreate = canCreateAutoblog(access.tenant);

  if (!canCreate) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita permisos de creacion de Autoblog."
          eyebrow="Autoblog"
          title="Crear articulo"
        />
        <EmptyState
          description="No tienes permiso para crear articulos."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const context = await getBusinessContext(access.tenant);
  const hasContext = context.ok && Boolean(context.data);
  const aiStatus = await getAutoblogAiStatus();

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Escribe un borrador simple y agrega fuentes, SEO o copys solo si los necesitas."
        eyebrow="Autoblog"
        title="Crear articulo"
      />

      <EphemeralPageAlert error={params?.error} success={params?.success} />

      {!hasContext ? (
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

      {!aiStatus.canGenerate ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          La generacion automatica todavia no esta lista. Puedes crear el articulo
          manualmente.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-lg border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Generar con IA</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Describe el tema y biz.os crea un borrador editable con SEO y copys.
                </p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
                {aiStatus.label}
              </span>
            </div>

            <form action={generateAutoblogDraftAction} className="mt-4 grid gap-4">
              <fieldset className="grid gap-4" disabled={!canCreate || !aiStatus.canGenerate}>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Tema del articulo</span>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    name="topic"
                    placeholder="Ej. Como elegir el producto correcto para..."
                    required
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Origen</span>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      defaultValue="internal_context"
                      name="sourceMode"
                    >
                      {AUTOBLOG_SOURCE_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {AUTOBLOG_SOURCE_MODE_LABELS[mode]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Notas opcionales</span>
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      name="sourceNotes"
                      placeholder="Enfoque, producto, promocion o audiencia"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Fuentes opcionales</span>
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    name="sourceUrlsText"
                    placeholder="Una URL por linea"
                  />
                </label>
              </fieldset>

              {aiStatus.tone !== "ready" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {aiStatus.detail}
                  {aiStatus.href ? (
                    <Link className="ml-1 font-semibold underline" href={aiStatus.href}>
                      Abrir IA
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="flex justify-end">
                <PendingSubmitButton
                  disabled={!canCreate || !aiStatus.canGenerate}
                  pendingLabel="Generando"
                >
                  Generar borrador
                </PendingSubmitButton>
              </div>
            </form>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Borrador manual</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Empieza con titulo y contenido. Los detalles avanzados quedan plegados.
              </p>
            </div>
            <AutoblogArticleForm
              canEdit={canCreate}
              defaultSourceMode="manual"
              mode="create"
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border bg-background p-5">
            <h2 className="text-base font-semibold">Herramientas de escritura</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Revision ortografica del navegador activa en campos de texto.</p>
              <p>
                Los borradores generados quedan guardados como articulos editables.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Fuentes preparadas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Guarda temas o fuentes para trabajarlos despues.
              </p>
            </div>
            <AutoblogTopicForm canCreate={canCreate} />
          </section>
        </aside>
      </div>
    </section>
  );
}
