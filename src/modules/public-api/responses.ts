const API_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

export function publicApiError(
  requestId: string,
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return Response.json(
    { error: { code, details, message, requestId } },
    { headers: { ...API_HEADERS, "X-Request-Id": requestId }, status },
  );
}

export function publicApiSuccess(
  requestId: string,
  data: unknown,
  meta: Record<string, unknown>,
  status = 200,
) {
  return Response.json(
    { data, meta, requestId },
    { headers: { ...API_HEADERS, "X-Request-Id": requestId }, status },
  );
}
