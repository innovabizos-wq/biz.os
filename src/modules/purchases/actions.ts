"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import {
  changePurchaseOrderStatusSchema,
  createPurchaseOrderSchema,
  createSupplierSchema,
  receivePurchaseOrderSchema,
  updateSupplierStatusSchema,
} from "@/modules/purchases/schemas";
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
  return error.message?.replace(/\s+/g, " ").trim() || "No se pudo completar la accion.";
}

function getPurchaseItemsFromForm(formData: FormData) {
  const productoIds = formData.getAll("productoId").map(String);
  const cantidades = formData.getAll("cantidad").map(String);
  const costos = formData.getAll("costoUnitario").map(String);
  const impuestos = formData.getAll("impuestoPorcentaje").map(String);
  const descripciones = formData.getAll("descripcion").map(String);

  return productoIds
    .map((productoId, index) => ({
      cantidad: cantidades[index],
      costoUnitario: costos[index],
      descripcion: descripciones[index] ?? "",
      impuestoPorcentaje: impuestos[index] ?? "0",
      productoId,
    }))
    .filter((item) => item.productoId || item.cantidad || item.costoUnitario);
}

function getReceiptItemsFromForm(formData: FormData) {
  const itemIds = formData.getAll("itemId").map(String);
  const cantidades = formData.getAll("cantidad").map(String);

  return itemIds
    .map((itemId, index) => ({
      cantidad: cantidades[index] ?? "0",
      itemId,
    }))
    .filter((item) => item.itemId);
}

async function assertPurchasesPermission(
  permissions: ("purchases.suppliers.manage" | "purchases.orders.manage")[],
) {
  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "purchases")) {
    redirectWithError("/dashboard", "El modulo Compras no esta activo.");
  }

  if (!hasAnyPermission(access.tenant.permissions, permissions)) {
    redirectWithError("/compras", "No tienes permiso para gestionar compras.");
  }

  return access;
}

export async function createSupplierAction(formData: FormData) {
  const parsed = createSupplierSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/compras", "Datos de proveedor invalidos.");
  }

  await assertPurchasesPermission(["purchases.suppliers.manage"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_proveedor", {
    p_correo: parsed.data.correo ?? null,
    p_direccion: parsed.data.direccion ?? null,
    p_identificacion: parsed.data.identificacion ?? null,
    p_nombre: parsed.data.nombre,
    p_notas: parsed.data.notas ?? null,
    p_telefono: parsed.data.telefono ?? null,
  });

  if (error) {
    redirectWithError(
      "/compras",
      `No se pudo crear el proveedor: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/compras");
  redirect("/compras");
}

export async function updateSupplierStatusAction(formData: FormData) {
  const parsed = updateSupplierStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/compras", "Proveedor invalido.");
  }

  await assertPurchasesPermission(["purchases.suppliers.manage"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_proveedor_compra", {
    p_estado: parsed.data.estado,
    p_supplier_id: parsed.data.supplierId,
  });

  if (error) {
    redirectWithError(
      "/compras",
      `No se pudo actualizar el proveedor: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/compras");
  redirect("/compras");
}

export async function createPurchaseOrderAction(formData: FormData) {
  const parsed = createPurchaseOrderSchema.safeParse({
    ...getFormData(formData),
    items: getPurchaseItemsFromForm(formData),
  });

  if (!parsed.success) {
    redirectWithError("/compras", "Datos de orden de compra invalidos.");
  }

  await assertPurchasesPermission(["purchases.orders.manage"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_orden_compra_completa", {
    p_bodega_id: parsed.data.bodegaId,
    p_estado: parsed.data.estado,
    p_items: parsed.data.items,
    p_notas: parsed.data.notas ?? null,
    p_supplier_id: parsed.data.supplierId,
  });

  if (error) {
    redirectWithError(
      "/compras",
      `No se pudo crear la orden: ${safeErrorMessage(error)}`,
    );
  }

  const created = Array.isArray(data) ? data[0] : null;

  revalidatePath("/compras");
  revalidatePath("/dashboard");
  redirect(created?.order_id ? `/compras/ordenes/${created.order_id}` : "/compras");
}

export async function emitPurchaseOrderAction(formData: FormData) {
  const parsed = changePurchaseOrderStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/compras", "Orden de compra invalida.");
  }

  await assertPurchasesPermission(["purchases.orders.manage"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("emitir_orden_compra", {
    p_order_id: parsed.data.orderId,
  });

  if (error) {
    redirectWithError(
      `/compras/ordenes/${parsed.data.orderId}`,
      `No se pudo emitir la orden: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/ordenes/${parsed.data.orderId}`);
  redirect(`/compras/ordenes/${parsed.data.orderId}`);
}

export async function cancelPurchaseOrderAction(formData: FormData) {
  const parsed = changePurchaseOrderStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/compras", "Orden de compra invalida.");
  }

  await assertPurchasesPermission(["purchases.orders.manage"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_orden_compra", {
    p_order_id: parsed.data.orderId,
  });

  if (error) {
    redirectWithError(
      `/compras/ordenes/${parsed.data.orderId}`,
      `No se pudo cancelar la orden: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/ordenes/${parsed.data.orderId}`);
  redirect(`/compras/ordenes/${parsed.data.orderId}`);
}

export async function receivePurchaseOrderAction(formData: FormData) {
  const parsed = receivePurchaseOrderSchema.safeParse({
    ...getFormData(formData),
    items: getReceiptItemsFromForm(formData),
  });

  if (!parsed.success) {
    redirectWithError("/compras", "Recepcion de compra invalida.");
  }

  await assertPurchasesPermission(["purchases.orders.manage"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("recibir_orden_compra_parcial", {
    p_items: parsed.data.items,
    p_notas: parsed.data.notas ?? null,
    p_order_id: parsed.data.orderId,
  });

  if (error) {
    redirectWithError(
      `/compras/ordenes/${parsed.data.orderId}`,
      `No se pudo recibir la orden: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/compras");
  revalidatePath(`/compras/ordenes/${parsed.data.orderId}`);
  revalidatePath("/inventario");
  revalidatePath("/pagos");
  revalidatePath("/dashboard");
  redirect(`/compras/ordenes/${parsed.data.orderId}`);
}
