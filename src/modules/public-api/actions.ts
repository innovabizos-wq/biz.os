"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { PUBLIC_API_SCOPES } from "@/modules/public-api/contract";
import { createPublicApiKey, revokePublicApiKey } from "@/modules/public-api/management";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

const allowedScopes = new Set<string>(PUBLIC_API_SCOPES.map((scope) => scope.value));

const createSchema = z.object({
  environment: z.enum(["live", "test"]),
  expiresInDays: z.enum(["30", "90", "365", "never"]),
  name: z.string().trim().min(3).max(80),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(600),
  scopes: z.array(z.string()).min(1).max(PUBLIC_API_SCOPES.length),
});

const revokeSchema = z.object({ keyId: z.uuid() });

export type PublicApiKeyActionState = {
  error: string | null;
  rawKey: string | null;
  success: string | null;
};

export async function createPublicApiKeyAction(
  _previous: PublicApiKeyActionState,
  formData: FormData,
): Promise<PublicApiKeyActionState> {
  const access = await requireAdminAccess();
  if (!hasPermission(access.tenant.permissions, "admin.settings.manage")) {
    return { error: "No tienes permiso para administrar claves API.", rawKey: null, success: null };
  }
  const parsed = createSchema.safeParse({
    environment: formData.get("environment"),
    expiresInDays: formData.get("expiresInDays"),
    name: formData.get("name"),
    rateLimitPerMinute: formData.get("rateLimitPerMinute"),
    scopes: formData.getAll("scopes").filter((scope): scope is string => typeof scope === "string"),
  });
  if (!parsed.success || parsed.data.scopes.some((scope) => !allowedScopes.has(scope))) {
    return { error: "Revisa nombre, vencimiento, limite y permisos de la clave.", rawKey: null, success: null };
  }
  try {
    const created = await createPublicApiKey({
      actorId: access.tenant.profileId,
      empresaId: access.tenant.empresaId,
      environment: parsed.data.environment,
      expiresInDays: parsed.data.expiresInDays === "never" ? null : Number(parsed.data.expiresInDays),
      name: parsed.data.name,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
      scopes: parsed.data.scopes,
    });
    revalidatePath("/admin/conexiones");
    return {
      error: null,
      rawKey: created.rawKey,
      success: "Clave creada. Copiala ahora: no volvera a mostrarse.",
    };
  } catch (error) {
    return {
      error: error instanceof Error && error.message.includes("duplicate")
        ? "Ya existe una clave con ese nombre."
        : "No se pudo crear la clave API.",
      rawKey: null,
      success: null,
    };
  }
}

export async function revokePublicApiKeyAction(formData: FormData) {
  const access = await requireAdminAccess();
  if (!hasPermission(access.tenant.permissions, "admin.settings.manage")) return;
  const parsed = revokeSchema.safeParse({ keyId: formData.get("keyId") });
  if (!parsed.success) return;
  await revokePublicApiKey({
    actorId: access.tenant.profileId,
    empresaId: access.tenant.empresaId,
    keyId: parsed.data.keyId,
  });
  revalidatePath("/admin/conexiones");
}
