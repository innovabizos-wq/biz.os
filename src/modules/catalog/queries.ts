import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import {
  DEFAULT_PRODUCT_STATUS_FILTER,
  DEFAULT_PRODUCT_TYPE_FILTER,
} from "@/modules/catalog/constants";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogProductStatusFilter,
  CatalogProductTypeFilter,
  CatalogSummary,
} from "@/modules/catalog/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type CategoryRow = {
  created_at: string;
  descripcion: string | null;
  estado: CatalogCategory["estado"];
  id: string;
  nombre: string;
  updated_at: string;
};

type CategoryRelation = {
  nombre: string | null;
};

type ProductRow = {
  catalogo_categorias: CategoryRelation | CategoryRelation[] | null;
  categoria_id: string | null;
  codigo: string | null;
  created_at: string;
  descripcion: string | null;
  estado: CatalogProduct["estado"];
  id: string;
  impuesto_porcentaje: number;
  moneda: string;
  nombre: string;
  precio_base: number;
  tipo: CatalogProduct["tipo"];
  unidad_medida: string;
  updated_at: string;
};

function firstRelation(value: CategoryRelation | CategoryRelation[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapCategory(row: CategoryRow): CatalogCategory {
  return {
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    id: row.id,
    nombre: row.nombre,
    updatedAt: row.updated_at,
  };
}

function mapProduct(row: ProductRow): CatalogProduct {
  return {
    categoriaId: row.categoria_id,
    categoriaNombre: firstRelation(row.catalogo_categorias)?.nombre ?? null,
    codigo: row.codigo,
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    id: row.id,
    impuestoPorcentaje: row.impuesto_porcentaje,
    moneda: row.moneda,
    nombre: row.nombre,
    precioBase: row.precio_base,
    tipo: row.tipo,
    unidadMedida: row.unidad_medida,
    updatedAt: row.updated_at,
  };
}

export function canAccessCatalog(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "catalog.products.view",
    "catalog.products.create",
    "catalog.products.edit",
    "catalog.categories.view",
    "catalog.categories.create",
    "catalog.categories.edit",
  ]);
}

export async function getCatalogSummary(
  tenant: TenantContext,
): Promise<CoreResult<CatalogSummary>> {
  if (!canAccessCatalog(tenant)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver esta sección.");
  }

  const [products, categories] = await Promise.all([
    getProducts(tenant),
    getCategories(tenant),
  ]);

  const productRows = products.ok ? products.data : [];
  const categoryRows = categories.ok ? categories.data : [];

  return ok({
    categoriasActivas: categoryRows.filter((category) => category.estado === "activa")
      .length,
    productosActivos: productRows.filter((product) => product.estado === "activo")
      .length,
    totalProductos: productRows.filter((product) => product.tipo === "producto")
      .length,
    totalServicios: productRows.filter((product) => product.tipo === "servicio")
      .length,
  });
}

export async function getCategories(
  tenant: TenantContext,
): Promise<CoreResult<CatalogCategory[]>> {
  if (!hasPermission(tenant.permissions, "catalog.categories.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver categorías.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_categorias")
    .select("id, nombre, descripcion, estado, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .order("nombre", { ascending: true });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar categorias.", error);
  }

  return ok(((data ?? []) as CategoryRow[]).map(mapCategory));
}

export async function getCategoryDetail(
  tenant: TenantContext,
  categoriaId: string,
): Promise<CoreResult<CatalogCategory | null>> {
  if (!hasPermission(tenant.permissions, "catalog.categories.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver categorías.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_categorias")
    .select("id, nombre, descripcion, estado, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("id", categoriaId)
    .maybeSingle<CategoryRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar la categoria.", error);
  }

  return ok(data ? mapCategory(data) : null);
}

export async function getProducts(
  tenant: TenantContext,
  type: CatalogProductTypeFilter = DEFAULT_PRODUCT_TYPE_FILTER,
  status: CatalogProductStatusFilter = DEFAULT_PRODUCT_STATUS_FILTER,
): Promise<CoreResult<CatalogProduct[]>> {
  if (!hasPermission(tenant.permissions, "catalog.products.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver productos.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("catalogo_productos")
    .select(
      "id, categoria_id, tipo, codigo, nombre, descripcion, unidad_medida, precio_base, impuesto_porcentaje, moneda, estado, created_at, updated_at, catalogo_categorias!catalogo_productos_categoria_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("nombre", { ascending: true });

  if (type !== "todos") {
    query = query.eq("tipo", type);
  }

  if (status !== "todos") {
    query = query.eq("estado", status);
  }

  const { data, error } = await query;

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron consultar productos.", error);
  }

  return ok(((data ?? []) as ProductRow[]).map(mapProduct));
}

export async function getProductDetail(
  tenant: TenantContext,
  productoId: string,
): Promise<CoreResult<CatalogProduct | null>> {
  if (!hasPermission(tenant.permissions, "catalog.products.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver productos.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_productos")
    .select(
      "id, categoria_id, tipo, codigo, nombre, descripcion, unidad_medida, precio_base, impuesto_porcentaje, moneda, estado, created_at, updated_at, catalogo_categorias!catalogo_productos_categoria_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .eq("id", productoId)
    .maybeSingle<ProductRow>();

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudo consultar el producto.", error);
  }

  return ok(data ? mapProduct(data) : null);
}

export async function getActiveCategoriesForProductForm(
  tenant: TenantContext,
): Promise<CoreResult<CatalogCategory[]>> {
  if (
    !hasAnyPermission(tenant.permissions, [
      "catalog.categories.view",
      "catalog.categories.create",
      "catalog.categories.edit",
    ])
  ) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalogo_categorias")
    .select("id, nombre, descripcion, estado, created_at, updated_at")
    .eq("empresa_id", tenant.empresaId)
    .eq("estado", "activa")
    .order("nombre", { ascending: true });

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as CategoryRow[]).map(mapCategory));
}
