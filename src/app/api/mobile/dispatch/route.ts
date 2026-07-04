import { getCurrentTenantContext, getCurrentUser } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { getDispatchOrders } from "@/modules/dispatch/queries";

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

  if (
    !isModuleActive(tenant.activeModules, "dispatch") ||
    !hasAnyPermission(tenant.permissions, [
      "dispatch.orders.view",
      "dispatch.orders.edit",
      "driver.tracking.use",
    ])
  ) {
    return Response.json(
      { code: "PERMISSION_DENIED", message: "Despacho no disponible para este usuario." },
      { status: 403 },
    );
  }

  const dispatches = await getDispatchOrders(tenant, "todos");

  if (!dispatches.ok) {
    return Response.json(dispatches.error, { status: 403 });
  }

  return Response.json({
    data: dispatches.data.map((dispatch) => ({
      clienteNombre: dispatch.clienteNombre,
      estado: dispatch.estado,
      fechaProgramada: dispatch.fechaProgramada,
      id: dispatch.id,
      numero: dispatch.numero,
      ventaId: dispatch.ventaId,
    })),
  });
}
