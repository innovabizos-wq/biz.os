"use server";

import { revalidatePath } from "next/cache";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import { getPosCatalogPage } from "@/modules/pos/queries";
import {
  closePosSessionSchema,
  createPosTerminalSchema,
  openPosSessionSchema,
  posSaleSchema,
} from "@/modules/pos/schemas";
import type { PosActionResult, PosCatalogItem, PosSaleInput, PosSaleResult } from "@/modules/pos/types";

type RpcError = { message?: string };
type TerminalRpcRow = { terminal_id: string };
type SessionRpcRow = { session_id: string };
type SaleRpcRow = {
  fiscal_status: string;
  payment_status: string;
  reused: boolean;
  sale_id: string;
  sale_number: string;
  total: number;
};

function errorMessage(error: RpcError | null, fallback: string) {
  const message = error?.message?.replace(/^.*?: /, "").trim();
  return message || fallback;
}

async function getTenant() {
  const result = await getCurrentTenantContext();
  return result.ok ? result.data : null;
}

export async function createPosTerminalAction(input: unknown): Promise<PosActionResult<{ terminalId: string }>> {
  const parsed = createPosTerminalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos de la terminal." };
  const tenant = await getTenant();
  if (!tenant || !hasPermission(tenant.permissions, "sales.pos.manage")) {
    return { ok: false, error: "No tienes permiso para crear terminales." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_pos_terminal", {
    p_branch_id: parsed.data.branchId ?? null,
    p_code: parsed.data.code,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_name: parsed.data.name,
    p_offline_enabled: parsed.data.offlineEnabled,
    p_warehouse_id: parsed.data.warehouseId,
  });
  if (error) return { ok: false, error: errorMessage(error, "No se pudo crear la terminal.") };
  const row = (data as TerminalRpcRow[] | null)?.[0];
  if (!row) return { ok: false, error: "La terminal no devolvió un identificador." };
  revalidatePath("/ventas/pos");
  return { ok: true, data: { terminalId: row.terminal_id } };
}

export async function openPosSessionAction(input: unknown): Promise<PosActionResult<{ sessionId: string }>> {
  const parsed = openPosSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el fondo inicial y la terminal." };
  const tenant = await getTenant();
  if (!tenant || !hasPermission(tenant.permissions, "sales.pos.use")) {
    return { ok: false, error: "No tienes permiso para abrir la caja." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_pos_session", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_opening_cash: parsed.data.openingCash,
    p_terminal_id: parsed.data.terminalId,
  });
  if (error) return { ok: false, error: errorMessage(error, "No se pudo abrir la caja.") };
  const row = (data as SessionRpcRow[] | null)?.[0];
  if (!row) return { ok: false, error: "La apertura no devolvió una sesión." };
  revalidatePath("/ventas/pos");
  return { ok: true, data: { sessionId: row.session_id } };
}

export async function submitPosSaleAction(input: PosSaleInput): Promise<PosActionResult<PosSaleResult>> {
  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "La venta pendiente contiene datos inválidos." };
  const tenant = await getTenant();
  if (!tenant || !hasPermission(tenant.permissions, "sales.pos.use")) {
    return { ok: false, error: "No tienes permiso para registrar ventas POS." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_pos_sale", {
    p_captured_at: parsed.data.capturedAt,
    p_client_operation_id: parsed.data.clientOperationId,
    p_items: parsed.data.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    p_offline: parsed.data.offline,
    p_payments: parsed.data.payments,
    p_sequence: parsed.data.sequence,
    p_session_id: parsed.data.sessionId,
  });
  if (error) return { ok: false, error: errorMessage(error, "No se pudo registrar la venta.") };
  const row = (data as SaleRpcRow[] | null)?.[0];
  if (!row) return { ok: false, error: "La venta no devolvió un resultado." };
  revalidatePath("/ventas");
  revalidatePath("/ventas/pos");
  return {
    ok: true,
    data: {
      fiscalStatus: row.fiscal_status,
      paymentStatus: row.payment_status,
      reused: row.reused,
      saleId: row.sale_id,
      saleNumber: row.sale_number,
      total: Number(row.total),
    },
  };
}

export async function loadPosCatalogPageAction(input: {
  limit?: number;
  offset?: number;
  search?: string;
  sessionId: string;
}): Promise<PosActionResult<{ items: PosCatalogItem[]; nextOffset: number | null }>> {
  const tenant = await getTenant();
  if (!tenant || !hasPermission(tenant.permissions, "sales.pos.use")) {
    return { ok: false, error: "No tienes permiso para descargar el catálogo." };
  }
  const result = await getPosCatalogPage(tenant, input.sessionId, input);
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error.message };
}

export async function closePosSessionAction(input: unknown): Promise<PosActionResult<{ difference: number }>> {
  const parsed = closePosSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa el arqueo de cierre." };
  const tenant = await getTenant();
  if (!tenant || !hasAnyPermission(tenant.permissions, ["sales.pos.manage", "sales.cash.manage"])) {
    return { ok: false, error: "No tienes permiso para cerrar la caja." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_pos_session", {
    p_counted_cash: parsed.data.countedCash,
    p_last_sequence: parsed.data.lastSequence,
    p_session_id: parsed.data.sessionId,
  });
  if (error) return { ok: false, error: errorMessage(error, "No se pudo cerrar la caja.") };
  const row = (data as Array<{ cash_difference: number }> | null)?.[0];
  revalidatePath("/ventas/pos");
  return { ok: true, data: { difference: Number(row?.cash_difference ?? 0) } };
}
