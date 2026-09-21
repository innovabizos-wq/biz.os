import { createPublicApiListHandler } from "@/modules/public-api/list-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fiscalProfile(value: unknown) {
  if (Array.isArray(value)) return (value[0] as Record<string, unknown> | undefined) ?? null;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export const GET = createPublicApiListHandler({
  resource: "catalog",
  scope: "catalog:read",
  select: "id, categoria_id, tipo, codigo, nombre, descripcion, unidad_medida, precio_base, impuesto_porcentaje, moneda, estado, created_at, updated_at, catalog_product_fiscal_profile!catalog_product_fiscal_profile_product_empresa_fkey(cabys_code, fiscal_unit_code)",
  serialize: (row) => {
    const profile = fiscalProfile(row.catalog_product_fiscal_profile);
    return {
      basePrice: row.precio_base,
      cabysCode: profile?.cabys_code ?? null,
      categoryId: row.categoria_id,
      code: row.codigo,
      createdAt: row.created_at,
      currency: row.moneda,
      description: row.descripcion,
      fiscalUnitCode: profile?.fiscal_unit_code ?? null,
      id: row.id,
      name: row.nombre,
      status: row.estado,
      taxPercentage: row.impuesto_porcentaje,
      type: row.tipo,
      unit: row.unidad_medida,
      updatedAt: row.updated_at,
    };
  },
  table: "catalogo_productos",
});
