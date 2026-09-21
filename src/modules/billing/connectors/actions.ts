"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/modules/billing/crypto";
import { getFiscalConnector } from "@/modules/billing/connectors/registry";
import type { FiscalProviderCode } from "@/modules/billing/connectors/types";

const providerSchema = z.enum(["gti", "factura_profesional", "alegra", "hacienda", "rest"]);
const connectionSchema = z.object({
  connectionId: z.string().uuid().nullish(),
  credentials: z.record(z.string(), z.string()).default({}),
  environment: z.enum(["testing", "production"]),
  name: z.string().trim().min(1).max(100),
  providerCode: providerSchema,
  publicConfig: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, context) => {
  for (const [key, item] of Object.entries(value.credentials)) {
    if (item.length > 700_000) {
      context.addIssue({ code: "too_big", maximum: 700_000, origin: "string", path: ["credentials", key], message: "La credencial supera el tamaño permitido." });
    }
  }
  if (value.providerCode === "hacienda") {
    if (!value.credentials.certificateBase64?.trim()) {
      context.addIssue({ code: "custom", path: ["credentials", "certificateBase64"], message: "Selecciona la llave criptográfica .p12." });
    }
    if (!value.credentials.certificatePin?.trim()) {
      context.addIssue({ code: "custom", path: ["credentials", "certificatePin"], message: "Indica el PIN del certificado." });
    }
  }
});

type ActionResult = {
  ok: true;
  data: {
    connectionId: string;
    detail: string;
    status: "active" | "verified";
  };
} | { ok: false; error: string; connectionId?: string };

async function authorizedTenant() {
  const result = await getCurrentTenantContext();
  const tenant = result.ok ? result.data : null;
  if (!tenant || !hasAnyPermission(tenant.permissions, [
    "admin.settings.manage",
    "billing.config.manage",
    "billing.fiscal.manage",
  ])) return null;
  return tenant;
}

function parseCredentials(value: string | null) {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Credenciales guardadas inválidas.");
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

async function verifyAndActivate(input: {
  connectionId: string;
  credentials: Record<string, string>;
  environment: "testing" | "production";
  providerCode: FiscalProviderCode;
  publicConfig: Record<string, unknown>;
}): Promise<ActionResult> {
  const connector = getFiscalConnector(input.providerCode);
  if (!connector) return { ok: false, connectionId: input.connectionId, error: "Este proveedor solo admite importación de documentos." };
  const supabase = await createClient();
  try {
    const verification = await connector.verify(input);
    const { data: recorded, error: recordError } = await supabase.rpc("record_fiscal_connection_verification", {
      p_capabilities: verification.capabilities,
      p_connection_id: input.connectionId,
      p_error: null,
      p_success: true,
    });
    if (recordError || recorded !== true) throw new Error("No se pudo guardar la verificación.");
    if (verification.activatable) {
      const { data: activated, error: activationError } = await supabase.rpc("activate_fiscal_connection", {
        p_connection_id: input.connectionId,
      });
      if (activationError || activated !== true) throw new Error("La conexión se verificó, pero no pudo activarse.");
    }
    revalidatePath("/admin/conexiones");
    return {
      ok: true,
      data: {
        connectionId: input.connectionId,
        detail: verification.detail,
        status: verification.activatable ? "active" : "verified",
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "La verificación falló.";
    await supabase.rpc("record_fiscal_connection_verification", {
      p_capabilities: [],
      p_connection_id: input.connectionId,
      p_error: message,
      p_success: false,
    });
    revalidatePath("/admin/conexiones");
    return { ok: false, connectionId: input.connectionId, error: message };
  }
}

export async function saveAndVerifyFiscalConnectionAction(value: unknown): Promise<ActionResult> {
  const parsed = connectionSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de la conexión." };
  const tenant = await authorizedTenant();
  if (!tenant) return { ok: false, error: "No tienes permiso para administrar conexiones fiscales." };
  const credentials = Object.fromEntries(Object.entries(parsed.data.credentials).filter(([, item]) => item.trim()));
  let encrypted: string | null = null;
  try {
    encrypted = Object.keys(credentials).length > 0 ? encryptSecret(JSON.stringify(credentials)) : null;
  } catch {
    return { ok: false, error: "Falta FISCAL_CONFIG_ENCRYPTION_KEY en el servidor." };
  }
  const supabase = await createClient();
  const { data: connectionId, error } = await supabase.rpc("save_fiscal_connection", {
    p_connection_id: parsed.data.connectionId ?? null,
    p_encrypted_credentials: encrypted,
    p_environment: parsed.data.environment,
    p_name: parsed.data.name,
    p_provider_code: parsed.data.providerCode,
    p_public_config: parsed.data.publicConfig,
  });
  if (error || typeof connectionId !== "string") {
    return { ok: false, error: error?.message ?? "No se pudo guardar la conexión." };
  }
  if (Object.keys(credentials).length === 0 && parsed.data.connectionId) {
    return reverifyFiscalConnectionAction(connectionId);
  }
  return verifyAndActivate({ ...parsed.data, connectionId, credentials });
}

export async function reverifyFiscalConnectionAction(connectionId: string): Promise<ActionResult> {
  const tenant = await authorizedTenant();
  if (!tenant) return { ok: false, error: "No tienes permiso para verificar conexiones." };
  const parsedId = z.string().uuid().safeParse(connectionId);
  if (!parsedId.success) return { ok: false, error: "Conexión inválida." };
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("company_fiscal_connections")
    .select("id, provider_code, environment, public_config, encrypted_credentials")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", parsedId.data)
    .maybeSingle<{
      encrypted_credentials: string | null;
      environment: "testing" | "production";
      id: string;
      provider_code: FiscalProviderCode;
      public_config: Record<string, unknown>;
    }>();
  if (error || !data) return { ok: false, error: "Conexión no encontrada." };
  try {
    return verifyAndActivate({
      connectionId: data.id,
      credentials: parseCredentials(decryptSecret(data.encrypted_credentials)),
      environment: data.environment,
      providerCode: data.provider_code,
      publicConfig: data.public_config ?? {},
    });
  } catch (verificationError) {
    return { ok: false, connectionId: data.id, error: verificationError instanceof Error ? verificationError.message : "No se pudieron leer las credenciales." };
  }
}
