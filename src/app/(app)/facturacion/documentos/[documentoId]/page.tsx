import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import {
  generateFiscalPdfRepresentationAction,
  generateFiscalDocumentXmlAction,
  issueFiscalDocumentNowAction,
  queryFiscalDocumentHaciendaStatusAction,
  registerFiscalDocumentDeliveryAction,
  sendFiscalDocumentToHaciendaAction,
  signFiscalDocumentXmlAction,
} from "@/modules/billing/actions";
import { canUseBilling } from "@/modules/billing/guards";
import {
  getFiscalDocumentArtifacts,
  getFiscalDocumentDetail,
} from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type FiscalDocumentDetailPageProps = {
  params: Promise<{ documentoId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function FiscalDocumentDetailPage({
  params,
  searchParams,
}: FiscalDocumentDetailPageProps) {
  const defaultSearchParams: { error?: string; success?: string } = {};
  const [{ documentoId }, access, query] = await Promise.all([
    params,
    requireAdminAccess(),
    searchParams ?? Promise.resolve(defaultSearchParams),
  ]);

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  const [document, artifacts] = await Promise.all([
    getFiscalDocumentDetail(access.tenant, documentoId),
    getFiscalDocumentArtifacts(access.tenant, documentoId),
  ]);

  if (!document.ok || !document.data) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No se encontro el documento fiscal en la empresa actual."
          eyebrow="Documento fiscal"
          title="Documento no encontrado"
        />
        <EmptyState
          description="Verifica que la migracion fiscal este aplicada y que el documento pertenezca a tu empresa."
          title="Sin documento fiscal"
        />
      </section>
    );
  }

  const fiscalDocument = document.data;
  const canGenerateXml =
    hasAnyPermission(access.tenant.permissions, ["billing.issue", "billing.invoices.create"]) &&
    fiscalDocument.status === "validated" &&
    !fiscalDocument.xmlUnsignedStoragePath;
  const canSignXml =
    hasAnyPermission(access.tenant.permissions, ["billing.issue", "billing.invoices.create"]) &&
    fiscalDocument.status === "xml_generated" &&
    Boolean(fiscalDocument.xmlUnsignedStoragePath);
  const canSendToHacienda =
    hasAnyPermission(access.tenant.permissions, ["billing.issue", "billing.invoices.create"]) &&
    fiscalDocument.status === "signed";
  const canQueryHacienda =
    hasAnyPermission(access.tenant.permissions, ["billing.issue", "billing.invoices.create"]) &&
    (["sent", "processing"].includes(fiscalDocument.status) ||
      ["recibido", "procesando"].includes(fiscalDocument.haciendaStatus));
  const canGenerateRepresentation =
    hasAnyPermission(access.tenant.permissions, [
      "billing.issue",
      "billing.invoices.create",
      "billing.view",
      "billing.invoices.view",
    ]) &&
    Boolean(fiscalDocument.clave) &&
    Boolean(fiscalDocument.consecutivo);
  const canRegisterDelivery = hasAnyPermission(access.tenant.permissions, [
    "billing.issue",
    "billing.invoices.create",
    "billing.view",
    "billing.invoices.view",
  ]);
  const canIssueNow =
    hasAnyPermission(access.tenant.permissions, ["billing.issue", "billing.invoices.create"]) &&
    [
      "validated",
      "xml_generated",
      "signed",
      "sent",
      "processing",
    ].includes(fiscalDocument.status);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Detalle fiscal protegido. Las acciones se habilitan por estado cuando XML, firma y Hacienda esten conectados."
        eyebrow="Documento fiscal"
        title={`Documento ${fiscalDocument.consecutivo ?? fiscalDocument.id}`}
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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Estado</p>
          <p className="mt-2 font-black">{fiscalDocument.status}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Hacienda</p>
          <p className="mt-2 font-black">{fiscalDocument.haciendaStatus}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Tipo</p>
          <p className="mt-2 font-black">{fiscalDocument.documentTypeCode}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Receptor</p>
          <p className="mt-2 font-black">{fiscalDocument.receiverName ?? "Sin receptor"}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-black">Emision fiscal inmediata</h2>
            <p className="text-sm text-muted-foreground">
              Ejecuta la cadena disponible: validacion, XML, firma, envio y consulta. Se detiene
              con error explicito si falta firma XAdES o cliente Hacienda real.
            </p>
          </div>
          <form action={issueFiscalDocumentNowAction}>
            <input name="documentId" type="hidden" value={fiscalDocument.id} />
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canIssueNow}
              type="submit"
            >
              Emitir ahora
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-black">XML sin firmar</h2>
            <p className="text-sm text-muted-foreground">
              {fiscalDocument.xmlUnsignedStoragePath
                ? `Artefacto interno: ${fiscalDocument.xmlUnsignedStoragePath}`
                : "Pendiente. Requiere documento validado, clave numerica y consecutivo fiscal."}
            </p>
          </div>
          <form action={generateFiscalDocumentXmlAction}>
            <input name="documentId" type="hidden" value={fiscalDocument.id} />
            <button
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canGenerateXml}
              type="submit"
            >
              Generar XML
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black">Firma XAdES-EPES</h2>
              <p className="text-sm text-muted-foreground">
                Pendiente de firmador real server-side con certificado y PIN protegidos.
              </p>
            </div>
            <form action={signFiscalDocumentXmlAction}>
              <input name="documentId" type="hidden" value={fiscalDocument.id} />
              <button
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!canSignXml}
                type="submit"
              >
                Firmar XML
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-black">Hacienda</h2>
              <p className="text-sm text-muted-foreground">
                El envio se habilita solo despues de una firma XML real. La aceptacion o rechazo
                requiere consulta oficial posterior.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={sendFiscalDocumentToHaciendaAction}>
                <input name="documentId" type="hidden" value={fiscalDocument.id} />
                <button
                  className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!canSendToHacienda}
                  type="submit"
                >
                  Enviar
                </button>
              </form>
              <form action={queryFiscalDocumentHaciendaStatusAction}>
                <input name="documentId" type="hidden" value={fiscalDocument.id} />
                <button
                  className="rounded-md border bg-white px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={!canQueryHacienda}
                  type="submit"
                >
                  Consultar estado
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-black">Representacion grafica</h2>
              <p className="text-sm text-muted-foreground">
                Genera un HTML imprimible archivado. No sustituye el XML firmado y aceptado.
              </p>
            </div>
            <form action={generateFiscalPdfRepresentationAction}>
              <input name="documentId" type="hidden" value={fiscalDocument.id} />
              <button
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!canGenerateRepresentation}
                type="submit"
              >
                Archivar
              </button>
            </form>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-black">Entrega documental</h2>
              <p className="text-sm text-muted-foreground">
                Registra descarga o entrega manual. El correo automatico fiscal aun no envia adjuntos.
              </p>
            </div>
            <form action={registerFiscalDocumentDeliveryAction} className="flex flex-col gap-2 md:flex-row">
              <input name="documentId" type="hidden" value={fiscalDocument.id} />
              <input
                className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue={fiscalDocument.receiverEmail ?? ""}
                name="recipientEmail"
                placeholder="correo@cliente.com"
                type="email"
              />
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                defaultValue="manual"
                name="deliveryType"
              >
                <option value="manual">Manual</option>
                <option value="download">Descarga</option>
              </select>
              <button
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!canRegisterDelivery}
                type="submit"
              >
                Registrar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-black">Archivo documental</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Descargas protegidas por sesion, empresa actual, modulo activo y permisos billing.
        </p>
        {artifacts.ok && artifacts.data.length ? (
          <div className="mt-4 grid gap-2">
            {artifacts.data.map((artifact) => (
              <div
                className="flex flex-col gap-2 rounded-md border bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
                key={artifact.id}
              >
                <div>
                  <p className="font-semibold">{artifact.artifactType}</p>
                  <p className="text-xs text-muted-foreground">
                    {artifact.contentMimeType} - {artifact.status}
                    {artifact.sha256 ? ` - ${artifact.sha256.slice(0, 12)}` : ""}
                  </p>
                </div>
                <a
                  className="rounded-md border bg-white px-3 py-2 text-center text-sm font-black"
                  href={`/api/facturacion/documentos/${fiscalDocument.id}/artefactos/${artifact.id}`}
                >
                  Descargar
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Sin artefactos archivados.</p>
        )}
      </div>

      {fiscalDocument.validationErrors.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-black text-amber-950">Errores de validacion</h2>
          <pre className="mt-3 overflow-auto rounded-md bg-white p-3 text-xs text-amber-950">
            {JSON.stringify(fiscalDocument.validationErrors, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-black">Totales</h2>
        <pre className="mt-3 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
          {JSON.stringify(fiscalDocument.totals, null, 2)}
        </pre>
      </div>
    </section>
  );
}
