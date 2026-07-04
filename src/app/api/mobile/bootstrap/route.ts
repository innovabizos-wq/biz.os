import { getCurrentTenantContext, getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";

export async function GET() {
  const [userResult, tenantResult] = await Promise.all([
    getCurrentUser(),
    getCurrentTenantContext(),
  ]);

  if (!userResult.ok || !userResult.data || !tenantResult.ok || !tenantResult.data) {
    return Response.json(
      { code: "AUTH_NOT_CONNECTED", message: "Usuario autenticado requerido." },
      { status: 401 },
    );
  }

  const tenant = tenantResult.data;

  if (
    !isModuleActive(tenant.activeModules, "mobile") ||
    !hasPermission(tenant.permissions, "mobile.access")
  ) {
    return Response.json(
      { code: "MODULE_INACTIVE", message: "API movil no disponible." },
      { status: 403 },
    );
  }

  return Response.json({
    activeModules: tenant.activeModules,
    empresaId: tenant.empresaId,
    permissions: tenant.permissions,
    profile: {
      email: tenant.profileEmail ?? userResult.data.email,
      id: tenant.profileId,
      name: tenant.profileName ?? null,
    },
  });
}
