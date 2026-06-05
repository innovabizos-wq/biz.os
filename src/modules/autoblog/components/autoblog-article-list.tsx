import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { AutoblogStatusBadge } from "@/modules/autoblog/components/autoblog-status-badge";
import type { AutoblogArticle } from "@/modules/autoblog/types";

type AutoblogArticleListProps = {
  articles: AutoblogArticle[];
};

export function AutoblogArticleList({ articles }: AutoblogArticleListProps) {
  if (articles.length === 0) {
    return (
      <EmptyState
        description="Crea el primer borrador para tu empresa."
        title="Aun no hay articulos"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Articulo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tema</th>
            <th className="px-4 py-3">Actualizado</th>
            <th className="px-4 py-3 text-right">Accion</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr className="border-t hover:bg-muted/30" key={article.id}>
              <td className="px-4 py-3">
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/autoblog/${article.id}`}
                >
                  {article.title}
                </Link>
                {article.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {article.summary}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <AutoblogStatusBadge status={article.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {article.topic ?? "-"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(article.updatedAt).toLocaleString("es")}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-muted"
                  href={`/autoblog/${article.id}`}
                >
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
