"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  addInboxMessageSchema,
  assignInboxConversationSchema,
  changeInboxChannelStatusSchema,
  changeInboxConversationStatusSchema,
  createMetaChannelSchema,
  createInboxChannelSchema,
  createInboxConversationSchema,
  linkInboxConversationCustomerSchema,
  regenerateVerifyTokenSchema,
  saveMetaChannelSecretsSchema,
  updateMetaChannelConfigSchema,
} from "@/modules/inbox/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type RpcIdRow = {
  id?: string;
};

type VerifyTokenRow = {
  verify_token?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
}

function logInboxActionError(
  actionName: string,
  error: RpcError,
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

function revalidateInboxPaths(conversacionId?: string, canalId?: string) {
  revalidatePath("/inbox");
  revalidatePath("/inbox/conversaciones");
  revalidatePath("/inbox/canales");
  revalidatePath("/inbox/canales/nuevo");

  if (conversacionId) {
    revalidatePath(`/inbox/conversaciones/${conversacionId}`);
  }

  if (canalId) {
    revalidatePath(`/inbox/canales/${canalId}`);
  }
}

async function assertInboxPermission(
  permission:
    | "inbox.channels.manage"
    | "inbox.conversations.assign"
    | "inbox.conversations.create"
    | "inbox.conversations.reply"
    | "inbox.conversations.status.change",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta accion.");
  }

  return access;
}

export async function createInboxChannelAction(formData: FormData) {
  const parsed = createInboxChannelSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales", "Datos de canal invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales");

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_inbox_canal_manual", {
    p_canal: parsed.data.canal,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_nombre: parsed.data.nombre,
  });

  if (error) {
    logInboxActionError("createInboxChannelAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/canales",
      `No se pudo crear el canal: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths();
  redirect("/inbox/canales");
}

export async function changeInboxChannelStatusAction(formData: FormData) {
  const parsed = changeInboxChannelStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales", "Estado de canal invalido.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inbox_canal", {
    p_canal_id: parsed.data.canalId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInboxActionError("changeInboxChannelStatusAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      "/inbox/canales",
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(`/inbox/canales/${parsed.data.canalId}`);
}

export async function createMetaChannelAction(formData: FormData) {
  const parsed = createMetaChannelSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/canales/nuevo", "Datos de canal Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", "/inbox/canales/nuevo");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_inbox_canal_meta", {
    p_app_id: parsed.data.appId ?? null,
    p_business_id: parsed.data.businessId ?? null,
    p_canal: parsed.data.canal,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_instagram_business_account_id:
      parsed.data.instagramBusinessAccountId ?? null,
    p_nombre: parsed.data.nombre,
    p_page_id: parsed.data.pageId ?? null,
    p_phone_number_id: parsed.data.phoneNumberId ?? null,
    p_waba_id: parsed.data.wabaId ?? null,
  });

  if (error) {
    logInboxActionError("createMetaChannelAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/canales/nuevo",
      `No se pudo crear el canal Meta: ${safeErrorMessage(error)}`,
    );
  }

  const canalId = (data as RpcIdRow[] | null)?.[0]?.id;

  revalidateInboxPaths(undefined, canalId);
  redirect(canalId ? `/inbox/canales/${canalId}` : "/inbox/canales");
}

export async function updateMetaChannelConfigAction(formData: FormData) {
  const parsed = updateMetaChannelConfigSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de configuracion Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_inbox_canal_meta_config", {
    p_app_id: parsed.data.appId ?? null,
    p_business_id: parsed.data.businessId ?? null,
    p_canal_id: parsed.data.canalId,
    p_conexion_estado: parsed.data.conexionEstado,
    p_identificador_externo: parsed.data.identificadorExterno ?? null,
    p_instagram_business_account_id:
      parsed.data.instagramBusinessAccountId ?? null,
    p_nombre: parsed.data.nombre,
    p_page_id: parsed.data.pageId ?? null,
    p_phone_number_id: parsed.data.phoneNumberId ?? null,
    p_waba_id: parsed.data.wabaId ?? null,
  });

  if (error) {
    logInboxActionError("updateMetaChannelConfigAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo actualizar el canal Meta: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(fallbackPath);
}

export async function saveMetaChannelSecretsAction(formData: FormData) {
  const parsed = saveMetaChannelSecretsSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de secretos Meta invalidos.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_inbox_canal_meta_secretos", {
    p_access_token: parsed.data.accessToken ?? null,
    p_app_secret: parsed.data.appSecret ?? null,
    p_canal_id: parsed.data.canalId,
    p_token_expires_at: parsed.data.tokenExpiresAt ?? null,
    p_verify_token: parsed.data.verifyToken ?? null,
  });

  if (error) {
    logInboxActionError("saveMetaChannelSecretsAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudieron guardar los secretos: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(fallbackPath);
}

export async function regenerateMetaVerifyTokenAction(formData: FormData) {
  const parsed = regenerateVerifyTokenSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("canalId") === "string"
      ? `/inbox/canales/${formData.get("canalId")}`
      : "/inbox/canales";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Canal invalido.");
  }

  await assertInboxPermission("inbox.channels.manage", fallbackPath);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "regenerar_inbox_canal_verify_token",
    {
      p_canal_id: parsed.data.canalId,
    },
  );

  if (error) {
    logInboxActionError("regenerateMetaVerifyTokenAction", error, {
      canalId: parsed.data.canalId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo regenerar el verify token: ${safeErrorMessage(error)}`,
    );
  }

  const verifyToken = (data as VerifyTokenRow[] | null)?.[0]?.verify_token;

  revalidateInboxPaths(undefined, parsed.data.canalId);
  redirect(
    verifyToken
      ? `${fallbackPath}?verifyToken=${encodeURIComponent(verifyToken)}`
      : fallbackPath,
  );
}

export async function createInboxConversationAction(formData: FormData) {
  const parsed = createInboxConversationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inbox/conversaciones", "Datos de conversacion invalidos.");
  }

  await assertInboxPermission(
    "inbox.conversations.create",
    "/inbox/conversaciones",
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_inbox_conversacion_manual", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_canal: parsed.data.canal,
    p_canal_id: parsed.data.canalId ?? null,
    p_cliente_id: parsed.data.clienteId ?? null,
    p_contacto_identificador: parsed.data.contactoIdentificador ?? null,
    p_contacto_nombre: parsed.data.contactoNombre ?? null,
    p_contacto_telefono: parsed.data.contactoTelefono ?? null,
    p_contacto_usuario: parsed.data.contactoUsuario ?? null,
    p_mensaje_inicial: parsed.data.mensajeInicial ?? null,
  });

  if (error) {
    logInboxActionError("createInboxConversationAction", error, {
      canal: parsed.data.canal,
    });
    redirectWithError(
      "/inbox/conversaciones",
      `No se pudo crear la conversacion: ${safeErrorMessage(error)}`,
    );
  }

  const conversacionId = (data as RpcIdRow[] | null)?.[0]?.id;

  revalidateInboxPaths(conversacionId);
  redirect(
    conversacionId
      ? `/inbox/conversaciones/${conversacionId}`
      : "/inbox/conversaciones",
  );
}

export async function addInboxMessageAction(formData: FormData) {
  const parsed = addInboxMessageSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de mensaje invalidos.");
  }

  if (parsed.data.direccion === "entrante") {
    const access = await requireAdminAccess();

    if (
      !hasAnyPermission(access.tenant.permissions, [
        "inbox.conversations.create",
        "inbox.conversations.reply",
      ])
    ) {
      redirectWithError(fallbackPath, "No tienes permiso para realizar esta accion.");
    }
  } else {
    await assertInboxPermission("inbox.conversations.reply", fallbackPath);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_mensaje_inbox", {
    p_contenido: parsed.data.contenido,
    p_conversacion_id: parsed.data.conversacionId,
    p_direccion: parsed.data.direccion,
    p_es_nota_interna: parsed.data.esNotaInterna,
  });

  if (error) {
    logInboxActionError("addInboxMessageAction", error, {
      conversacionId: parsed.data.conversacionId,
      direccion: parsed.data.direccion,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo registrar el mensaje: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(fallbackPath);
}

export async function assignInboxConversationAction(formData: FormData) {
  const parsed = assignInboxConversationSchema.safeParse(getFormData(formData));
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de asignacion invalidos.");
  }

  await assertInboxPermission("inbox.conversations.assign", fallbackPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_inbox_conversacion", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("assignInboxConversationAction", error, {
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo asignar la conversacion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(fallbackPath);
}

export async function linkInboxConversationCustomerAction(formData: FormData) {
  const parsed = linkInboxConversationCustomerSchema.safeParse(
    getFormData(formData),
  );
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Datos de cliente invalidos.");
  }

  await assertInboxPermission("inbox.conversations.assign", fallbackPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("vincular_inbox_conversacion_cliente", {
    p_cliente_id: parsed.data.clienteId,
    p_conversacion_id: parsed.data.conversacionId,
  });

  if (error) {
    logInboxActionError("linkInboxConversationCustomerAction", error, {
      clienteId: parsed.data.clienteId,
      conversacionId: parsed.data.conversacionId,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo vincular el cliente: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(fallbackPath);
}

export async function changeInboxConversationStatusAction(formData: FormData) {
  const parsed = changeInboxConversationStatusSchema.safeParse(
    getFormData(formData),
  );
  const fallbackPath =
    typeof formData.get("conversacionId") === "string"
      ? `/inbox/conversaciones/${formData.get("conversacionId")}`
      : "/inbox/conversaciones";

  if (!parsed.success) {
    redirectWithError(fallbackPath, "Estado de conversacion invalido.");
  }

  await assertInboxPermission(
    "inbox.conversations.status.change",
    fallbackPath,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inbox_conversacion", {
    p_conversacion_id: parsed.data.conversacionId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInboxActionError("changeInboxConversationStatusAction", error, {
      conversacionId: parsed.data.conversacionId,
      estado: parsed.data.estado,
    });
    redirectWithError(
      fallbackPath,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInboxPaths(parsed.data.conversacionId);
  redirect(fallbackPath);
}
