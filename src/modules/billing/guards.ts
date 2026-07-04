import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import type { PermissionCode, TenantContext } from "@/types/core";

export const BILLING_VIEW_PERMISSIONS = [
  "billing.view",
  "billing.manage",
  "billing.issue",
  "billing.config.view",
  "billing.config.manage",
  "billing.invoices.view",
  "billing.invoices.create",
  "billing.fiscal.view",
  "billing.fiscal.manage",
] as const satisfies readonly PermissionCode[];

export const BILLING_CONFIG_VIEW_PERMISSIONS = [
  "billing.config.view",
  "billing.config.manage",
  "billing.fiscal.view",
  "billing.fiscal.manage",
] as const satisfies readonly PermissionCode[];

export const BILLING_CONFIG_MANAGE_PERMISSIONS = [
  "billing.config.manage",
  "billing.fiscal.manage",
] as const satisfies readonly PermissionCode[];

export function canUseBilling(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "billing") &&
    hasAnyPermission(tenant.permissions, BILLING_VIEW_PERMISSIONS)
  );
}

export function canViewBillingConfig(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "billing") &&
    hasAnyPermission(tenant.permissions, BILLING_CONFIG_VIEW_PERMISSIONS)
  );
}

export function canManageBillingConfig(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "billing") &&
    hasAnyPermission(tenant.permissions, BILLING_CONFIG_MANAGE_PERMISSIONS)
  );
}
