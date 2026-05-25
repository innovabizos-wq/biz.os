"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  assignPermissionSchema,
  changeRoleStatusSchema,
  createRoleSchema,
  removePermissionSchema,
  updateRoleSchema,
} from "@/modules/roles/schemas";

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  const params = new URLSearchParams({ error: message });

  redirect(`${path}?${params.toString()}`);
}

function getSafeSupabaseErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  const message = error.message?.replace(/\s+/g, " ").trim();
  const code = error.code?.trim();

  if (message && code) {
    return `${message} (${code})`;
  }

  return message || "Error desconocido de Supabase.";
}

function logRoleActionError(
  actionName: string,
  error: {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  },
  context: Record<string, string>,
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

function revalidateRolePaths(rolId?: string) {
  revalidatePath("/admin/roles");
  revalidatePath("/admin/permisos");

  if (rolId) {
    revalidatePath(`/admin/roles/${rolId}`);
  }
}

export async function createRoleAction(formData: FormData) {
  const parsed = createRoleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/roles/nuevo", "Datos de rol invalidos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_rol_empresa", {
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
  });

  if (error) {
    logRoleActionError("createRoleAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError("/admin/roles/nuevo", "No se pudo crear el rol.");
  }

  const rolId = (data as { rol_id?: string }[] | null)?.[0]?.rol_id;

  revalidateRolePaths(rolId);
  redirect(rolId ? `/admin/roles/${rolId}` : "/admin/roles");
}

export async function updateRoleAction(formData: FormData) {
  const parsed = updateRoleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/roles", "Datos de rol invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_rol_empresa", {
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
    p_rol_id: parsed.data.rolId,
  });

  if (error) {
    logRoleActionError("updateRoleAction", error, {
      rolId: parsed.data.rolId,
    });
    redirectWithError(
      `/admin/roles/${parsed.data.rolId}`,
      "No se pudo actualizar el rol.",
    );
  }

  revalidateRolePaths(parsed.data.rolId);
  redirect(`/admin/roles/${parsed.data.rolId}`);
}

export async function changeRoleStatusAction(formData: FormData) {
  const parsed = changeRoleStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/roles", "Estado de rol invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_rol_empresa", {
    p_estado: parsed.data.estado,
    p_rol_id: parsed.data.rolId,
  });

  if (error) {
    logRoleActionError("changeRoleStatusAction", error, {
      estado: parsed.data.estado,
      rolId: parsed.data.rolId,
    });
    redirectWithError(
      `/admin/roles/${parsed.data.rolId}`,
      "No se pudo cambiar el estado del rol.",
    );
  }

  revalidateRolePaths(parsed.data.rolId);
  redirect(`/admin/roles/${parsed.data.rolId}`);
}

export async function assignPermissionToRoleAction(formData: FormData) {
  const parsed = assignPermissionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/roles", "Permiso invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_permiso_rol", {
    p_permiso_codigo: parsed.data.permisoCodigo,
    p_rol_id: parsed.data.rolId,
  });

  if (error) {
    logRoleActionError("assignPermissionToRoleAction", error, {
      permisoCodigo: parsed.data.permisoCodigo,
      rolId: parsed.data.rolId,
    });
    redirectWithError(
      `/admin/roles/${parsed.data.rolId}`,
      `No se pudo asignar el permiso: ${getSafeSupabaseErrorMessage(error)}`,
    );
  }

  revalidateRolePaths(parsed.data.rolId);
  redirect(`/admin/roles/${parsed.data.rolId}`);
}

export async function removePermissionFromRoleAction(formData: FormData) {
  const parsed = removePermissionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/roles", "Permiso invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("quitar_permiso_rol", {
    p_permiso_codigo: parsed.data.permisoCodigo,
    p_rol_id: parsed.data.rolId,
  });

  if (error) {
    logRoleActionError("removePermissionFromRoleAction", error, {
      permisoCodigo: parsed.data.permisoCodigo,
      rolId: parsed.data.rolId,
    });
    redirectWithError(
      `/admin/roles/${parsed.data.rolId}`,
      `No se pudo quitar el permiso: ${getSafeSupabaseErrorMessage(error)}`,
    );
  }

  revalidateRolePaths(parsed.data.rolId);
  redirect(`/admin/roles/${parsed.data.rolId}`);
}
