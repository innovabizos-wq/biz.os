import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.BIZOS_TEST_PASSWORD ?? "Userprueba1234";

assert.ok(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required");
assert.ok(publishableKey, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");

const runId = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14);
const prefix = `BLOQUE1-${runId}`;

const users = {
  admin: "userprueba2@bizos.test",
  seller: "userprueba3@bizos.test",
  driver: "userprueba1@bizos.test",
};

function makeClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function firstRelation(value) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function printableError(error) {
  if (!error) return null;
  return {
    code: error.code ?? null,
    message: error.message ?? String(error),
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function sanitizeForLog(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 5) return "[MaxDepth]";
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item, depth + 1));

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (["supabase", "auth", "client", "headers"].includes(key)) continue;
    if (typeof item === "function") continue;
    output[key] = sanitizeForLog(item, depth + 1);
  }
  return output;
}

const steps = [];
const artifacts = {};
let fatalError = null;

async function record(step, actor, fn) {
  try {
    const data = await fn();
    steps.push({ step, actor, ok: true, data: sanitizeForLog(data) });
    return data;
  } catch (error) {
    const normalized =
      error && typeof error === "object" && "message" in error
        ? {
            code: error.code ?? null,
            message: error.message,
            details: error.details ?? null,
            hint: error.hint ?? null,
          }
        : { message: String(error) };
    steps.push({ step, actor, ok: false, error: normalized });
    throw error;
  }
}

async function recordSoft(step, actor, fn) {
  try {
    return await record(step, actor, fn);
  } catch {
    return null;
  }
}

async function login(label, email) {
  const supabase = makeClient();
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    const error = new Error(authError?.message ?? "No auth user returned");
    error.code = authError?.code ?? null;
    throw error;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, empresa_id, nombre, correo, requiere_cambio_contrasena, estado, roles(nombre)",
    )
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    const error = new Error(profileError?.message ?? "Profile not found");
    error.code = profileError?.code ?? null;
    throw error;
  }

  return {
    label,
    email,
    supabase,
    profile: {
      id: profile.id,
      empresaId: profile.empresa_id,
      nombre: profile.nombre,
      correo: profile.correo,
      estado: profile.estado,
      rol: firstRelation(profile.roles)?.nombre ?? null,
      requiereCambioContrasena: profile.requiere_cambio_contrasena,
    },
  };
}

async function rpcRequired(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw Object.assign(new Error(error.message), printableError(error));
  return data ?? [];
}

async function queryRequired(query) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), printableError(error));
  return data ?? [];
}

async function queryMaybeSingle(query) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), printableError(error));
  return data ?? null;
}

const contexts = {};

try {
  contexts.admin = await record("login admin", users.admin, () =>
    login("admin", users.admin),
  );
  contexts.seller = await record("login vendedor", users.seller, () =>
    login("seller", users.seller),
  );
  contexts.driver = await record("login chofer", users.driver, () =>
    login("driver", users.driver),
  );

  const companyId = contexts.admin.profile.empresaId;

  await record("validar misma empresa de usuarios", "system", async () => {
    const profiles = [contexts.admin.profile, contexts.seller.profile, contexts.driver.profile];
    const sameCompany = profiles.every((profile) => profile.empresaId === companyId);
    if (!sameCompany) {
      throw new Error("Los usuarios de prueba no pertenecen a la misma empresa.");
    }
    return profiles.map((profile) => ({
      correo: profile.correo,
      rol: profile.rol,
      estado: profile.estado,
      requiereCambioContrasena: profile.requiereCambioContrasena,
    }));
  });

  const warehouse = await record("obtener o crear bodega activa", "admin", async () => {
    const warehouses = await queryRequired(
      contexts.admin.supabase
        .from("inventario_bodegas")
        .select("id, nombre, estado")
        .eq("empresa_id", companyId)
        .eq("estado", "activa")
        .order("created_at", { ascending: true })
        .limit(1),
    );

    if (warehouses[0]) return warehouses[0];

    const created = await rpcRequired(contexts.admin.supabase, "crear_inventario_bodega", {
      p_descripcion: "Bodega creada por smoke core operativo",
      p_nombre: `${prefix} Bodega`,
      p_ubicacion: "Pruebas",
    });

    return created[0];
  });
  artifacts.warehouseId = warehouse.id ?? warehouse.bodega_id;

  const customer = await record("crear cliente CRM", "vendedor", async () => {
    const created = await rpcRequired(contexts.seller.supabase, "crear_crm_cliente", {
      p_asignado_a: contexts.seller.profile.id,
      p_correo: `cliente-${runId}@bizos.test`,
      p_genero: "o",
      p_identificacion: null,
      p_nombre: `${prefix} Cliente`,
      p_notas: "Cliente creado por smoke core operativo",
      p_origen: "smoke-core",
      p_telefono: "88888888",
      p_tipo: "cliente",
      p_whatsapp: "88888888",
    });

    return created[0];
  });
  artifacts.customerId = customer.cliente_id;

  const product = await record("crear producto catalogo", "admin", async () => {
    const created = await rpcRequired(contexts.admin.supabase, "crear_catalogo_producto", {
      p_categoria_id: null,
      p_codigo: `B1-${runId}`,
      p_descripcion: "Producto creado por smoke core operativo",
      p_impuesto_porcentaje: 13,
      p_moneda: "CRC",
      p_nombre: `${prefix} Producto`,
      p_precio_base: 1500,
      p_tipo: "producto",
      p_unidad_medida: "unidad",
    });

    return created[0];
  });
  artifacts.productId = product.producto_id;

  const initialStock = await record("registrar stock inicial", "admin", async () => {
    const movement = await rpcRequired(contexts.admin.supabase, "registrar_movimiento_inventario", {
      p_bodega_id: artifacts.warehouseId,
      p_cantidad: 10,
      p_motivo: "Stock inicial smoke core",
      p_producto_id: artifacts.productId,
      p_referencia_id: null,
      p_referencia_tipo: "smoke",
      p_tipo: "entrada",
    });

    return movement[0];
  });
  artifacts.initialStock = initialStock.cantidad_nueva;

  const quote = await record("crear cotizacion con producto", "vendedor", async () => {
    const created = await rpcRequired(contexts.seller.supabase, "crear_cotizacion", {
      p_cliente_id: artifacts.customerId,
      p_condiciones: "Pago de contado",
      p_fecha_vencimiento: null,
      p_items: [
        {
          cantidad: 2,
          descripcion: `${prefix} Producto`,
          descuento: 0,
          impuesto_porcentaje: 13,
          orden: 1,
          precio_unitario: 1500,
          producto_id: artifacts.productId,
        },
      ],
      p_moneda: "CRC",
      p_notas: "Cotizacion smoke core",
    });

    return created[0];
  });
  artifacts.quoteId = quote.cotizacion_id;

  await record("enviar cotizacion", "vendedor", async () => {
    const changed = await rpcRequired(contexts.seller.supabase, "cambiar_estado_cotizacion", {
      p_cotizacion_id: artifacts.quoteId,
      p_estado: "enviada",
    });
    return changed[0];
  });

  await record("aceptar cotizacion", "vendedor", async () => {
    const changed = await rpcRequired(contexts.seller.supabase, "cambiar_estado_cotizacion", {
      p_cotizacion_id: artifacts.quoteId,
      p_estado: "aceptada",
    });
    return changed[0];
  });

  const sale = await record("generar venta desde cotizacion", "vendedor", async () => {
    const created = await rpcRequired(
      contexts.seller.supabase,
      "generar_venta_desde_cotizacion",
      {
        p_cotizacion_id: artifacts.quoteId,
      },
    );
    return created[0];
  });
  artifacts.saleId = sale.venta_id;

  await record("confirmar venta", "vendedor", async () => {
    const changed = await rpcRequired(contexts.seller.supabase, "cambiar_estado_venta", {
      p_estado: "confirmada",
      p_venta_id: artifacts.saleId,
    });
    return changed[0];
  });

  await record("aplicar salida de inventario", "admin", async () => {
    const applied = await rpcRequired(
      contexts.admin.supabase,
      "apply_sale_inventory_atomic",
      {
        p_operation_id: randomUUID(),
        p_sale_id: artifacts.saleId,
        p_warehouse_id: artifacts.warehouseId,
      },
    );
    return applied[0];
  });

  const stockAfterSale = await record("verificar stock posterior", "admin", async () => {
    const stock = await queryMaybeSingle(
      contexts.admin.supabase
        .from("inventario_stock")
        .select("id, cantidad, inventario_bodegas(nombre), catalogo_productos(nombre)")
        .eq("producto_id", artifacts.productId)
        .eq("bodega_id", artifacts.warehouseId)
        .maybeSingle(),
    );
    if (!stock) throw new Error("Stock no encontrado tras salida de inventario.");
    if (Number(stock.cantidad) !== 8) {
      throw new Error(`Stock esperado 8, recibido ${stock.cantidad}.`);
    }
    return stock;
  });
  artifacts.stockAfterSale = stockAfterSale.cantidad;

  const dispatch = await record("crear despacho desde venta", "admin", async () => {
    const created = await rpcRequired(contexts.admin.supabase, "crear_despacho_desde_venta", {
      p_contacto_entrega: `${prefix} Cliente`,
      p_direccion_entrega: "Direccion smoke core 123",
      p_fecha_programada: new Date().toISOString().slice(0, 10),
      p_hora_programada: "10:00",
      p_notas: "Despacho smoke core",
      p_responsable_id: contexts.driver.profile.id,
      p_telefono_entrega: "88888888",
      p_venta_id: artifacts.saleId,
    });

    return created[0];
  });
  artifacts.dispatchId = dispatch.despacho_id;

  for (const status of ["preparando", "listo", "en_ruta", "entregado"]) {
    await record(`avanzar despacho a ${status}`, "chofer", async () => {
      const changed = await rpcRequired(contexts.driver.supabase, "cambiar_estado_despacho", {
        p_despacho_id: artifacts.dispatchId,
        p_estado: status,
        p_resultado: status === "entregado" ? "Entregado completo por smoke core" : null,
      });
      return changed[0];
    });
  }

  const finalSale = await recordSoft("verificar estado final de venta", "admin", async () => {
    const row = await queryMaybeSingle(
      contexts.admin.supabase
        .from("ventas")
        .select("id, numero, estado, inventario_estado, total")
        .eq("id", artifacts.saleId)
        .maybeSingle(),
    );
    if (!row) throw new Error("Venta no encontrada para verificacion final.");
    if (row.estado !== "completada") {
      throw new Error(
        `La venta deberia quedar completada al entregar despacho; estado actual: ${row.estado}.`,
      );
    }
    return row;
  });
  artifacts.saleTotal = finalSale?.total ?? null;

  const account = await record("sincronizar cuenta por cobrar", "admin", async () => {
    const accounts = await rpcRequired(
      contexts.admin.supabase,
      "sincronizar_cuentas_cobrar_ventas_actual",
      {},
    );
    const accountForSale = accounts.find((row) => row.venta_id === artifacts.saleId);
    if (!accountForSale) {
      throw new Error("No se genero cuenta por cobrar para la venta.");
    }
    return accountForSale;
  });
  artifacts.accountId = account.account_id;

  await record("registrar cobro total", "admin", async () => {
    const paid = await rpcRequired(contexts.admin.supabase, "registrar_movimiento_cuenta", {
      p_account_id: artifacts.accountId,
      p_metodo: "manual",
      p_monto: account.saldo,
      p_notas: "Cobro smoke core",
      p_referencia: `BLOQUE1-${runId}`,
    });
    return paid[0];
  });
} catch (error) {
  fatalError =
    error && typeof error === "object" && "message" in error
      ? {
          code: error.code ?? null,
          message: error.message,
          details: error.details ?? null,
          hint: error.hint ?? null,
        }
      : { message: String(error) };
} finally {
  await Promise.all(
    Object.values(contexts).map((context) => context?.supabase?.auth?.signOut?.()),
  );
}

const failed = steps.find((step) => !step.ok);
const summary = {
  ok: !failed,
  runId,
  users: Object.fromEntries(
    Object.entries(contexts).map(([key, context]) => [
      key,
      {
        correo: context.profile.correo,
        rol: context.profile.rol,
        estado: context.profile.estado,
        requiereCambioContrasena: context.profile.requiereCambioContrasena,
      },
    ]),
  ),
  artifacts,
  fatalError,
  steps,
};

console.log(JSON.stringify(summary, null, 2));

if (failed || fatalError) {
  process.exitCode = 1;
}
