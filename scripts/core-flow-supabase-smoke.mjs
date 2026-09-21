import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function first(data) {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function readTable(name, select, options = {}) {
  let query = admin.from(name).select(select);

  for (const [column, value] of Object.entries(options.eq ?? {})) {
    query = query.eq(column, value);
  }

  if (options.limit) query = query.limit(options.limit);
  if (options.order) query = query.order(options.order.column, options.order);

  const { data, error } = await query;

  if (error) {
    return { error: `${error.code ?? "ERROR"} ${error.message}`, rows: [] };
  }

  return { error: null, rows: data ?? [] };
}

async function checkTableAccess(name) {
  const { error } = await admin.from(name).select("id", {
    count: "exact",
    head: true,
  });

  return error ? `${error.code ?? "ERROR"} ${error.message}` : "ok";
}

const companies = await readTable("empresas", "id, nombre, estado", {
  limit: 5,
  order: { column: "created_at", ascending: false },
});
const company = first(companies.rows);

const roles = company
  ? await readTable("roles", "id, nombre, estado", {
      eq: { empresa_id: company.id },
      limit: 20,
      order: { column: "nombre", ascending: true },
    })
  : { error: "No company", rows: [] };
const warehouses = company
  ? await readTable("inventario_bodegas", "id, nombre, estado", {
      eq: { empresa_id: company.id },
      limit: 10,
      order: { column: "nombre", ascending: true },
    })
  : { error: "No company", rows: [] };

const permissions = company
  ? await admin
      .from("rol_permisos")
      .select("roles!inner(nombre), permisos!inner(codigo)")
      .eq("empresa_id", company.id)
      .in("permisos.codigo", [
        "catalog.products.create",
        "inventory.stock.adjust",
        "quotes.create",
        "sales.orders.status.change",
        "dispatch.orders.status.change",
        "payments.accounts.manage",
      ])
  : { data: [], error: null };

const permissionRows = permissions.error ? [] : (permissions.data ?? []);
const rolePermissionMap = permissionRows.reduce((acc, row) => {
  const roleName = row.roles?.nombre;
  const code = row.permisos?.codigo;
  if (!roleName || !code) return acc;
  acc[roleName] ??= [];
  acc[roleName].push(code);
  return acc;
}, {});

const summary = {
  serviceRoleGrantChecks: {
    auditoria_eventos: await checkTableAccess("auditoria_eventos"),
    empresas: await checkTableAccess("empresas"),
    profiles: await checkTableAccess("profiles"),
  },
  company: company ? { id: company.id, nombre: company.nombre, estado: company.estado } : null,
  companyReadError: companies.error,
  roles: roles.rows.map((role) => ({
    nombre: role.nombre,
    estado: role.estado,
  })),
  rolesReadError: roles.error,
  warehouses: warehouses.rows.map((warehouse) => ({
    nombre: warehouse.nombre,
    estado: warehouse.estado,
  })),
  warehousesReadError: warehouses.error,
  checkedPermissionsByRole: rolePermissionMap,
};

console.log(JSON.stringify(summary, null, 2));
