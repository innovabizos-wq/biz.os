import "server-only";

import {
  authenticatePublicApiRequest,
  completePublicApiRequest,
} from "@/modules/public-api/auth";
import {
  cursorFilter,
  encodePublicApiCursor,
  parsePublicApiPagination,
} from "@/modules/public-api/pagination";
import { publicApiError, publicApiSuccess } from "@/modules/public-api/responses";

type Row = { created_at: string; id: string; [key: string]: unknown };

type PublicApiListOptions = {
  resource: string;
  scope: string;
  select: string;
  serialize: (row: Row) => unknown;
  table: string;
};

export function createPublicApiListHandler(options: PublicApiListOptions) {
  return async function GET(request: Request) {
    const fallbackRequestId = crypto.randomUUID();
    try {
    const authentication = await authenticatePublicApiRequest(request, options.scope);
    if (!authentication.ok) {
      const requestId = crypto.randomUUID();
      const message =
        authentication.error.code === "RATE_LIMITED"
          ? "Se excedio el limite de solicitudes por minuto."
          : authentication.error.code === "FORBIDDEN"
            ? "La clave no tiene el permiso requerido."
            : "Proporciona una clave de API valida.";
      return publicApiError(
        requestId,
        authentication.error.code,
        message,
        authentication.error.status,
      );
    }

    const context = authentication.context;
    const pagination = parsePublicApiPagination(request);
    if (!pagination) {
      const response = publicApiError(
        context.requestId,
        "INVALID_CURSOR",
        "El cursor de paginacion no es valido.",
        400,
      );
      await completePublicApiRequest(context, response.status);
      return response;
    }

    let query = context.client
      .from(options.table)
      .select(options.select)
      .eq("empresa_id", context.empresaId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pagination.limit + 1);
    if (pagination.cursor) query = query.or(cursorFilter(pagination.cursor));

    const { data, error } = await query;
    if (error) {
      console.error("[public-api] resource query failed", {
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
        requestId: context.requestId,
        resource: options.resource,
      });
      const response = publicApiError(
        context.requestId,
        "RESOURCE_QUERY_FAILED",
        `No se pudo consultar ${options.resource}.`,
        500,
      );
      await completePublicApiRequest(context, response.status);
      return response;
    }

    const rows = (data ?? []) as unknown as Row[];
    const hasMore = rows.length > pagination.limit;
    const pageRows = rows.slice(0, pagination.limit);
    const nextCursor = hasMore && pageRows.length
      ? encodePublicApiCursor(pageRows[pageRows.length - 1])
      : null;
    const response = publicApiSuccess(
      context.requestId,
      pageRows.map(options.serialize),
      { hasMore, limit: pagination.limit, nextCursor, resource: options.resource },
    );
    await completePublicApiRequest(context, response.status);
    return response;
    } catch {
      return publicApiError(
        fallbackRequestId,
        "INTERNAL_ERROR",
        "No se pudo completar la solicitud.",
        500,
      );
    }
  };
}
