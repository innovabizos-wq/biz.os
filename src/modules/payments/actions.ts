"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import {
  recordPaymentSchema,
  syncReceivablesSchema,
  voidPaymentAccountSchema,
} from "@/modules/payments/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type PaymentAccountGuardRow = {
  estado: string;
  saldo: number;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();
  return message || "No se pudo completar la accion.";
}

async function assertPaymentsManage() {
  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "payments")) {
    redirectWithError("/dashboard", "El modulo Pagos no esta activo.");
  }

  if (!hasPermission(access.tenant.permissions, "payments.accounts.manage")) {
    redirectWithError("/pagos", "No tienes permiso para gestionar pagos.");
  }

  return access;
}

export async function syncReceivablesAction(formData: FormData) {
  const parsed = syncReceivablesSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/pagos", "Solicitud de sincronizacion invalida.");
  }

  await assertPaymentsManage();

  const supabase = await createClient();
  const rpcName =
    parsed.data.intent === "sync-payables"
      ? "sincronizar_cuentas_pagar_compras_actual"
      : "sincronizar_cuentas_cobrar_ventas_actual";
  const { error } = await supabase.rpc(rpcName);

  if (error) {
    redirectWithError(
      "/pagos",
      `No se pudieron sincronizar cuentas: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/pagos");
  revalidatePath("/dashboard");
  redirect("/pagos");
}

export async function recordPaymentAction(formData: FormData) {
  const parsed = recordPaymentSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/pagos", "Datos de pago invalidos.");
  }

  const access = await assertPaymentsManage();

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from("payments_accounts")
    .select("saldo, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.accountId)
    .maybeSingle<PaymentAccountGuardRow>();

  if (accountError || !account) {
    redirectWithError("/pagos", "Cuenta no encontrada.");
  }

  if (["pagada", "anulada"].includes(account.estado)) {
    redirectWithError("/pagos", "La cuenta no acepta nuevos movimientos.");
  }

  if (parsed.data.monto > Number(account.saldo)) {
    redirectWithError(
      "/pagos",
      "El monto no puede superar el saldo pendiente.",
    );
  }

  const { error } = await supabase.rpc("registrar_movimiento_cuenta", {
    p_account_id: parsed.data.accountId,
    p_metodo: parsed.data.metodo,
    p_monto: parsed.data.monto,
    p_notas: parsed.data.notas ?? null,
    p_referencia: parsed.data.referencia ?? null,
  });

  if (error) {
    redirectWithError(
      "/pagos",
      `No se pudo registrar el movimiento: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/pagos");
  revalidatePath("/dashboard");
  redirect("/pagos");
}

export async function voidPaymentAccountAction(formData: FormData) {
  const parsed = voidPaymentAccountSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/pagos", "Cuenta invalida.");
  }

  await assertPaymentsManage();

  const supabase = await createClient();
  const { error } = await supabase.rpc("anular_cuenta_pago", {
    p_account_id: parsed.data.accountId,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    redirectWithError(
      "/pagos",
      `No se pudo anular la cuenta: ${safeErrorMessage(error)}`,
    );
  }

  revalidatePath("/pagos");
  revalidatePath("/dashboard");
  redirect("/pagos");
}
