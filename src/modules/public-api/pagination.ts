import { z } from "zod";

const cursorSchema = z.object({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});

export type PublicApiCursor = z.infer<typeof cursorSchema>;

export function parsePublicApiPagination(request: Request) {
  const url = new URL(request.url);
  const parsedLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
  const rawCursor = url.searchParams.get("cursor");
  if (!rawCursor) return { cursor: null, limit };

  try {
    const decoded = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
    const cursor = cursorSchema.safeParse(decoded);
    return cursor.success ? { cursor: cursor.data, limit } : null;
  } catch {
    return null;
  }
}

export function cursorFilter(cursor: PublicApiCursor) {
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`;
}

export function encodePublicApiCursor(row: { created_at: string; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id })).toString("base64url");
}
