import "server-only";

import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type { TenantContext } from "@/types/core";

export async function requireConversationLayerAccess(manage = false): Promise<
  | { ok: true; tenant: TenantContext }
  | { message: string; ok: false; status: number }
> {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok || !tenantResult.data) {
    return { message: "Sesion requerida.", ok: false, status: 401 };
  }

  const tenant = tenantResult.data;

  if (!isModuleActive(tenant.activeModules, "ai")) {
    return { message: "El modulo IA no esta activo.", ok: false, status: 403 };
  }

  const permissions = manage
    ? ["admin.settings.manage" as const]
    : ["ai.reports.use" as const, "admin.settings.manage" as const];

  if (!hasAnyPermission(tenant.permissions, permissions)) {
    return { message: "No tienes permiso para usar la IA central.", ok: false, status: 403 };
  }

  return { ok: true, tenant };
}

export function conversationLayerApiError(
  message: string,
  code = "CONVERSATION_LAYER_ERROR",
  status = 400,
) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const requireBrainAiAccess = requireConversationLayerAccess;
export const brainAiApiError = conversationLayerApiError;
