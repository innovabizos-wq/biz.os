"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import {
  applyPurchaseReturnInventorySchema,
  createPurchaseReturnSchema,
  settlePurchaseReturnFinancialSchema,
} from "@/modules/purchase-returns/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  if (!message) return "No se pudo completar la devolución de compra.";
  if (error.code === "23505") return "La operación ya existe con datos diferentes.";
  if (error.code === "42501") return "No tienes permiso para completar esta operación.";
  return message;
}

function logActionError(
  action: string,
  error: RpcError,
  context: Record<string, string>,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${action}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function orderPath(orderId: string) {
  return `/compras/ordenes/${orderId}`;
}

function revalidatePurchaseReturnPaths(orderId: string) {
  revalidatePath("/compras");
  revalidatePath(orderPath(orderId));
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/pagos");
  revalidatePath("/dashboard");
}

async function requirePurchaseReturnPermission(orderId: string) {
  const access = await requireAdminAccess();
  if (
    !isModuleActive(access.tenant.activeModules, "purchases") ||
    !hasPermission(access.tenant.permissions, "purchases.orders.manage")
  ) {
    redirectWithError(orderPath(orderId), "No tienes permiso para registrar devoluciones.");
  }
  return access;
}

function parseReturnItems(formData: FormData) {
  const items: { quantity: FormDataEntryValue; receiptItemId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("returnQuantity:")) continue;
    const receiptItemId = key.slice("returnQuantity:".length);
    if (typeof value !== "string" || value.trim() === "" || Number(value) === 0) continue;
    items.push({ quantity: value, receiptItemId });
  }
  return items;
}

export async function createPurchaseReturnAction(formData: FormData) {
  const parsed = createPurchaseReturnSchema.safeParse({
    items: parseReturnItems(formData),
    operationId: formData.get("operationId"),
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });
  const orderId = String(formData.get("orderId") ?? "");

  if (!parsed.success) {
    redirectWithError(
      orderId ? orderPath(orderId) : "/compras",
      parsed.error.issues[0]?.message ?? "Selecciona al menos una cantidad válida.",
    );
  }

  await requirePurchaseReturnPermission(parsed.data.orderId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_purchase_return", {
    p_items: parsed.data.items.map((item) => ({
      quantity: item.quantity,
      receiptItemId: item.receiptItemId,
    })),
    p_operation_id: parsed.data.operationId,
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });

  if (error) {
    logActionError("createPurchaseReturnAction", error, { orderId: parsed.data.orderId });
    redirectWithError(
      orderPath(parsed.data.orderId),
      `No se pudo registrar la devolución: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePurchaseReturnPaths(parsed.data.orderId);
  redirect(orderPath(parsed.data.orderId));
}

export async function applyPurchaseReturnInventoryAction(formData: FormData) {
  const parsed = applyPurchaseReturnInventorySchema.safeParse(Object.fromEntries(formData));
  const orderId = String(formData.get("orderId") ?? "");

  if (!parsed.success) {
    redirectWithError(orderId ? orderPath(orderId) : "/compras", "Datos de inventario inválidos.");
  }

  const access = await requirePurchaseReturnPermission(parsed.data.orderId);
  if (
    !isModuleActive(access.tenant.activeModules, "inventory") ||
    !hasPermission(access.tenant.permissions, "inventory.stock.adjust")
  ) {
    redirectWithError(orderPath(parsed.data.orderId), "No tienes permiso para devolver inventario.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_purchase_return_inventory", {
    p_operation_id: parsed.data.operationId,
    p_return_id: parsed.data.returnId,
  });

  if (error) {
    logActionError("applyPurchaseReturnInventoryAction", error, {
      orderId: parsed.data.orderId,
      returnId: parsed.data.returnId,
    });
    redirectWithError(
      orderPath(parsed.data.orderId),
      `No se pudo retirar el inventario: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePurchaseReturnPaths(parsed.data.orderId);
  redirect(orderPath(parsed.data.orderId));
}

export async function settlePurchaseReturnFinancialAction(formData: FormData) {
  const parsed = settlePurchaseReturnFinancialSchema.safeParse(Object.fromEntries(formData));
  const orderId = String(formData.get("orderId") ?? "");

  if (!parsed.success) {
    redirectWithError(orderId ? orderPath(orderId) : "/compras", "Datos financieros inválidos.");
  }

  const access = await requirePurchaseReturnPermission(parsed.data.orderId);
  if (
    !isModuleActive(access.tenant.activeModules, "payments") ||
    !hasPermission(access.tenant.permissions, "payments.accounts.manage")
  ) {
    redirectWithError(orderPath(parsed.data.orderId), "No tienes permiso para ajustar la cuenta por pagar.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_purchase_return_financial", {
    p_operation_id: parsed.data.operationId,
    p_return_id: parsed.data.returnId,
    p_supplier_document_reference: parsed.data.supplierDocumentReference ?? null,
  });

  if (error) {
    logActionError("settlePurchaseReturnFinancialAction", error, {
      orderId: parsed.data.orderId,
      returnId: parsed.data.returnId,
    });
    redirectWithError(
      orderPath(parsed.data.orderId),
      `No se pudo ajustar la cuenta por pagar: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePurchaseReturnPaths(parsed.data.orderId);
  redirect(orderPath(parsed.data.orderId));
}
