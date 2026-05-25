"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  createTimesheetStateSchema,
  registerTimesheetStatusSchema,
  toggleTimesheetStateSchema,
  updateTimesheetStateSchema,
} from "@/modules/hr-timesheets/schemas";
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

function safeRedirectPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
}

function logTimesheetActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string> = {},
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function revalidateTimesheetPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/rrhh/planillas");
  revalidatePath("/rrhh/planillas/dashboard");
  revalidatePath("/rrhh/planillas/estados");
}

export async function initializeTimesheetStatesAction() {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "hr.timesheets.states.manage")) {
    redirectWithError(
      "/rrhh/planillas/estados",
      "No tienes permiso para inicializar estados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "inicializar_rrhh_planilla_estados_empresa",
  );

  if (error) {
    logTimesheetActionError("initializeTimesheetStatesAction", error);
    redirectWithError(
      "/rrhh/planillas/estados",
      `No se pudieron inicializar estados: ${safeErrorMessage(error)}`,
    );
  }

  revalidateTimesheetPaths();
  redirect("/rrhh/planillas/estados");
}

export async function registerTimesheetStatusAction(formData: FormData) {
  const parsed = registerTimesheetStatusSchema.safeParse(getFormData(formData));
  const redirectTo = safeRedirectPath(
    typeof formData.get("redirectTo") === "string"
      ? String(formData.get("redirectTo"))
      : undefined,
    "",
  );

  if (!parsed.success) {
    if (redirectTo) {
      redirectWithError(redirectTo, "Estado de planilla invalido.");
    }

    return;
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "hr.timesheets.register")) {
    if (redirectTo) {
      redirectWithError(redirectTo, "No tienes permiso para registrar estado.");
    }

    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_rrhh_planilla_estado", {
    p_estado_codigo: parsed.data.estadoCodigo,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    logTimesheetActionError("registerTimesheetStatusAction", error, {
      estadoCodigo: parsed.data.estadoCodigo,
    });

    if (redirectTo) {
      redirectWithError(
        redirectTo,
        `No se pudo registrar el estado: ${safeErrorMessage(error)}`,
      );
    }

    return;
  }

  revalidateTimesheetPaths();
}

export async function createTimesheetStateAction(formData: FormData) {
  const parsed = createTimesheetStateSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/rrhh/planillas/estados", "Datos de estado invalidos.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "hr.timesheets.states.manage")) {
    redirectWithError(
      "/rrhh/planillas/estados",
      "No tienes permiso para crear estados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_rrhh_planilla_estado", {
    p_codigo: parsed.data.codigo,
    p_color: parsed.data.color ?? null,
    p_cuenta_como_pausa: parsed.data.cuentaComoPausa,
    p_cuenta_como_trabajo: parsed.data.cuentaComoTrabajo,
    p_estado_regreso_codigo: parsed.data.estadoRegresoCodigo ?? null,
    p_nombre: parsed.data.nombre,
    p_orden: parsed.data.orden,
    p_requiere_regreso: parsed.data.requiereRegreso,
    p_tipo: parsed.data.tipo,
  });

  if (error) {
    logTimesheetActionError("createTimesheetStateAction", error, {
      codigo: parsed.data.codigo,
    });
    redirectWithError(
      "/rrhh/planillas/estados",
      `No se pudo crear el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateTimesheetPaths();
  redirect("/rrhh/planillas/estados");
}

export async function updateTimesheetStateAction(formData: FormData) {
  const parsed = updateTimesheetStateSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/rrhh/planillas/estados", "Datos de estado invalidos.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "hr.timesheets.states.manage")) {
    redirectWithError(
      "/rrhh/planillas/estados",
      "No tienes permiso para actualizar estados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_rrhh_planilla_estado", {
    p_codigo: parsed.data.codigo,
    p_color: parsed.data.color ?? null,
    p_cuenta_como_pausa: parsed.data.cuentaComoPausa,
    p_cuenta_como_trabajo: parsed.data.cuentaComoTrabajo,
    p_estado_id: parsed.data.estadoId,
    p_estado_regreso_codigo: parsed.data.estadoRegresoCodigo ?? null,
    p_nombre: parsed.data.nombre,
    p_orden: parsed.data.orden,
    p_requiere_regreso: parsed.data.requiereRegreso,
    p_tipo: parsed.data.tipo,
  });

  if (error) {
    logTimesheetActionError("updateTimesheetStateAction", error, {
      estadoId: parsed.data.estadoId,
    });
    redirectWithError(
      "/rrhh/planillas/estados",
      `No se pudo actualizar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateTimesheetPaths();
  redirect("/rrhh/planillas/estados");
}

export async function toggleTimesheetStateAction(formData: FormData) {
  const parsed = toggleTimesheetStateSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/rrhh/planillas/estados", "Estado invalido.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "hr.timesheets.states.manage")) {
    redirectWithError(
      "/rrhh/planillas/estados",
      "No tienes permiso para activar o desactivar estados.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_rrhh_planilla_estado", {
    p_activo: parsed.data.activo,
    p_estado_id: parsed.data.estadoId,
  });

  if (error) {
    logTimesheetActionError("toggleTimesheetStateAction", error, {
      estadoId: parsed.data.estadoId,
    });
    redirectWithError(
      "/rrhh/planillas/estados",
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateTimesheetPaths();
  redirect("/rrhh/planillas/estados");
}
