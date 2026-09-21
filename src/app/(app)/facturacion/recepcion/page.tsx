import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import {
  prepareReceiverMessageAction,
  registerReceivedFiscalXmlAction,
} from "@/modules/billing/actions";
import { canUseBilling } from "@/modules/billing/guards";
import {
  getFiscalImportSaleCandidates,
  getFiscalXmlImportBatches,
  getReceivedFiscalDocuments,
} from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type FiscalReceptionPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

const SOURCE_LABELS: Record<string, string> = {
  manual_xml: "XML manual",
  other: "Otro sistema",
  rest_import: "API REST",
  tico_factura: "Tico Factura",
};

const STATUS_LABELS: Record<string, string> = {
  duplicate: "Duplicado",
  imported: "Importado",
  previewed: "Vista previa valida",
  processing: "Procesando",
  rejected: "Rechazado",
};

function formatAmount(value: number | null, currencyCode: string | null) {
  if (typeof value !== "number") return "Sin total";
  return new Intl.NumberFormat("es-CR", {
    currency: currencyCode ?? "CRC",
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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

  const [receivedDocuments, importBatches, saleCandidates] = await Promise.all([
    getReceivedFiscalDocuments(access.tenant),
    getFiscalXmlImportBatches(access.tenant),
    getFiscalImportSaleCandidates(access.tenant),
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Valida, deduplica y archiva comprobantes de proveedores o documentos exportados desde Tico Factura y otros sistemas."
        eyebrow="Facturacion"
        title="Importacion y recepcion fiscal"
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

      <form action={registerReceivedFiscalXmlAction} className="space-y-4 rounded-lg border bg-white p-4">
        <div>
          <h2 className="font-black">Revisar e importar XML 4.4</h2>
          <p className="text-sm text-muted-foreground">
            La vista previa verifica estructura, XSD oficial, identidad de la empresa, clave y huella. Importar conserva el XML original; no afirma un estado de Hacienda sin una respuesta oficial.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm font-semibold">
            <span>Origen</span>
            <select className="w-full rounded-md border bg-background px-3 py-2" defaultValue="tico_factura" name="importSource">
              <option value="tico_factura">Tico Factura</option>
              <option value="manual_xml">XML manual</option>
              <option value="rest_import">API REST</option>
              <option value="other">Otro sistema</option>
            </select>
          </label>

          <label className="space-y-1 text-sm font-semibold">
            <span>Tipo de archivo</span>
            <select className="w-full rounded-md border bg-background px-3 py-2" defaultValue="outgoing" name="documentDirection">
              <option value="outgoing">Venta emitida por mi empresa</option>
              <option value="incoming">Compra recibida de proveedor</option>
            </select>
          </label>

          <label className="space-y-1 text-sm font-semibold">
            <span>Nombre del archivo o lote</span>
            <input className="w-full rounded-md border bg-background px-3 py-2" maxLength={160} name="sourceName" placeholder="Ej. exportacion-setiembre.xml" />
          </label>
        </div>

        <label className="block space-y-1 text-sm font-semibold">
          <span>Vincular con una venta existente (solo archivos salientes)</span>
          <select className="w-full rounded-md border bg-background px-3 py-2" defaultValue="" name="linkedSaleId">
            <option value="">No vincular automaticamente</option>
            {saleCandidates.ok
              ? saleCandidates.data.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.number} · {sale.date} · {formatAmount(sale.totalAmount, sale.currencyCode)}
                  </option>
                ))
              : null}
          </select>
          <span className="block text-xs font-normal text-muted-foreground">
            Biz.OS solo acepta la vinculacion si moneda y total coinciden. Para documentos entrantes deja este campo vacio.
          </span>
        </label>

        <textarea
          className="min-h-64 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
          name="xmlText"
          placeholder="Pega aqui el XML fiscal completo"
          required
        />

        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border bg-white px-4 py-2 text-sm font-black" name="importMode" type="submit" value="preview">
            Validar vista previa
          </button>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white" name="importMode" type="submit" value="import">
            Validar e importar
          </button>
        </div>
      </form>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="font-black">Historial de validaciones e importaciones</h2>
          <p className="text-sm text-muted-foreground">
            Cada intento conserva resultado, errores y coincidencias sugeridas sin duplicar documentos.
          </p>
        </div>
        {!importBatches.ok ? (
          <div className="p-4 text-sm font-semibold text-red-800">{importBatches.error.message}</div>
        ) : importBatches.data.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Resultado</th>
                  <th className="px-4 py-3">Venta sugerida</th>
                </tr>
              </thead>
              <tbody>
                {importBatches.data.map((batch) => (
                  <tr className="border-t" key={batch.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDate(batch.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{SOURCE_LABELS[batch.importSource] ?? batch.importSource}</div>
                      <div className="text-xs text-muted-foreground">{batch.sourceName ?? (batch.documentDirection === "incoming" ? "Entrante" : "Saliente")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{batch.issuerName ?? "Sin emisor"}</div>
                      <div className="font-mono text-xs text-muted-foreground">{batch.clave ?? "Sin clave"}</div>
                      <div className="text-xs">{formatAmount(batch.totalAmount, batch.currencyCode)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{STATUS_LABELS[batch.status] ?? batch.status}</div>
                      <div className="text-xs text-muted-foreground">
                        {batch.xsdValid ? "XSD 4.4 valido" : "XSD invalido"}
                        {batch.validationErrors.length + batch.xsdErrors.length
                          ? ` · ${batch.validationErrors.length + batch.xsdErrors.length} error(es)`
                          : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{batch.suggestedSaleNumber ?? "Sin coincidencia unica"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState description="Valida un XML para iniciar el historial del lote." title="Sin importaciones" />
        )}
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="font-black">Documentos externos archivados</h2>
          <p className="text-sm text-muted-foreground">
            Los documentos entrantes pueden preparar un mensaje receptor. Los salientes quedan disponibles para consulta y vinculacion con ventas.
          </p>
        </div>
        {!receivedDocuments.ok ? (
          <div className="p-4 text-sm font-semibold text-red-800">{receivedDocuments.error.message}</div>
        ) : receivedDocuments.data.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Emisor</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Clave y total</th>
                  <th className="px-4 py-3">Comprobacion</th>
                  <th className="px-4 py-3">Archivo</th>
                  <th className="px-4 py-3">Accion</th>
                </tr>
              </thead>
              <tbody>
                {receivedDocuments.data.map((document) => (
                  <tr className="border-t" key={document.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{document.issuerName ?? "Sin emisor"}</div>
                      <div className="text-xs text-muted-foreground">{document.issuerIdentification ?? "Sin identificacion"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{document.documentDirection === "incoming" ? "Entrante" : "Saliente"}</div>
                      <div className="text-xs text-muted-foreground">{SOURCE_LABELS[document.importSource] ?? document.importSource}</div>
                      {document.linkedSaleNumber ? <div className="text-xs font-semibold">Venta {document.linkedSaleNumber}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs">{document.clave ?? "Sin clave"}</div>
                      <div>{formatAmount(document.totalAmount, document.currencyCode)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{document.xsdValid ? "XSD 4.4 valido" : "Sin validacion XSD"}</div>
                      <div className="text-xs text-muted-foreground">
                        {document.haciendaStatusVerified ? document.haciendaStatus ?? "Verificado" : "Estado Hacienda no verificado"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {document.xmlArtifactId ? (
                        <a className="rounded-md border bg-white px-3 py-2 text-xs font-black" href={`/api/facturacion/recepcion/${document.id}/artefactos/${document.xmlArtifactId}`}>
                          XML
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin archivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {document.documentDirection === "incoming" ? (
                        <div className="flex min-w-56 flex-col gap-2">
                          {document.receiverMessageArtifactId ? (
                            <a className="w-fit rounded-md border bg-white px-3 py-2 text-xs font-black" href={`/api/facturacion/recepcion/${document.id}/artefactos/${document.receiverMessageArtifactId}`}>
                              Descargar mensaje
                            </a>
                          ) : (
                            <form action={prepareReceiverMessageAction} className="flex flex-col gap-2">
                              <input name="receivedDocumentId" type="hidden" value={document.id} />
                              <select className="rounded-md border bg-background px-2 py-2 text-xs" defaultValue="accepted" disabled={Boolean(document.validationErrors.length) || document.xsdValid !== true} name="responseStatus">
                                <option value="accepted">Aceptar</option>
                                <option value="partially_accepted">Aceptar parcial</option>
                                <option value="rejected">Rechazar</option>
                              </select>
                              <input className="rounded-md border bg-background px-2 py-2 text-xs" disabled={Boolean(document.validationErrors.length) || document.xsdValid !== true} name="detail" placeholder="Detalle opcional" />
                              <button className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" disabled={Boolean(document.validationErrors.length) || document.xsdValid !== true} type="submit">
                                Preparar mensaje
                              </button>
                            </form>
                          )}
                          <span className="text-xs text-muted-foreground">Preparar no envia a Hacienda.</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Archivo de venta externa</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState description="Importa el primer XML fiscal externo." title="Sin documentos archivados" />
        )}
      </div>
    </section>
  );
}
