"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  changeFollowupStatusSchema,
  createCustomerSchema,
  createFollowupSchema,
  createInteractionSchema,
  updateCustomerSchema,
} from "@/modules/crm/schemas";

type CreatedCustomerRow = {
  cliente_id?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function revalidateCrmPaths(clienteId?: string) {
  revalidatePath("/crm");
  revalidatePath("/crm/clientes");

  if (clienteId) {
    revalidatePath(`/crm/clientes/${clienteId}`);
  }
}

function logCrmActionError(
  actionName: string,
  error: { code?: string; details?: string; hint?: string; message?: string },
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

export async function createCustomerAction(formData: FormData) {
  const parsed = createCustomerSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/crm/clientes/nuevo", "Datos de cliente invalidos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_crm_cliente", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_correo: parsed.data.correo ?? null,
    p_identificacion: parsed.data.identificacion ?? null,
    p_nombre: parsed.data.nombre,
    p_notas: parsed.data.notas ?? null,
    p_origen: parsed.data.origen ?? null,
    p_telefono: parsed.data.telefono ?? null,
    p_tipo: parsed.data.tipo,
    p_whatsapp: parsed.data.whatsapp ?? null,
  });

  if (error) {
    logCrmActionError("createCustomerAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/crm/clientes/nuevo",
      `No se pudo crear el cliente: ${safeErrorMessage(error)}`,
    );
  }

  const clienteId = (data as CreatedCustomerRow[] | null)?.[0]?.cliente_id;

  revalidateCrmPaths(clienteId);
  redirect(clienteId ? `/crm/clientes/${clienteId}` : "/crm/clientes");
}

export async function updateCustomerAction(formData: FormData) {
  const parsed = updateCustomerSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/crm/clientes", "Datos de cliente invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_crm_cliente", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_cliente_id: parsed.data.clienteId,
    p_correo: parsed.data.correo ?? null,
    p_estado: parsed.data.estado,
    p_identificacion: parsed.data.identificacion ?? null,
    p_nombre: parsed.data.nombre,
    p_notas: parsed.data.notas ?? null,
    p_origen: parsed.data.origen ?? null,
    p_telefono: parsed.data.telefono ?? null,
    p_tipo: parsed.data.tipo,
    p_whatsapp: parsed.data.whatsapp ?? null,
  });

  if (error) {
    logCrmActionError("updateCustomerAction", error, {
      clienteId: parsed.data.clienteId,
    });
    redirectWithError(
      `/crm/clientes/${parsed.data.clienteId}`,
      `No se pudo actualizar el cliente: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCrmPaths(parsed.data.clienteId);
  redirect(`/crm/clientes/${parsed.data.clienteId}`);
}

export async function createInteractionAction(formData: FormData) {
  const parsed = createInteractionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/crm/clientes", "Datos de interaccion invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_crm_interaccion", {
    p_cliente_id: parsed.data.clienteId,
    p_resultado: parsed.data.resultado ?? null,
    p_resumen: parsed.data.resumen,
    p_tipo: parsed.data.tipo,
  });

  if (error) {
    logCrmActionError("createInteractionAction", error, {
      clienteId: parsed.data.clienteId,
      tipo: parsed.data.tipo,
    });
    redirectWithError(
      `/crm/clientes/${parsed.data.clienteId}`,
      `No se pudo crear la interaccion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCrmPaths(parsed.data.clienteId);
  redirect(`/crm/clientes/${parsed.data.clienteId}`);
}

export async function createFollowupAction(formData: FormData) {
  const parsed = createFollowupSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/crm/clientes", "Datos de seguimiento invalidos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_crm_seguimiento", {
    p_asignado_a: parsed.data.asignadoA ?? null,
    p_asunto: parsed.data.asunto,
    p_cliente_id: parsed.data.clienteId,
    p_descripcion: parsed.data.descripcion ?? null,
    p_fecha_programada: parsed.data.fechaProgramada,
  });

  if (error) {
    logCrmActionError("createFollowupAction", error, {
      clienteId: parsed.data.clienteId,
    });
    redirectWithError(
      `/crm/clientes/${parsed.data.clienteId}`,
      `No se pudo crear el seguimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCrmPaths(parsed.data.clienteId);
  redirect(`/crm/clientes/${parsed.data.clienteId}`);
}

export async function changeFollowupStatusAction(formData: FormData) {
  const parsed = changeFollowupStatusSchema.safeParse(getFormData(formData));
  const clienteId = String(formData.get("clienteId") ?? "");

  if (!parsed.success || !clienteId) {
    redirectWithError("/crm/clientes", "Estado de seguimiento invalido.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_crm_seguimiento", {
    p_estado: parsed.data.estado,
    p_seguimiento_id: parsed.data.seguimientoId,
  });

  if (error) {
    logCrmActionError("changeFollowupStatusAction", error, {
      estado: parsed.data.estado,
      seguimientoId: parsed.data.seguimientoId,
    });
    redirectWithError(
      `/crm/clientes/${clienteId}`,
      `No se pudo cambiar el seguimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCrmPaths(clienteId);
  redirect(`/crm/clientes/${clienteId}`);
}
