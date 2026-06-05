import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import type { ElectronicInvoice, FiscalConfiguration } from "@/modules/billing/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

type InvoiceRow = {
  ambiente: ElectronicInvoice["ambiente"];
  clave: string | null;
  cliente_id: string | null;
  estado: ElectronicInvoice["estado"];
  id: string;
  numero: string;
  total: number;
  venta_id: string;
};

function bool(value: unknown) {
  return value === true;
}

function defaultFiscalConfiguration(): FiscalConfiguration {
  return {
    actividadEconomica: null,
    ambiente: "pruebas",
    correoEmisor: null,
    hasHaciendaPassword: false,
    hasHaciendaUsuario: false,
    hasP12: false,
    hasPin: false,
    identificacion: null,
    listoParaEmitir: false,
    razonSocial: null,
    sucursal: "001",
    terminal: "00001",
    tipoIdentificacion: "02",
  };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function fiscalReady(config: FiscalConfiguration) {
  return Boolean(
    config.razonSocial &&
      config.identificacion &&
      config.actividadEconomica &&
      config.correoEmisor &&
      config.hasHaciendaUsuario &&
      config.hasHaciendaPassword &&
      config.hasP12 &&
      config.hasPin,
  );
}

function mapInvoice(row: InvoiceRow): ElectronicInvoice {
  return {
    ambiente: row.ambiente,
    clave: row.clave,
    clienteId: row.cliente_id,
    estado: row.estado,
    id: row.id,
    numero: row.numero,
    totalComprobante: row.total,
    ventaId: row.venta_id,
  };
}

export function canViewFiscalConfiguration(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
    "billing.fiscal.view",
    "billing.fiscal.manage",
  ]);
}

export async function getFiscalConfiguration(
  tenant: TenantContext,
): Promise<CoreResult<FiscalConfiguration>> {
  if (!canViewFiscalConfiguration(tenant)) {
    return ok(defaultFiscalConfiguration());
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_configuracion_fiscal");

  if (error) return ok(defaultFiscalConfiguration());

  const raw = (data ?? {}) as JsonRecord;
  const config: FiscalConfiguration = {
    actividadEconomica: text(raw.actividadEconomica),
    ambiente: raw.ambiente === "produccion" ? "produccion" : "pruebas",
    correoEmisor: text(raw.correoEmisor),
    hasHaciendaPassword: bool(raw.hasHaciendaPassword),
    hasHaciendaUsuario: bool(raw.hasHaciendaUsuario),
    hasP12: bool(raw.hasP12),
    hasPin: bool(raw.hasPin),
    identificacion: text(raw.identificacion),
    listoParaEmitir: false,
    razonSocial: text(raw.razonSocial),
    sucursal: text(raw.sucursal) ?? "001",
    terminal: text(raw.terminal) ?? "00001",
    tipoIdentificacion: text(raw.tipoIdentificacion) ?? "02",
  };

  return ok({ ...config, listoParaEmitir: fiscalReady(config) });
}

export async function getInvoicesForSales(
  tenant: TenantContext,
  ventaIds: string[],
): Promise<CoreResult<Record<string, ElectronicInvoice>>> {
  if (!hasPermission(tenant.permissions, "billing.invoices.view") || ventaIds.length === 0) {
    return ok({});
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("facturas_electronicas")
    .select("id, venta_id, cliente_id, numero, clave, estado, ambiente, total")
    .eq("empresa_id", tenant.empresaId)
    .in("venta_id", ventaIds);

  if (error) return ok({});

  return ok(
    ((data ?? []) as InvoiceRow[]).reduce<Record<string, ElectronicInvoice>>(
      (accumulator, row) => {
        accumulator[row.venta_id] = mapInvoice(row);
        return accumulator;
      },
      {},
    ),
  );
}
