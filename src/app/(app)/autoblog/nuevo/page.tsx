import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { isAutoblogAiConfigured } from "@/modules/autoblog/ai";
import { AutoblogArticleForm } from "@/modules/autoblog/components/autoblog-article-form";
import { AutoblogTopicForm } from "@/modules/autoblog/components/autoblog-topic-form";
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
  const aiConfigured = isAutoblogAiConfigured();

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

      {!aiConfigured ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          La generacion automatica todavia no esta configurada. Puedes crear el
          articulo manualmente.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
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
              <p>Mejora con IA, tono de marca y copys automaticos quedan listos para conectar.</p>
            </div>
          </section>

          <section className="rounded-lg border bg-background p-5">
            <h2 className="text-base font-semibold">Generar borrador</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              La generacion IA quedara disponible cuando exista un proveedor seguro
              configurado en servidor.
            </p>
            <button
              className="mt-4 h-9 rounded-lg border px-3 text-sm font-semibold text-muted-foreground"
              disabled
              type="button"
            >
              Generar borrador
            </button>
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
