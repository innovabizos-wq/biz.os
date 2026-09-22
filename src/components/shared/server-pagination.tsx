import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ServerPaginationProps = {
  currentPage: number;
  pageSize: number;
  pathname: string;
  query?: Record<string, string | undefined>;
  totalItems: number;
};

function pageHref(
  pathname: string,
  page: number,
  query: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }

  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function ServerPagination({
  currentPage,
  pageSize,
  pathname,
  query = {},
  totalItems,
}: ServerPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, currentPage), totalPages);

  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginacion"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-sm"
    >
      <span className="text-muted-foreground">
        Pagina {page.toLocaleString("es-CR")} de {totalPages.toLocaleString("es-CR")} ·{" "}
        {totalItems.toLocaleString("es-CR")} registros
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            href={pageHref(pathname, page - 1, query)}
          >
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            href={pageHref(pathname, page + 1, query)}
          >
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
