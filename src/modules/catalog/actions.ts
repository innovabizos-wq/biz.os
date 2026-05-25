"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
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
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
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

  await assertCatalogPermission(
    "catalog.products.create",
    "/catalogo/productos/nuevo",
  );

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
