import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  recordPaymentAction,
  syncReceivablesAction,
  voidPaymentAccountAction,
} from "@/modules/payments/actions";
import {
  canManagePayments,
  getPaymentAccounts,
  getPaymentTransactions,
} from "@/modules/payments/queries";
import type {
  PaymentAccount,
  PaymentsSummary,
  PaymentTransaction,
} from "@/modules/payments/types";

type PaymentsPageProps = {
  searchParams?: Promise<{ error?: string; tipo?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function accountName(account: PaymentAccount) {
  if (account.tipo === "receivable") {
    return account.clienteNombre ?? "Cliente sin nombre";
  }

  return account.proveedorNombre ?? "Proveedor sin nombre";
}

function accountReference(account: PaymentAccount) {
  if (account.tipo === "receivable") {
    return `Venta ${account.ventaNumero ?? "sin referencia"}`;
  }

  return `Compra ${account.compraId ? account.numero.replace(/^CXP-/, "") : "sin referencia"}`;
}

function buildPaymentsSummary(
  accounts: PaymentAccount[],
  transactions: PaymentTransaction[],
): PaymentsSummary {
  const openAccounts = accounts.filter((account) =>
    ["pendiente", "parcial", "vencida"].includes(account.estado),
  );

  return {
    cuentasPorCobrarPendientes: openAccounts.filter(
      (account) => account.tipo === "receivable",
    ).length,
    cuentasPorPagarPendientes: openAccounts.filter(
      (account) => account.tipo === "payable",
    ).length,
    cuentasVencidas: accounts.filter((account) => account.estado === "vencida").length,
    saldoPorCobrar: accounts
      .filter((account) => account.tipo === "receivable")
      .reduce((sum, account) => sum + account.saldo, 0),
    saldoPorPagar: accounts
      .filter((account) => account.tipo === "payable")
      .reduce((sum, account) => sum + account.saldo, 0),
    totalCobrado: transactions
      .filter((transaction) =>
        accounts.some(
          (account) =>
            account.id === transaction.accountId && account.tipo === "receivable",
        ),
      )
      .reduce((sum, transaction) => sum + transaction.monto, 0),
    totalPagado: transactions
      .filter((transaction) =>
        accounts.some(
          (account) =>
            account.id === transaction.accountId && account.tipo === "payable",
        ),
      )
      .reduce((sum, transaction) => sum + transaction.monto, 0),
  };
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const [params, tenantResult] = await Promise.all([
    searchParams,
    getCurrentTenantContext(),
  ]);

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  const tenant = tenantResult.data;
  const selectedType =
    params?.tipo === "payable" || params?.tipo === "receivable"
      ? params.tipo
      : "all";
  let accountsResult;
  let transactionsResult;

  try {
    [accountsResult, transactionsResult] = await Promise.all([
      getPaymentAccounts(tenant, selectedType),
      getPaymentTransactions(tenant),
    ]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar pagos.";

    return (
      <section className="space-y-6">
        <PageHeader
          description={message}
          eyebrow="Operacion"
          title="Pagos"
        />
      </section>
    );
  }

  if (!accountsResult.ok) {
    return (
      <section className="space-y-6">
        <PageHeader
          description={accountsResult.error.message}
          eyebrow="Operacion"
          title="Pagos"
        />
      </section>
    );
  }

  const canManage = canManagePayments(tenant);
  const accounts = accountsResult.data;
  const transactions = transactionsResult.ok ? transactionsResult.data : [];
  const summary = buildPaymentsSummary(accounts, transactions);

  return (
    <section className="space-y-6">
      <PageHeader
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-3">
              <form action={syncReceivablesAction}>
                <input name="intent" type="hidden" value="sync-receivables" />
                <Button type="submit" variant="outline">
                  <RefreshCw aria-hidden={true} size={16} />
                  Sincronizar CxC
                </Button>
              </form>
              <form action={syncReceivablesAction}>
                <input name="intent" type="hidden" value="sync-payables" />
                <Button type="submit">
                  <RefreshCw aria-hidden={true} size={16} />
                  Sincronizar CxP
                </Button>
              </form>
            </div>
          ) : null
        }
        description="Cuentas por cobrar, cuentas por pagar y movimientos internos."
        eyebrow="Finanzas"
        title="Pagos"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Saldo por cobrar", formatCurrency(summary.saldoPorCobrar)],
          ["Saldo por pagar", formatCurrency(summary.saldoPorPagar)],
          ["Cuentas vencidas", summary.cuentasVencidas.toLocaleString("es-CR")],
          [
            "Movimientos recientes",
            `${formatCurrency(summary.totalCobrado)} / ${formatCurrency(summary.totalPagado)}`,
          ],
        ].map(([label, value]) => (
          <div className="rounded-lg border bg-background p-5 shadow-sm" key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <strong className="mt-2 block text-2xl">{value}</strong>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "Todas"],
          ["receivable", `Por cobrar (${summary.cuentasPorCobrarPendientes})`],
          ["payable", `Por pagar (${summary.cuentasPorPagarPendientes})`],
        ].map(([value, label]) => (
          <Link
            className={buttonVariants({
              variant: selectedType === value ? "default" : "outline",
            })}
            href={value === "all" ? "/pagos" : `/pagos?tipo=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          description="Sincroniza ventas para CxC o compras recibidas para CxP."
          title="No hay cuentas"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3">Cuenta</th>
                <th className="p-3">Tercero</th>
                <th className="p-3">Vence</th>
                <th className="p-3 text-right">Saldo</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Movimiento</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr className="border-t align-top" key={account.id}>
                  <td className="p-3">
                    <strong>{account.numero}</strong>
                    <span className="block text-muted-foreground">
                      {account.tipo === "receivable" ? "Por cobrar" : "Por pagar"} -{" "}
                      {accountReference(account)}
                    </span>
                  </td>
                  <td className="p-3">{accountName(account)}</td>
                  <td className="p-3">{formatDate(account.fechaVencimiento)}</td>
                  <td className="p-3 text-right font-semibold">
                    {formatCurrency(account.saldo)}
                  </td>
                  <td className="p-3 capitalize">{account.estado}</td>
                  <td className="p-3">
                    {canManage && account.saldo > 0 && !["anulada", "pagada"].includes(account.estado) ? (
                      <div className="grid gap-2">
                        <form action={recordPaymentAction} className="grid gap-2">
                          <input name="accountId" type="hidden" value={account.id} />
                          <input
                            className="rounded-md border bg-background px-3 py-2"
                            max={account.saldo}
                            min="1"
                            name="monto"
                            placeholder={account.tipo === "receivable" ? "Cobro" : "Pago"}
                            step="0.01"
                            type="number"
                          />
                          <input
                            className="rounded-md border bg-background px-3 py-2"
                            name="referencia"
                            placeholder="Referencia"
                          />
                          <input
                            name="metodo"
                            type="hidden"
                            value={account.tipo === "receivable" ? "cobro_manual" : "pago_manual"}
                          />
                          <Button size="sm" type="submit">
                            {account.tipo === "receivable" ? "Registrar cobro" : "Registrar pago"}
                          </Button>
                        </form>
                        <form action={voidPaymentAccountAction}>
                          <input name="accountId" type="hidden" value={account.id} />
                          <Button size="sm" type="submit" variant="destructive">
                            Anular
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sin accion</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border bg-background p-5">
        <h2 className="text-base font-semibold">Movimientos recientes</h2>
        <div className="mt-4 grid gap-3">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
          ) : (
            transactions.map((transaction) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                key={transaction.id}
              >
                <div>
                  <strong>{formatCurrency(transaction.monto)}</strong>
                  <p className="text-sm text-muted-foreground">
                    {transaction.accountNumero ?? "Cuenta"} -{" "}
                    {transaction.referencia ?? transaction.metodo}
                  </p>
                </div>
                <time className="text-sm text-muted-foreground">
                  {formatDate(transaction.paidAt)}
                </time>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
