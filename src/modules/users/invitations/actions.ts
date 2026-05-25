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

function redirectInvitationWithError(token: string, message: string): never {
  const params = new URLSearchParams({
    error: message,
    token,
  });

  redirect(`/invitation?${params.toString()}`);
}

export async function createInvitationAction(formData: FormData) {
  const parsed = createInvitationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/invitaciones", "Datos de invitacion invalidos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_invitacion_usuario", {
    p_correo: parsed.data.correo,
    p_nombre: parsed.data.nombre,
    p_rol_id: parsed.data.rolId,
    p_sucursal_id: parsed.data.sucursalId ?? null,
  });

  if (error) {
    redirectWithError("/admin/invitaciones", "No se pudo crear la invitacion.");
  }

  const invitation = (data as CreateInvitationRpcRow[] | null)?.[0];

  if (!invitation) {
    redirectWithError("/admin/invitaciones", "La RPC no devolvio invitacion.");
  }

  revalidatePath("/admin/invitaciones");
  redirect(
    `/admin/invitaciones?token=${encodeURIComponent(invitation.token)}&correo=${encodeURIComponent(invitation.correo)}`,
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
      "No se pudo aceptar la invitacion.",
    );
  }

  await clearPendingInvitationToken();

  redirect("/dashboard");
}
