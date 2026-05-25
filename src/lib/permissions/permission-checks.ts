import type { PermissionCode } from "@/types/core";

export function hasPermission(
  profilePermissions: readonly PermissionCode[],
  permissionCode: PermissionCode,
): boolean {
  return profilePermissions.includes(permissionCode);
}

export function hasEveryPermission(
  profilePermissions: readonly PermissionCode[],
  requiredPermissions: readonly PermissionCode[],
): boolean {
  const permissionSet = new Set(profilePermissions);

  return requiredPermissions.every((permission) => permissionSet.has(permission));
}

export function hasAnyPermission(
  profilePermissions: readonly PermissionCode[],
  requiredPermissions: readonly PermissionCode[],
): boolean {
  const permissionSet = new Set(profilePermissions);

  return requiredPermissions.some((permission) => permissionSet.has(permission));
}
