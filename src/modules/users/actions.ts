"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import {
  changeUserBranchSchema,
  changeUserRoleSchema,
  changeUserStatusSchema,
  createAdministrativeUserSchema,
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

function getCreateAdministrativeUserErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("already been registered") || message.includes("already registered")) {
    return "Este correo ya pertenece a una cuenta de acceso.";
  }

  if (message.includes("duplicate key") || message.includes("already exists")) {
    return "Este correo ya pertenece a un usuario de la empresa.";
  }

  return "No se pudo crear el usuario. Intenta de nuevo o revisa sus datos.";
}

export async function createAdministrativeUserAction(formData: FormData) {
  const parsed = createAdministrativeUserSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/invitaciones", parsed.error.issues[0]?.message ?? "Datos de usuario invalidos.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "admin.users.manage")) {
    redirectWithError("/admin/invitaciones", "No tienes permiso para crear usuarios.");
  }

  const supabase = await createClient();
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id")
    .eq("id", parsed.data.rolId)
    .eq("empresa_id", access.tenant.empresaId)
    .eq("estado", "activo")
    .maybeSingle();

  if (roleError || !role) {
    redirectWithError("/admin/invitaciones", "El rol seleccionado no es valido para esta empresa.");
  }

  if (parsed.data.sucursalId) {
    const { data: branch, error: branchError } = await supabase
      .from("sucursales")
      .select("id")
      .eq("id", parsed.data.sucursalId)
      .eq("empresa_id", access.tenant.empresaId)
      .eq("estado", "activa")
      .maybeSingle();

    if (branchError || !branch) {
      redirectWithError("/admin/invitaciones", "La sucursal seleccionada no es valida para esta empresa.");
    }
  }

  const admin = createServiceRoleClient();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.correo,
    email_confirm: true,
    password: parsed.data.password,
    user_metadata: {
      nombre: parsed.data.nombre,
    },
  });

  if (authError || !authData.user) {
    redirectWithError(
      "/admin/invitaciones",
      getCreateAdministrativeUserErrorMessage(authError ?? {}),
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      correo: parsed.data.correo.toLowerCase(),
      empresa_id: access.tenant.empresaId,
      id: authData.user.id,
      nombre: parsed.data.nombre,
      requiere_cambio_contrasena: true,
      rol_id: parsed.data.rolId,
      sucursal_id: parsed.data.sucursalId ?? null,
      telefono: parsed.data.telefono ?? null,
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(authData.user.id);
    redirectWithError(
      "/admin/invitaciones",
      getCreateAdministrativeUserErrorMessage(profileError ?? {}),
    );
  }

  await admin.from("auditoria_eventos").insert({
    accion: "crear_usuario_administrativo",
    empresa_id: access.tenant.empresaId,
    entidad: "profiles",
    entidad_id: profile.id,
    metadata: {
      cargo: parsed.data.cargo || null,
      correo: parsed.data.correo.toLowerCase(),
      requiereCambioContrasena: true,
    },
    usuario_id: access.tenant.profileId,
  });

  revalidateUserPaths(profile.id);
  revalidatePath("/admin/invitaciones");
  redirect("/admin/invitaciones?created=1");
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

  if (message?.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }

  return "No se pudo completar la accion. Intenta de nuevo o solicita ayuda al administrador.";
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
