"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import {
  changeSaleStatusSchema,
  generateSaleFromQuoteSchema,
  updateSaleNotesSchema,
} from "@/modules/sales/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedSaleRow = {
  venta_id?: string;
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

function logSaleActionError(
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

function revalidateSalePaths(ventaId?: string, cotizacionId?: string) {
  revalidatePath("/ventas");

  if (ventaId) {
    revalidatePath(`/ventas/${ventaId}`);
  }

  if (cotizacionId) {
    revalidatePath(`/cotizaciones/${cotizacionId}`);
  }
}

async function assertSalePermission(
  permission:
    | "sales.orders.create"
    | "sales.orders.edit"
    | "sales.orders.status.change",
  redirectPath: string,
) {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError(redirectPath, "No tienes permiso para realizar esta acción.");
  }

  return access;
}

export async function generateSaleFromQuoteAction(formData: FormData) {
  const parsed = generateSaleFromQuoteSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Datos de cotizacion invalidos.");
  }

  await assertSalePermission(
    "sales.orders.create",
    `/cotizaciones/${parsed.data.cotizacionId}`,
  );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generar_venta_desde_cotizacion", {
    p_cotizacion_id: parsed.data.cotizacionId,
  });

  if (error) {
    logSaleActionError("generateSaleFromQuoteAction", error, {
      cotizacionId: parsed.data.cotizacionId,
    });
    redirectWithError(
      `/cotizaciones/${parsed.data.cotizacionId}`,
      `No se pudo generar la venta: ${safeErrorMessage(error)}`,
    );
  }

  const ventaId = (data as CreatedSaleRow[] | null)?.[0]?.venta_id;

  revalidateSalePaths(ventaId, parsed.data.cotizacionId);
  redirect(ventaId ? `/ventas/${ventaId}` : "/ventas");
}

export async function changeSaleStatusAction(formData: FormData) {
  const parsed = changeSaleStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Estado de venta invalido.");
  }

  await assertSalePermission(
    "sales.orders.status.change",
    `/ventas/${parsed.data.ventaId}`,
  );

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_venta", {
    p_estado: parsed.data.estado,
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    logSaleActionError("changeSaleStatusAction", error, {
      estado: parsed.data.estado,
      ventaId: parsed.data.ventaId,
    });
    redirectWithError(
      `/ventas/${parsed.data.ventaId}`,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateSalePaths(parsed.data.ventaId);
  redirect(`/ventas/${parsed.data.ventaId}`);
}

export async function updateSaleNotesAction(formData: FormData) {
  const parsed = updateSaleNotesSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/ventas", "Datos de venta invalidos.");
  }

  await assertSalePermission("sales.orders.edit", `/ventas/${parsed.data.ventaId}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_notas_venta", {
    p_notas: parsed.data.notas ?? null,
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    logSaleActionError("updateSaleNotesAction", error, {
      ventaId: parsed.data.ventaId,
    });
    redirectWithError(
      `/ventas/${parsed.data.ventaId}`,
      `No se pudieron actualizar notas: ${safeErrorMessage(error)}`,
    );
  }

  revalidateSalePaths(parsed.data.ventaId);
  redirect(`/ventas/${parsed.data.ventaId}`);
}
