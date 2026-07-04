import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  PaymentAccount,
  PaymentsSummary,
  PaymentTransaction,
} from "@/modules/payments/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type AccountRow = {
  cliente_id: string | null;
  compra_id: string | null;
  created_at: string;
  descripcion: string | null;
  estado: PaymentAccount["estado"];
  fecha_emision: string;
  fecha_vencimiento: string | null;
  id: string;
  moneda: string;
  numero: string;
  proveedor_id: string | null;
  saldo: number;
  tipo: PaymentAccount["tipo"];
  total: number;
  venta_id: string | null;
};

type TransactionRow = {
  account_id: string;
  created_at: string;
  id: string;
  metodo: string;
  monto: number;
  notas: string | null;
  paid_at: string;
  referencia: string | null;
};

type NameRow = {
  id: string;
  nombre: string | null;
};

type NumberRow = {
  id: string;
  numero: string | null;
};

function uniqueIds(ids: Array<string | null | undefined>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

async function getNamesById(
  tenant: TenantContext,
  table: string,
  ids: string[],
) {
  if (ids.length === 0) return new Map<string, string | null>();

  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id, nombre")
    .in("id", ids);

  if (["crm_clientes", "purchases_suppliers"].includes(table)) {
    query = query.eq("empresa_id", tenant.empresaId);
  }

  const { data, error } = await query;

  if (error) {
    return new Map<string, string | null>();
  }

  return new Map(((data ?? []) as NameRow[]).map((row) => [row.id, row.nombre]));
}

async function getSaleNumbersById(tenant: TenantContext, ids: string[]) {
  if (ids.length === 0) return new Map<string, string | null>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ventas")
    .select("id, numero")
    .eq("empresa_id", tenant.empresaId)
    .in("id", ids);

  if (error) {
    return new Map<string, string | null>();
  }

  return new Map(((data ?? []) as NumberRow[]).map((row) => [row.id, row.numero]));
}

function mapAccount(
  row: AccountRow,
  customersById: Map<string, string | null>,
  suppliersById: Map<string, string | null>,
  salesById: Map<string, string | null>,
): PaymentAccount {
  return {
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_id
      ? (customersById.get(row.cliente_id) ?? null)
      : null,
    compraId: row.compra_id,
    createdAt: row.created_at,
    descripcion: row.descripcion,
    estado: row.estado,
    fechaEmision: row.fecha_emision,
    fechaVencimiento: row.fecha_vencimiento,
    id: row.id,
    moneda: row.moneda,
    numero: row.numero,
    proveedorId: row.proveedor_id,
    proveedorNombre: row.proveedor_id
      ? (suppliersById.get(row.proveedor_id) ?? null)
      : null,
    saldo: row.saldo,
    tipo: row.tipo,
    total: row.total,
    ventaId: row.venta_id,
    ventaNumero: row.venta_id ? (salesById.get(row.venta_id) ?? null) : null,
  };
}

function mapTransaction(
  row: TransactionRow,
  accountsById: Map<string, string | null>,
): PaymentTransaction {
  return {
    accountId: row.account_id,
    accountNumero: accountsById.get(row.account_id) ?? null,
    createdAt: row.created_at,
    createdByNombre: null,
    id: row.id,
    metodo: row.metodo,
    monto: row.monto,
    notas: row.notas,
    paidAt: row.paid_at,
    referencia: row.referencia,
  };
}

export function canAccessPayments(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "payments") &&
    hasAnyPermission(tenant.permissions, [
      "payments.accounts.view",
      "payments.accounts.manage",
    ])
  );
}

export function canManagePayments(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "payments") &&
    hasPermission(tenant.permissions, "payments.accounts.manage")
  );
}

export async function getPaymentAccounts(
  tenant: TenantContext,
  type: PaymentAccount["tipo"] | "all" = "all",
): Promise<CoreResult<PaymentAccount[]>> {
  if (!isModuleActive(tenant.activeModules, "payments")) {
    return fail("MODULE_INACTIVE", "El modulo Pagos no esta activo.");
  }

  if (!hasPermission(tenant.permissions, "payments.accounts.view")) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver pagos.");
  }

  const supabase = await createClient();
  let query = supabase
    .from("payments_accounts")
    .select(
      "id, tipo, venta_id, compra_id, cliente_id, proveedor_id, numero, descripcion, moneda, total, saldo, fecha_emision, fecha_vencimiento, estado, created_at",
    )
    .eq("empresa_id", tenant.empresaId);

  if (type !== "all") {
    query = query.eq("tipo", type);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return fail("PERMISSION_DENIED", "No se pudieron cargar cuentas.", error);
  }

  const rows = (data ?? []) as AccountRow[];
  const [customersById, suppliersById, salesById] = await Promise.all([
    getNamesById(
      tenant,
      "crm_clientes",
      uniqueIds(rows.map((row) => row.cliente_id)),
    ),
    getNamesById(
      tenant,
      "purchases_suppliers",
      uniqueIds(rows.map((row) => row.proveedor_id)),
    ),
    getSaleNumbersById(tenant, uniqueIds(rows.map((row) => row.venta_id))),
  ]);

  return ok(rows.map((row) => mapAccount(row, customersById, suppliersById, salesById)));
}

export async function getPaymentTransactions(
  tenant: TenantContext,
): Promise<CoreResult<PaymentTransaction[]>> {
  if (!canAccessPayments(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments_transactions")
    .select("id, account_id, monto, metodo, referencia, notas, paid_at, created_at")
    .eq("empresa_id", tenant.empresaId)
    .order("paid_at", { ascending: false })
    .limit(30);

  if (error) {
    return ok([]);
  }

  const rows = (data ?? []) as TransactionRow[];
  const accountIds = uniqueIds(rows.map((row) => row.account_id));
  const { data: accountRows } =
    accountIds.length > 0
      ? await supabase
          .from("payments_accounts")
          .select("id, numero")
          .eq("empresa_id", tenant.empresaId)
          .in("id", accountIds)
      : { data: [] };
  const accountsById = new Map(
    ((accountRows ?? []) as NumberRow[]).map((row) => [row.id, row.numero]),
  );

  return ok(rows.map((row) => mapTransaction(row, accountsById)));
}

export async function getPaymentsSummary(
  tenant: TenantContext,
): Promise<CoreResult<PaymentsSummary>> {
  const [accounts, transactions] = await Promise.all([
    getPaymentAccounts(tenant),
    getPaymentTransactions(tenant),
  ]);

  const accountRows = accounts.ok ? accounts.data : [];
  const transactionRows = transactions.ok ? transactions.data : [];
  const openAccounts = accountRows.filter((account) =>
    ["pendiente", "parcial", "vencida"].includes(account.estado),
  );

  return ok({
    cuentasPorCobrarPendientes: openAccounts.filter(
      (account) => account.tipo === "receivable",
    ).length,
    cuentasPorPagarPendientes: openAccounts.filter(
      (account) => account.tipo === "payable",
    ).length,
    cuentasVencidas: accountRows.filter((account) => account.estado === "vencida")
      .length,
    saldoPorCobrar: accountRows
      .filter((account) => account.tipo === "receivable")
      .reduce((sum, account) => sum + account.saldo, 0),
    saldoPorPagar: accountRows
      .filter((account) => account.tipo === "payable")
      .reduce((sum, account) => sum + account.saldo, 0),
    totalCobrado: transactionRows
      .filter((transaction) =>
        accountRows.some(
          (account) =>
            account.id === transaction.accountId && account.tipo === "receivable",
        ),
      )
      .reduce((sum, transaction) => sum + transaction.monto, 0),
    totalPagado: transactionRows
      .filter((transaction) =>
        accountRows.some(
          (account) => account.id === transaction.accountId && account.tipo === "payable",
        ),
      )
      .reduce((sum, transaction) => sum + transaction.monto, 0),
  });
}
