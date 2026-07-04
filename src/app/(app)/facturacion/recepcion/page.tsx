import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import {
  prepareReceiverMessageAction,
  registerReceivedFiscalXmlAction,
} from "@/modules/billing/actions";
import { canUseBilling } from "@/modules/billing/guards";
import { getReceivedFiscalDocuments } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type FiscalReceptionPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

function formatAmount(value: number | null, currencyCode: string | null) {
  if (typeof value !== "number") return "Sin total";
  return new Intl.NumberFormat("es-CR", {
    currency: currencyCode ?? "CRC",
    style: "currency",
  }).format(value);
}

export default async function FiscalReceptionPage({ searchParams }: FiscalReceptionPageProps) {
  const defaultSearchParams: { error?: string; success?: string } = {};
  const [access, query] = await Promise.all([
    requireAdminAccess(),
    searchParams ?? Promise.resolve(defaultSearchParams),
  ]);

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  const receivedDocuments = await getReceivedFiscalDocuments(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Recepcion de XML de proveedores y respuestas de receptor."
        eyebrow="Facturacion"
        title="Recepcion fiscal"
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

      <form action={registerReceivedFiscalXmlAction} className="space-y-3 rounded-lg border bg-white p-4">
        <div>
          <h2 className="font-black">Registrar XML recibido</h2>
          <p className="text-sm text-muted-foreground">
            Guarda el XML proveedor y valida campos minimos. El mensaje receptor a Hacienda queda pendiente.
          </p>
        </div>
        <textarea
          className="min-h-56 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          name="xmlText"
          placeholder="Pega aqui el XML recibido del proveedor"
          required
        />
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white" type="submit">
          Registrar XML
        </button>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="font-black">Ultimos XML recibidos</h2>
          <p className="text-sm text-muted-foreground">
            Ningun registro de esta lista equivale a mensaje receptor enviado a Hacienda.
          </p>
        </div>
        {receivedDocuments.ok && receivedDocuments.data.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Emisor</th>
                  <th className="px-4 py-3">Clave</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Respuesta</th>
                  <th className="px-4 py-3">Validacion</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3">Mensaje receptor</th>
                </tr>
              </thead>
              <tbody>
                {receivedDocuments.data.map((document) => (
                  <tr className="border-t" key={document.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{document.issuerName ?? "Sin emisor"}</div>
                      <div className="text-xs text-muted-foreground">
                        {document.issuerIdentification ?? "Sin identificacion"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{document.clave ?? "Sin clave"}</td>
                    <td className="px-4 py-3">
                      {formatAmount(document.totalAmount, document.currencyCode)}
                    </td>
                    <td className="px-4 py-3">{document.receiverResponseStatus}</td>
                    <td className="px-4 py-3">
                      {document.validationErrors.length
                        ? `${document.validationErrors.length} error(es)`
                        : "Minima OK"}
                    </td>
                    <td className="px-4 py-3">
                      {document.xmlArtifactId ? (
                        <a
                          className="rounded-md border bg-white px-3 py-2 text-xs font-black"
                          href={`/api/facturacion/recepcion/${document.id}/artefactos/${document.xmlArtifactId}`}
                        >
                          XML
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin archivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-56 flex-col gap-2">
                        {document.receiverMessageArtifactId ? (
                          <a
                            className="w-fit rounded-md border bg-white px-3 py-2 text-xs font-black"
                            href={`/api/facturacion/recepcion/${document.id}/artefactos/${document.receiverMessageArtifactId}`}
                          >
                            Descargar mensaje
                          </a>
                        ) : (
                          <form action={prepareReceiverMessageAction} className="flex flex-col gap-2">
                            <input name="receivedDocumentId" type="hidden" value={document.id} />
                            <select
                              className="rounded-md border bg-background px-2 py-2 text-xs"
                              defaultValue="accepted"
                              disabled={Boolean(document.validationErrors.length)}
                              name="responseStatus"
                            >
                              <option value="accepted">Aceptar</option>
                              <option value="partially_accepted">Aceptar parcial</option>
                              <option value="rejected">Rechazar</option>
                            </select>
                            <input
                              className="rounded-md border bg-background px-2 py-2 text-xs"
                              disabled={Boolean(document.validationErrors.length)}
                              name="detail"
                              placeholder="Detalle opcional"
                            />
                            <button
                              className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                              disabled={Boolean(document.validationErrors.length)}
                              type="submit"
                            >
                              Preparar
                            </button>
                          </form>
                        )}
                        <span className="text-xs text-muted-foreground">
                          No envia a Hacienda; solo archiva el XML receptor.
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            description="Carga el primer XML de proveedor para iniciar el archivo recibido."
            title="Sin documentos recibidos"
          />
        )}
      </div>
    </section>
  );
}
