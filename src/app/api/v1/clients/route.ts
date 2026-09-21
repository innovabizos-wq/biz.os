import { createPublicApiListHandler } from "@/modules/public-api/list-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createPublicApiListHandler({
  resource: "clients",
  scope: "clients:read",
  select: "id, numero, tipo, estado, genero, nombre, identificacion, fiscal_identification_type, telefono, whatsapp, correo, origen, created_at, updated_at",
  serialize: (row) => ({
    createdAt: row.created_at,
    email: row.correo,
    fiscalIdentificationType: row.fiscal_identification_type,
    gender: row.genero,
    id: row.id,
    identification: row.identificacion,
    name: row.nombre,
    number: row.numero,
    origin: row.origen,
    phone: row.telefono,
    status: row.estado,
    type: row.tipo,
    updatedAt: row.updated_at,
    whatsapp: row.whatsapp,
  }),
  table: "crm_clientes",
});
