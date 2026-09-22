"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  changeDispatchStatusSchema,
  createDispatchFromSaleSchema,
  recordDispatchFulfillmentSchema,
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

  if (!message) return "No se pudo completar la accion.";
  if (message.includes("Permiso") || message.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }

  return message;
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

  revalidateDispatchPaths(parsed.data.despachoId, parsed.data.ventaId);
  redirect(`/despacho/${parsed.data.despachoId}`);
}

function parseFulfillmentItems(formData: FormData) {
  const items: Array<{ dispatchItemId: string; quantity: FormDataEntryValue }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity:")) continue;
    const dispatchItemId = key.slice("quantity:".length);
    if (typeof value !== "string" || value.trim() === "" || Number(value) === 0) continue;
    items.push({ dispatchItemId, quantity: value });
  }
  return items;
}

export async function recordDispatchFulfillmentAction(formData: FormData) {
  const parsed = recordDispatchFulfillmentSchema.safeParse({
    despachoId: formData.get("despachoId"),
    eventType: formData.get("eventType"),
    items: parseFulfillmentItems(formData),
    operationId: formData.get("operationId"),
    receiverName: formData.get("receiverName"),
    result: formData.get("result"),
    ventaId: formData.get("ventaId"),
    warehouseId: formData.get("warehouseId"),
  });

  const fallbackDispatchId = String(formData.get("despachoId") ?? "");
  if (!parsed.success) {
    redirectWithError(
      fallbackDispatchId ? `/despacho/${fallbackDispatchId}` : "/despacho",
      parsed.error.issues[0]?.message ?? "Selecciona al menos una cantidad válida.",
    );
  }

  const access = await assertDispatchPermission(
    "dispatch.orders.status.change",
    `/despacho/${parsed.data.despachoId}`,
  );
  if (parsed.data.eventType === "return") {
    if (
      !hasPermission(access.tenant.permissions, "sales.orders.edit")
      || !hasPermission(access.tenant.permissions, "inventory.stock.adjust")
    ) {
      redirectWithError(
        `/despacho/${parsed.data.despachoId}`,
        "Necesitas permisos de ventas e inventario para registrar la devolución física.",
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_dispatch_fulfillment", {
    p_dispatch_id: parsed.data.despachoId,
    p_event_type: parsed.data.eventType,
    p_items: parsed.data.items.map((item) => ({
      dispatchItemId: item.dispatchItemId,
      quantity: item.quantity,
    })),
    p_operation_id: parsed.data.operationId,
    p_receiver_name: parsed.data.receiverName ?? null,
    p_result: parsed.data.result ?? null,
    p_warehouse_id: parsed.data.warehouseId ?? null,
  });

  if (error) {
    logDispatchActionError("recordDispatchFulfillmentAction", error, {
      despachoId: parsed.data.despachoId,
      eventType: parsed.data.eventType,
    });
    redirectWithError(
      `/despacho/${parsed.data.despachoId}`,
      `No se pudo registrar el movimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateDispatchPaths(parsed.data.despachoId, parsed.data.ventaId);
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/pagos");
  revalidatePath("/facturacion");
  redirect(`/despacho/${parsed.data.despachoId}`);
}
