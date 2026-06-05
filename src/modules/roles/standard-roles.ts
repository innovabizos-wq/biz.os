import type { AccessibleRole } from "@/modules/roles/queries";
import type { Rol } from "@/types/core";

export const STANDARD_ROLE_NAMES = [
  "Super Admin",
  "Administrador",
  "Supervisor",
  "Vendedor",
  "Servicio al cliente",
  "Bodeguero",
  "Chofer / Repartidor",
  "Contabilidad / Facturacion",
  "RRHH",
] as const;

const STANDARD_ROLE_ORDER = new Map<string, number>(
  STANDARD_ROLE_NAMES.map((name, index) => [name.toLowerCase(), index]),
);

export function isStandardRole(roleName: string) {
  return STANDARD_ROLE_ORDER.has(roleName.toLowerCase());
}

export function isSuperAdminRole(roleName: string) {
  return roleName.toLowerCase() === "super admin";
}

export function isDriverRole(roleName: string) {
  return roleName.toLowerCase() === "chofer / repartidor";
}

export function sortRolesByStandardOrder<T extends Pick<Rol, "createdAt" | "nombre">>(
  roles: T[],
) {
  return [...roles].sort((a, b) => {
    const aOrder = STANDARD_ROLE_ORDER.get(a.nombre.toLowerCase());
    const bOrder = STANDARD_ROLE_ORDER.get(b.nombre.toLowerCase());

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export function getMissingStandardRoleNames(roles: AccessibleRole[]) {
  const existing = new Set(roles.map((role) => role.nombre.toLowerCase()));

  return STANDARD_ROLE_NAMES.filter((roleName) => !existing.has(roleName.toLowerCase()));
}

export function getRoleHelpText(roleName: string) {
  if (isSuperAdminRole(roleName)) {
    return "Este rol tiene acceso total a la empresa.";
  }

  if (isDriverRole(roleName)) {
    return "Este rol se usa para entregas, rutas y ubicacion en despacho.";
  }

  return null;
}
