import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isCoreModule } from "@/lib/platform-modules/module-checks";
import {
  getLockedModuleMessage,
  getModuleDefinition,
  type ModuleHealthKey,
  type ModuleKind,
} from "@/modules/platform-modules/module-catalog";
import type {
  CatalogEstado,
  CoreResult,
  JsonRecord,
  ModuleCode,
  TenantContext,
} from "@/types/core";
import { fail, ok } from "@/types/core";

export type ModuleHealthStatus =
  | "unknown"
  | "healthy"
  | "misconfigured"
  | "unhealthy"
  | "inactive";

export type CompanyModuleStatus = {
  catalogStatus: CatalogEstado;
  canToggle: boolean;
  codigo: ModuleCode;
  companyStatus: CatalogEstado | null;
  descripcion: string | null;
  effectiveStatus: CatalogEstado;
  fechaActivacion: string | null;
  fechaDesactivacion: string | null;
  healthConfigurationComplete: boolean;
  healthCredentialsPresent: boolean;
  healthKeys: readonly ModuleHealthKey[];
  healthLastError: string | null;
  healthLastErrorAt: string | null;
  healthLastSuccessAt: string | null;
  healthMetadata: JsonRecord;
  healthStatus: ModuleHealthStatus;
  isActive: boolean;
  isCore: boolean;
  kind: ModuleKind;
  lockedMessage: string | null;
  moduloId: string;
  nombre: string;
  requiredConfigKeys: readonly string[];
  routes: readonly string[];
  softDependencies: readonly ModuleCode[];
};

export type ActiveEmpresaModule = {
  codigo: ModuleCode;
  estado: CatalogEstado;
  fechaActivacion: string;
  nombre: string;
};

type ModuleRelation = {
  codigo: ModuleCode;
  nombre: string;
};

type EmpresaModuloRow = {
  estado: CatalogEstado;
  fecha_activacion: string;
  modulos: ModuleRelation | ModuleRelation[] | null;
};

type CompanyModuleStatusRow = {
  catalog_status: CatalogEstado;
  codigo: ModuleCode;
  company_status: CatalogEstado | null;
  descripcion: string | null;
  fecha_activacion: string | null;
  fecha_desactivacion: string | null;
  health_configuration_complete?: boolean | null;
  health_credentials_present?: boolean | null;
  health_last_error?: string | null;
  health_last_error_at?: string | null;
  health_last_success_at?: string | null;
  health_metadata?: JsonRecord | null;
  health_status?: ModuleHealthStatus | null;
  is_active: boolean;
  modulo_id: string;
  nombre: string;
};

function firstModule(
  value: ModuleRelation | ModuleRelation[] | null,
): ModuleRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getActiveEmpresaModules(
  tenant: TenantContext,
): Promise<CoreResult<ActiveEmpresaModule[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresa_modulos")
    .select("estado, fecha_activacion, modulos(codigo, nombre)")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activo");

  if (error) {
    return fail("MODULE_INACTIVE", "No se pudieron consultar modulos.", error);
  }

  const modules = ((data ?? []) as EmpresaModuloRow[])
    .map((row) => ({
      relation: firstModule(row.modulos),
      row,
    }))
    .filter((item): item is { relation: ModuleRelation; row: EmpresaModuloRow } =>
      Boolean(item.relation),
    )
    .map(({ relation, row }) => ({
      codigo: relation.codigo,
      estado: row.estado,
      fechaActivacion: row.fecha_activacion,
      nombre: relation.nombre,
    }));

  return ok(modules);
}

export async function getCompanyModulesStatus(
  tenant: TenantContext,
): Promise<CoreResult<CompanyModuleStatus[]>> {
  if (!hasPermission(tenant.permissions, "admin.settings.manage")) {
    return fail(
      "PERMISSION_DENIED",
      "No tienes permiso para administrar modulos.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_modulos_empresa_actual");

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar modulos.", error);
  }

  return ok(
    ((data ?? []) as CompanyModuleStatusRow[]).map((row) => {
      const definition = getModuleDefinition(row.codigo);
      const isCore = isCoreModule(row.codigo);
      const isActive = isCore || row.is_active;

      return {
        canToggle: !isCore,
        catalogStatus: row.catalog_status,
        codigo: row.codigo,
        companyStatus: row.company_status,
        descripcion: row.descripcion ?? definition.description,
        effectiveStatus: isActive ? "activo" : "inactivo",
        fechaActivacion: row.fecha_activacion,
        fechaDesactivacion: row.fecha_desactivacion,
        healthConfigurationComplete: row.health_configuration_complete ?? false,
        healthCredentialsPresent: row.health_credentials_present ?? false,
        healthKeys: definition.healthKeys,
        healthLastError: row.health_last_error ?? null,
        healthLastErrorAt: row.health_last_error_at ?? null,
        healthLastSuccessAt: row.health_last_success_at ?? null,
        healthMetadata: row.health_metadata ?? {},
        healthStatus: row.health_status ?? (isActive ? "unknown" : "inactive"),
        isActive,
        isCore,
        kind: definition.kind,
        lockedMessage: isCore ? getLockedModuleMessage(row.codigo) : null,
        moduloId: row.modulo_id,
        nombre: row.nombre || definition.name,
        requiredConfigKeys: definition.requiredConfigKeys,
        routes: definition.routes,
        softDependencies: definition.softDependencies,
      };
    }),
  );
}
