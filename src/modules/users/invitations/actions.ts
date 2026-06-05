"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  acceptInvitationSchema,
  createInvitationSchema,
} from "@/modules/users/invitations/schemas";
import { clearPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";

type CreateInvitationRpcRow = {
  correo: string;
  fecha_expiracion: string;
  invitacion_id: string;
  token: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function getCreateInvitationReturnTo(formData: FormData) {
  const value = formData.get("returnTo");

  return value === "/rrhh/personal" ? value : "/admin/invitaciones";
}

function redirectInvitationWithError(token: string, message: string): never {
  const params = new URLSearchParams({
    error: message,
    token,
  });

  redirect(`/invitation?${params.toString()}`);
}

function getInvitationErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("ya pertenece") || message.includes("profile")) {
    return "Este correo ya pertenece a un usuario del sistema. No se puede crear otra invitacion.";
  }

  if (message.includes("pendiente")) {
    return "Ya existe una invitacion pendiente para este correo.";
  }

  if (message.includes("rol") || message.includes("sucursal")) {
    return "Rol o sucursal invalidos para esta empresa.";
  }

  if (message.includes("correo")) {
    return "El correo no es valido.";
  }

  if (message.includes("nombre")) {
    return "El nombre completo es requerido.";
  }

  if (error.code === "42501") {
    return "No tienes permiso para agregar personal.";
  }

  return "No se pudo crear la invitacion.";
}

function getAcceptInvitationErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("expirada")) {
    return "Esta invitacion expiro. Solicita una nueva invitacion.";
  }

  if (message.includes("cancelada")) {
    return "Esta invitacion fue cancelada.";
  }

  if (message.includes("aceptada") || message.includes("no esta pendiente")) {
    return "Esta invitacion ya fue usada.";
  }

  if (message.includes("correo autenticado no coincide")) {
    return "El correo de tu sesion no coincide con la invitacion.";
  }

  if (message.includes("ya pertenece")) {
    return "Esta cuenta ya pertenece a una empresa. Para aceptar esta invitacion usa otro correo.";
  }

  if (message.includes("rol") || message.includes("sucursal")) {
    return "Rol o sucursal invalidos para esta empresa.";
  }

  if (message.includes("no encontrada")) {
    return "La invitacion no existe o el enlace no es valido.";
  }

  return "No se pudo aceptar la invitacion. Intentalo de nuevo.";
}

export async function createInvitationAction(formData: FormData) {
  const returnTo = getCreateInvitationReturnTo(formData);
  const parsed = createInvitationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(returnTo, "Datos de personal invalidos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_invitacion_usuario", {
    p_cargo: parsed.data.cargo ?? null,
    p_cedula: parsed.data.cedula ?? null,
    p_correo: parsed.data.correo,
    p_nombre: parsed.data.nombre,
    p_rol_id: parsed.data.rolId,
    p_sucursal_id: parsed.data.sucursalId ?? null,
    p_telefono: parsed.data.telefono ?? null,
  });

  if (error) {
    redirectWithError(returnTo, getInvitationErrorMessage(error));
  }

  const invitation = (data as CreateInvitationRpcRow[] | null)?.[0];

  if (!invitation) {
    redirectWithError(returnTo, "La RPC no devolvio invitacion.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/invitaciones");
  revalidatePath("/admin/usuarios");
  revalidatePath("/rrhh/personal");
  redirect(
    `${returnTo}?created=1&token=${encodeURIComponent(invitation.token)}&correo=${encodeURIComponent(invitation.correo)}`,
  );
}

export async function acceptInvitationAction(formData: FormData) {
  const parsed = acceptInvitationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/invitation", "Datos de invitacion invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("aceptar_invitacion_usuario", {
    p_nombre_usuario: parsed.data.nombreUsuario ?? null,
    p_telefono_usuario: parsed.data.telefonoUsuario ?? null,
    p_token: parsed.data.token,
  });

  if (error) {
    redirectInvitationWithError(
      parsed.data.token,
      getAcceptInvitationErrorMessage(error),
    );
  }

  await clearPendingInvitationToken();

  redirect("/dashboard");
}
