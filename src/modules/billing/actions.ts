"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { encryptSecret } from "@/modules/billing/crypto";
import {
  fiscalConfigurationSchema,
  issueInvoiceSchema,
} from "@/modules/billing/schemas";
import { getFiscalConfiguration } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import type { JsonRecord } from "@/types/core";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  return error.message?.replace(/\s+/g, " ").trim() ?? "No se pudo completar la accion.";
}

function buildFiscalValuePatch(value: JsonRecord, encrypted: JsonRecord) {
  const patch: JsonRecord = {
    actividadEconomica: value.actividadEconomica,
    ambiente: value.ambiente,
    correoEmisor: value.correoEmisor,
    identificacion: value.identificacion,
    razonSocial: value.razonSocial,
    sucursal: value.sucursal,
    terminal: value.terminal,
    tipoIdentificacion: value.tipoIdentificacion,
  };

  for (const key of [
    "haciendaPasswordEnc",
    "haciendaUsuarioEnc",
    "p12Base64Enc",
    "pinEnc",
  ]) {
    if (typeof encrypted[key] === "string" && encrypted[key]) {
      patch[key] = encrypted[key];
    }
  }

  return patch;
}

export async function saveFiscalConfigurationAction(formData: FormData) {
  const parsed = fiscalConfigurationSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/fiscal", "Completa la configuracion fiscal requerida.");
  }

  const access = await requireAdminAccess();

  if (
    !hasAnyPermission(access.tenant.permissions, [
      "admin.settings.manage",
      "billing.fiscal.manage",
    ])
  ) {
    redirectWithError("/admin/fiscal", "No tienes permiso para guardar configuracion fiscal.");
  }

  let encrypted: JsonRecord;
  try {
    encrypted = {
      haciendaPasswordEnc: parsed.data.haciendaPassword
        ? encryptSecret(parsed.data.haciendaPassword)
        : undefined,
      haciendaUsuarioEnc: parsed.data.haciendaUsuario
        ? encryptSecret(parsed.data.haciendaUsuario)
        : undefined,
      p12Base64Enc: parsed.data.p12Base64 ? encryptSecret(parsed.data.p12Base64) : undefined,
      pinEnc: parsed.data.pin ? encryptSecret(parsed.data.pin) : undefined,
    };
  } catch {
    redirectWithError(
      "/admin/fiscal",
      "Falta FISCAL_CONFIG_ENCRYPTION_KEY para guardar secretos fiscales.",
    );
  }

  const supabase = await createClient();
  const value = buildFiscalValuePatch(parsed.data as unknown as JsonRecord, encrypted);
  const { error } = await supabase.rpc("guardar_configuracion_fiscal", {
    p_valor: value,
  });

  if (error) {
    redirectWithError("/admin/fiscal", "No se pudo guardar la configuracion fiscal.");
  }

  revalidatePath("/admin/fiscal");
  redirectWithSuccess("/admin/fiscal", "Configuracion fiscal guardada.");
}

export async function issueInvoiceFromSaleAction(formData: FormData) {
  const parsed = issueInvoiceSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Completa los datos fiscales antes de emitir.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "billing.invoices.create")) {
    redirectWithError("/cotizaciones", "No tienes permiso para emitir facturas.");
  }

  const fiscal = await getFiscalConfiguration(access.tenant);

  if (!fiscal.ok || !fiscal.data.listoParaEmitir) {
    redirectWithError(
      "/cotizaciones",
      "La configuracion fiscal esta incompleta. Revisa Admin > Fiscal.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("crear_factura_electronica_desde_venta", {
    p_ambiente: fiscal.data.ambiente,
    p_actividad_economica: parsed.data.actividadEconomica,
    p_condicion_venta: parsed.data.condicionVenta,
    p_medio_pago: parsed.data.medioPago,
    p_receptor_correo: parsed.data.correoReceptor || null,
    p_receptor_identificacion: parsed.data.identificacionReceptor ?? null,
    p_receptor_nombre: parsed.data.nombreReceptor ?? null,
    p_receptor_tipo_identificacion: parsed.data.identificacionReceptor ? "02" : null,
    p_tipo_comprobante: "factura_electronica",
    p_venta_id: parsed.data.ventaId,
  });

  if (error) {
    redirectWithError("/cotizaciones", `No se pudo preparar la factura: ${safeErrorMessage(error)}`);
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/ventas");
  redirectWithSuccess(
    "/cotizaciones",
    "Factura preparada. El envio real a Hacienda queda habilitado al completar la firma XAdES.",
  );
}
