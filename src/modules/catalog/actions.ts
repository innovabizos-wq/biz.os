"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import {
  changeCategoryStatusSchema,
  changeProductStatusSchema,
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
} from "@/modules/catalog/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedProductRow = {
  producto_id?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (message?.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }

  return "No se pudo actualizar el catalogo. Intenta de nuevo o solicita ayuda al administrador.";
}

function logCatalogActionError(
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

function revalidateCatalogPaths(productoId?: string) {
  revalidatePath("/catalogo");
  revalidatePath("/catalogo/productos");
  revalidatePath("/catalogo/productos/nuevo");
  revalidatePath("/catalogo/categorias");

  if (productoId) {
    revalidatePath(`/catalogo/productos/${productoId}`);
  }
}

async function initializeProductStockRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    empresaId: string;
    productId: string | null | undefined;
  },
) {
  if (!input.productId) return 0;

  const { data: warehouses, error: warehouseError } = await supabase
    .from("inventario_bodegas")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .eq("estado", "activa");

  if (warehouseError || !warehouses?.length) return 0;

  let initialized = 0;

  for (const warehouse of warehouses) {
    const { error } = await supabase.rpc("actualizar_stock_minimos", {
      p_bodega_id: warehouse.id,
      p_producto_id: input.productId,
      p_stock_maximo: null,
      p_stock_minimo: 0,
    });

    if (!error) initialized += 1;
  }

  return initialized;
}

async function registerInitialProductStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    bodegaId: string;
    cantidad: number;
    productId: string;
  },
) {
  return supabase.rpc("registrar_movimiento_inventario", {
    p_bodega_id: input.bodegaId,
    p_cantidad: input.cantidad,
    p_motivo: "Ingreso inicial desde alta de catalogo",
    p_producto_id: input.productId,
    p_referencia_id: null,
    p_referencia_tipo: null,
    p_tipo: "entrada",
  });
}

async function assertCatalogPermission(
  permission:
    | "catalog.categories.create"
    | "catalog.categories.edit"
    | "catalog.products.create"
    | "catalog.products.edit",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta acción.");
  }

  return access;
}

export async function createCategoryAction(formData: FormData) {
  const parsed = createCategorySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/categorias", "Datos de categoria invalidos.");
  }

  await assertCatalogPermission(
    "catalog.categories.create",
    "/catalogo/categorias",
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_catalogo_categoria", {
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
  });

  if (error) {
    logCatalogActionError("createCategoryAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/catalogo/categorias",
      `No se pudo crear la categoria: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCatalogPaths();
  redirect("/catalogo/categorias");
}

export async function updateCategoryAction(formData: FormData) {
  const parsed = updateCategorySchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/categorias", "Datos de categoria invalidos.");
  }

  await assertCatalogPermission("catalog.categories.edit", "/catalogo/categorias");

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_catalogo_categoria", {
    p_categoria_id: parsed.data.categoriaId,
    p_descripcion: parsed.data.descripcion ?? null,
    p_nombre: parsed.data.nombre,
  });

  if (error) {
    logCatalogActionError("updateCategoryAction", error, {
      categoriaId: parsed.data.categoriaId,
    });
    redirectWithError(
      "/catalogo/categorias",
      `No se pudo actualizar la categoria: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCatalogPaths();
  redirect("/catalogo/categorias");
}

export async function changeCategoryStatusAction(formData: FormData) {
  const parsed = changeCategoryStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/categorias", "Estado de categoria invalido.");
  }

  await assertCatalogPermission("catalog.categories.edit", "/catalogo/categorias");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_catalogo_categoria", {
    p_categoria_id: parsed.data.categoriaId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logCatalogActionError("changeCategoryStatusAction", error, {
      categoriaId: parsed.data.categoriaId,
    });
    redirectWithError(
      "/catalogo/categorias",
      `No se pudo cambiar la categoria: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCatalogPaths();
  redirect("/catalogo/categorias");
}

export async function createProductAction(formData: FormData) {
  const parsed = createProductSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/productos/nuevo", "Datos de producto invalidos.");
  }

  const access = await assertCatalogPermission(
    "catalog.products.create",
    "/catalogo/productos/nuevo",
  );

  const hasInitialStock = Boolean(
    parsed.data.tipo === "producto" &&
      parsed.data.cantidadInicial &&
      parsed.data.cantidadInicial > 0,
  );
  const canAdjustInventory =
    isModuleActive(access.tenant.activeModules, "inventory") &&
    hasPermission(access.tenant.permissions, "inventory.stock.adjust");

  if (parsed.data.tipo === "servicio" && parsed.data.cantidadInicial) {
    redirectWithError(
      "/catalogo/productos/nuevo",
      "Los servicios no pueden tener stock inicial.",
    );
  }

  if (hasInitialStock && !canAdjustInventory) {
    redirectWithError(
      "/catalogo/productos/nuevo",
      "No tienes permiso para registrar stock inicial.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_catalogo_producto", {
    p_categoria_id: parsed.data.categoriaId ?? null,
    p_codigo: parsed.data.codigo ?? null,
    p_descripcion: parsed.data.descripcion ?? null,
    p_impuesto_porcentaje: parsed.data.impuestoPorcentaje,
    p_moneda: parsed.data.moneda,
    p_nombre: parsed.data.nombre,
    p_precio_base: parsed.data.precioBase,
    p_tipo: parsed.data.tipo,
    p_unidad_medida: parsed.data.unidadMedida,
  });

  if (error) {
    logCatalogActionError("createProductAction", error, {
      nombre: parsed.data.nombre,
    });
    redirectWithError(
      "/catalogo/productos/nuevo",
      `No se pudo crear el producto: ${safeErrorMessage(error)}`,
    );
  }

  const productoId = (data as CreatedProductRow[] | null)?.[0]?.producto_id;

  if (
    parsed.data.tipo === "producto" &&
    productoId &&
    canAdjustInventory
  ) {
    await initializeProductStockRows(supabase, {
      empresaId: access.tenant.empresaId,
      productId: productoId,
    });

    if (hasInitialStock) {
      const { error: stockError } = await registerInitialProductStock(supabase, {
        bodegaId: parsed.data.bodegaId!,
        cantidad: parsed.data.cantidadInicial!,
        productId: productoId,
      });

      if (stockError) {
        logCatalogActionError("createProductAction.initialStock", stockError, {
          productoId,
        });
        redirectWithError(
          `/catalogo/productos/${productoId}`,
          `Producto creado, pero no se pudo registrar stock inicial: ${safeErrorMessage(stockError)}`,
        );
      }
    }

    revalidatePath("/inventario");
    revalidatePath("/inventario/productos");
    revalidatePath("/inventario/movimientos");
  }

  revalidateCatalogPaths(productoId);
  redirect(productoId ? `/catalogo/productos/${productoId}` : "/catalogo/productos");
}

export async function updateProductAction(formData: FormData) {
  const parsed = updateProductSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/productos", "Datos de producto invalidos.");
  }

  await assertCatalogPermission(
    "catalog.products.edit",
    `/catalogo/productos/${parsed.data.productoId}`,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_catalogo_producto", {
    p_categoria_id: parsed.data.categoriaId ?? null,
    p_codigo: parsed.data.codigo ?? null,
    p_descripcion: parsed.data.descripcion ?? null,
    p_impuesto_porcentaje: parsed.data.impuestoPorcentaje,
    p_moneda: parsed.data.moneda,
    p_nombre: parsed.data.nombre,
    p_precio_base: parsed.data.precioBase,
    p_producto_id: parsed.data.productoId,
    p_tipo: parsed.data.tipo,
    p_unidad_medida: parsed.data.unidadMedida,
  });

  if (error) {
    logCatalogActionError("updateProductAction", error, {
      productoId: parsed.data.productoId,
    });
    redirectWithError(
      `/catalogo/productos/${parsed.data.productoId}`,
      `No se pudo actualizar el producto: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCatalogPaths(parsed.data.productoId);
  redirect(`/catalogo/productos/${parsed.data.productoId}`);
}

export async function changeProductStatusAction(formData: FormData) {
  const parsed = changeProductStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/catalogo/productos", "Estado de producto invalido.");
  }

  await assertCatalogPermission(
    "catalog.products.edit",
    `/catalogo/productos/${parsed.data.productoId}`,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_catalogo_producto", {
    p_estado: parsed.data.estado,
    p_producto_id: parsed.data.productoId,
  });

  if (error) {
    logCatalogActionError("changeProductStatusAction", error, {
      productoId: parsed.data.productoId,
    });
    redirectWithError(
      `/catalogo/productos/${parsed.data.productoId}`,
      `No se pudo cambiar el producto: ${safeErrorMessage(error)}`,
    );
  }

  revalidateCatalogPaths(parsed.data.productoId);
  redirect(`/catalogo/productos/${parsed.data.productoId}`);
}
