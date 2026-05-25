"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  changeDispatchStatusSchema,
  createDispatchFromSaleSchema,
  updateDispatchSchema,
} from "@/modules/dispatch/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedDispatchRow = {
  despacho_id?: string;
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

function logDispatchActionError(
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

function revalidateDispatchPaths(despachoId?: string, ventaId?: string) {
  revalidatePath("/despacho");

  if (despachoId) {
    revalidatePath(`/despacho/${despachoId}`);
  }

  if (ventaId) {
    revalidatePath(`/ventas/${ventaId}`);
  }
}

async function assertDispatchPermission(
  permission:
    | "dispatch.orders.create"
    | "dispatch.orders.edit"
    | "dispatch.orders.status.change",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta acción.");
  }

  return access;
}

export async function createDispatchFromSaleAction(formData: FormData) {
  const parsed = createDispatchFromSaleSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Datos de despacho invalidos.");
  }

  await assertDispatchPermission(
    "dispatch.orders.create",
    `/ventas/${parsed.data.ventaId}`,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_despacho_desde_venta", {
    p_contacto_entrega: parsed.data.contactoEntrega ?? null,
    p_direccion_entrega: parsed.data.direccionEntrega ?? null,
    p_fecha_programada: parsed.data.fechaProgramada ?? null,
    p_hora_programada: parsed.data.horaProgramada ?? null,
    p_notas: parsed.data.notas ?? null,
    p_responsable_id: parsed.data.responsableId ?? null,
    p_telefono_entrega: parsed.data.telefonoEntrega ?? null,
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    logDispatchActionError("createDispatchFromSaleAction", error, {
      ventaId: parsed.data.ventaId,
    });
    redirectWithError(
      `/ventas/${parsed.data.ventaId}`,
      `No se pudo crear el despacho: ${safeErrorMessage(error)}`,
    );
  }

  const despachoId = (data as CreatedDispatchRow[] | null)?.[0]?.despacho_id;

  revalidateDispatchPaths(despachoId, parsed.data.ventaId);
  redirect(despachoId ? `/despacho/${despachoId}` : `/ventas/${parsed.data.ventaId}`);
}

export async function updateDispatchAction(formData: FormData) {
  const parsed = updateDispatchSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/despacho", "Datos de despacho invalidos.");
  }

  await assertDispatchPermission(
    "dispatch.orders.edit",
    `/despacho/${parsed.data.despachoId}`,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_despacho", {
    p_contacto_entrega: parsed.data.contactoEntrega ?? null,
    p_despacho_id: parsed.data.despachoId,
    p_direccion_entrega: parsed.data.direccionEntrega ?? null,
    p_fecha_programada: parsed.data.fechaProgramada ?? null,
    p_hora_programada: parsed.data.horaProgramada ?? null,
    p_notas: parsed.data.notas ?? null,
    p_responsable_id: parsed.data.responsableId ?? null,
    p_telefono_entrega: parsed.data.telefonoEntrega ?? null,
  });

  if (error) {
    logDispatchActionError("updateDispatchAction", error, {
      despachoId: parsed.data.despachoId,
    });
    redirectWithError(
      `/despacho/${parsed.data.despachoId}`,
      `No se pudo actualizar el despacho: ${safeErrorMessage(error)}`,
    );
  }

  revalidateDispatchPaths(parsed.data.despachoId);
  redirect(`/despacho/${parsed.data.despachoId}`);
}

export async function changeDispatchStatusAction(formData: FormData) {
  const parsed = changeDispatchStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/despacho", "Estado de despacho invalido.");
  }

  await assertDispatchPermission(
    "dispatch.orders.status.change",
    `/despacho/${parsed.data.despachoId}`,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_despacho", {
    p_despacho_id: parsed.data.despachoId,
    p_estado: parsed.data.estado,
    p_resultado: parsed.data.resultado ?? null,
  });

  if (error) {
    logDispatchActionError("changeDispatchStatusAction", error, {
      despachoId: parsed.data.despachoId,
      estado: parsed.data.estado,
    });
    redirectWithError(
      `/despacho/${parsed.data.despachoId}`,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateDispatchPaths(parsed.data.despachoId);
  redirect(`/despacho/${parsed.data.despachoId}`);
}
