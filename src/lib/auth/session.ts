import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { createTenantContext } from "@/lib/tenant/tenant-context";
import { MODULE_CODES } from "@/modules/platform-modules/constants";
import { PERMISSION_CODES } from "@/modules/permissions/constants";
import type { AuthSession, AuthUser } from "@/modules/auth/types";
import type {
  AuthenticatedProfile,
  CoreResult,
  ModuleCode,
  PermissionCode,
  PlanCode,
  Profile,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

type ProfileRow = {
  correo: string;
  created_at: string;
  empresa_id: string;
  estado: Profile["estado"];
  id: string;
  nombre: string;
  rol_id: string | null;
  sucursal_id: string | null;
  telefono: string | null;
  ultimo_acceso: string | null;
  updated_at: string;
};

type CodigoRelation<TCode extends string> = {
  codigo?: TCode | null;
};

function mapProfile(row: ProfileRow): Profile {
  return {
    correo: row.correo,
    createdAt: row.created_at,
    empresaId: row.empresa_id,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    rolId: row.rol_id,
    sucursalId: row.sucursal_id,
    telefono: row.telefono,
    ultimoAcceso: row.ultimo_acceso,
    updatedAt: row.updated_at,
  };
}

function getSingleRelation<TCode extends string>(
  value: CodigoRelation<TCode> | CodigoRelation<TCode>[] | null,
): CodigoRelation<TCode> | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function logSessionDiagnostic(
  source: string,
  reason: string,
  context: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[${source}] ${reason}`, context);
  }
}

function getZodIssues(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    return (error as { issues: { message: string; path: unknown[] }[] }).issues.map(
      (issue) => ({
        message: issue.message,
        path: issue.path.join("."),
      }),
    );
  }

  return undefined;
}

function isKnownPermissionCode(code: string | null | undefined): code is PermissionCode {
  return (
    typeof code === "string" &&
    (PERMISSION_CODES as readonly string[]).includes(code)
  );
}

function isKnownModuleCode(code: string | null | undefined): code is ModuleCode {
  return (
    typeof code === "string" && (MODULE_CODES as readonly string[]).includes(code)
  );
}

export const getCurrentUser = cache(async function getCurrentUser(): Promise<
  CoreResult<AuthUser | null>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (error.status !== 400) {
      logSessionDiagnostic("getCurrentUser", "auth.getUser failed", {
        message: error.message,
        name: error.name,
        status: error.status,
      });
    }
    return fail("AUTH_NOT_CONNECTED", "No hay usuario autenticado.", error);
  }

  if (!data.user) {
    return ok(null);
  }

  return ok({
    email: data.user.email ?? null,
    id: data.user.id,
  });
});

export const getCurrentSession = cache(async function getCurrentSession(): Promise<
  CoreResult<AuthSession | null>
> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return userResult;
  }

  if (!userResult.data) {
    return ok(null);
  }

  return ok({
    email: userResult.data.email ?? undefined,
    userId: userResult.data.id,
  });
});

export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<
  CoreResult<AuthenticatedProfile | null>
> {
  const userResult = await getCurrentUser();

  if (!userResult.ok) {
    return userResult;
  }

  if (!userResult.data) {
    return ok(null);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, empresa_id, sucursal_id, rol_id, nombre, correo, telefono, estado, ultimo_acceso, created_at, updated_at",
    )
    .eq("id", userResult.data.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    logSessionDiagnostic("getCurrentProfile", "profile query failed", {
      message: error.message,
      userId: userResult.data.id,
    });
    return fail(
      "AUTH_NOT_CONNECTED",
      "No se pudo cargar tu perfil de usuario.",
      error,
    );
  }

  if (!data) {
    logSessionDiagnostic("getCurrentProfile", "user has no profile", {
      userId: userResult.data.id,
    });
    return ok(null);
  }

  const profile = mapProfile(data);

  if (profile.estado !== "activo") {
    logSessionDiagnostic("getCurrentProfile", "profile is not active", {
      estado: profile.estado,
      profileId: profile.id,
    });
    return fail("PERMISSION_DENIED", "Tu usuario no esta activo.");
  }

  return ok(profile as AuthenticatedProfile);
});

export const getCurrentTenantContext = cache(async function getCurrentTenantContext(): Promise<
  CoreResult<TenantContext | null>
> {
  const profileResult = await getCurrentProfile();

  if (!profileResult.ok) {
    logSessionDiagnostic("getCurrentTenantContext", "profile result failed", {
      code: profileResult.error.code,
      message: profileResult.error.message,
    });
    return profileResult;
  }

  if (!profileResult.data) {
    logSessionDiagnostic("getCurrentTenantContext", "missing profile");
    return ok(null);
  }

  const profile = profileResult.data;
  const supabase = await createClient();
  const rolIdForPermissionQuery =
    profile.rolId ?? "00000000-0000-0000-0000-000000000000";

  const [permissionsResult, modulesResult, planResult] = await Promise.all([
    supabase
      .from("rol_permisos")
      .select("permisos(codigo)")
      .eq("empresa_id", profile.empresaId)
      .eq("rol_id", rolIdForPermissionQuery),
    supabase
      .from("empresa_modulos")
      .select("modulos(codigo)")
      .eq("empresa_id", profile.empresaId)
      .eq("estado", "activo"),
    supabase
      .from("empresa_plan")
      .select("planes(codigo)")
      .eq("empresa_id", profile.empresaId)
      .eq("estado", "activo")
      .maybeSingle(),
  ]);

  if (permissionsResult.error) {
    logSessionDiagnostic("getCurrentTenantContext", "permissions query failed", {
      message: permissionsResult.error.message,
      profileId: profile.id,
    });
    return fail(
      "PERMISSION_DENIED",
      "No se pudieron cargar tus permisos.",
      permissionsResult.error,
    );
  }

  if (modulesResult.error) {
    logSessionDiagnostic("getCurrentTenantContext", "modules query failed", {
      message: modulesResult.error.message,
      profileId: profile.id,
    });
    return fail(
      "MODULE_INACTIVE",
      "No se pudieron cargar los modulos activos.",
      modulesResult.error,
    );
  }

  if (planResult.error) {
    logSessionDiagnostic("getCurrentTenantContext", "plan query failed", {
      message: planResult.error.message,
      profileId: profile.id,
    });
    return fail(
      "PLAN_INACTIVE",
      "No se pudo cargar el plan activo.",
      planResult.error,
    );
  }

  const permissions = (permissionsResult.data ?? [])
    .map((row) =>
      getSingleRelation(
        row.permisos as CodigoRelation<PermissionCode> | CodigoRelation<PermissionCode>[],
      ),
    )
    .map((permiso) => permiso?.codigo)
    .filter(isKnownPermissionCode);

  const activeModules = (modulesResult.data ?? [])
    .map((row) =>
      getSingleRelation(
        row.modulos as CodigoRelation<ModuleCode> | CodigoRelation<ModuleCode>[],
      ),
    )
    .map((modulo) => modulo?.codigo)
    .filter(isKnownModuleCode);

  const planRelation = getSingleRelation(
    planResult.data?.planes as
      | CodigoRelation<PlanCode>
      | CodigoRelation<PlanCode>[]
      | null,
  );

  const tenantInput = {
    activeModules,
    empresaId: profile.empresaId,
    permissions,
    planCode: planRelation?.codigo,
    profileEmail: profile.correo || undefined,
    profileId: profile.id,
    profileName: profile.nombre || undefined,
    rolId: profile.rolId ?? undefined,
    sucursalId: profile.sucursalId ?? undefined,
  };

  const tenantResult = createTenantContext(tenantInput);

  if (!tenantResult.ok) {
    logSessionDiagnostic("getCurrentTenantContext", "tenant validation failed", {
      activeModules,
      empresaIdExists: Boolean(profile.empresaId),
      permissions,
      planCodeExists: Boolean(planRelation?.codigo),
      planCodeValue: planRelation?.codigo ?? null,
      profileIdExists: Boolean(profile.id),
      rolIdExists: Boolean(profile.rolId),
      rolIdValue: profile.rolId,
      sucursalIdExists: Boolean(profile.sucursalId),
      sucursalIdValue: profile.sucursalId,
      validationIssues: getZodIssues(tenantResult.error.cause),
      validationMessage: tenantResult.error.message,
    });

    return tenantResult;
  }

  return ok(tenantResult.data);
});
