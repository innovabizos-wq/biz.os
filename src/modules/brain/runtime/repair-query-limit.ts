/** Only repair a read-only page size, never a business amount or a write payload. */
export function repairBrainQueryLimit(input: unknown, schema: { properties?: Record<string, unknown> }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const limitSchema = schema.properties?.limit as { minimum?: number; maximum?: number } | undefined;
  if (typeof value.limit !== "number" || !Number.isFinite(value.limit) || !limitSchema) return null;
  const limit = Math.max(limitSchema.minimum ?? 1, Math.min(value.limit, limitSchema.maximum ?? value.limit));
  if (limit === value.limit) return null;
  return { ...value, limit };
}
