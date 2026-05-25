import { tenantContextInputSchema } from "@/modules/tenant/schemas";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type TenantValidationIssue = {
  code?: string;
  expected?: unknown;
  message: string;
  path: unknown[];
  received?: unknown;
  values?: unknown;
};

function summarizeArrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return {
      isArray: false,
      type: typeof value,
      value,
    };
  }

  return {
    isArray: true,
    length: value.length,
    values: value,
  };
}

function summarizeTenantInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return {
      inputType: typeof input,
      isObject: false,
    };
  }

  const value = input as Record<string, unknown>;
  const permissions = value.permissions;
  const activeModules = value.activeModules;

  return {
    activeModules: summarizeArrayValue(activeModules),
    empresaIdExists: Boolean(value.empresaId),
    permissions: summarizeArrayValue(permissions),
    planCodeExists: Boolean(value.planCode),
    planCodeValue: value.planCode ?? null,
    profileIdExists: Boolean(value.profileId),
    rolIdExists: Boolean(value.rolId),
    rolIdValue: value.rolId ?? null,
    sucursalIdExists: Boolean(value.sucursalId),
    sucursalIdValue: value.sucursalId ?? null,
  };
}

function getTenantValidationMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  ) {
    const firstIssue = (error as { issues: TenantValidationIssue[] }).issues[0];

    if (firstIssue) {
      const path = firstIssue.path.join(".");
      return path
        ? `Tenant context invalido en ${path}: ${firstIssue.message}`
        : `Tenant context invalido: ${firstIssue.message}`;
    }
  }

  return "Tenant context invalido.";
}

function logTenantContextDiagnostic(input: unknown, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const issues =
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
      ? (error as { issues: TenantValidationIssue[] }).issues.map((issue) => ({
          code: issue.code,
          expected: issue.expected,
          message: issue.message,
          path: issue.path.join("."),
          received: issue.received,
          values: issue.values,
        }))
      : undefined;

  console.info("[createTenantContext] validation failed", {
    issues,
    summary: summarizeTenantInput(input),
  });
}

export function createTenantContext(input: unknown): CoreResult<TenantContext> {
  const parsed = tenantContextInputSchema.safeParse(input);

  if (!parsed.success) {
    logTenantContextDiagnostic(input, parsed.error);

    return fail(
      "INVALID_TENANT_CONTEXT",
      getTenantValidationMessage(parsed.error),
      parsed.error,
    );
  }

  return ok(parsed.data);
}

export function assertTenantContext(
  context: TenantContext | null | undefined,
): CoreResult<TenantContext> {
  if (!context?.empresaId || !context.profileId) {
    return fail(
      "INVALID_TENANT_CONTEXT",
      "Tenant context requiere empresaId y profileId.",
    );
  }

  return ok(context);
}
