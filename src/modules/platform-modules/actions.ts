"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getLockedModuleMessage } from "@/modules/platform-modules/module-catalog";
import { getCompanyModulesStatus } from "@/modules/platform-modules/queries";
import { toggleCompanyModuleSchema } from "@/modules/platform-modules/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(message: string): never {
  redirect(`/admin/modulos?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/admin/modulos?success=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo cambiar el modulo.";
  if (message.toLowerCase().includes("permission") || message.includes("Permiso")) {
    return "No tienes permiso para cambiar modulos.";
  }

  return message;
}

function logPlatformModuleActionError(actionName: string, error: RpcError) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

export async function toggleCompanyModuleAction(formData: FormData) {
  const parsed = toggleCompanyModuleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("Datos de modulo invalidos.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "admin.settings.manage")) {
    redirectWithError("No tienes permiso para administrar modulos.");
  }

  const modules = await getCompanyModulesStatus(access.tenant);
  const selectedModule = modules.ok
    ? modules.data.find((module) => module.moduloId === parsed.data.moduloId)
    : null;

  if (!selectedModule) {
    redirectWithError("Modulo no encontrado.");
  }

  if (!selectedModule.canToggle && parsed.data.nextState === "inactivo") {
    redirectWithError(
      selectedModule.lockedMessage ?? getLockedModuleMessage(selectedModule.codigo),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_modulo_empresa_actual", {
    p_modulo_id: parsed.data.moduloId,
    p_next_state: parsed.data.nextState,
  });

  if (error) {
    logPlatformModuleActionError("toggleCompanyModuleAction", error);
    redirectWithError(`No se pudo cambiar el modulo: ${safeErrorMessage(error)}`);
  }

  revalidatePath("/admin/modulos");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");

  redirectWithSuccess(
    parsed.data.nextState === "activo"
      ? "Modulo activado. Puede que debas refrescar la pagina para verlo en la barra lateral."
      : "Modulo desactivado.",
  );
}
