import { getCurrentProfile, getCurrentTenantContext } from "@/lib/auth/session";
import { getCurrentSucursal } from "@/modules/branches/queries";
import { getCurrentEmpresa } from "@/modules/companies/queries";
import type { CurrentPlanDetail } from "@/modules/plans/queries";
import { getCurrentEmpresaPlan } from "@/modules/plans/queries";
import type { ActiveEmpresaModule } from "@/modules/platform-modules/queries";
import { getActiveEmpresaModules } from "@/modules/platform-modules/queries";
import type { RolePermissionDetail } from "@/modules/roles/queries";
import { getCurrentRol, getCurrentRolPermissions } from "@/modules/roles/queries";
import type {
  AuthenticatedProfile,
  CoreResult,
  Empresa,
  Rol,
  Sucursal,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

export type AdminCoreSnapshot = {
  empresa: Empresa | null;
  modules: ActiveEmpresaModule[];
  permissions: RolePermissionDetail[];
  plan: CurrentPlanDetail | null;
  profile: AuthenticatedProfile;
  rol: Rol | null;
  sucursal: Sucursal | null;
  tenant: TenantContext;
};

export type AdminAccessState =
  | { status: "unauthenticated" }
  | { status: "needs_onboarding" }
  | { profile: AuthenticatedProfile; status: "ready"; tenant: TenantContext };

export async function getAdminAccessState(): Promise<AdminAccessState> {
  const [profileResult, tenantResult] = await Promise.all([
    getCurrentProfile(),
    getCurrentTenantContext(),
  ]);

  if (!profileResult.ok || !tenantResult.ok) {
    return { status: "unauthenticated" };
  }

  if (!profileResult.data || !tenantResult.data) {
    return { status: "needs_onboarding" };
  }

  return {
    profile: profileResult.data,
    status: "ready",
    tenant: tenantResult.data,
  };
}

export async function getAdminCoreSnapshot(
  tenant: TenantContext,
  profile: AuthenticatedProfile,
): Promise<CoreResult<AdminCoreSnapshot>> {
  const [empresa, sucursal, rol, permissions, modules, plan] = await Promise.all([
    getCurrentEmpresa(tenant),
    getCurrentSucursal(tenant),
    getCurrentRol(tenant),
    getCurrentRolPermissions(tenant),
    getActiveEmpresaModules(tenant),
    getCurrentEmpresaPlan(tenant),
  ]);

  if (!empresa.ok) {
    return fail(empresa.error.code, empresa.error.message, empresa.error.cause);
  }

  if (!sucursal.ok) {
    return fail(sucursal.error.code, sucursal.error.message, sucursal.error.cause);
  }

  if (!rol.ok) {
    return fail(rol.error.code, rol.error.message, rol.error.cause);
  }

  if (!permissions.ok) {
    return fail(
      permissions.error.code,
      permissions.error.message,
      permissions.error.cause,
    );
  }

  if (!modules.ok) {
    return fail(modules.error.code, modules.error.message, modules.error.cause);
  }

  if (!plan.ok) {
    return fail(plan.error.code, plan.error.message, plan.error.cause);
  }

  return ok({
    empresa: empresa.data,
    modules: modules.data,
    permissions: permissions.data,
    plan: plan.data,
    profile,
    rol: rol.data,
    sucursal: sucursal.data,
    tenant,
  });
}
