import { requireModule } from "@/lib/platform-modules/module-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import type { CoreResult, ModuleCode, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

export async function requireActiveModule(
  moduleCode: ModuleCode,
): Promise<CoreResult<TenantContext>> {
  const access = await requireAdminAccess();
  const moduleResult = requireModule(access.tenant.activeModules, moduleCode);

  if (!moduleResult.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[requireActiveModule] inactive module", {
        empresaId: access.tenant.empresaId,
        moduleCode,
      });
    }

    return fail(
      "MODULE_INACTIVE",
      "Este modulo no esta activo para tu empresa.",
    );
  }

  return ok(access.tenant);
}
