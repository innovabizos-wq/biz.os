"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  applySaleInventorySchema,
  markSaleWithoutInventorySchema,
} from "@/modules/sales-inventory/schemas";
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

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo completar la operacion.";
  if (message.includes("Permiso") || message.toLowerCase().includes("permission")) {
    return "No tienes permiso para ajustar inventario.";
  }
  if (message.toLowerCase().includes("stock")) return message;

  return message;
}

function logSaleInventoryActionError(
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

function revalidateSaleInventoryPaths(ventaId: string) {
  revalidatePath("/ventas");
  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/inventario");
  revalidatePath("/inventario/productos");
  revalidatePath("/inventario/movimientos");
}

async function assertApplyPermission(redirectPath: string) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "sales.orders.edit")) {
    redirectWithError(redirectPath, "No tienes permiso para editar esta venta.");
  }

  if (!hasPermission(access.tenant.permissions, "inventory.stock.adjust")) {
    redirectWithError(redirectPath, "No tienes permiso para ajustar inventario.");
  }

  return access;
}

export async function applySaleInventoryAction(formData: FormData) {
  const parsed = applySaleInventorySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Datos de inventario invalidos.");
  }

  const redirectPath = `/ventas/${parsed.data.ventaId}`;
  await assertApplyPermission(redirectPath);

  const supabase = await createClient();
  const { error } = await supabase.rpc("aplicar_salida_inventario_venta", {
    p_bodega_id: parsed.data.bodegaId,
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    logSaleInventoryActionError("applySaleInventoryAction", error, {
      bodegaId: parsed.data.bodegaId,
      ventaId: parsed.data.ventaId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo aplicar la salida de inventario: ${safeErrorMessage(error)}`,
    );
  }

  revalidateSaleInventoryPaths(parsed.data.ventaId);
  redirect(redirectPath);
}

export async function markSaleWithoutInventoryAction(formData: FormData) {
  const parsed = markSaleWithoutInventorySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Venta invalida.");
  }

  const redirectPath = `/ventas/${parsed.data.ventaId}`;
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "sales.orders.edit")) {
    redirectWithError(redirectPath, "No tienes permiso para editar esta venta.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("marcar_venta_sin_inventario", {
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    logSaleInventoryActionError("markSaleWithoutInventoryAction", error, {
      ventaId: parsed.data.ventaId,
    });
    redirectWithError(
      redirectPath,
      `No se pudo marcar sin inventario: ${safeErrorMessage(error)}`,
    );
  }

  revalidateSaleInventoryPaths(parsed.data.ventaId);
  redirect(redirectPath);
}
