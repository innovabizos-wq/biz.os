"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  changeUserBranchSchema,
  changeUserRoleSchema,
  changeUserStatusSchema,
  updateUserSchema,
} from "@/modules/users/schemas";

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  const params = new URLSearchParams({ error: message });

  redirect(`${path}?${params.toString()}`);
}

function revalidateUserPaths(profileId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/usuarios");

  if (profileId) {
    revalidatePath(`/admin/usuarios/${profileId}`);
  }
}

function logUserActionError(
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

function safeErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
}

export async function updateUserAction(formData: FormData) {
  const parsed = updateUserSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/usuarios", "Datos de usuario invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_usuario_empresa", {
    p_nombre: parsed.data.nombre,
    p_profile_id: parsed.data.profileId,
    p_telefono: parsed.data.telefono ?? null,
  });

  if (error) {
    logUserActionError("updateUserAction", error, {
      profileId: parsed.data.profileId,
    });
    redirectWithError(
      `/admin/usuarios/${parsed.data.profileId}`,
      `No se pudo actualizar el usuario: ${safeErrorMessage(error)}`,
    );
  }

  revalidateUserPaths(parsed.data.profileId);
  redirect(`/admin/usuarios/${parsed.data.profileId}`);
}

export async function changeUserRoleAction(formData: FormData) {
  const parsed = changeUserRoleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/usuarios", "Rol de usuario invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_rol_usuario_empresa", {
    p_profile_id: parsed.data.profileId,
    p_rol_id: parsed.data.rolId,
  });

  if (error) {
    logUserActionError("changeUserRoleAction", error, {
      profileId: parsed.data.profileId,
      rolId: parsed.data.rolId,
    });
    redirectWithError(
      `/admin/usuarios/${parsed.data.profileId}`,
      `No se pudo cambiar el rol: ${safeErrorMessage(error)}`,
    );
  }

  revalidateUserPaths(parsed.data.profileId);
  redirect(`/admin/usuarios/${parsed.data.profileId}`);
}

export async function changeUserBranchAction(formData: FormData) {
  const parsed = changeUserBranchSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/usuarios", "Sucursal de usuario invalida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_sucursal_usuario_empresa", {
    p_profile_id: parsed.data.profileId,
    p_sucursal_id: parsed.data.sucursalId ?? null,
  });

  if (error) {
    logUserActionError("changeUserBranchAction", error, {
      profileId: parsed.data.profileId,
      sucursalId: parsed.data.sucursalId ?? "null",
    });
    redirectWithError(
      `/admin/usuarios/${parsed.data.profileId}`,
      `No se pudo cambiar la sucursal: ${safeErrorMessage(error)}`,
    );
  }

  revalidateUserPaths(parsed.data.profileId);
  redirect(`/admin/usuarios/${parsed.data.profileId}`);
}

export async function changeUserStatusAction(formData: FormData) {
  const parsed = changeUserStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/usuarios", "Estado de usuario invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_usuario_empresa", {
    p_estado: parsed.data.estado,
    p_profile_id: parsed.data.profileId,
  });

  if (error) {
    logUserActionError("changeUserStatusAction", error, {
      estado: parsed.data.estado,
      profileId: parsed.data.profileId,
    });
    redirectWithError(
      `/admin/usuarios/${parsed.data.profileId}`,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateUserPaths(parsed.data.profileId);
  redirect(`/admin/usuarios/${parsed.data.profileId}`);
}
