import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { getWarehouses } from "@/modules/inventory/queries";
import { PosSessionSetup, PosTerminalSetup } from "@/modules/pos/components/pos-setup";
import { PosTerminalScreen } from "@/modules/pos/components/pos-terminal";
import { canUsePos, getCurrentPosSessions, getPosCatalogPage, getPosTerminals } from "@/modules/pos/queries";

type PosPageProps = { searchParams?: Promise<{ terminal?: string }> };

export default async function PosPage({ searchParams }: PosPageProps) {
  const [tenantResult, params] = await Promise.all([getCurrentTenantContext(), searchParams]);
  if (!tenantResult.ok || !tenantResult.data) redirect("/login");
  const tenant = tenantResult.data;
  if (!canUsePos(tenant)) {
    return <EmptyState description="Solicita el permiso de punto de venta a un administrador." title="Acceso denegado" />;
  }

  const [terminalResult, sessionResult, warehouseResult] = await Promise.all([
    getPosTerminals(tenant),
    getCurrentPosSessions(tenant),
    hasPermission(tenant.permissions, "sales.pos.manage")
      ? getWarehouses(tenant)
      : Promise.resolve(null),
  ]);
  if (!terminalResult.ok) return <EmptyState description={terminalResult.error.message} title="No se pudieron cargar las terminales" />;
  if (!sessionResult.ok) return <EmptyState description={sessionResult.error.message} title="No se pudieron cargar las cajas" />;

  const terminals = terminalResult.data;
  const selectedTerminal = terminals.find((terminal) => terminal.id === params?.terminal) ?? terminals[0] ?? null;
  const currentSession = selectedTerminal
    ? sessionResult.data.find((session) => session.terminalId === selectedTerminal.id) ?? null
    : null;
  const catalogResult = currentSession
    ? await getPosCatalogPage(tenant, currentSession.id, { limit: 300 })
    : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        actions={<Link className={buttonVariants({ variant: "outline" })} href="/ventas">Ver ventas</Link>}
        description="Caja, cobros divididos, cupos de inventario y ventas recuperables sin conexión."
        eyebrow="Ventas"
        title="Punto de venta"
      />

      {terminals.length > 1 ? (
        <nav className="flex flex-wrap gap-2" aria-label="Terminales POS">
          {terminals.map((terminal) => (
            <Link className={buttonVariants({ variant: terminal.id === selectedTerminal?.id ? "default" : "outline" })} href={`/ventas/pos?terminal=${terminal.id}`} key={terminal.id}>
              {terminal.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {!selectedTerminal ? (
        hasPermission(tenant.permissions, "sales.pos.manage") ? (
          <PosTerminalSetup warehouses={(warehouseResult?.ok ? warehouseResult.data : []).filter((row) => row.estado === "activa").map((row) => ({ id: row.id, name: row.nombre }))} />
        ) : (
          <EmptyState description="Un administrador debe crear y asociar la primera terminal." title="No hay terminales configuradas" />
        )
      ) : !currentSession ? (
        <PosSessionSetup terminal={selectedTerminal} />
      ) : catalogResult?.ok ? (
        <PosTerminalScreen initialCatalog={catalogResult.data.items} session={currentSession} terminal={selectedTerminal} />
      ) : (
        <EmptyState description={catalogResult?.error.message ?? "No se pudo leer el catálogo de la sesión."} title="Catálogo no disponible" />
      )}
    </section>
  );
}
