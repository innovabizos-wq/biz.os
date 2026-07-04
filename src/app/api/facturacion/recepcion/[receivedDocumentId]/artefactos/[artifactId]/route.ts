import { canUseBilling } from "@/modules/billing/guards";
import { getReceivedFiscalDocumentArtifactForDownload } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type ReceivedFiscalArtifactDownloadRouteProps = {
  params: Promise<{ artifactId: string; receivedDocumentId: string }>;
};

function extensionForMimeType(mimeType: string) {
  if (mimeType.includes("xml")) return "xml";
  if (mimeType.includes("html")) return "html";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("json")) return "json";
  return "txt";
}

function filenameForArtifact(artifactType: string, mimeType: string) {
  return `${artifactType}.${extensionForMimeType(mimeType)}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(
  _request: Request,
  { params }: ReceivedFiscalArtifactDownloadRouteProps,
) {
  const [{ artifactId, receivedDocumentId }, access] = await Promise.all([
    params,
    requireAdminAccess(),
  ]);

  if (!canUseBilling(access.tenant)) {
    return new Response("Acceso denegado.", { status: 403 });
  }

  const artifact = await getReceivedFiscalDocumentArtifactForDownload(
    access.tenant,
    receivedDocumentId,
    artifactId,
  );

  if (!artifact.ok || !artifact.data) {
    return new Response("Artefacto no encontrado.", { status: 404 });
  }

  return new Response(artifact.data.contentText, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filenameForArtifact(
        artifact.data.artifactType,
        artifact.data.contentMimeType,
      )}"`,
      "Content-Type": `${artifact.data.contentMimeType}; charset=utf-8`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
