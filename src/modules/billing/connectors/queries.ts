import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import type { FiscalConnection, FiscalProviderCode } from "@/modules/billing/connectors/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type ConnectionRow = {
  activated_at: string | null;
  capabilities: string[];
  environment: FiscalConnection["environment"];
  has_credentials: boolean;
  id: string;
  last_error: string | null;
  last_verified_at: string | null;
  name: string;
  provider_code: FiscalProviderCode;
  public_config: Record<string, unknown>;
  status: FiscalConnection["status"];
  updated_at: string;
};

export async function getFiscalConnections(
  tenant: TenantContext,
): Promise<CoreResult<FiscalConnection[]>> {
  if (!hasAnyPermission(tenant.permissions, [
    "billing.config.view",
    "billing.config.manage",
    "billing.fiscal.view",
    "billing.fiscal.manage",
  ])) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver conexiones fiscales.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_fiscal_connections");
  if (error) return fail("VALIDATION_ERROR", "No se pudieron consultar las conexiones fiscales.", error);
  return ok(((data ?? []) as ConnectionRow[]).map((row) => ({
    activatedAt: row.activated_at,
    capabilities: row.capabilities ?? [],
    environment: row.environment,
    hasCredentials: row.has_credentials,
    id: row.id,
    lastError: row.last_error,
    lastVerifiedAt: row.last_verified_at,
    name: row.name,
    providerCode: row.provider_code,
    publicConfig: row.public_config ?? {},
    status: row.status,
    updatedAt: row.updated_at,
  })));
}
