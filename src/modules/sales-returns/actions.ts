"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import {
  applySalesReturnInventorySchema,
  createSalesReturnSchema,
  prepareSalesReturnCreditNoteSchema,
  settleSalesReturnFinancialSchema,
} from "@/modules/sales-returns/schemas";
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
  if (!message) return "No se pudo completar la devolución.";
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

function revalidateReturnPaths(saleId: string) {
  revalidatePath("/ventas");
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath("/pagos");
  revalidatePath("/inventario");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/facturacion");
  revalidatePath("/facturacion/documentos");
  revalidatePath("/dashboard");
}

async function requireReturnPermission(saleId: string) {
  const access = await requireAdminAccess();
  if (!hasPermission(access.tenant.permissions, "sales.orders.edit")) {
    redirectWithError(`/ventas/${saleId}`, "No tienes permiso para registrar devoluciones.");
  }
  return access;
}

function parseReturnItems(formData: FormData) {
  const items: { quantity: FormDataEntryValue; saleItemId: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity:")) continue;
    const saleItemId = key.slice("quantity:".length);
    if (typeof value !== "string" || value.trim() === "" || Number(value) === 0) continue;
    items.push({ quantity: value, saleItemId });
  }
  return items;
}

export async function createSalesReturnAction(formData: FormData) {
  const parsed = createSalesReturnSchema.safeParse({
    items: parseReturnItems(formData),
    operationId: formData.get("operationId"),
    reason: formData.get("reason"),
    saleId: formData.get("saleId"),
  });

  if (!parsed.success) {
    const saleId = String(formData.get("saleId") ?? "");
    redirectWithError(
      saleId ? `/ventas/${saleId}` : "/ventas",
      parsed.error.issues[0]?.message ?? "Selecciona al menos una cantidad válida.",
    );
  }

  await requireReturnPermission(parsed.data.saleId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_sales_return", {
    p_items: parsed.data.items.map((item) => ({
      quantity: item.quantity,
      saleItemId: item.saleItemId,
    })),
    p_operation_id: parsed.data.operationId,
    p_reason: parsed.data.reason,
    p_sale_id: parsed.data.saleId,
  });

  if (error) {
    logActionError("createSalesReturnAction", error, { saleId: parsed.data.saleId });
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      `No se pudo registrar la devolución: ${safeErrorMessage(error)}`,
    );
  }

  revalidateReturnPaths(parsed.data.saleId);
  redirect(`/ventas/${parsed.data.saleId}`);
}

export async function settleSalesReturnFinancialAction(formData: FormData) {
  const parsed = settleSalesReturnFinancialSchema.safeParse(Object.fromEntries(formData));
  const saleId = String(formData.get("saleId") ?? "");
  if (!parsed.success) {
    redirectWithError(
      saleId ? `/ventas/${saleId}` : "/ventas",
      parsed.error.issues[0]?.message ?? "Datos financieros inválidos.",
    );
  }

  const access = await requireReturnPermission(parsed.data.saleId);
  if (
    !isModuleActive(access.tenant.activeModules, "payments") ||
    !hasPermission(access.tenant.permissions, "payments.accounts.manage")
  ) {
    redirectWithError(`/ventas/${parsed.data.saleId}`, "No tienes permiso para ajustar el cobro.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_sales_return_financial", {
    p_method: parsed.data.method,
    p_notes: parsed.data.notes ?? null,
    p_operation_id: parsed.data.operationId,
    p_reference: parsed.data.reference ?? null,
    p_return_id: parsed.data.returnId,
  });
  if (error) {
    logActionError("settleSalesReturnFinancialAction", error, {
      returnId: parsed.data.returnId,
      saleId: parsed.data.saleId,
    });
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      `No se pudo aplicar la devolución financiera: ${safeErrorMessage(error)}`,
    );
  }

  revalidateReturnPaths(parsed.data.saleId);
  redirect(`/ventas/${parsed.data.saleId}`);
}

export async function applySalesReturnInventoryAction(formData: FormData) {
  const parsed = applySalesReturnInventorySchema.safeParse(Object.fromEntries(formData));
  const saleId = String(formData.get("saleId") ?? "");
  if (!parsed.success) {
    redirectWithError(saleId ? `/ventas/${saleId}` : "/ventas", "Datos de inventario inválidos.");
  }

  const access = await requireReturnPermission(parsed.data.saleId);
  if (
    !isModuleActive(access.tenant.activeModules, "inventory") ||
    !hasPermission(access.tenant.permissions, "inventory.stock.adjust")
  ) {
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      "No tienes permiso para reintegrar inventario.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_sales_return_inventory", {
    p_operation_id: parsed.data.operationId,
    p_return_id: parsed.data.returnId,
    p_warehouse_id: parsed.data.warehouseId,
  });
  if (error) {
    logActionError("applySalesReturnInventoryAction", error, {
      returnId: parsed.data.returnId,
      saleId: parsed.data.saleId,
    });
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      `No se pudo reintegrar el inventario: ${safeErrorMessage(error)}`,
    );
  }

  revalidateReturnPaths(parsed.data.saleId);
  redirect(`/ventas/${parsed.data.saleId}`);
}

export async function prepareSalesReturnCreditNoteAction(formData: FormData) {
  const parsed = prepareSalesReturnCreditNoteSchema.safeParse(Object.fromEntries(formData));
  const saleId = String(formData.get("saleId") ?? "");
  if (!parsed.success) {
    redirectWithError(saleId ? `/ventas/${saleId}` : "/ventas", "Datos fiscales inválidos.");
  }

  const access = await requireReturnPermission(parsed.data.saleId);
  if (
    !isModuleActive(access.tenant.activeModules, "billing") ||
    !hasPermission(access.tenant.permissions, "billing.credit_note")
  ) {
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      "No tienes permiso para preparar notas de crédito.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("prepare_sales_return_credit_note", {
    p_operation_id: parsed.data.operationId,
    p_return_id: parsed.data.returnId,
  });
  if (error) {
    logActionError("prepareSalesReturnCreditNoteAction", error, {
      returnId: parsed.data.returnId,
      saleId: parsed.data.saleId,
    });
    redirectWithError(
      `/ventas/${parsed.data.saleId}`,
      `No se pudo preparar la nota de crédito: ${safeErrorMessage(error)}`,
    );
  }

  revalidateReturnPaths(parsed.data.saleId);
  const documentId = (data as { document_id?: string }[] | null)?.[0]?.document_id;
  redirect(documentId ? `/facturacion/documentos/${documentId}` : `/ventas/${parsed.data.saleId}`);
}
