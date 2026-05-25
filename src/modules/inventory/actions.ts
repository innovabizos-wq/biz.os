"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  changeWarehouseStatusSchema,
  createInventoryMovementSchema,
  createWarehouseSchema,
  updateStockLimitsSchema,
  updateWarehouseSchema,
} from "@/modules/inventory/schemas";
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
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
}

function logInventoryActionError(
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

function revalidateInventoryPaths(productoId?: string) {
  revalidatePath("/inventario");
  revalidatePath("/inventario/productos");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/inventario/bodegas");

  if (productoId) {
    revalidatePath(`/catalogo/productos/${productoId}`);
  }
}

async function assertInventoryPermission(
  permission: "inventory.stock.adjust" | "inventory.warehouses.manage",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta acción.");
  }

  return access;
}

export async function createWarehouseAction(formData: FormData) {
  const parsed = createWarehouseSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Datos de bodega invalidos.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_inventario_bodega", {
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
    p_ubicacion: parsed.data.ubicacion ?? null,
  });

  if (error) {
    logInventoryActionError("createWarehouseAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo crear la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function updateWarehouseAction(formData: FormData) {
  const parsed = updateWarehouseSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Datos de bodega invalidos.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_inventario_bodega", {
    p_bodega_id: parsed.data.bodegaId,
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
    p_ubicacion: parsed.data.ubicacion ?? null,
  });

  if (error) {
    logInventoryActionError("updateWarehouseAction", error, {
      bodegaId: parsed.data.bodegaId,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo actualizar la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function changeWarehouseStatusAction(formData: FormData) {
  const parsed = changeWarehouseStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/bodegas", "Estado de bodega invalido.");
  }

  await assertInventoryPermission(
    "inventory.warehouses.manage",
    "/inventario/bodegas",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_inventario_bodega", {
    p_bodega_id: parsed.data.bodegaId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logInventoryActionError("changeWarehouseStatusAction", error, {
      bodegaId: parsed.data.bodegaId,
    });
    redirectWithError(
      "/inventario/bodegas",
      `No se pudo cambiar la bodega: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths();
  redirect("/inventario/bodegas");
}

export async function createInventoryMovementAction(formData: FormData) {
  const parsed = createInventoryMovementSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Movimiento de inventario invalido.");
  }

  await assertInventoryPermission(
    "inventory.stock.adjust",
    "/inventario/productos",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_movimiento_inventario", {
    p_bodega_id: parsed.data.bodegaId,
    p_cantidad: parsed.data.cantidad,
    p_motivo: parsed.data.motivo ?? null,
    p_producto_id: parsed.data.productoId,
    p_referencia_id: null,
    p_referencia_tipo: null,
    p_tipo: parsed.data.tipo,
  });

  if (error) {
    logInventoryActionError("createInventoryMovementAction", error, {
      productoId: parsed.data.productoId,
      tipo: parsed.data.tipo,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudo registrar el movimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths(parsed.data.productoId);
  redirect("/inventario/productos");
}

export async function updateStockLimitsAction(formData: FormData) {
  const parsed = updateStockLimitsSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/inventario/productos", "Limites de stock invalidos.");
  }

  await assertInventoryPermission(
    "inventory.stock.adjust",
    "/inventario/productos",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_stock_minimos", {
    p_bodega_id: parsed.data.bodegaId,
    p_producto_id: parsed.data.productoId,
    p_stock_maximo: parsed.data.stockMaximo ?? null,
    p_stock_minimo: parsed.data.stockMinimo,
  });

  if (error) {
    logInventoryActionError("updateStockLimitsAction", error, {
      productoId: parsed.data.productoId,
    });
    redirectWithError(
      "/inventario/productos",
      `No se pudieron actualizar limites: ${safeErrorMessage(error)}`,
    );
  }

  revalidateInventoryPaths(parsed.data.productoId);
  redirect("/inventario/productos");
}
