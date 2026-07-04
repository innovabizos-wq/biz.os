import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import {
  assignProductCabysAction,
  importCabysCatalogAction,
} from "@/modules/billing/actions";
import { canUseBilling } from "@/modules/billing/guards";
import {
  getProductCabysProfiles,
  searchCabysCatalog,
} from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type CabysPageProps = {
  searchParams?: Promise<{ error?: string; q?: string; success?: string }>;
};

export default async function CabysPage({ searchParams }: CabysPageProps) {
  const defaultSearchParams: { error?: string; q?: string; success?: string } = {};
  const [access, query] = await Promise.all([
    requireAdminAccess(),
    searchParams ?? Promise.resolve(defaultSearchParams),
  ]);

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  const [products, cabysOptions] = await Promise.all([
    getProductCabysProfiles(access.tenant),
    searchCabysCatalog(access.tenant, query.q),
  ]);
  const canManageCabys = hasAnyPermission(access.tenant.permissions, ["billing.cabys.manage"]);
  const rows = products.ok ? products.data : [];
  const missingCabys = rows.filter((row) => !row.cabysCode);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Buscador y asociacion CABYS. La migracion crea catalogo, lotes de importacion y perfil fiscal de producto."
        eyebrow="Facturacion"
        title="CABYS"
      />

      {query.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          {query.error}
        </div>
      ) : null}

      {query.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {query.success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Productos activos</p>
          <p className="mt-2 text-2xl font-black">{rows.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Sin CABYS</p>
          <p className="mt-2 text-2xl font-black">{missingCabys.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Resultados CABYS</p>
          <p className="mt-2 text-2xl font-black">{cabysOptions.ok ? cabysOptions.data.length : 0}</p>
        </div>
      </div>

      <form className="flex flex-col gap-2 rounded-lg border bg-white p-4 md:flex-row" action="/facturacion/cabys">
        <input
          className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2"
          defaultValue={query.q ?? ""}
          name="q"
          placeholder="Buscar CABYS por codigo o descripcion"
        />
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white" type="submit">
          Buscar
        </button>
      </form>

      <form action={importCabysCatalogAction} className="space-y-3 rounded-lg border bg-white p-4">
        <div>
          <h2 className="font-black">Importar CABYS oficial</h2>
          <p className="text-sm text-muted-foreground">
            Pega CSV/TSV con encabezados como codigo, descripcion, tarifa. Dry-run no modifica el catalogo.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            name="sourceName"
            placeholder="Fuente oficial"
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            name="sourceVersion"
            placeholder="Version/fecha"
          />
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            name="sourceUrl"
            placeholder="URL fuente"
          />
        </div>
        <textarea
          className="min-h-40 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          name="cabysText"
          placeholder={"codigo,descripcion,tarifa\n0101010101010,Producto ejemplo,13"}
          required
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border bg-white px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-100"
            disabled={!canManageCabys}
            name="importMode"
            type="submit"
            value="dry_run"
          >
            Validar
          </button>
          <button
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!canManageCabys}
            name="importMode"
            type="submit"
            value="import"
          >
            Importar
          </button>
        </div>
      </form>

      {cabysOptions.ok && cabysOptions.data.length ? (
        <div className="rounded-lg border bg-white p-4">
          <h2 className="font-black">Resultados CABYS importados</h2>
          <div className="mt-3 grid gap-2">
            {cabysOptions.data.map((option) => (
              <div className="rounded-md border bg-slate-50 p-3 text-sm" key={option.code}>
                <strong>{option.code}</strong> - {option.description}
                <span className="ml-2 text-muted-foreground">
                  IVA {typeof option.taxRate === "number" ? option.taxRate : "N/D"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          description="Busca en el catalogo CABYS importado. Si no hay resultados, primero importa la fuente oficial."
          title="Sin resultados CABYS"
        />
      )}

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="font-black">Productos y perfil fiscal</h2>
          <p className="text-sm text-muted-foreground">
            Asigna solo codigos existentes en `cabys_catalog`; no se crean codigos falsos.
          </p>
        </div>
        {rows.length ? (
          <div className="grid gap-3 p-4">
            {rows.map((product) => (
              <form
                action={assignProductCabysAction}
                className="grid gap-3 rounded-md border bg-slate-50 p-3 lg:grid-cols-[1fr_180px_140px_1fr_auto]"
                key={product.productId}
              >
                <input name="productId" type="hidden" value={product.productId} />
                <div>
                  <p className="font-semibold">{product.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.productCode ?? "Sin codigo"} - {product.productType}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actual: {product.cabysCode ?? "Sin CABYS"}
                    {product.cabysDescription ? ` - ${product.cabysDescription}` : ""}
                  </p>
                </div>
                <input
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  defaultValue={product.cabysCode ?? ""}
                  name="cabysCode"
                  placeholder="Codigo CABYS"
                  required
                />
                <input
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  defaultValue={product.fiscalUnitCode ?? ""}
                  name="fiscalUnitCode"
                  placeholder="Unidad"
                />
                <input
                  className="rounded-md border bg-white px-3 py-2 text-sm"
                  defaultValue={product.fiscalNotes ?? ""}
                  name="fiscalNotes"
                  placeholder="Notas fiscales"
                />
                <button
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!canManageCabys}
                  type="submit"
                >
                  Guardar
                </button>
              </form>
            ))}
          </div>
        ) : (
          <EmptyState
            description="No hay productos activos visibles para asociar CABYS."
            title="Sin productos"
          />
        )}
      </div>
    </section>
  );
}
